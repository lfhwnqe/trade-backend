import { Injectable, Logger } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from './config.service';
import {
  DynamoDBException,
  ResourceNotFoundException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import {
  ApiTokenPublic,
  ApiTokenRecord,
  ApiTokenScope,
} from './api-token.types';

@Injectable()
export class ApiTokenService {
  private readonly logger = new Logger(ApiTokenService.name);
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;
  private readonly userIdCreatedAtIndexName = 'userId-createdAt-index';

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow('API_TOKENS_TABLE_NAME');
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
  }

  private sha256Base64Url(input: string) {
    const buf = crypto.createHash('sha256').update(input).digest();
    // base64url
    return buf
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }

  private generateTokenSecret() {
    // 32 bytes random => 43 chars base64url-ish
    const buf = crypto.randomBytes(32);
    const secret = buf
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
    return `tc_${secret}`;
  }

  async createToken(userId: string, name?: string) {
    if (!userId) {
      throw new ValidationException(
        'userId is required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '用户信息异常',
      );
    }

    const token = this.generateTokenSecret();
    const tokenHash = this.sha256Base64Url(token);
    const now = new Date().toISOString();

    const scopes: ApiTokenScope[] = ['trade:read', 'trade:write'];

    const record: ApiTokenRecord = {
      tokenId: uuidv4(),
      tokenHash,
      userId,
      name: name?.trim() || undefined,
      scopes,
      createdAt: now,
    };

    try {
      await this.db.put({
        TableName: this.tableName,
        Item: record,
        // prevent extremely unlikely collisions
        ConditionExpression: 'attribute_not_exists(tokenHash)',
      });

      const publicRecord: ApiTokenPublic = {
        tokenId: record.tokenId,
        userId: record.userId,
        name: record.name,
        scopes: record.scopes,
        createdAt: record.createdAt,
        revokedAt: record.revokedAt,
        lastUsedAt: record.lastUsedAt,
      };

      return {
        success: true,
        data: {
          token,
          tokenInfo: publicRecord,
        },
      };
    } catch (error: any) {
      this.logger.error(`createToken failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `Token create failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '创建 token 失败，请稍后重试',
      );
    }
  }

  private encodeCursor(key: Record<string, any> | undefined) {
    if (!key) return undefined;
    const json = JSON.stringify(key);
    return Buffer.from(json)
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) return undefined;
    try {
      const normalized = cursor.replaceAll('-', '+').replaceAll('_', '/');
      const pad = normalized.length % 4;
      const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
      const json = Buffer.from(padded, 'base64').toString('utf8');
      return JSON.parse(json) as Record<string, any>;
    } catch {
      return undefined;
    }
  }

  async listTokens(
    userId: string,
    options?: { limit?: number; cursor?: string },
  ) {
    try {
      const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
      const startKey = this.decodeCursor(options?.cursor);

      const res = await this.db.query({
        TableName: this.tableName,
        IndexName: this.userIdCreatedAtIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false,
        ExclusiveStartKey: startKey,
        Limit: limit,
      });

      const items = ((res.Items || []) as ApiTokenRecord[]).map((item) => ({
        tokenId: item.tokenId,
        userId: item.userId,
        name: item.name,
        scopes: item.scopes,
        createdAt: item.createdAt,
        revokedAt: item.revokedAt,
        lastUsedAt: item.lastUsedAt,
      }));

      const nextCursor = this.encodeCursor(res.LastEvaluatedKey);

      return {
        success: true,
        data: {
          items,
          nextCursor,
        },
      };
    } catch (error: any) {
      this.logger.error(`listTokens failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `Token list failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '获取 token 列表失败，请稍后重试',
      );
    }
  }

  async revokeToken(userId: string, tokenId: string) {
    if (!tokenId) {
      throw new ValidationException(
        'tokenId is required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        'tokenId 不能为空',
      );
    }

    // We store by tokenHash PK, so we first find by userId GSI and tokenId.
    const list = await this.listTokensRaw(userId);
    const target = list.find((t) => t.tokenId === tokenId);
    if (!target) {
      throw new ResourceNotFoundException(
        `token not found: tokenId=${tokenId}`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'token 不存在',
      );
    }

    const now = new Date().toISOString();
    try {
      await this.db.update({
        TableName: this.tableName,
        Key: { tokenHash: target.tokenHash },
        UpdateExpression: 'SET revokedAt = :revokedAt',
        ExpressionAttributeValues: { ':revokedAt': now },
      });
      return { success: true, message: '撤销成功' };
    } catch (error: any) {
      this.logger.error(`revokeToken failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `Token revoke failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '撤销 token 失败，请稍后重试',
      );
    }
  }

  private async listTokensRaw(userId: string) {
    const items: ApiTokenRecord[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const res = await this.db.query({
        TableName: this.tableName,
        IndexName: this.userIdCreatedAtIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastKey,
      });

      items.push(...((res.Items || []) as ApiTokenRecord[]));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  async authenticateToken(token: string) {
    if (!token || typeof token !== 'string') return null;
    if (!token.startsWith('tc_')) return null;

    const tokenHash = this.sha256Base64Url(token);

    try {
      const res = await this.db.get({
        TableName: this.tableName,
        Key: { tokenHash },
      });

      const item = res.Item as ApiTokenRecord | undefined;
      if (!item) return null;
      if (item.revokedAt) return null;

      // best-effort lastUsedAt update
      const now = new Date().toISOString();
      this.db
        .update({
          TableName: this.tableName,
          Key: { tokenHash },
          UpdateExpression: 'SET lastUsedAt = :lastUsedAt',
          ExpressionAttributeValues: { ':lastUsedAt': now },
        })
        .catch(() => undefined);

      return {
        userId: item.userId,
        tokenId: item.tokenId,
        scopes: item.scopes,
      };
    } catch (error: any) {
      // Do not leak tokenHash/token.
      this.logger.warn(`authenticateToken failed: ${error?.message || error}`);
      return null;
    }
  }
}
