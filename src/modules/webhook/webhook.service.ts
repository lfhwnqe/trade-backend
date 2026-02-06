import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../common/config.service';
import {
  DynamoDBException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { CreateWebhookHookResult, WebhookHook } from './webhook.types';

function base64Url(buf: Buffer) {
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow('WEBHOOK_HOOKS_TABLE_NAME');
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
  }

  private hashSecret(secret: string) {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private generateHookId() {
    // short + url-safe
    return base64Url(crypto.randomBytes(18));
  }

  private generateSecret() {
    return base64Url(crypto.randomBytes(32));
  }

  private getApiBaseUrl() {
    // optional, used to build full url to show to user
    const base = this.configService.get('API_ENDPOINT_URL');
    if (!base) return '';
    return base.endsWith('/') ? base : base + '/';
  }

  buildTradeAlertUrl(hookId: string) {
    const base = this.getApiBaseUrl();
    if (!base) return `/webhook/trade-alert/${hookId}`;
    return `${base}webhook/trade-alert/${hookId}`;
  }

  async createHook(
    userId: string,
    name?: string,
  ): Promise<CreateWebhookHookResult> {
    if (!userId) {
      throw new ValidationException(
        'userId required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '用户信息异常',
      );
    }

    const now = new Date().toISOString();
    const hookId = this.generateHookId();
    const secret = this.generateSecret();

    const item: WebhookHook = {
      hookId,
      userId,
      name: name?.trim() || undefined,
      secretHash: this.hashSecret(secret),
      createdAt: now,
    };

    try {
      await this.db.put({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(hookId)',
      });

      // do not return secretHash
      const { secretHash: _ignoreSecretHash, ...publicHook } = item;
      void _ignoreSecretHash;
      return {
        hook: publicHook,
        secret,
        url: this.buildTradeAlertUrl(hookId),
      };
    } catch (error: any) {
      this.logger.error(`createHook failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `create hook failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '创建 webhook 失败，请稍后重试',
      );
    }
  }

  async listHooks(userId: string, limit = 20, cursor?: any) {
    try {
      const res = await this.db.query({
        TableName: this.tableName,
        IndexName: 'userId-createdAt-index',
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: cursor,
      });

      const items = (res.Items || []).map((it) => {
        const hook = it as WebhookHook;
        // do not return secretHash
        const { secretHash: _ignoreSecretHash, ...publicHook } = hook;
        void _ignoreSecretHash;
        return {
          ...publicHook,
          url: this.buildTradeAlertUrl(publicHook.hookId),
        };
      });

      return {
        success: true,
        data: {
          items,
          nextCursor: res.LastEvaluatedKey
            ? base64Url(Buffer.from(JSON.stringify(res.LastEvaluatedKey)))
            : undefined,
        },
      };
    } catch (error: any) {
      this.logger.error(`listHooks failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `list hooks failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '获取 webhook 列表失败，请稍后重试',
      );
    }
  }

  decodeCursor(cursor?: string) {
    if (!cursor) return undefined;
    try {
      const normalized = cursor.replaceAll('-', '+').replaceAll('_', '/');
      const pad = normalized.length % 4;
      const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
      const json = Buffer.from(padded, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }

  async revokeHook(userId: string, hookId: string) {
    const now = new Date().toISOString();
    try {
      // Ensure belongs to user
      const existing = await this.db.get({
        TableName: this.tableName,
        Key: { hookId },
      });
      const item = existing.Item as WebhookHook | undefined;
      if (!item || item.userId !== userId) {
        throw new ValidationException(
          'hook not found',
          ERROR_CODES.RESOURCE_NOT_FOUND,
          'hook 不存在',
        );
      }

      await this.db.update({
        TableName: this.tableName,
        Key: { hookId },
        UpdateExpression: 'SET revokedAt = :r',
        ExpressionAttributeValues: { ':r': now },
      });

      return { success: true };
    } catch (error: any) {
      if (error instanceof ValidationException) throw error;
      this.logger.error(`revokeHook failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `revoke hook failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '撤销 webhook 失败，请稍后重试',
      );
    }
  }

  async authenticateHook(hookId: string, secret: string) {
    if (!hookId || !secret) return null;
    const res = await this.db.get({
      TableName: this.tableName,
      Key: { hookId },
    });
    const item = res.Item as WebhookHook | undefined;
    if (!item || item.revokedAt) return null;

    const provided = this.hashSecret(secret);
    try {
      const ok = crypto.timingSafeEqual(
        Buffer.from(provided),
        Buffer.from(item.secretHash),
      );
      if (!ok) return null;
    } catch {
      return null;
    }

    return { userId: item.userId, hookId: item.hookId };
  }
}
