import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import crypto from 'node:crypto';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../common/config.service';
import {
  DynamoDBException,
  ValidationException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { TelegramBinding } from './telegram.types';
import { WebhookService } from '../webhook/webhook.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WebhookService))
    private readonly webhookService: WebhookService,
  ) {
    const region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow(
      'TELEGRAM_BINDINGS_TABLE_NAME',
    );
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
  }

  getBotToken() {
    return this.configService.getOrThrow('TELEGRAM_BOT_TOKEN');
  }

  getBindSecret() {
    return this.configService.getOrThrow('TELEGRAM_BIND_SECRET');
  }

  getWebhookSecret() {
    return this.configService.getOrThrow('TELEGRAM_WEBHOOK_SECRET');
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

  private hmac(payload: string) {
    return crypto
      .createHmac('sha256', this.getBindSecret())
      .update(payload)
      .digest('hex');
  }

  createBindPayload(userId: string) {
    if (!userId) {
      throw new ValidationException(
        'userId is required',
        ERROR_CODES.VALIDATION_REQUIRED_FIELD,
        '用户信息异常',
      );
    }

    const now = Date.now();
    const payloadObj = { u: userId, t: now };
    const payload = this.base64UrlEncode(JSON.stringify(payloadObj));
    const sig = this.hmac(payload);
    return `${payload}.${sig}`;
  }

  verifyBindPayload(startParam: string) {
    if (!startParam) return null;
    const parts = startParam.split('.');
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
      const parsed = JSON.parse(decoded) as { u?: string; t?: number };
      if (!parsed?.u) return null;
      return { userId: parsed.u, ts: parsed.t };
    } catch {
      return null;
    }
  }

  verifyHookBindCode(code: string) {
    return this.webhookService.verifyBindCode(code);
  }

  async bindHookToChat(input: {
    userId: string;
    hookId: string;
    chatId: number;
    chatType?: string;
    chatTitle?: string;
  }) {
    return this.webhookService.bindHookToChat(input);
  }

  async upsertBinding(input: {
    userId: string;
    chatId: number;
    telegramUserId?: number;
    telegramUsername?: string;
  }) {
    const now = new Date().toISOString();
    const item: TelegramBinding = {
      userId: input.userId,
      chatId: input.chatId,
      telegramUserId: input.telegramUserId,
      telegramUsername: input.telegramUsername,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Keep createdAt if exists
      const old = await this.db.get({
        TableName: this.tableName,
        Key: { userId: input.userId },
      });
      if (old.Item?.createdAt) {
        item.createdAt = old.Item.createdAt;
      }

      await this.db.put({ TableName: this.tableName, Item: item });
      return { success: true, data: item };
    } catch (error: any) {
      this.logger.error(`upsertBinding failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `Telegram binding failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '绑定 telegram 失败，请稍后重试',
      );
    }
  }

  async getBinding(userId: string) {
    try {
      const res = await this.db.get({
        TableName: this.tableName,
        Key: { userId },
      });
      return {
        success: true,
        data: (res.Item as TelegramBinding | undefined) ?? null,
      };
    } catch (error: any) {
      this.logger.error(`getBinding failed: ${error?.message || error}`);
      throw new DynamoDBException(
        `Telegram binding lookup failed: ${error.message}`,
        ERROR_CODES.DYNAMODB_OPERATION_FAILED,
        '获取 telegram 绑定失败，请稍后重试',
      );
    }
  }

  async sendMessage(chatId: number, text: string) {
    const token = this.getBotToken();
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new DynamoDBException(
        `Telegram sendMessage failed: ${resp.status} ${body}`,
        ERROR_CODES.SYSTEM_SERVICE_UNAVAILABLE,
        '发送 telegram 消息失败',
      );
    }

    return resp.json();
  }
}
