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

  private generateTriggerToken() {
    return 'tw_' + base64Url(crypto.randomBytes(24));
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

  private getBindSecret() {
    return this.configService.getOrThrow('WEBHOOK_BIND_SECRET');
  }

  private hmac(payload: string) {
    return crypto
      .createHmac('sha256', this.getBindSecret())
      .update(payload)
      .digest('hex');
  }

  private base64UrlEncode(input: string) {
    return Buffer.from(input)
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }

  private base64UrlDecode(input: string) {
    const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
    const pad = normalized.length % 4;
    const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  createBindCode(userId: string, hookId: string) {
    const payloadObj = { u: userId, h: hookId, t: Date.now() };
    const payload = this.base64UrlEncode(JSON.stringify(payloadObj));
    const sig = this.hmac(payload);
    return `${payload}.${sig}`;
  }

  verifyBindCode(code: string): { userId: string; hookId: string } | null {
    if (!code) return null;
    const parts = code.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = this.hmac(payload);
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return null;
      }
    } catch {
      return null;
    }

    try {
      const decoded = this.base64UrlDecode(payload);
      const parsed = JSON.parse(decoded) as { u?: string; h?: string };
      if (!parsed?.u || !parsed?.h) return null;
      return { userId: parsed.u, hookId: parsed.h };
    } catch {
      return null;
    }
  }

  buildTradeAlertUrl(hookId: string) {
    const base = this.getApiBaseUrl();
    // legacy
    if (!base) return `/webhook/trade-alert/hook/${hookId}`;
    return `${base}webhook/trade-alert/hook/${hookId}`;
  }

  buildTradingViewTriggerUrl(triggerToken: string) {
    const base = this.getApiBaseUrl();
    if (!base) return `/webhook/trade-alert/${triggerToken}`;
    return `${base}webhook/trade-alert/${triggerToken}`;
  }

  buildTradingViewTriggerUrlForTrade(
    triggerToken: string,
    tradeShortId: string,
  ) {
    const base = this.getApiBaseUrl();
    if (!base) return `/webhook/trade-alert/${triggerToken}/${tradeShortId}`;
    return `${base}webhook/trade-alert/${triggerToken}/${tradeShortId}`;
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

    const triggerToken = this.generateTriggerToken();

    const item: WebhookHook = {
      hookId,
      userId,
      name: name?.trim() || undefined,
      secretHash: this.hashSecret(secret),
      triggerToken,
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
        bindCode: this.createBindCode(userId, hookId),
        triggerUrl: this.buildTradingViewTriggerUrl(triggerToken),
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

  async findActiveHookByTrade(userId: string, transactionId: string) {
    if (!userId || !transactionId) return null;
    // Quota is small (<=5), so a query by user and in-memory filter is acceptable.
    const res = await this.db.query({
      TableName: this.tableName,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      FilterExpression: 'attribute_not_exists(revokedAt)',
      ScanIndexForward: false,
      Limit: 50,
    });

    const items = (res.Items || []) as WebhookHook[];
    return (
      items.find(
        (it) =>
          it.userId === userId &&
          it.tradeTransactionId === transactionId &&
          !it.revokedAt,
      ) || null
    );
  }

  async createHookForTrade(params: {
    userId: string;
    tradeTransactionId: string;
    tradeShortId: string;
    name?: string;
  }): Promise<CreateWebhookHookResult> {
    const { userId, tradeTransactionId, tradeShortId, name } = params;
    if (!userId || !tradeTransactionId || !tradeShortId) {
      throw new ValidationException(
        'missing fields',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '缺少 userId / transactionId / tradeShortId',
      );
    }

    const existing = await this.findActiveHookByTrade(
      userId,
      tradeTransactionId,
    );
    if (existing?.hookId && existing.triggerToken) {
      const { secretHash: _ignoreSecretHash, ...publicHook } = existing;
      void _ignoreSecretHash;
      return {
        hook: publicHook,
        secret: '',
        url: this.buildTradeAlertUrl(existing.hookId),
        bindCode: this.createBindCode(userId, existing.hookId),
        triggerUrl: this.buildTradingViewTriggerUrlForTrade(
          existing.triggerToken,
          tradeShortId,
        ),
      };
    }

    const now = new Date().toISOString();
    const hookId = this.generateHookId();
    const secret = this.generateSecret();
    const triggerToken = this.generateTriggerToken();

    const item: WebhookHook = {
      hookId,
      userId,
      name: name?.trim() || undefined,
      secretHash: this.hashSecret(secret),
      triggerToken,
      tradeTransactionId,
      tradeShortId,
      createdAt: now,
    };

    try {
      await this.db.put({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(hookId)',
      });

      const { secretHash: _ignoreSecretHash, ...publicHook } = item;
      void _ignoreSecretHash;
      return {
        hook: publicHook,
        secret,
        url: this.buildTradeAlertUrl(hookId),
        bindCode: this.createBindCode(userId, hookId),
        triggerUrl: this.buildTradingViewTriggerUrlForTrade(
          triggerToken,
          tradeShortId,
        ),
      };
    } catch (error: any) {
      this.logger.error(
        `createHookForTrade failed: ${error?.message || error}`,
      );
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
        // FilterExpression to hide revoked legacy items (revoked now means deleted)
        FilterExpression: 'attribute_not_exists(revokedAt)',
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
          triggerUrl: publicHook.triggerToken
            ? publicHook.tradeShortId
              ? this.buildTradingViewTriggerUrlForTrade(
                  publicHook.triggerToken,
                  publicHook.tradeShortId,
                )
              : this.buildTradingViewTriggerUrl(publicHook.triggerToken)
            : undefined,
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

      // Treat revoke as delete (hard delete)
      await this.db.delete({
        TableName: this.tableName,
        Key: { hookId },
        ConditionExpression: 'userId = :u',
        ExpressionAttributeValues: { ':u': userId },
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

  async bindHookToChat(input: {
    userId: string;
    hookId: string;
    chatId: number;
    chatType?: string;
    chatTitle?: string;
  }) {
    const now = new Date().toISOString();
    try {
      await this.db.update({
        TableName: this.tableName,
        Key: { hookId: input.hookId },
        ConditionExpression: 'userId = :u AND attribute_not_exists(revokedAt)',
        UpdateExpression:
          'SET chatId = :c, chatType = :ct, chatTitle = :ttl, boundAt = :b',
        ExpressionAttributeValues: {
          ':u': input.userId,
          ':c': input.chatId,
          ':ct': input.chatType || 'unknown',
          ':ttl': input.chatTitle || '',
          ':b': now,
        },
      });
      return { success: true };
    } catch (error: any) {
      this.logger.error(`bindHookToChat failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `bind hook failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '绑定群组失败，请稍后重试',
      );
    }
  }

  async getHook(hookId: string) {
    const res = await this.db.get({
      TableName: this.tableName,
      Key: { hookId },
    });
    return (res.Item as WebhookHook | undefined) ?? null;
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

  async authenticateByTriggerToken(triggerToken: string) {
    if (!triggerToken) return null;

    const res = await this.db.query({
      TableName: this.tableName,
      IndexName: 'triggerToken-index',
      KeyConditionExpression: 'triggerToken = :t',
      FilterExpression: 'attribute_not_exists(revokedAt)',
      ExpressionAttributeValues: { ':t': triggerToken },
      Limit: 1,
    });

    const item = (res.Items?.[0] as WebhookHook | undefined) ?? undefined;
    if (!item) return null;

    return { userId: item.userId, hookId: item.hookId };
  }

  async touchTrigger(hookId: string, nowIso: string, minIntervalSeconds = 60) {
    const minMs = minIntervalSeconds * 1000;
    try {
      const existing = await this.db.get({
        TableName: this.tableName,
        Key: { hookId },
      });
      const item = existing.Item as WebhookHook | undefined;
      if (!item) return { allowed: false, reason: 'hook not found' };
      const last = item.lastTriggeredAt ? Date.parse(item.lastTriggeredAt) : 0;
      const now = Date.parse(nowIso);
      if (last && now - last < minMs) {
        return {
          allowed: false,
          reason: 'rate_limited',
          nextInMs: minMs - (now - last),
        };
      }

      await this.db.update({
        TableName: this.tableName,
        Key: { hookId },
        UpdateExpression: 'SET lastTriggeredAt = :t',
        ExpressionAttributeValues: { ':t': nowIso },
      });

      return { allowed: true };
    } catch (error: any) {
      this.logger.error(`touchTrigger failed: ${error?.message || error}`);
      return { allowed: false, reason: 'touch_failed' };
    }
  }

  async countActiveHooks(userId: string): Promise<number> {
    const res = await this.db.query({
      TableName: this.tableName,
      IndexName: 'userId-createdAt-index',
      KeyConditionExpression: 'userId = :u',
      ExpressionAttributeValues: { ':u': userId },
      FilterExpression: 'attribute_not_exists(revokedAt)',
      Select: 'COUNT',
    });
    return res.Count ?? 0;
  }
}
