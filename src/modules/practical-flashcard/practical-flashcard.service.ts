import { BadRequestException, Injectable } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { ResourceNotFoundException, ValidationException } from '../../base/exceptions/custom.exceptions';
import { ConfigService } from '../common/config.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { TradeFlashcardCard } from '../trade-flashcard/trade-flashcard.types';
import { CreatePracticalFlashcardCardDto } from './dto/create-practical-flashcard-card.dto';
import { CreatePracticalFlashcardFromTradeFlashcardDto } from './dto/create-practical-flashcard-from-trade-flashcard.dto';
import { ListPracticalFlashcardCardsDto } from './dto/list-practical-flashcard-cards.dto';
import { UpdatePracticalFlashcardCardDto } from './dto/update-practical-flashcard-card.dto';
import {
  PracticalFlashcardCandle,
  PracticalFlashcardCard,
  PracticalFlashcardInterval,
  PracticalFlashcardVenue,
} from './practical-flashcard.types';

const DEFAULT_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const DEFAULT_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
const BINANCE_LIMIT = 1000;

@Injectable()
export class PracticalFlashcardService {
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;
  private readonly region: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dictionaryService: DictionaryService,
  ) {
    this.region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow('FLASHCARDS_TABLE_NAME');
    this.db = DynamoDBDocument.from(new DynamoDB({ region: this.region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
  }

  async createCard(userId: string, dto: CreatePracticalFlashcardCardDto) {
    const item = await this.buildCardFromInput(userId, dto);
    await this.db.put({ TableName: this.tableName, Item: item });
    return { success: true, data: await this.attachDictionaryTags(item) };
  }

  async createFromTradeFlashcard(
    userId: string,
    tradeFlashcardId: string,
    dto: CreatePracticalFlashcardFromTradeFlashcardDto,
  ) {
    const source = await this.getTradeFlashcardOrThrow(userId, tradeFlashcardId);
    if (source.lifecycleStatus !== 'COMPLETED') {
      throw new BadRequestException('Only completed trade flashcards can be converted to practical flashcards');
    }

    const symbolPairInfo = source.symbolPairInfo?.trim();
    const entryTimeInfo = source.entryTimeInfo?.trim() || source.marketTimeInfo?.trim();
    const playbookType = source.playbookType?.trim();
    if (!symbolPairInfo || !entryTimeInfo || !playbookType) {
      throw new BadRequestException('source trade flashcard requires symbolPairInfo, entryTimeInfo and playbookType');
    }

    const item = await this.buildCardFromInput(userId, {
      venue: 'BINANCE_UM_FUTURES',
      symbolPairInfo,
      entryTimeInfo,
      exitTimeInfo: dto.exitTimeInfo,
      primaryInterval: dto.primaryInterval,
      snapshotStartTime: dto.snapshotStartTime,
      snapshotEndTime: dto.snapshotEndTime,
      standardEntryPrice: dto.standardEntryPrice,
      standardStopLossPrice: dto.standardStopLossPrice,
      standardTakeProfitPrice: dto.standardTakeProfitPrice,
      playbookType,
      tagCodes: source.tagCodes,
      orderFlowImageUrls: ((source as unknown as { orderFlowImageUrls?: string[] }).orderFlowImageUrls || [])
        .map((item) => item.trim())
        .filter(Boolean),
      orderFlowRemark: (source as unknown as { orderFlowRemark?: string }).orderFlowRemark,
      notes: [source.notes, source.summary].filter(Boolean).join('\n\n') || undefined,
      sourceTradeFlashcardId: tradeFlashcardId,
    });

    await this.db.put({ TableName: this.tableName, Item: item });
    return { success: true, data: await this.attachDictionaryTags(item) };
  }

  async listCards(userId: string, dto: ListPracticalFlashcardCardsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const all = await this.listAllCards(userId);
    const filtered = all.filter((card) => {
      if (dto.status && card.status !== dto.status) return false;
      if (dto.playbookType && card.playbookType !== dto.playbookType) return false;
      if (dto.symbolPairInfo) {
        const keyword = dto.symbolPairInfo.trim().toLowerCase();
        if (keyword && !card.symbolPairInfo.toLowerCase().includes(keyword)) return false;
      }
      return true;
    });
    const sorted = filtered.sort(
      (a, b) => this.safeParseTimestamp(b.createdAt) - this.safeParseTimestamp(a.createdAt),
    );
    const items = sorted.slice(offset, offset + pageSize);
    const nextOffset = offset + items.length;
    return {
      success: true,
      data: {
        items,
        totalCount: filtered.length,
        nextCursor: nextOffset < filtered.length ? this.encodeOffsetCursor(nextOffset) : null,
      },
    };
  }

  async getCard(userId: string, cardId: string) {
    return { success: true, data: await this.getCardOrThrow(userId, cardId) };
  }

  async updateCard(userId: string, cardId: string, dto: UpdatePracticalFlashcardCardDto) {
    const existing = await this.getCardOrThrow(userId, cardId);
    const hasField = (field: keyof UpdatePracticalFlashcardCardDto) =>
      Object.prototype.hasOwnProperty.call(dto, field);
    const normalizedTagCodes = hasField('tagCodes')
      ? await this.dictionaryService.assertCategoryCodesExist(userId, 'flashcard_tag', dto.tagCodes || [])
      : existing.tagCodes;
    const normalizedPlaybookType = hasField('playbookType')
      ? (
          await this.dictionaryService.assertCategoryCodesExist(
            userId,
            'playbook_type',
            dto.playbookType ? [dto.playbookType] : undefined,
          )
        )[0]
      : existing.playbookType;
    if (!normalizedPlaybookType) {
      throw new BadRequestException('playbookType is required');
    }

    const updated: PracticalFlashcardCard = {
      ...existing,
      status: hasField('status') ? dto.status || existing.status : existing.status,
      expectedDirection: hasField('expectedDirection') ? dto.expectedDirection || undefined : existing.expectedDirection,
      standardEntryPrice: hasField('standardEntryPrice') ? dto.standardEntryPrice ?? undefined : existing.standardEntryPrice,
      standardStopLossPrice:
        hasField('standardStopLossPrice') ? dto.standardStopLossPrice ?? undefined : existing.standardStopLossPrice,
      standardTakeProfitPrice:
        hasField('standardTakeProfitPrice') ? dto.standardTakeProfitPrice ?? undefined : existing.standardTakeProfitPrice,
      playbookType: normalizedPlaybookType,
      tagCodes: normalizedTagCodes,
      orderFlowImageUrls:
        hasField('orderFlowImageUrls') ? this.normalizeUrls(dto.orderFlowImageUrls || []) : existing.orderFlowImageUrls,
      orderFlowRemark:
        hasField('orderFlowRemark') ? dto.orderFlowRemark?.trim() || undefined : existing.orderFlowRemark,
      notes: hasField('notes') ? dto.notes?.trim() || undefined : existing.notes,
      summary: hasField('summary') ? dto.summary?.trim() || undefined : existing.summary,
      updatedAt: new Date().toISOString(),
    };

    await this.db.put({ TableName: this.tableName, Item: updated });
    return { success: true, data: await this.attachDictionaryTags(updated) };
  }

  async deleteCard(userId: string, cardId: string) {
    await this.getCardOrThrow(userId, cardId);
    await this.db.delete({ TableName: this.tableName, Key: { userId, cardId } });
    return { success: true, data: true };
  }

  private async buildCardFromInput(
    userId: string,
    dto: CreatePracticalFlashcardCardDto & { sourceTradeFlashcardId?: string },
  ): Promise<PracticalFlashcardCard> {
    const primaryInterval = dto.primaryInterval || '15m';
    const entryTime = this.parseTime(dto.entryTimeInfo, 'entryTimeInfo');
    const exitTime = this.parseTime(dto.exitTimeInfo, 'exitTimeInfo');
    if (exitTime.getTime() <= entryTime.getTime()) {
      throw new BadRequestException('exitTimeInfo must be after entryTimeInfo');
    }

    const snapshotStartTime = dto.snapshotStartTime
      ? this.parseTime(dto.snapshotStartTime, 'snapshotStartTime')
      : new Date(entryTime.getTime() - DEFAULT_LOOKBACK_MS);
    const snapshotEndTime = dto.snapshotEndTime
      ? this.parseTime(dto.snapshotEndTime, 'snapshotEndTime')
      : new Date(exitTime.getTime() + DEFAULT_LOOKAHEAD_MS);
    if (snapshotEndTime.getTime() <= snapshotStartTime.getTime()) {
      throw new BadRequestException('snapshotEndTime must be after snapshotStartTime');
    }

    const tagCodes = await this.dictionaryService.assertCategoryCodesExist(userId, 'flashcard_tag', dto.tagCodes);
    const [playbookType] = await this.dictionaryService.assertCategoryCodesExist(
      userId,
      'playbook_type',
      dto.playbookType ? [dto.playbookType] : undefined,
    );
    if (!playbookType) {
      throw new BadRequestException('playbookType is required');
    }

    const candles = await this.fetchCandles(
      dto.venue,
      dto.symbolPairInfo,
      primaryInterval,
      snapshotStartTime.getTime(),
      snapshotEndTime.getTime(),
    );
    this.assertSnapshotCoverage(candles, entryTime.getTime(), exitTime.getTime());

    const now = new Date().toISOString();
    const cardId = uuidv4();
    return {
      id: cardId,
      userId,
      cardId,
      entityType: 'PRACTICAL_FLASHCARD',
      status: 'ACTIVE',
      venue: dto.venue,
      symbolPairInfo: this.normalizeSymbol(dto.symbolPairInfo),
      primaryInterval,
      entryTimeInfo: dto.entryTimeInfo.trim(),
      exitTimeInfo: dto.exitTimeInfo.trim(),
      snapshotStartTime: snapshotStartTime.toISOString(),
      snapshotEndTime: snapshotEndTime.toISOString(),
      candles,
      initialVisibleCandleIndex: this.resolveCandleIndex(candles, entryTime.getTime()),
      resultCandleIndex: this.resolveCandleIndex(candles, exitTime.getTime()),
      expectedDirection: dto.expectedDirection,
      standardEntryPrice: dto.standardEntryPrice,
      standardStopLossPrice: dto.standardStopLossPrice,
      standardTakeProfitPrice: dto.standardTakeProfitPrice,
      playbookType,
      tagCodes,
      orderFlowImageUrls: this.normalizeUrls(dto.orderFlowImageUrls),
      orderFlowRemark: dto.orderFlowRemark?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
      summary: dto.summary?.trim() || undefined,
      sourceTradeFlashcardId: dto.sourceTradeFlashcardId,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async fetchCandles(
    venue: PracticalFlashcardVenue,
    symbolPairInfo: string,
    interval: PracticalFlashcardInterval,
    startTime: number,
    endTime: number,
  ): Promise<PracticalFlashcardCandle[]> {
    const baseUrl = venue === 'BINANCE_SPOT' ? 'https://api.binance.com' : 'https://fapi.binance.com';
    const path = venue === 'BINANCE_SPOT' ? '/api/v3/klines' : '/fapi/v1/klines';
    const params = new URLSearchParams({
      symbol: this.normalizeSymbol(symbolPairInfo),
      interval,
      startTime: String(startTime),
      endTime: String(endTime),
      limit: String(BINANCE_LIMIT),
    });
    const url = `${baseUrl}${path}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    if (!res.ok) {
      throw new ValidationException(
        `Binance public klines API error: ${res.status} ${text}`,
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        'Binance 行情快照拉取失败',
        { status: res.status, body: text },
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ValidationException(
        'Invalid Binance klines response',
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        'Binance 行情返回格式异常',
      );
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new BadRequestException('No candles returned for the requested snapshot range');
    }

    return raw.map((item) => {
      const row = item as unknown[];
      return {
        openTime: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        closeTime: Number(row[6]),
      };
    });
  }

  private assertSnapshotCoverage(candles: PracticalFlashcardCandle[], entryTime: number, exitTime: number) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (!first || !last || first.openTime > entryTime || last.closeTime < exitTime) {
      throw new BadRequestException('candles do not cover entryTimeInfo to exitTimeInfo');
    }
  }

  private async getCardOrThrow(userId: string, cardId: string) {
    const result = await this.db.get({ TableName: this.tableName, Key: { userId, cardId } });
    const item = result.Item as PracticalFlashcardCard | undefined;
    if (!item || item.entityType !== 'PRACTICAL_FLASHCARD') {
      throw new ResourceNotFoundException('Practical flashcard not found', ERROR_CODES.RESOURCE_NOT_FOUND, '实操闪卡不存在');
    }
    return this.attachDictionaryTags(item);
  }

  private async getTradeFlashcardOrThrow(userId: string, cardId: string) {
    const result = await this.db.get({ TableName: this.tableName, Key: { userId, cardId } });
    const item = result.Item as TradeFlashcardCard | undefined;
    if (!item || item.entityType !== 'TRADE_FLASHCARD') {
      throw new ResourceNotFoundException('Trade flashcard not found', ERROR_CODES.RESOURCE_NOT_FOUND, '交易闪卡不存在');
    }
    return item;
  }

  private async listAllCards(userId: string) {
    const cards: PracticalFlashcardCard[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      cards.push(
        ...((result.Items || []) as PracticalFlashcardCard[]).filter(
          (item) => item.entityType === 'PRACTICAL_FLASHCARD',
        ),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Promise.all(cards.map((item) => this.attachDictionaryTags(item)));
  }

  private async attachDictionaryTags(card: PracticalFlashcardCard): Promise<PracticalFlashcardCard> {
    const tagItems = await this.dictionaryService.resolveCategoryItemsByCodes(
      card.userId,
      'flashcard_tag',
      card.tagCodes,
    );
    return { ...card, tagItems };
  }

  private parseTime(value: string, fieldName: string) {
    const trimmed = value.trim();
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(trimmed)
      ? trimmed.replace(' ', 'T')
      : trimmed;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid datetime`);
    }
    return date;
  }

  private normalizeSymbol(value: string) {
    return value.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private normalizeUrls(urls?: string[]) {
    return (urls || []).map((item) => item.trim()).filter(Boolean);
  }

  private resolveCandleIndex(candles: PracticalFlashcardCandle[], timestamp: number) {
    const index = candles.findIndex((item) => item.openTime <= timestamp && item.closeTime >= timestamp);
    if (index >= 0) return index;
    return candles.reduce((bestIndex, item, currentIndex) => {
      const best = candles[bestIndex];
      return Math.abs(item.openTime - timestamp) < Math.abs(best.openTime - timestamp) ? currentIndex : bestIndex;
    }, 0);
  }

  private safeParseTimestamp(value?: string) {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private encodeOffsetCursor(offset: number) {
    return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
  }

  private decodeOffsetCursor(cursor?: string) {
    if (!cursor) return 0;
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { offset?: unknown };
      const offset = typeof parsed.offset === 'number' ? parsed.offset : 0;
      return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
    } catch {
      return 0;
    }
  }
}
