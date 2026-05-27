import { BadRequestException, Injectable } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { ResourceNotFoundException, ValidationException } from '../../base/exceptions/custom.exceptions';
import { ConfigService } from '../common/config.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { TradeFlashcardCard } from '../trade-flashcard/trade-flashcard.types';
import { CreatePracticalFlashcardAttemptTradeDto } from './dto/create-practical-flashcard-attempt-trade.dto';
import { CreatePracticalFlashcardCardDto } from './dto/create-practical-flashcard-card.dto';
import { CreatePracticalFlashcardFromTradeFlashcardDto } from './dto/create-practical-flashcard-from-trade-flashcard.dto';
import { GetPracticalFlashcardCandlesBeforeDto } from './dto/get-practical-flashcard-candles-before.dto';
import { GetPracticalFlashcardDashboardAnalyticsDto } from './dto/get-practical-flashcard-dashboard-analytics.dto';
import { ListPracticalFlashcardAttemptsDto } from './dto/list-practical-flashcard-attempts.dto';
import { ListPracticalFlashcardCardsDto } from './dto/list-practical-flashcard-cards.dto';
import { ResolvePracticalFlashcardAttemptDto } from './dto/resolve-practical-flashcard-attempt.dto';
import { StartRandomPracticalFlashcardTrainingDto } from './dto/start-random-practical-flashcard-training.dto';
import { StartPracticalFlashcardAttemptDto } from './dto/start-practical-flashcard-attempt.dto';
import { UpdatePracticalFlashcardCardDto } from './dto/update-practical-flashcard-card.dto';
import {
  PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES,
  PracticalFlashcardAttempt,
  PracticalFlashcardAnalyticsAttemptSample,
  PracticalFlashcardAnalyticsGroup,
  PracticalFlashcardCandle,
  PracticalFlashcardCard,
  PracticalFlashcardDashboardAnalytics,
  PracticalFlashcardExitReason,
  PracticalFlashcardInterval,
  PracticalFlashcardRunningStats,
  PracticalFlashcardTrainingMode,
} from './practical-flashcard.types';

