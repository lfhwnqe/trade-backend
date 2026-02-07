import { Injectable, Logger } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import crypto from 'node:crypto';
import { ConfigService } from '../../common/config.service';
import {
  BinanceFuturesApiKeyRecord,
  BinanceFuturesFillRecord,
} from './binance-futures.types';
import { decryptText, encryptText } from './binance-futures.crypto';
import {
  AuthorizationException,
  ResourceNotFoundException,
  ValidationException,
} from '../../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../../base/constants/error-codes';

const BINANCE_FAPI_BASE = 'https://fapi.binance.com';

@Injectable()
export class BinanceFuturesService {
  private readonly logger = new Logger(BinanceFuturesService.name);
  private readonly db: DynamoDBDocument;
  private readonly keysTableName: string;
  private readonly fillsTableName: string;
  private readonly encSecret: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.getOrThrow('AWS_REGION');
    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });

    this.keysTableName = this.configService.getOrThrow(
      'BINANCE_FUTURES_KEYS_TABLE_NAME',
    );
    this.fillsTableName = this.configService.getOrThrow(
      'BINANCE_FUTURES_FILLS_TABLE_NAME',
    );
    this.encSecret = this.configService.getOrThrow('EXCHANGE_KEY_ENC_SECRET');
  }

  async upsertApiKey(userId: string, apiKey: string, apiSecret: string) {
    const now = new Date().toISOString();
    const secretEnc = encryptText(apiSecret, this.encSecret);

    const record: BinanceFuturesApiKeyRecord = {
      userId,
      apiKey,
      secretEnc,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.keysTableName,
      Item: record,
    });

    return { success: true, message: '保存成功' };
  }

  async getApiKeyStatus(userId: string) {
    const res = await this.db.get({
      TableName: this.keysTableName,
      Key: { userId },
    });
    const item = res.Item as BinanceFuturesApiKeyRecord | undefined;
    return {
      success: true,
      data: {
        configured: Boolean(item?.apiKey && item?.secretEnc),
        apiKeyTail: item?.apiKey ? item.apiKey.slice(-6) : null,
        updatedAt: item?.updatedAt || null,
      },
    };
  }

  async deleteApiKey(userId: string) {
    await this.db.delete({
      TableName: this.keysTableName,
      Key: { userId },
    });
    return { success: true, message: '删除成功' };
  }

  private async getApiKey(userId: string) {
    const res = await this.db.get({
      TableName: this.keysTableName,
      Key: { userId },
    });
    const item = res.Item as BinanceFuturesApiKeyRecord | undefined;
    if (!item?.apiKey || !item?.secretEnc) {
      throw new ResourceNotFoundException(
        'Binance futures api key not configured',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '请先配置 Binance API Key/Secret',
      );
    }

    let apiSecret = '';
    try {
      apiSecret = decryptText(item.secretEnc, this.encSecret);
    } catch (e) {
      this.logger.error('Failed to decrypt api secret', e);
      throw new AuthorizationException(
        'Cannot decrypt exchange secret',
        ERROR_CODES.AUTH_UNAUTHORIZED,
        '密钥解密失败，请重新配置',
      );
    }

    return { apiKey: item.apiKey, apiSecret };
  }

  private signQuery(queryString: string, apiSecret: string) {
    return crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async binanceFetch(
    path: string,
    params: Record<string, string>,
    apiKey: string,
    apiSecret: string,
  ) {
    const searchParams = new URLSearchParams(params);
    const queryString = searchParams.toString();
    const signature = this.signQuery(queryString, apiSecret);
    const url = `${BINANCE_FAPI_BASE}${path}?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new ValidationException(
        `Binance API error: ${res.status} ${text}`,
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        'Binance API 调用失败',
        { status: res.status, body: text },
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private normalizeFill(userId: string, raw: any): BinanceFuturesFillRecord {
    const importedAt = new Date().toISOString();
    return {
      userId,
      tradeId: String(raw?.id ?? raw?.tradeId ?? ''),
      symbol: String(raw?.symbol ?? ''),
      time: Number(raw?.time ?? raw?.timestamp ?? 0),
      side: raw?.side,
      positionSide: raw?.positionSide,
      price: raw?.price,
      qty: raw?.qty,
      realizedPnl: raw?.realizedPnl,
      commission: raw?.commission,
      commissionAsset: raw?.commissionAsset,
      orderId: raw?.orderId ? String(raw.orderId) : undefined,
      raw,
      importedAt,
    };
  }

  private async saveFill(fill: BinanceFuturesFillRecord) {
    // PK+SK model: userId + tradeKey
    const tradeKey = `${fill.symbol}#${fill.tradeId}`;

    await this.db.put({
      TableName: this.fillsTableName,
      Item: {
        ...fill,
        tradeKey,
      },
      ConditionExpression:
        'attribute_not_exists(userId) AND attribute_not_exists(tradeKey)',
    });
  }

  async importLastYearFills(userId: string, symbols?: string[]) {
    const { apiKey, apiSecret } = await this.getApiKey(userId);

    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const overallStart = now - oneYearMs;

    // Binance 限制：最大时间窗口 7 天（见 -4165）
    const maxWindowMs = 7 * 24 * 60 * 60 * 1000;

    const attemptNoSymbol = !symbols || symbols.length === 0;

    const imported: BinanceFuturesFillRecord[] = [];
    const skipped: number[] = [];

    const importFromPayload = async (payload: any) => {
      if (!Array.isArray(payload)) {
        return { count: 0, lastTime: null as number | null };
      }
      let count = 0;
      let lastTime: number | null = null;

      for (const raw of payload) {
        const fill = this.normalizeFill(userId, raw);
        if (!fill.tradeId || !fill.symbol || !fill.time) continue;
        try {
          await this.saveFill(fill);
          imported.push(fill);
          count += 1;
        } catch (e: any) {
          // ConditionalCheckFailedException means duplicate
          if (String(e?.name || '').includes('ConditionalCheckFailed')) {
            skipped.push(Number(fill.tradeId));
          } else if (
            String(e?.message || '').includes('ConditionalCheckFailed')
          ) {
            skipped.push(Number(fill.tradeId));
          } else {
            throw e;
          }
        }

        if (typeof fill.time === 'number' && Number.isFinite(fill.time)) {
          if (lastTime === null || fill.time > lastTime) lastTime = fill.time;
        }
      }

      return { count, lastTime };
    };

    const fetchWindowAll = async (startTime: number, endTime: number) => {
      // paginate inside a window by moving startTime forward based on last fill time
      let cursor = startTime;
      let total = 0;

      while (cursor < endTime) {
        const payload = await this.binanceFetch(
          '/fapi/v1/userTrades',
          {
            recvWindow: '5000',
            startTime: String(cursor),
            endTime: String(endTime),
            limit: '1000',
            timestamp: String(Date.now()),
          },
          apiKey,
          apiSecret,
        );

        const { count, lastTime } = await importFromPayload(payload);
        total += count;

        if (!Array.isArray(payload) || payload.length === 0) break;
        if (lastTime === null) break;

        // Move cursor forward to avoid infinite loop on same timestamp
        const nextCursor = lastTime + 1;
        if (nextCursor <= cursor) break;
        cursor = nextCursor;

        // If returned less than limit, likely no more within window
        if (payload.length < 1000) break;
      }

      return total;
    };

    const fetchWindowBySymbol = async (
      symbol: string,
      startTime: number,
      endTime: number,
    ) => {
      let cursor = startTime;
      let total = 0;

      while (cursor < endTime) {
        const payload = await this.binanceFetch(
          '/fapi/v1/userTrades',
          {
            symbol,
            recvWindow: '5000',
            startTime: String(cursor),
            endTime: String(endTime),
            limit: '1000',
            timestamp: String(Date.now()),
          },
          apiKey,
          apiSecret,
        );

        const { count, lastTime } = await importFromPayload(payload);
        total += count;

        if (!Array.isArray(payload) || payload.length === 0) break;
        if (lastTime === null) break;

        const nextCursor = lastTime + 1;
        if (nextCursor <= cursor) break;
        cursor = nextCursor;

        if (payload.length < 1000) break;
      }

      return total;
    };

    // Iterate over 7-day windows for last 1 year
    for (let windowStart = overallStart; windowStart < now; ) {
      const windowEnd = Math.min(windowStart + maxWindowMs, now);

      if (attemptNoSymbol) {
        try {
          await fetchWindowAll(windowStart, windowEnd);
        } catch (e: any) {
          // If Binance requires symbol, ask caller to provide symbols
          const msg = String(e?.message || '');
          if (msg.includes('symbol') || msg.includes('Mandatory parameter')) {
            throw new ValidationException(
              'Binance requires symbol parameter; please provide symbols',
              ERROR_CODES.VALIDATION_INVALID_VALUE,
              'Binance 要求提供 symbol，请在导入时指定 symbols（如 BTCUSDT/ETHUSDT）',
            );
          }
          throw e;
        }
      } else {
        if (symbols.length > 50) {
          throw new ValidationException(
            'Too many symbols',
            ERROR_CODES.VALIDATION_INVALID_VALUE,
            'symbols 最多支持 50 个',
          );
        }

        for (const symbol of symbols) {
          await fetchWindowBySymbol(symbol, windowStart, windowEnd);
        }
      }

      // next window
      windowStart = windowEnd;
    }

    return {
      success: true,
      data: {
        importedCount: imported.length,
        skippedCount: skipped.length,
        range: {
          fromMs: overallStart,
          toMs: now,
        },
      },
    };
  }
}
