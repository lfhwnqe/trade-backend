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
import { buildClosedPositionsV2 } from './binance-futures.aggregator.v2';
import { BinanceFuturesClosedPosition } from './binance-futures.positions';
import {
  AuthorizationException,
  ResourceNotFoundException,
  ValidationException,
} from '../../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../../base/constants/error-codes';

const BINANCE_FAPI_BASE = 'https://fapi.binance.com'; // USDⓈ-M (USDT/USDC perpetual)
const BINANCE_DAPI_BASE = 'https://dapi.binance.com'; // COIN-M (coin-margined)

@Injectable()
export class BinanceFuturesService {
  private readonly logger = new Logger(BinanceFuturesService.name);
  private readonly db: DynamoDBDocument;
  private readonly keysTableName: string;
  private readonly fillsTableName: string;
  private readonly positionsTableName: string;
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
    this.positionsTableName = this.configService.getOrThrow(
      'BINANCE_FUTURES_POSITIONS_TABLE_NAME',
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
    baseUrl: string,
    path: string,
    params: Record<string, string>,
    apiKey: string,
    apiSecret: string,
  ) {
    const searchParams = new URLSearchParams(params);
    const queryString = searchParams.toString();
    const signature = this.signQuery(queryString, apiSecret);
    const url = `${baseUrl}${path}?${queryString}&signature=${signature}`;

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

    // Normalize side for different Binance payload variants
    const side =
      raw?.side ||
      (raw?.buyer === true ? 'BUY' : raw?.buyer === false ? 'SELL' : undefined);

    return {
      userId,
      tradeId: String(raw?.id ?? raw?.tradeId ?? ''),
      symbol: String(raw?.symbol ?? ''),
      time: Number(raw?.time ?? raw?.timestamp ?? 0),
      side,
      positionSide: raw?.positionSide,
      price: raw?.price,
      qty: raw?.qty ?? raw?.executedQty,
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

  private encodeNextToken(key: any) {
    if (!key) return null;
    return Buffer.from(JSON.stringify(key), 'utf8').toString('base64');
  }

  private decodeNextToken(token?: string) {
    if (!token) return undefined;
    try {
      const json = Buffer.from(token, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch {
      return undefined;
    }
  }

  async listFills(userId: string, pageSize = 50, nextToken?: string) {
    const ExclusiveStartKey = this.decodeNextToken(nextToken);

    const res = await this.db.query({
      TableName: this.fillsTableName,
      IndexName: 'userId-time-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      Limit: Math.min(Math.max(pageSize, 1), 200),
      ScanIndexForward: false,
      ExclusiveStartKey,
    });

    return {
      success: true,
      data: {
        items: (res.Items || []) as BinanceFuturesFillRecord[],
        nextToken: this.encodeNextToken(res.LastEvaluatedKey),
      },
    };
  }

  async convertFillsToTrades(userId: string, tradeKeys: string[]) {
    if (!tradeKeys || tradeKeys.length === 0) {
      return { success: true, data: { createdCount: 0 } };
    }

    const uniqueKeys = Array.from(new Set(tradeKeys)).slice(0, 100);

    const keys = uniqueKeys.map((tradeKey) => ({ userId, tradeKey }));

    const batch = await this.db.batchGet({
      RequestItems: {
        [this.fillsTableName]: {
          Keys: keys,
        },
      },
    });

    const fills =
      (batch.Responses?.[this.fillsTableName] as BinanceFuturesFillRecord[]) ||
      [];

    const transactionsTable = this.configService.getOrThrow(
      'TRANSACTIONS_TABLE_NAME',
    );

    const { v4: uuidv4 } = await import('uuid');
    const {
      TradeType,
      TradeStatus,
      EntryDirection,
      TradeResult,
      MarketStructure,
    } = await import('../../trade/dto/create-trade.dto');

    const createdAt = new Date().toISOString();

    let createdCount = 0;

    for (const fill of fills) {
      const transactionId = uuidv4();
      const timeMs = Number(fill.time);
      const timeIso = Number.isFinite(timeMs)
        ? new Date(timeMs).toISOString()
        : createdAt;

      const realized = Number(fill.realizedPnl ?? 0);
      const tradeResult =
        realized > 0
          ? TradeResult.PROFIT
          : realized < 0
            ? TradeResult.LOSS
            : TradeResult.BREAKEVEN;

      const dir =
        String(fill.positionSide || '').toUpperCase() === 'SHORT'
          ? EntryDirection.SHORT
          : EntryDirection.LONG;

      const entryPrice = Number(fill.price ?? 0);

      const trade = {
        transactionId,
        userId,
        status: TradeStatus.EXITED,
        tradeType: TradeType.REAL,
        tradeSubject: fill.symbol || 'UNKNOWN',
        analysisTime: timeIso,
        analysisPeriod: '1小时',
        marketStructure: MarketStructure.UNSEEN,
        marketStructureAnalysis: 'Binance futures auto-import (fills)',
        entryPlanA: {
          entryReason: '自动导入（币安合约成交）',
          entrySignal: '',
          exitSignal: '',
        },
        entryDirection: dir,
        entryTime: timeIso,
        entryPrice: Number.isFinite(entryPrice) ? entryPrice : undefined,
        exitTime: timeIso,
        profitLossPercentage: 0,
        tradeResult,
        remarks: JSON.stringify(
          {
            source: 'binance-futures',
            tradeKey: fill.tradeKey || `${fill.symbol}#${fill.tradeId}`,
            tradeId: fill.tradeId,
            symbol: fill.symbol,
            time: fill.time,
            side: fill.side,
            positionSide: fill.positionSide,
            price: fill.price,
            qty: fill.qty,
            realizedPnl: fill.realizedPnl,
            commission: fill.commission,
            commissionAsset: fill.commissionAsset,
            orderId: fill.orderId,
          },
          null,
          2,
        ),
        createdAt,
        updatedAt: createdAt,
      };

      if (!trade.tradeSubject || trade.tradeSubject === 'UNKNOWN') continue;

      await this.db.put({
        TableName: transactionsTable,
        Item: trade,
      });
      createdCount += 1;
    }

    return {
      success: true,
      data: { createdCount },
    };
  }

  async importFills(
    userId: string,
    symbols?: string[],
    range?: '7d' | '30d' | '1y',
    market?: 'usdtm' | 'coinm',
  ) {
    const resolvedMarket = market || 'usdtm';
    const baseUrl =
      resolvedMarket === 'coinm' ? BINANCE_DAPI_BASE : BINANCE_FAPI_BASE;
    const userTradesPath =
      resolvedMarket === 'coinm'
        ? '/dapi/v1/userTrades'
        : '/fapi/v1/userTrades';
    const { apiKey, apiSecret } = await this.getApiKey(userId);

    const now = Date.now();
    const rangeMs =
      range === '1y'
        ? 365 * 24 * 60 * 60 * 1000
        : range === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const overallStart = now - rangeMs;

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
          baseUrl,
          userTradesPath,
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
          baseUrl,
          userTradesPath,
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

    // Iterate over 7-day windows within selected range
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

    // NOTE: Do NOT rebuild positions here; keep import fast.
    // User can rebuild positions manually from UI.

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

  async rebuildClosedPositions(userId: string, range?: '7d' | '30d' | '1y') {
    const now = Date.now();
    const rangeMs =
      range === '1y'
        ? 365 * 24 * 60 * 60 * 1000
        : range === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const fromMs = now - rangeMs;

    const debug =
      String(process.env.DEBUG_BINANCE || '').toLowerCase() === 'true';
    if (debug) {
      this.logger.log('[binance][rebuildClosedPositions] start', {
        userId,
        range: range || '7d',
        fromMs,
        toMs: now,
      });
    }

    // Load fills by time descending, then sort asc for aggregation
    const all: any[] = [];
    let nextToken: string | null = null;

    // Safety cap to avoid runaway memory for 1y in extreme accounts
    const hardCap = range === '1y' ? 200000 : range === '30d' ? 50000 : 15000;

    while (true) {
      const page = await this.listFills(userId, 200, nextToken);
      const items = (page.data.items || []) as any[];
      const filtered = items.filter((it) => Number(it.time) >= fromMs);
      all.push(...filtered);

      if (debug) {
        this.logger.log('[binance][rebuildClosedPositions] page', {
          got: items.length,
          kept: filtered.length,
          nextToken: Boolean(page.data.nextToken),
          totalKept: all.length,
        });
      }

      if (all.length >= hardCap) break;
      nextToken = page.data.nextToken || null;
      if (!nextToken) break;
      // If the oldest item in this page is already older than fromMs, we can stop
      const oldest = filtered[filtered.length - 1];
      if (oldest && Number(oldest.time) < fromMs) break;
      if (filtered.length === 0) break;
    }

    const fillsAsc = all
      .slice()
      .sort((a, b) => Number(a.time) - Number(b.time));

    if (debug) {
      const sample = fillsAsc.slice(0, 5).map((f: any) => ({
        symbol: f.symbol,
        time: f.time,
        side: f.side,
        positionSide: f.positionSide,
        qty: f.qty,
        price: f.price,
        realizedPnl: f.realizedPnl,
      }));
      this.logger.log(
        '[binance][rebuildClosedPositions] fillsAsc sample',
        sample,
      );
    }

    // V2: group by symbol+orderId+time+side then sessionize (one-way friendly)
    const v2 = buildClosedPositionsV2(userId, fillsAsc);
    const positions = v2.closedPositions;
    const openPositions = v2.openPositions;

    if (debug) {
      this.logger.log('[binance][rebuildClosedPositions] v2', {
        scannedFills: fillsAsc.length,
        groups: v2.groups,
        closedPositions: positions.length,
        openPositions: openPositions.length,
      });
      const posSample = positions.slice(0, 3);
      this.logger.log(
        '[binance][rebuildClosedPositions] positions sample',
        posSample,
      );
    }

    const nowIso = new Date().toISOString();

    let written = 0;
    for (const p of positions) {
      const item: BinanceFuturesClosedPosition = {
        ...p,
        status: 'CLOSED',
        updatedAt: nowIso,
      };

      await this.db.put({
        TableName: this.positionsTableName,
        Item: item,
      });
      written += 1;
    }

    // Persist open positions too (for pagination)
    for (const op of openPositions) {
      const positionKey = `${op.symbol}#${op.positionSide}#${op.openTime}`;
      const item: BinanceFuturesClosedPosition = {
        userId,
        positionKey,
        symbol: op.symbol,
        positionSide: op.positionSide,
        openTime: op.openTime,
        closeTime: op.lastTime,
        openPrice: op.openPrice,
        closePrice: op.openPrice,
        closedQty: 0,
        maxOpenQty: op.maxOpenQty,
        currentQty: op.currentQty,
        realizedPnl: op.realizedPnl,
        pnlPercent: undefined,
        fees: op.fees,
        feeAsset: op.feeAsset,
        status: 'OPEN',
        source: 'binance-futures-fills',
        fillCount: op.fillCount,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await this.db.put({
        TableName: this.positionsTableName,
        Item: item,
      });
    }

    if (debug) {
      this.logger.log('[binance][rebuildClosedPositions] written', { written });
    }

    return {
      success: true,
      data: {
        rebuiltCount: positions.length,
        written,
        openCount: openPositions.length,
        // For now, return a preview list too (useful for quick UI update)
        openItems: openPositions.slice(0, 50),
        ignoredFills: 0,
        scannedFills: fillsAsc.length,
      },
    };
  }

  async listPositions(
    userId: string,
    pageSize = 20,
    nextToken?: string,
    range?: '7d' | '30d' | '1y',
    status?: 'open' | 'closed',
  ) {
    const ExclusiveStartKey = this.decodeNextToken(nextToken);

    const now = Date.now();
    const rangeMs =
      range === '1y'
        ? 365 * 24 * 60 * 60 * 1000
        : range === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const fromMs = now - rangeMs;

    const filterStatus =
      status === 'open' ? 'OPEN' : status === 'closed' ? 'CLOSED' : null;

    const res = await this.db.query({
      TableName: this.positionsTableName,
      IndexName: 'userId-closeTime-index',
      KeyConditionExpression: 'userId = :userId AND closeTime >= :fromMs',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':fromMs': fromMs,
        ...(filterStatus ? { ':status': filterStatus } : {}),
      },
      ...(filterStatus
        ? {
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
          }
        : {}),
      Limit: Math.min(Math.max(pageSize, 1), 100),
      ScanIndexForward: false,
      ExclusiveStartKey,
    });

    return {
      success: true,
      data: {
        items: (res.Items || []) as BinanceFuturesClosedPosition[],
        nextToken: this.encodeNextToken(res.LastEvaluatedKey),
      },
    };
  }

  async convertPositionsToTrades(userId: string, positionKeys: string[]) {
    if (!positionKeys || positionKeys.length === 0) {
      return { success: true, data: { createdCount: 0 } };
    }

    const uniqueKeys = Array.from(new Set(positionKeys)).slice(0, 50);
    const keys = uniqueKeys.map((positionKey) => ({ userId, positionKey }));

    const batch = await this.db.batchGet({
      RequestItems: {
        [this.positionsTableName]: { Keys: keys },
      },
    });

    const positions =
      (batch.Responses?.[
        this.positionsTableName
      ] as BinanceFuturesClosedPosition[]) || [];

    const transactionsTable = this.configService.getOrThrow(
      'TRANSACTIONS_TABLE_NAME',
    );

    const { v4: uuidv4 } = await import('uuid');
    const {
      TradeType,
      TradeStatus,
      EntryDirection,
      TradeResult,
      MarketStructure,
    } = await import('../../trade/dto/create-trade.dto');

    const nowIso = new Date().toISOString();
    let createdCount = 0;

    for (const pos of positions) {
      const transactionId = uuidv4();
      const openIso = new Date(pos.openTime).toISOString();
      const closeIso = new Date(pos.closeTime).toISOString();

      const tradeResult =
        pos.realizedPnl > 0
          ? TradeResult.PROFIT
          : pos.realizedPnl < 0
            ? TradeResult.LOSS
            : TradeResult.BREAKEVEN;

      const profitLossPercentage =
        typeof pos.pnlPercent === 'number' && Number.isFinite(pos.pnlPercent)
          ? pos.pnlPercent
          : 0;

      const dir =
        pos.positionSide === 'SHORT'
          ? EntryDirection.SHORT
          : EntryDirection.LONG;

      const trade = {
        transactionId,
        userId,
        status: TradeStatus.EXITED,
        tradeType: TradeType.REAL,
        tradeSubject: pos.symbol,
        analysisTime: openIso,
        analysisPeriod: '1小时',
        marketStructure: MarketStructure.UNSEEN,
        marketStructureAnalysis:
          'Binance futures auto-import (closed positions)',
        entryPlanA: {
          entryReason: '自动导入（币安合约已平仓仓位）',
          entrySignal: '',
          exitSignal: '',
        },
        entryDirection: dir,
        entryTime: openIso,
        entryPrice: pos.openPrice,
        exitTime: closeIso,
        exitPrice: pos.closePrice,
        tradeResult,
        profitLossPercentage,
        tradeTags: ['binance', 'auto-import', 'position'],
        remarks: JSON.stringify(
          {
            source: 'binance-futures-positions',
            positionKey: pos.positionKey,
            symbol: pos.symbol,
            positionSide: pos.positionSide,
            openTime: pos.openTime,
            closeTime: pos.closeTime,
            openPrice: pos.openPrice,
            closePrice: pos.closePrice,
            closedQty: pos.closedQty,
            maxOpenQty: pos.maxOpenQty,
            currentQty: pos.currentQty,
            realizedPnl: pos.realizedPnl,
            pnlPercent: profitLossPercentage,
            fees: pos.fees,
            feeAsset: pos.feeAsset,
            fillCount: pos.fillCount,
          },
          null,
          2,
        ),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await this.db.put({
        TableName: transactionsTable,
        Item: trade,
      });
      createdCount += 1;
    }

    return {
      success: true,
      data: { createdCount },
    };
  }

  async cleanupSyncedData(userId: string, includeKeys?: boolean) {
    let fillsDeleted = 0;
    let positionsDeleted = 0;

    // 1) Delete fills
    let startKey: any = undefined;
    while (true) {
      const res = await this.db.query({
        TableName: this.fillsTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ProjectionExpression: 'userId, tradeKey',
        ExclusiveStartKey: startKey,
        Limit: 200,
      });

      const requests = (res.Items || []).map((it: any) => ({
        DeleteRequest: { Key: { userId: it.userId, tradeKey: it.tradeKey } },
      }));

      for (let i = 0; i < requests.length; i += 25) {
        const chunk = requests.slice(i, i + 25);
        if (chunk.length === 0) continue;
        await this.db.batchWrite({
          RequestItems: {
            [this.fillsTableName]: chunk,
          },
        });
        fillsDeleted += chunk.length;
      }

      startKey = res.LastEvaluatedKey;
      if (!startKey) break;
    }

    // 2) Delete positions (table might not exist yet in some env)
    try {
      startKey = undefined;
      while (true) {
        const res = await this.db.query({
          TableName: this.positionsTableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': userId },
          ProjectionExpression: 'userId, positionKey',
          ExclusiveStartKey: startKey,
          Limit: 200,
        });

        const requests = (res.Items || []).map((it: any) => ({
          DeleteRequest: {
            Key: { userId: it.userId, positionKey: it.positionKey },
          },
        }));

        for (let i = 0; i < requests.length; i += 25) {
          const chunk = requests.slice(i, i + 25);
          if (chunk.length === 0) continue;
          await this.db.batchWrite({
            RequestItems: {
              [this.positionsTableName]: chunk,
            },
          });
          positionsDeleted += chunk.length;
        }

        startKey = res.LastEvaluatedKey;
        if (!startKey) break;
      }
    } catch {
      this.logger.warn('cleanup positions skipped');
    }

    if (includeKeys) {
      await this.deleteApiKey(userId);
    }

    return {
      success: true,
      data: {
        fillsDeleted,
        positionsDeleted,
        keysDeleted: Boolean(includeKeys),
      },
    };
  }
}