const DEFAULT_LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000;
const DEFAULT_LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
const BINANCE_LIMIT = 1000;
const INTERVAL_MS: Record<PracticalFlashcardInterval, number> = {
  '15m': 15 * 60 * 1000,
};
const DEFAULT_TIME_ZONE = 'Asia/Shanghai';
const PRACTICAL_ATTEMPT_PREFIX = 'practical-attempt#';

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
      marshallOptions: { convertClassInstanceToMap: true, removeUndefinedValues: true },
    });
  }

  async createCard(userId: string, dto: CreatePracticalFlashcardCardDto, ownerRole?: string) {
    const item = await this.buildCardFromInput(userId, dto, ownerRole);
    await this.db.put({ TableName: this.tableName, Item: item });
    return { success: true, data: await this.attachDictionaryTags(item) };
  }

  async createFromTradeFlashcard(
    userId: string,
    tradeFlashcardId: string,
    dto: CreatePracticalFlashcardFromTradeFlashcardDto,
    ownerRole?: string,
  ) {
    const source = await this.getTradeFlashcardOrThrow(userId, tradeFlashcardId);
    if (source.lifecycleStatus !== 'COMPLETED') {
      throw new BadRequestException('Only completed trade flashcards can be converted to practical flashcards');
    }
    if (source.convertedToPracticalFlashcardAt || source.convertedPracticalFlashcardId) {
      throw new BadRequestException('This trade flashcard has already been converted to a practical flashcard');
    }

    const symbolPairInfo = source.symbolPairInfo?.trim();
    const entryTimeInfo = source.entryTimeInfo?.trim() || source.marketTimeInfo?.trim();
    const playbookType = source.playbookType?.trim();
    if (!symbolPairInfo || !entryTimeInfo || !playbookType) {
      throw new BadRequestException('source trade flashcard requires symbolPairInfo, entryTimeInfo and playbookType');
    }

    const item = await this.buildCardFromInput(
      userId,
      {
        venue: 'BINANCE_UM_FUTURES',
        symbolPairInfo,
        entryTimeInfo,
        exitTimeInfo: dto.exitTimeInfo,
        primaryInterval: dto.primaryInterval,
        timeZone: dto.timeZone,
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
      },
      ownerRole,
    );

    const convertedAt = new Date().toISOString();
    await this.db.put({ TableName: this.tableName, Item: item });
    await this.db.put({
      TableName: this.tableName,
      Item: {
        ...source,
        convertedToPracticalFlashcardAt: convertedAt,
        convertedPracticalFlashcardId: item.cardId,
        updatedAt: convertedAt,
      },
    });
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
    return { success: true, data: await this.getAccessibleCardOrThrow(userId, cardId) };
  }

  async getCandlesBefore(userId: string, cardId: string, dto: GetPracticalFlashcardCandlesBeforeDto) {
    const card = await this.getAccessibleCardOrThrow(userId, cardId);
    const beforeOpenTime = Number(dto.beforeOpenTime);
    if (!Number.isFinite(beforeOpenTime)) {
      throw new BadRequestException('beforeOpenTime must be a valid timestamp');
    }
    const firstSavedOpenTime = card.candles?.[0]?.openTime;
    if (!firstSavedOpenTime || beforeOpenTime > firstSavedOpenTime) {
      throw new BadRequestException('beforeOpenTime must be at or before the saved snapshot start');
    }

    const intervalMs = INTERVAL_MS[card.primaryInterval || '15m'];
    const parsedLimit = Number(dto.limit || 500);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 500, 1), BINANCE_LIMIT);
    const endTime = beforeOpenTime - 1;
    const startTime = Math.max(0, beforeOpenTime - intervalMs * limit);
    const candles = await this.fetchCandles(
      card.symbolPairInfo,
      card.primaryInterval || '15m',
      startTime,
      endTime,
      { allowEmpty: true },
    );

    return {
      success: true,
      data: {
        items: candles.filter((candle) => candle.openTime < beforeOpenTime),
        beforeOpenTime,
      },
    };
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

    const nextTimeZone = hasField('timeZone')
      ? this.normalizeTimeZone(dto.timeZone)
      : this.normalizeTimeZone(existing.timeZone);
    const nextEntryTimeInfo = hasField('entryTimeInfo')
      ? dto.entryTimeInfo?.trim()
      : existing.entryTimeInfo;
    const nextExitTimeInfo = hasField('exitTimeInfo')
      ? dto.exitTimeInfo?.trim()
      : existing.exitTimeInfo;
    if (!nextEntryTimeInfo) {
      throw new BadRequestException('entryTimeInfo is required');
    }
    if (!nextExitTimeInfo) {
      throw new BadRequestException('exitTimeInfo is required');
    }

    const shouldRefreshCandles =
      nextEntryTimeInfo !== existing.entryTimeInfo ||
      nextExitTimeInfo !== existing.exitTimeInfo ||
      (hasField('timeZone') && !existing.timeZone) ||
      nextTimeZone !== this.normalizeTimeZone(existing.timeZone);
    const refreshedSnapshot = shouldRefreshCandles
      ? await this.buildSnapshotForTimeRange(existing, nextEntryTimeInfo, nextExitTimeInfo, nextTimeZone)
      : {
          entryTimeInfo: existing.entryTimeInfo,
          exitTimeInfo: existing.exitTimeInfo,
          snapshotStartTime: existing.snapshotStartTime,
          snapshotEndTime: existing.snapshotEndTime,
          candles: existing.candles,
          initialVisibleCandleIndex: existing.initialVisibleCandleIndex,
          resultCandleIndex: existing.resultCandleIndex,
        };

    const updated: PracticalFlashcardCard = {
      ...existing,
      status: hasField('status') ? dto.status || existing.status : existing.status,
      timeZone: nextTimeZone,
      entryTimeInfo: refreshedSnapshot.entryTimeInfo,
      exitTimeInfo: refreshedSnapshot.exitTimeInfo,
      snapshotStartTime: refreshedSnapshot.snapshotStartTime,
      snapshotEndTime: refreshedSnapshot.snapshotEndTime,
      candles: refreshedSnapshot.candles,
      initialVisibleCandleIndex: refreshedSnapshot.initialVisibleCandleIndex,
      resultCandleIndex: refreshedSnapshot.resultCandleIndex,
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

  async startAttempt(userId: string, dto: StartPracticalFlashcardAttemptDto) {
    const card = await this.getAccessibleCardOrThrow(userId, dto.cardId);
    const attempt = await this.createAttemptForCard(userId, card, 'DIRECT_CARD');
    return { success: true, data: { attemptId: attempt.attemptId, attempt, card } };
  }

  async startRandomTraining(userId: string, dto: StartRandomPracticalFlashcardTrainingDto) {
    let candidates = (await this.listTrainingCardsForUser(userId)).filter((card) => {
      if (card.status !== 'ACTIVE') return false;
      if (!Array.isArray(card.candles) || card.candles.length === 0) return false;
      if (dto.symbolPairInfo) {
        const keyword = this.normalizeSymbol(dto.symbolPairInfo);
        if (keyword && this.normalizeSymbol(card.symbolPairInfo) !== keyword) return false;
      }
      if (dto.playbookType && card.playbookType !== dto.playbookType) return false;
      if (dto.tagCodes?.length) {
        const cardTags = new Set(card.tagCodes || []);
        if (!dto.tagCodes.every((tagCode) => cardTags.has(tagCode))) return false;
      }
      return true;
    });
    if (dto.excludeRecentlyResolved !== false && candidates.length > 1) {
      const recentlyResolvedCardIds = new Set(
        (await this.listAllAttempts(userId))
          .filter((attempt) => attempt.status === 'RESOLVED')
          .sort(
            (a, b) =>
              this.safeParseTimestamp(b.resolvedAt || b.updatedAt) -
              this.safeParseTimestamp(a.resolvedAt || a.updatedAt),
          )
          .slice(0, 20)
          .map((attempt) => attempt.targetCardId),
      );
      const freshCandidates = candidates.filter((card) => !recentlyResolvedCardIds.has(card.cardId));
      if (freshCandidates.length) candidates = freshCandidates;
    }
    if (!candidates.length) {
      throw new BadRequestException('No active practical flashcards available for random training');
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const attempt = await this.createAttemptForCard(userId, picked, 'RANDOM_TRAINING');
    return { success: true, data: { attemptId: attempt.attemptId, attempt, card: picked } };
  }

  async createAttemptTrade(
    userId: string,
    attemptId: string,
    dto: CreatePracticalFlashcardAttemptTradeDto,
  ) {
    const attempt = await this.getAttemptOrThrow(userId, attemptId);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Only in-progress attempts can open a trade');
    }
    if (attempt.tradeOpenedCandleIndex !== undefined) {
      throw new BadRequestException('This attempt already has a confirmed trade');
    }

    const card = await this.getCardOrThrow(attempt.targetCardOwnerUserId || userId, attempt.targetCardId);
    const currentCandleIndex = this.clampCandleIndex(dto.currentCandleIndex, card.candles);
    const candle = card.candles[currentCandleIndex];
    if (!candle) {
      throw new BadRequestException('currentCandleIndex is outside candle snapshot range');
    }

    const entryPrice = candle.close;
    this.assertTradePrices(dto.direction, entryPrice, dto.stopLossPrice, dto.takeProfitPrice);
    const preTradeMarketStructureAnalysis = dto.preTradeMarketStructureAnalysis.trim();
    if (!preTradeMarketStructureAnalysis) {
      throw new BadRequestException('preTradeMarketStructureAnalysis is required');
    }
    const plannedRr = this.calculatePlannedRr(dto.direction, entryPrice, dto.stopLossPrice, dto.takeProfitPrice);
    const now = new Date().toISOString();
    const updated: PracticalFlashcardAttempt = {
      ...attempt,
      decision: dto.direction,
      tradeDirection: dto.direction,
      tradeOpenedCandleIndex: currentCandleIndex,
      currentCandleIndex,
      entryPrice,
      stopLossPrice: dto.stopLossPrice,
      takeProfitPrice: dto.takeProfitPrice,
      plannedRr,
      preTradeMarketStructureAnalysis,
      preTradePriceActionAnalysis: dto.preTradePriceActionAnalysis?.trim() || undefined,
      preTradeOrderFlowAnalysis: dto.preTradeOrderFlowAnalysis?.trim() || undefined,
      drawingSnapshot: dto.drawingSnapshot ?? attempt.drawingSnapshot,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: updated });
    return { success: true, data: updated };
  }

  async resolveAttempt(
    userId: string,
    attemptId: string,
    dto: ResolvePracticalFlashcardAttemptDto,
  ) {
    const attempt = await this.getAttemptOrThrow(userId, attemptId);
    if (attempt.status === 'RESOLVED') {
      const hasField = (field: keyof ResolvePracticalFlashcardAttemptDto) =>
        Object.prototype.hasOwnProperty.call(dto, field);
      const orderFlowAnalysisUsed = hasField('orderFlowAnalysisUsed')
        ? dto.orderFlowAnalysisUsed
        : attempt.orderFlowAnalysisUsed;
      const updated: PracticalFlashcardAttempt = {
        ...attempt,
        drawingSnapshot: hasField('drawingSnapshot') ? dto.drawingSnapshot ?? attempt.drawingSnapshot : attempt.drawingSnapshot,
        marketStructureAnalysisCorrect: hasField('marketStructureAnalysisCorrect')
          ? dto.marketStructureAnalysisCorrect
          : attempt.marketStructureAnalysisCorrect,
        priceActionAnalysisCorrect: hasField('priceActionAnalysisCorrect')
          ? dto.priceActionAnalysisCorrect
          : attempt.priceActionAnalysisCorrect,
        orderFlowAnalysisUsed,
        orderFlowAnalysisCorrect: orderFlowAnalysisUsed
          ? hasField('orderFlowAnalysisCorrect')
            ? dto.orderFlowAnalysisCorrect
            : attempt.orderFlowAnalysisCorrect
          : undefined,
        riskRewardSetupCorrect: hasField('riskRewardSetupCorrect')
          ? dto.riskRewardSetupCorrect
          : attempt.riskRewardSetupCorrect,
        mistakeReasons: hasField('mistakeReasons')
          ? dto.mistakeReasons?.map((item) => item.trim()).filter(Boolean)
          : attempt.mistakeReasons,
        notes: hasField('notes') ? dto.notes?.trim() || undefined : attempt.notes,
        summary: hasField('summary') ? dto.summary?.trim() || undefined : attempt.summary,
        updatedAt: new Date().toISOString(),
      };
      await this.db.put({ TableName: this.tableName, Item: updated });
      return { success: true, data: { attempt: updated, runningStats: await this.getRunningStats(userId) } };
    }
    if (!attempt.tradeDirection || attempt.tradeOpenedCandleIndex === undefined) {
      throw new BadRequestException('Confirm a trade before resolving the attempt');
    }

    const card = await this.getCardOrThrow(attempt.targetCardOwnerUserId || userId, attempt.targetCardId);
    const fallbackFinalIndex = attempt.currentCandleIndex ?? card.resultCandleIndex ?? card.candles.length - 1;
    const finalCandleIndex = this.clampCandleIndex(dto.finalCandleIndex ?? fallbackFinalIndex, card.candles);
    const calculated = this.calculateTradeOutcome(card.candles, attempt, finalCandleIndex);
    const now = new Date().toISOString();
    const orderFlowAnalysisUsed = dto.orderFlowAnalysisUsed;
    const updated: PracticalFlashcardAttempt = {
      ...attempt,
      status: 'RESOLVED',
      finalCandleIndex,
      currentCandleIndex: finalCandleIndex,
      realizedR: dto.realizedR ?? calculated.realizedR,
      isWin: dto.isWin ?? calculated.isWin,
      maxFavorableR: dto.maxFavorableR ?? calculated.maxFavorableR,
      maxAdverseR: dto.maxAdverseR ?? calculated.maxAdverseR,
      tradeClosedCandleIndex: dto.tradeClosedCandleIndex ?? calculated.tradeClosedCandleIndex,
      exitPrice: dto.exitPrice ?? calculated.exitPrice,
      exitReason: dto.exitReason ?? calculated.exitReason,
      tradeExecutionSnapshot: this.buildTradeExecutionSnapshot(
        card.candles,
        attempt,
        dto.tradeClosedCandleIndex ?? calculated.tradeClosedCandleIndex,
        dto.exitPrice ?? calculated.exitPrice,
        dto.exitReason ?? calculated.exitReason,
      ),
      drawingSnapshot: dto.drawingSnapshot ?? attempt.drawingSnapshot,
      marketStructureAnalysisCorrect: dto.marketStructureAnalysisCorrect,
      priceActionAnalysisCorrect: dto.priceActionAnalysisCorrect,
      orderFlowAnalysisUsed,
      orderFlowAnalysisCorrect: orderFlowAnalysisUsed ? dto.orderFlowAnalysisCorrect : undefined,
      riskRewardSetupCorrect: dto.riskRewardSetupCorrect,
      mistakeReasons: dto.mistakeReasons?.map((item) => item.trim()).filter(Boolean),
      notes: dto.notes?.trim() || undefined,
      summary: dto.summary?.trim() || undefined,
      resolvedAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: updated });
    return { success: true, data: { attempt: updated, runningStats: await this.getRunningStats(userId) } };
  }

  async listAttempts(userId: string, dto: ListPracticalFlashcardAttemptsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const all = await this.listAllAttempts(userId);
    const filtered = all.filter((attempt) => {
      if (dto.cardId && attempt.targetCardId !== dto.cardId) return false;
      if (dto.decision && attempt.decision !== dto.decision) return false;
      if (typeof dto.isWin === 'boolean' && attempt.isWin !== dto.isWin) return false;
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

  async getAttempt(userId: string, attemptId: string) {
    return { success: true, data: await this.getAttemptOrThrow(userId, attemptId) };
  }

  async deleteAttempt(userId: string, attemptId: string) {
    await this.getAttemptOrThrow(userId, attemptId);
    await this.db.delete({ TableName: this.tableName, Key: { userId, cardId: this.makeAttemptKey(attemptId) } });
    return { success: true, data: true };
  }

  async getDashboardAnalytics(userId: string, dto: GetPracticalFlashcardDashboardAnalyticsDto) {
    const allAttempts = await this.listAllAttempts(userId);
    const cards = await this.listAllCards(userId);
    const cardById = new Map(cards.map((card) => [card.cardId, card]));
    const fromTime = dto.from ? this.safeParseTimestamp(dto.from) : null;
    const toTime = dto.to ? this.safeParseTimestamp(dto.to) : null;
    const symbolFilter = dto.symbolPairInfo ? this.normalizeSymbol(dto.symbolPairInfo) : undefined;

    const resolved = allAttempts.filter((attempt) => {
      if (attempt.status !== 'RESOLVED') return false;
      const context = this.resolveAttemptAnalyticsContext(attempt, cardById.get(attempt.targetCardId));
      if (dto.playbookType && context.playbookType !== dto.playbookType) return false;
      if (symbolFilter && this.normalizeSymbol(context.symbolPairInfo || '') !== symbolFilter) return false;
      const resolvedAt = this.safeParseTimestamp(attempt.resolvedAt || attempt.updatedAt);
      if (fromTime !== null && resolvedAt < fromTime) return false;
      if (toTime !== null && resolvedAt > toTime) return false;
      return true;
    });

    const runningStats = this.calculateRunningStats(resolved, resolved);
    const sorted = [...resolved].sort(
      (a, b) =>
        this.safeParseTimestamp(b.resolvedAt || b.updatedAt) -
        this.safeParseTimestamp(a.resolvedAt || a.updatedAt),
    );
    const dashboard: PracticalFlashcardDashboardAnalytics = {
      ...runningStats,
      filters: {
        ...(dto.from ? { from: dto.from } : {}),
        ...(dto.to ? { to: dto.to } : {}),
        ...(dto.playbookType ? { playbookType: dto.playbookType } : {}),
        ...(dto.symbolPairInfo ? { symbolPairInfo: dto.symbolPairInfo } : {}),
      },
      analysisDimensions: this.buildAnalysisDimensionStats(resolved),
      playbookStats: this.buildGroupedAttemptStats(
        resolved,
        (attempt) => this.resolveAttemptAnalyticsContext(attempt, cardById.get(attempt.targetCardId)).playbookType,
        (key) => key,
      ),
      symbolStats: this.buildGroupedAttemptStats(
        resolved,
        (attempt) => this.resolveAttemptAnalyticsContext(attempt, cardById.get(attempt.targetCardId)).symbolPairInfo,
        (key) => key,
      ),
      cardStats: this.buildGroupedAttemptStats(
        resolved,
        (attempt) => attempt.targetCardId,
        (key) => {
          const card = cardById.get(key);
          const symbol = card?.symbolPairInfo || '未知币对';
          const playbook = card?.playbookType || '未知剧本';
          return `${symbol} / ${playbook} / ${key.slice(0, 8)}`;
        },
      ).slice(0, 10),
      recentAttempts: sorted.slice(0, 10).map((attempt) => this.toAnalyticsAttemptSample(attempt, cardById.get(attempt.targetCardId))),
      recentWrongAttempts: sorted
        .filter((attempt) => attempt.isWin === false)
        .slice(0, 10)
        .map((attempt) => this.toAnalyticsAttemptSample(attempt, cardById.get(attempt.targetCardId))),
    };

    return { success: true, data: dashboard };
  }

  private async createAttemptForCard(
    userId: string,
    card: PracticalFlashcardCard,
    trainingMode: PracticalFlashcardTrainingMode,
  ) {
    if (card.status !== 'ACTIVE') {
      throw new BadRequestException('Only active practical flashcards can be practiced');
    }
    if (!Array.isArray(card.candles) || card.candles.length === 0) {
      throw new BadRequestException('Practical flashcard requires frozen candles before training');
    }

    const now = new Date().toISOString();
    const attemptId = uuidv4();
    const attempt: PracticalFlashcardAttempt = {
      id: attemptId,
      userId,
      cardId: this.makeAttemptKey(attemptId),
      entityType: 'PRACTICAL_FLASHCARD_ATTEMPT',
      attemptId,
      targetCardId: card.cardId,
      targetCardOwnerUserId: card.userId,
      status: 'IN_PROGRESS',
      trainingMode,
      cardSnapshot: this.buildCardSnapshot(card),
      currentCandleIndex: card.initialVisibleCandleIndex,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: attempt });
    return attempt;
  }

  private async buildCardFromInput(
    userId: string,
    dto: CreatePracticalFlashcardCardDto & { sourceTradeFlashcardId?: string },
    ownerRole?: string,
  ): Promise<PracticalFlashcardCard> {
    const primaryInterval = dto.primaryInterval || '15m';
    const normalizedSymbol = this.assertSupportedBinanceUmSymbol(dto.venue, dto.symbolPairInfo);
    const timeZone = this.normalizeTimeZone(dto.timeZone);
    const entryTime = this.parseTime(dto.entryTimeInfo, 'entryTimeInfo', timeZone);
    const exitTime = this.parseTime(dto.exitTimeInfo, 'exitTimeInfo', timeZone);
    if (exitTime.getTime() <= entryTime.getTime()) {
      throw new BadRequestException('exitTimeInfo must be after entryTimeInfo');
    }

    const snapshotStartTime = dto.snapshotStartTime
      ? this.parseTime(dto.snapshotStartTime, 'snapshotStartTime', timeZone)
      : new Date(entryTime.getTime() - DEFAULT_LOOKBACK_MS);
    const snapshotEndTime = dto.snapshotEndTime
      ? this.parseTime(dto.snapshotEndTime, 'snapshotEndTime', timeZone)
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
      normalizedSymbol,
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
      ownerRole,
      cardId,
      entityType: 'PRACTICAL_FLASHCARD',
      status: 'ACTIVE',
      venue: dto.venue,
      symbolPairInfo: normalizedSymbol,
      primaryInterval,
      timeZone,
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
    symbolPairInfo: string,
    interval: PracticalFlashcardInterval,
    startTime: number,
    endTime: number,
    options: { allowEmpty?: boolean } = {},
  ): Promise<PracticalFlashcardCandle[]> {
    const baseUrl = 'https://fapi.binance.com';
    const path = '/fapi/v1/klines';
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
      if (options.allowEmpty) return [];
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

  private async buildSnapshotForTimeRange(
    existing: PracticalFlashcardCard,
    entryTimeInfo: string,
    exitTimeInfo: string,
    timeZone: string,
  ) {
    const normalizedSymbol = this.assertSupportedBinanceUmSymbol(existing.venue, existing.symbolPairInfo);
    const normalizedTimeZone = this.normalizeTimeZone(timeZone);
    const entryTime = this.parseTime(entryTimeInfo, 'entryTimeInfo', normalizedTimeZone);
    const exitTime = this.parseTime(exitTimeInfo, 'exitTimeInfo', normalizedTimeZone);
    if (exitTime.getTime() <= entryTime.getTime()) {
      throw new BadRequestException('exitTimeInfo must be after entryTimeInfo');
    }

    const snapshotStartTime = new Date(entryTime.getTime() - DEFAULT_LOOKBACK_MS);
    const snapshotEndTime = new Date(exitTime.getTime() + DEFAULT_LOOKAHEAD_MS);
    const candles = await this.fetchCandles(
      normalizedSymbol,
      existing.primaryInterval || '15m',
      snapshotStartTime.getTime(),
      snapshotEndTime.getTime(),
    );
    this.assertSnapshotCoverage(candles, entryTime.getTime(), exitTime.getTime());

    return {
      entryTimeInfo: entryTimeInfo.trim(),
      exitTimeInfo: exitTimeInfo.trim(),
      timeZone: normalizedTimeZone,
      snapshotStartTime: snapshotStartTime.toISOString(),
      snapshotEndTime: snapshotEndTime.toISOString(),
      candles,
      initialVisibleCandleIndex: this.resolveCandleIndex(candles, entryTime.getTime()),
      resultCandleIndex: this.resolveCandleIndex(candles, exitTime.getTime()),
    };
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

  private async getAccessibleCardOrThrow(userId: string, cardId: string) {
    try {
      return await this.getCardOrThrow(userId, cardId);
    } catch (error) {
      const systemCard = await this.findSystemTrainingCardById(cardId);
      if (systemCard) return systemCard;
      throw error;
    }
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

  private async listTrainingCardsForUser(userId: string) {
    const ownCards = await this.listAllCards(userId);
    const cardsByOwnerAndId = new Map(ownCards.map((card) => [`${card.userId}:${card.cardId}`, card]));
    const systemCards = await this.scanSystemTrainingCards();
    for (const card of systemCards) {
      const key = `${card.userId}:${card.cardId}`;
      if (!cardsByOwnerAndId.has(key)) cardsByOwnerAndId.set(key, card);
    }
    return Array.from(cardsByOwnerAndId.values());
  }

  private async findSystemTrainingCardById(cardId: string) {
    const cards = await this.scanSystemTrainingCards(cardId);
    return cards.find((card) => card.cardId === cardId);
  }

  private async scanSystemTrainingCards(cardId?: string) {
    const cards: PracticalFlashcardCard[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const expressionAttributeNames: Record<string, string> = { '#entityType': 'entityType' };
      const expressionAttributeValues: Record<string, unknown> = {
        ':entityType': 'PRACTICAL_FLASHCARD',
      };
      const filters = ['#entityType = :entityType'];
      if (cardId) {
        expressionAttributeNames['#cardId'] = 'cardId';
        expressionAttributeValues[':cardId'] = cardId;
        filters.push('#cardId = :cardId');
      }

      const result = await this.db.scan({
        TableName: this.tableName,
        FilterExpression: filters.join(' AND '),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      cards.push(
        ...((result.Items || []) as PracticalFlashcardCard[]).filter((item) => this.isSystemTrainingCard(item)),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Promise.all(cards.map((item) => this.attachDictionaryTags(item)));
  }

  private isSystemTrainingCard(card: PracticalFlashcardCard) {
    if (card.entityType !== 'PRACTICAL_FLASHCARD') return false;
    return !card.ownerRole || card.ownerRole === 'Admins' || card.ownerRole === 'SuperAdmins';
  }

  private async listAllAttempts(userId: string) {
    const attempts: PracticalFlashcardAttempt[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId AND begins_with(cardId, :prefix)',
        ExpressionAttributeValues: { ':userId': userId, ':prefix': PRACTICAL_ATTEMPT_PREFIX },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      attempts.push(
        ...((result.Items || []) as PracticalFlashcardAttempt[]).filter(
          (item) => item.entityType === 'PRACTICAL_FLASHCARD_ATTEMPT',
        ),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return attempts;
  }

  private async getAttemptOrThrow(userId: string, attemptId: string) {
    const result = await this.db.get({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeAttemptKey(attemptId) },
    });
    const item = result.Item as PracticalFlashcardAttempt | undefined;
    if (!item || item.entityType !== 'PRACTICAL_FLASHCARD_ATTEMPT') {
      throw new ResourceNotFoundException(
        'Practical flashcard attempt not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '实操闪卡训练记录不存在',
      );
    }
    return item;
  }

  private async getRunningStats(userId: string): Promise<PracticalFlashcardRunningStats> {
    const attempts = await this.listAllAttempts(userId);
    const resolved = attempts.filter((attempt) => attempt.status === 'RESOLVED');
    return this.calculateRunningStats(attempts, resolved);
  }

  private calculateRunningStats(
    attempts: PracticalFlashcardAttempt[],
    resolved: PracticalFlashcardAttempt[],
  ): PracticalFlashcardRunningStats {
    const wins = resolved.filter((attempt) => attempt.isWin === true).length;
    const realizedValues = resolved
      .map((attempt) => attempt.realizedR)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const plannedValues = attempts
      .map((attempt) => attempt.plannedRr)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const revealCount = resolved.filter((attempt) => attempt.usedOrderFlowReveal).length;
    const totalRealizedR = realizedValues.reduce((sum, value) => sum + value, 0);
    return {
      attemptCount: attempts.length,
      resolvedCount: resolved.length,
      winRate: resolved.length ? wins / resolved.length : null,
      avgRealizedR: realizedValues.length ? totalRealizedR / realizedValues.length : null,
      totalRealizedR,
      avgPlannedRr: plannedValues.length
        ? plannedValues.reduce((sum, value) => sum + value, 0) / plannedValues.length
        : null,
      orderFlowRevealRate: resolved.length ? revealCount / resolved.length : null,
    };
  }

  private buildGroupedAttemptStats(
    attempts: PracticalFlashcardAttempt[],
    getKey: (attempt: PracticalFlashcardAttempt) => string | undefined,
    getLabel: (key: string) => string,
  ): PracticalFlashcardAnalyticsGroup[] {
    const groups = new Map<string, PracticalFlashcardAttempt[]>();
    for (const attempt of attempts) {
      const key = getKey(attempt) || 'UNKNOWN';
      const current = groups.get(key) || [];
      current.push(attempt);
      groups.set(key, current);
    }

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const wins = items.filter((attempt) => attempt.isWin === true).length;
        const realizedValues = items
          .map((attempt) => attempt.realizedR)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const plannedValues = items
          .map((attempt) => attempt.plannedRr)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const totalRealizedR = realizedValues.reduce((sum, value) => sum + value, 0);
        return {
          key,
          label: getLabel(key),
          attemptCount: items.length,
          resolvedCount: items.length,
          winCount: wins,
          winRate: items.length ? wins / items.length : null,
          avgRealizedR: realizedValues.length ? totalRealizedR / realizedValues.length : null,
          totalRealizedR,
          avgPlannedRr: plannedValues.length
            ? plannedValues.reduce((sum, value) => sum + value, 0) / plannedValues.length
            : null,
        };
      })
      .sort((a, b) => b.resolvedCount - a.resolvedCount || a.label.localeCompare(b.label));
  }

  private buildAnalysisDimensionStats(attempts: PracticalFlashcardAttempt[]) {
    return [
      this.buildBooleanDimensionStats(attempts, 'marketStructureAnalysisCorrect', '市场结构分析'),
      this.buildBooleanDimensionStats(attempts, 'priceActionAnalysisCorrect', '价格行为分析'),
      this.buildBooleanDimensionStats(
        attempts.filter((attempt) => attempt.orderFlowAnalysisUsed === true),
        'orderFlowAnalysisCorrect',
        '足迹图 / 订单流分析',
      ),
      this.buildBooleanDimensionStats(attempts, 'riskRewardSetupCorrect', '止盈止损设置'),
    ];
  }

  private buildBooleanDimensionStats(
    attempts: PracticalFlashcardAttempt[],
    key: 'marketStructureAnalysisCorrect' | 'priceActionAnalysisCorrect' | 'orderFlowAnalysisCorrect' | 'riskRewardSetupCorrect',
    label: string,
  ) {
    const reviewed = attempts.filter((attempt) => typeof attempt[key] === 'boolean');
    const correctCount = reviewed.filter((attempt) => attempt[key] === true).length;
    return {
      key,
      label,
      reviewedCount: reviewed.length,
      correctCount,
      wrongCount: reviewed.length - correctCount,
      correctRate: reviewed.length ? correctCount / reviewed.length : null,
    };
  }

  private resolveAttemptAnalyticsContext(
    attempt: PracticalFlashcardAttempt,
    fallbackCard?: PracticalFlashcardCard,
  ) {
    return {
      playbookType: attempt.cardSnapshot?.playbookType || fallbackCard?.playbookType,
      symbolPairInfo: attempt.cardSnapshot?.symbolPairInfo || fallbackCard?.symbolPairInfo,
      tagCodes: attempt.cardSnapshot?.tagCodes || fallbackCard?.tagCodes || [],
      primaryInterval: attempt.cardSnapshot?.primaryInterval || fallbackCard?.primaryInterval,
      expectedDirection: attempt.cardSnapshot?.expectedDirection || fallbackCard?.expectedDirection,
    };
  }

  private toAnalyticsAttemptSample(
    attempt: PracticalFlashcardAttempt,
    fallbackCard?: PracticalFlashcardCard,
  ): PracticalFlashcardAnalyticsAttemptSample {
    const context = this.resolveAttemptAnalyticsContext(attempt, fallbackCard);
    return {
      attemptId: attempt.attemptId,
      targetCardId: attempt.targetCardId,
      resolvedAt: attempt.resolvedAt,
      symbolPairInfo: context.symbolPairInfo,
      playbookType: context.playbookType,
      tradeDirection: attempt.tradeDirection,
      realizedR: attempt.realizedR,
      isWin: attempt.isWin,
      mistakeReasons: attempt.mistakeReasons,
      summary: attempt.summary,
    };
  }

  private buildCardSnapshot(card: PracticalFlashcardCard) {
    return {
      playbookType: card.playbookType,
      tagCodes: card.tagCodes || [],
      symbolPairInfo: card.symbolPairInfo,
      primaryInterval: card.primaryInterval,
      ...(card.expectedDirection ? { expectedDirection: card.expectedDirection } : {}),
    };
  }

  private async attachDictionaryTags(card: PracticalFlashcardCard): Promise<PracticalFlashcardCard> {
    const tagItems = await this.dictionaryService.resolveCategoryItemsByCodes(
      card.userId,
      'flashcard_tag',
      card.tagCodes,
    );
    return { ...card, tagItems };
  }

  private parseTime(value: string, fieldName: string, timeZone = DEFAULT_TIME_ZONE) {
    const trimmed = value.trim();
    const localMatch = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
    );
    const date = localMatch
      ? this.parseZonedTime(localMatch, this.normalizeTimeZone(timeZone))
      : new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid datetime`);
    }
    return date;
  }

  private parseZonedTime(match: RegExpMatchArray, timeZone: string) {
    const [, year, month, day, hour, minute, second] = match;
    const utcGuess = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second || '0'),
    );
    const offset = this.getTimeZoneOffsetMs(timeZone, utcGuess);
    let utcTime = utcGuess - offset;
    const adjustedOffset = this.getTimeZoneOffsetMs(timeZone, utcTime);
    if (adjustedOffset !== offset) {
      utcTime = utcGuess - adjustedOffset;
    }
    return new Date(utcTime);
  }

  private getTimeZoneOffsetMs(timeZone: string, utcTime: number) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utcTime));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const zonedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    return zonedAsUtc - utcTime;
  }

  private normalizeTimeZone(value?: string) {
    const timeZone = value?.trim() || DEFAULT_TIME_ZONE;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
      return timeZone;
    } catch {
      throw new BadRequestException('timeZone must be a valid IANA timezone');
    }
  }

  private normalizeSymbol(value: string) {
    return value.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }

  private assertSupportedBinanceUmSymbol(venue: string, symbolPairInfo: string) {
    if (venue !== 'BINANCE_UM_FUTURES') {
      throw new BadRequestException('Practical flashcard creation currently only supports Binance U-M futures');
    }
    const normalized = this.normalizeSymbol(symbolPairInfo);
    if (!normalized) {
      throw new BadRequestException('symbolPairInfo is required');
    }
    const supportedSymbols: readonly string[] = PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES;
    if (!supportedSymbols.includes(normalized)) {
      throw new BadRequestException(
        `symbolPairInfo must be one of ${PRACTICAL_FLASHCARD_BINANCE_UM_SYMBOL_VALUES.join(', ')}`,
      );
    }
    return normalized;
  }

  private normalizeUrls(urls?: string[]) {
    return (urls || []).map((item) => item.trim()).filter(Boolean);
  }

  private makeAttemptKey(attemptId: string) {
    return `${PRACTICAL_ATTEMPT_PREFIX}${attemptId}`;
  }

  private clampCandleIndex(index: number, candles: PracticalFlashcardCandle[]) {
    if (!candles.length) {
      throw new BadRequestException('candle snapshot is empty');
    }
    return Math.max(0, Math.min(Math.round(index), candles.length - 1));
  }

  private assertTradePrices(direction: 'LONG' | 'SHORT', entryPrice: number, stopLossPrice: number, takeProfitPrice: number) {
    if (![entryPrice, stopLossPrice, takeProfitPrice].every((value) => Number.isFinite(value) && value > 0)) {
      throw new BadRequestException('entryPrice, stopLossPrice and takeProfitPrice must be positive numbers');
    }
    if (direction === 'LONG' && !(stopLossPrice < entryPrice && takeProfitPrice > entryPrice)) {
      throw new BadRequestException('LONG trade requires stopLossPrice < entryPrice < takeProfitPrice');
    }
    if (direction === 'SHORT' && !(takeProfitPrice < entryPrice && stopLossPrice > entryPrice)) {
      throw new BadRequestException('SHORT trade requires takeProfitPrice < entryPrice < stopLossPrice');
    }
  }

  private calculatePlannedRr(direction: 'LONG' | 'SHORT', entryPrice: number, stopLossPrice: number, takeProfitPrice: number) {
    const risk = direction === 'LONG' ? entryPrice - stopLossPrice : stopLossPrice - entryPrice;
    const reward = direction === 'LONG' ? takeProfitPrice - entryPrice : entryPrice - takeProfitPrice;
    if (risk <= 0 || reward <= 0) {
      throw new BadRequestException('Invalid stop loss or take profit for selected direction');
    }
    return reward / risk;
  }

  private calculateTradeOutcome(
    candles: PracticalFlashcardCandle[],
    attempt: PracticalFlashcardAttempt,
    finalCandleIndex: number,
  ) {
    const direction = attempt.tradeDirection;
    const entryIndex = attempt.tradeOpenedCandleIndex;
    const entryPrice = attempt.entryPrice;
    const stopLossPrice = attempt.stopLossPrice;
    const takeProfitPrice = attempt.takeProfitPrice;
    if (!direction || entryIndex === undefined || entryPrice === undefined || stopLossPrice === undefined || takeProfitPrice === undefined) {
      throw new BadRequestException('Attempt trade is incomplete');
    }

    const risk = Math.abs(entryPrice - stopLossPrice);
    if (!Number.isFinite(risk) || risk <= 0) {
      throw new BadRequestException('Attempt risk is invalid');
    }

    const start = Math.min(entryIndex + 1, candles.length - 1);
    const end = this.clampCandleIndex(finalCandleIndex, candles);
    const window = candles.slice(start, end + 1);
    let hit: 'TAKE_PROFIT' | 'STOP_LOSS' | null = null;
    let hitIndex: number | undefined;
    let maxFavorableR = 0;
    let maxAdverseR = 0;

    for (let offset = 0; offset < window.length; offset += 1) {
      const candle = window[offset];
      const favorable = direction === 'LONG' ? candle.high - entryPrice : entryPrice - candle.low;
      const adverse = direction === 'LONG' ? entryPrice - candle.low : candle.high - entryPrice;
      maxFavorableR = Math.max(maxFavorableR, favorable / risk);
      maxAdverseR = Math.max(maxAdverseR, adverse / risk);

      const stopHit = direction === 'LONG' ? candle.low <= stopLossPrice : candle.high >= stopLossPrice;
      const takeProfitHit = direction === 'LONG' ? candle.high >= takeProfitPrice : candle.low <= takeProfitPrice;
      if (stopHit && takeProfitHit) {
        hit = 'STOP_LOSS';
        hitIndex = start + offset;
        break;
      }
      if (stopHit) {
        hit = 'STOP_LOSS';
        hitIndex = start + offset;
        break;
      }
      if (takeProfitHit) {
        hit = 'TAKE_PROFIT';
        hitIndex = start + offset;
        break;
      }
    }

    const lastClose = candles[end]?.close ?? entryPrice;
    const floatingR = direction === 'LONG' ? (lastClose - entryPrice) / risk : (entryPrice - lastClose) / risk;
    const realizedR =
      hit === 'TAKE_PROFIT'
        ? this.calculatePlannedRr(direction, entryPrice, stopLossPrice, takeProfitPrice)
        : hit === 'STOP_LOSS'
          ? -1
          : floatingR;
    const exitReason: PracticalFlashcardExitReason =
      hit === 'TAKE_PROFIT' ? 'TAKE_PROFIT' : hit === 'STOP_LOSS' ? 'STOP_LOSS' : 'NO_EXIT_BY_FINAL_CANDLE';
    const tradeClosedCandleIndex = hitIndex ?? end;
    const exitPrice = hit === 'TAKE_PROFIT' ? takeProfitPrice : hit === 'STOP_LOSS' ? stopLossPrice : lastClose;

    return {
      realizedR,
      isWin: realizedR > 0,
      maxFavorableR,
      maxAdverseR,
      tradeClosedCandleIndex,
      exitPrice,
      exitReason,
    };
  }

  private buildTradeExecutionSnapshot(
    candles: PracticalFlashcardCandle[],
    attempt: PracticalFlashcardAttempt,
    exitCandleIndex?: number,
    exitPrice?: number,
    exitReason?: PracticalFlashcardExitReason,
  ) {
    if (
      attempt.tradeOpenedCandleIndex === undefined ||
      attempt.entryPrice === undefined ||
      attempt.stopLossPrice === undefined ||
      attempt.takeProfitPrice === undefined ||
      !attempt.tradeDirection
    ) {
      return undefined;
    }
    const entryCandle = candles[attempt.tradeOpenedCandleIndex];
    const exitCandle = exitCandleIndex !== undefined ? candles[exitCandleIndex] : undefined;
    return {
      entryCandleIndex: attempt.tradeOpenedCandleIndex,
      entryCandleOpenTime: entryCandle?.openTime ?? 0,
      entryPrice: attempt.entryPrice,
      exitCandleIndex,
      exitCandleOpenTime: exitCandle?.openTime,
      exitPrice,
      exitReason,
      stopLossPrice: attempt.stopLossPrice,
      takeProfitPrice: attempt.takeProfitPrice,
      tradeDirection: attempt.tradeDirection,
    };
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
