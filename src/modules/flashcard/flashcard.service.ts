import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CreateFlashcardCardDto } from './dto/create-flashcard-card.dto';
import { GetFlashcardUploadUrlDto } from './dto/get-upload-url.dto';
import { RandomFlashcardCardsDto } from './dto/random-flashcard-cards.dto';
import {
  FlashcardCard,
  FlashcardCardSortOrder,
  FlashcardCardSortBy,
  FlashcardCollectionDistributionItem,
  FlashcardCollectionState,
  FlashcardDrillCardErrorRankingItem,
  FlashcardDrillPlaybookErrorRankingItem,
  FlashcardDrillAnalyticsDimensionStat,
  FlashcardDrillAnalyticsTrendPoint,
  FlashcardDrillAnalyticsWindow,
  FlashcardDrillAttemptItem,
  FlashcardDrillMistakeReason,
  FlashcardDrillSessionItem,
  FlashcardFavoriteItem,
  FlashcardSimulationAttemptItem,
  FlashcardSimulationPlaybookAnalyticsItem,
  FlashcardSimulationSessionItem,
  FlashcardSource,
  FlashcardWrongBookItem,
} from './flashcard.types';
import { ListFlashcardCardsDto } from './dto/list-flashcard-cards.dto';
import { ResourceNotFoundException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { StartFlashcardDrillSessionDto } from './dto/start-flashcard-drill-session.dto';
import { CreateFlashcardDrillAttemptDto } from './dto/create-flashcard-drill-attempt.dto';
import { ListFlashcardDrillSessionsDto } from './dto/list-flashcard-drill-sessions.dto';
import { UpdateFlashcardCardDto } from './dto/update-flashcard-card.dto';
import {
  GetFlashcardDrillAnalyticsDto,
  GetFlashcardDrillCardErrorRankingDto,
} from './dto/get-flashcard-drill-analytics.dto';
import { StartFlashcardSimulationSessionDto } from './dto/start-flashcard-simulation-session.dto';
import { CreateFlashcardSimulationAttemptDto } from './dto/create-flashcard-simulation-attempt.dto';
import { ResolveFlashcardSimulationAttemptDto } from './dto/resolve-flashcard-simulation-attempt.dto';
import { ListFlashcardSimulationSessionsDto } from './dto/list-flashcard-simulation-sessions.dto';
import { ListFlashcardSimulationCardHistoryDto } from './dto/list-flashcard-simulation-card-history.dto';
import { ListFlashcardSimulationAttemptsDto } from './dto/list-flashcard-simulation-attempts.dto';
import { GetFlashcardSimulationPlaybookAnalyticsDto } from './dto/get-flashcard-simulation-playbook-analytics.dto';
import { MistakeService } from '../mistake/mistake.service';
import { UpdateFlashcardDrillStatusDto } from './dto/update-flashcard-drill-status.dto';
import { DuplicateFlashcardCardDto } from './dto/duplicate-flashcard-card.dto';

@Injectable()
export class FlashcardService {
  private readonly db: DynamoDBDocument;
  private readonly s3: S3Client;
  private readonly tableName: string;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cloudfrontDomain?: string;
  private readonly createdAtIndexName = 'userId-createdAt-index';

  constructor(
    private readonly configService: ConfigService,
    private readonly dictionaryService: DictionaryService,
    private readonly mistakeService: MistakeService,
  ) {
    this.region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow('FLASHCARDS_TABLE_NAME');
    this.bucketName = this.configService.getOrThrow('IMAGE_BUCKET_NAME');
    this.cloudfrontDomain = this.configService.get('CLOUDFRONT_DOMAIN_NAME');

    this.db = DynamoDBDocument.from(new DynamoDB({ region: this.region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });

    this.s3 = new S3Client({ region: this.region });

    console.log('[FlashcardService] using table:', this.tableName);
  }

  async getUploadUrl(userId: string, dto: GetFlashcardUploadUrlDto) {
    const ext = this.resolveFileExtension(dto.fileName, dto.contentType);
    const date = new Date().toISOString().slice(0, 10);
    const key = `flashcards/${userId}/${dto.scope}/${date}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 600 });

    return {
      success: true,
      data: {
        uploadUrl,
        fileUrl: this.buildFileUrl(key),
        key,
        expiresIn: 600,
      },
    };
  }

  async createCard(userId: string, dto: CreateFlashcardCardDto) {
    const now = new Date().toISOString();
    const cardId = uuidv4();

    const expectedAction = dto.expectedAction || dto.direction;
    const normalizedTagCodes = await this.dictionaryService.assertCategoryCodesExist(
      userId,
      'flashcard_tag',
      dto.tagCodes,
    );
    const normalizedPlaybookType = (
      await this.dictionaryService.assertCategoryCodesExist(
        userId,
        'playbook_type',
        dto.playbookType ? [dto.playbookType] : undefined,
      )
    )[0];

    if (!dto.systemOutcomeType) {
      throw new BadRequestException('systemOutcomeType is required');
    }
    if (!dto.marketTimeInfo?.trim()) {
      throw new BadRequestException('marketTimeInfo is required');
    }
    if (!dto.symbolPairInfo?.trim()) {
      throw new BadRequestException('symbolPairInfo is required');
    }
    if (!normalizedPlaybookType) {
      throw new BadRequestException('playbookType is required');
    }

    const item: FlashcardCard = {
      id: cardId,
      userId,
      cardId,
      entityType: 'CARD',
      questionImageUrl: dto.questionImageUrl,
      answerImageUrl: dto.answerImageUrl,
      expectedAction,
      behaviorType: dto.behaviorType,
      invalidationType: dto.invalidationType,
      systemOutcomeType: dto.systemOutcomeType,
      direction: expectedAction,
      earlyExitTag: dto.earlyExitTag === true,
      earlyExitReason:
        dto.earlyExitTag === true
          ? dto.earlyExitReason?.trim() || undefined
          : undefined,
      earlyExitImageUrls:
        dto.earlyExitTag === true
          ? (dto.earlyExitImageUrls || []).map((item) => item.trim()).filter(Boolean)
          : undefined,
      orderFlowImageUrls: (dto.orderFlowImageUrls || [])
        .map((item) => item.trim())
        .filter(Boolean),
      orderFlowRemark: dto.orderFlowRemark?.trim() || undefined,
      marketTimeInfo: dto.marketTimeInfo?.trim() || undefined,
      symbolPairInfo: dto.symbolPairInfo?.trim() || undefined,
      playbookType: normalizedPlaybookType,
      notes: dto.notes?.trim() || undefined,
      tagCodes: normalizedTagCodes,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: item,
    });

    return {
      success: true,
      data: await this.attachDictionaryTags(this.normalizeCard(item)),
    };
  }

  async randomCards(userId: string, dto: RandomFlashcardCardsDto) {
    const cards = await this.listAllCards(userId);
    const filtered = cards.filter(
      (card) => this.isDrillTrainable(card) && this.matchesFilters(card, dto),
    );

    this.shuffleInPlace(filtered);

    return {
      success: true,
      data: filtered.slice(0, dto.count || 20),
    };
  }

  async getTodaySummary(userId: string, timezone = 'Asia/Shanghai') {
    const resolvedTimezone = this.normalizeTimezone(timezone);
    const today = this.formatDateInTimezone(new Date(), resolvedTimezone);
    const cards = await this.listAllCards(userId);
    const todayCards = this.filterCardsByDate(cards, today, resolvedTimezone);

    const latestCreatedAt = this.pickBoundaryCreatedAt(todayCards, 'latest');

    return {
      success: true,
      data: {
        date: today,
        timezone: resolvedTimezone,
        hasNewCardsToday: todayCards.length > 0,
        newCardsCount: todayCards.length,
        latestCreatedAt: latestCreatedAt || null,
      },
    };
  }

  async getTodayCollectionSummary(userId: string, timezone = 'Asia/Shanghai') {
    const resolvedTimezone = this.normalizeTimezone(timezone);
    const now = new Date();
    const today = this.formatDateInTimezone(now, resolvedTimezone);
    const cards = await this.listAllCards(userId);
    const todayCards = this.filterCardsByDate(cards, today, resolvedTimezone);
    const firstCreatedAt = this.pickBoundaryCreatedAt(todayCards, 'first');
    const latestCreatedAt = this.pickBoundaryCreatedAt(todayCards, 'latest');
    const behaviorTypeDistribution = this.buildDistribution(
      todayCards,
      'behaviorType',
    );
    const symbolPairDistribution = this.buildDistribution(
      todayCards,
      'symbolPairInfo',
    );
    const marketTimeDistribution = this.buildDistribution(
      todayCards,
      'marketTimeInfo',
    );

    return {
      success: true,
      data: {
        date: today,
        timezone: resolvedTimezone,
        hasNewCardsToday: todayCards.length > 0,
        newCardsCount: todayCards.length,
        firstCreatedAt: firstCreatedAt || null,
        latestCreatedAt: latestCreatedAt || null,
        minutesSinceLastCreated: latestCreatedAt
          ? Math.max(
              0,
              Math.floor((now.getTime() - Date.parse(latestCreatedAt)) / 60000),
            )
          : null,
        behaviorTypeDistribution,
        symbolPairDistribution,
        marketTimeDistribution,
        collectionState: this.resolveCollectionState({
          newCardsCount: todayCards.length,
          latestCreatedAt,
          behaviorTypeDistribution,
          symbolPairDistribution,
          marketTimeDistribution,
          now,
        }),
      },
    };
  }

  async listCards(userId: string, dto: ListFlashcardCardsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);

    const cards = await this.listAllCards(userId);
    const filtered = cards.filter((card) => {
      if (dto.behaviorType && card.behaviorType !== dto.behaviorType) {
        return false;
      }
      if (dto.cardId) {
        const keyword = dto.cardId.trim().toLowerCase();
        if (keyword && !(card.cardId || '').toLowerCase().includes(keyword)) {
          return false;
        }
      }
      if (
        dto.invalidationType &&
        card.invalidationType !== dto.invalidationType
      ) {
        return false;
      }
      if (dto.symbolPairInfo) {
        const keyword = dto.symbolPairInfo.trim().toLowerCase();
        if (
          keyword &&
          !(card.symbolPairInfo || '').toLowerCase().includes(keyword)
        ) {
          return false;
        }
      }
      if (dto.playbookType && card.playbookType !== dto.playbookType) {
        return false;
      }
      if (dto.marketTimeInfo) {
        const keyword = dto.marketTimeInfo.trim().toLowerCase();
        if (
          keyword &&
          !(card.marketTimeInfo || '').toLowerCase().includes(keyword)
        ) {
          return false;
        }
      }
      if (dto.drillStatus && dto.drillStatus !== 'ALL') {
        if (this.resolveDrillStatus(card) !== dto.drillStatus) {
          return false;
        }
      }
      return true;
    });

    const sorted = this.sortCards(
      filtered,
      dto.sortBy || 'CREATED_AT',
      dto.sortOrder || (dto.sortBy === 'QUALITY_SCORE_AVG' ? 'asc' : 'desc'),
    );

    const items = sorted.slice(offset, offset + pageSize);
    const normalizedItems = await Promise.all(
      items.map((item) => this.attachDictionaryTags(this.normalizeCard(item))),
    );
    const nextOffset = offset + items.length;

    return {
      success: true,
      data: {
        items: normalizedItems,
        totalCount: filtered.length,
        nextCursor:
          nextOffset < filtered.length
            ? this.encodeOffsetCursor(nextOffset)
            : null,
      },
    };
  }

  async rateCard(userId: string, cardId: string, score: number) {
    const now = new Date().toISOString();
    const card = await this.getCardById(userId, cardId);
    const qualityScoreCount = (card.qualityScoreCount || 0) + 1;
    const previousScoreTotal =
      (card.qualityScoreAvg || 0) * (card.qualityScoreCount || 0);
    const qualityScoreAvg = Number(
      ((previousScoreTotal + score) / qualityScoreCount).toFixed(2),
    );

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression: 'attribute_exists(cardId)',
      UpdateExpression:
        'SET qualityScoreAvg = :qualityScoreAvg, qualityScoreCount = :qualityScoreCount, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':qualityScoreAvg': qualityScoreAvg,
        ':qualityScoreCount': qualityScoreCount,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    return {
      success: true,
      data: await this.attachDictionaryTags(
        this.normalizeCard(updated.Attributes as FlashcardCard),
      ),
    };
  }

  async deleteCard(userId: string, cardId: string) {
    try {
      await this.db.delete({
        TableName: this.tableName,
        Key: {
          userId,
          cardId,
        },
        ConditionExpression: 'attribute_exists(cardId)',
      });
    } catch (error: any) {
      if (String(error?.name || '').includes('ConditionalCheckFailed')) {
        throw new ResourceNotFoundException(
          `flashcard not found: ${cardId}`,
          ERROR_CODES.RESOURCE_NOT_FOUND,
          '卡片不存在或已删除',
          { userId, cardId },
        );
      }
      throw error;
    }

    return {
      success: true,
      data: {
        cardId,
      },
    };
  }

  async updateCardDrillStatus(
    userId: string,
    cardId: string,
    dto: UpdateFlashcardDrillStatusDto,
  ) {
    const now = new Date().toISOString();
    const isDisabled = dto.drillStatus === 'DISABLED';
    const disabledReason = dto.disabledReason?.trim();

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression:
        'attribute_exists(cardId) AND (attribute_not_exists(entityType) OR entityType = :entityTypeCard)',
      UpdateExpression: isDisabled
        ? 'SET drillStatus = :drillStatus, disabledAt = :disabledAt, disabledReason = :disabledReason, updatedAt = :updatedAt, entityType = if_not_exists(entityType, :entityTypeCard)'
        : 'SET drillStatus = :drillStatus, updatedAt = :updatedAt, entityType = if_not_exists(entityType, :entityTypeCard) REMOVE disabledAt, disabledReason',
      ExpressionAttributeValues: isDisabled
        ? {
            ':entityTypeCard': 'CARD',
            ':drillStatus': dto.drillStatus,
            ':disabledAt': now,
            ':disabledReason': disabledReason || '',
            ':updatedAt': now,
          }
        : {
            ':entityTypeCard': 'CARD',
            ':drillStatus': dto.drillStatus,
            ':updatedAt': now,
          },
      ReturnValues: 'ALL_NEW',
    });

    return {
      success: true,
      data: await this.attachDictionaryTags(
        this.normalizeCard(updated.Attributes as FlashcardCard),
      ),
    };
  }

  async duplicateCard(
    userId: string,
    cardId: string,
    dto: DuplicateFlashcardCardDto,
  ) {
    const source = await this.getCardById(userId, cardId);
    const overrides = dto.overrides || {};
    const now = new Date().toISOString();
    const nextCardId = uuidv4();

    const expectedAction =
      overrides.expectedAction ||
      overrides.direction ||
      source.expectedAction ||
      source.direction;
    const behaviorType =
      overrides.behaviorType === undefined
        ? source.behaviorType
        : overrides.behaviorType;
    const invalidationType =
      overrides.invalidationType === undefined
        ? source.invalidationType
        : overrides.invalidationType;
    const systemOutcomeType =
      overrides.systemOutcomeType === undefined
        ? source.systemOutcomeType
        : overrides.systemOutcomeType;
    const earlyExitTag =
      overrides.earlyExitTag === undefined
        ? source.earlyExitTag === true
        : overrides.earlyExitTag === true;
    const earlyExitReason = earlyExitTag
      ? overrides.earlyExitReason === undefined
        ? source.earlyExitReason
        : overrides.earlyExitReason.trim() || undefined
      : undefined;
    const earlyExitImageUrls = earlyExitTag
      ? overrides.earlyExitImageUrls === undefined
        ? source.earlyExitImageUrls
        : overrides.earlyExitImageUrls.map((item) => item.trim()).filter(Boolean)
      : undefined;
    const orderFlowImageUrls =
      overrides.orderFlowImageUrls === undefined
        ? source.orderFlowImageUrls
        : overrides.orderFlowImageUrls.map((item) => item.trim()).filter(Boolean);
    const orderFlowRemark =
      overrides.orderFlowRemark === undefined
        ? source.orderFlowRemark
        : overrides.orderFlowRemark.trim() || undefined;
    const marketTimeInfo =
      overrides.marketTimeInfo === undefined
        ? source.marketTimeInfo
        : overrides.marketTimeInfo.trim() || undefined;
    const symbolPairInfo =
      overrides.symbolPairInfo === undefined
        ? source.symbolPairInfo
        : overrides.symbolPairInfo.trim() || undefined;
    const playbookType =
      overrides.playbookType === undefined
        ? source.playbookType
        : (
            await this.dictionaryService.assertCategoryCodesExist(
              userId,
              'playbook_type',
              overrides.playbookType ? [overrides.playbookType] : undefined,
            )
          )[0];
    const notes =
      overrides.notes === undefined
        ? source.notes
        : overrides.notes.trim() || undefined;
    const tagCodes =
      overrides.tagCodes === undefined
        ? source.tagCodes
        : await this.dictionaryService.assertCategoryCodesExist(
            userId,
            'flashcard_tag',
            overrides.tagCodes,
          );

    if (!expectedAction) {
      throw new BadRequestException('expectedAction is required');
    }
    if (!systemOutcomeType) {
      throw new BadRequestException('systemOutcomeType is required');
    }
    if (!marketTimeInfo?.trim()) {
      throw new BadRequestException('marketTimeInfo is required');
    }
    if (!symbolPairInfo?.trim()) {
      throw new BadRequestException('symbolPairInfo is required');
    }
    if (!playbookType) {
      throw new BadRequestException('playbookType is required');
    }

    const item: FlashcardCard = {
      id: nextCardId,
      userId,
      cardId: nextCardId,
      entityType: 'CARD',
      questionImageUrl: overrides.questionImageUrl || source.questionImageUrl,
      answerImageUrl: overrides.answerImageUrl || source.answerImageUrl,
      expectedAction,
      direction: expectedAction,
      behaviorType,
      invalidationType,
      systemOutcomeType,
      earlyExitTag,
      earlyExitReason,
      earlyExitImageUrls,
      orderFlowImageUrls,
      orderFlowRemark,
      marketTimeInfo,
      symbolPairInfo,
      playbookType,
      notes,
      tagCodes,
      drillStatus: 'ENABLED',
      copiedFromCardId: source.cardId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(cardId)',
    });

    return {
      success: true,
      data: await this.attachDictionaryTags(this.normalizeCard(item)),
    };
  }

  async updateCardNote(userId: string, cardId: string, note?: string) {
    const now = new Date().toISOString();
    const trimmedNote = note?.trim();
    const hasNote = typeof trimmedNote === 'string' && trimmedNote.length > 0;

    const result = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression:
        'attribute_exists(cardId) AND (attribute_not_exists(entityType) OR entityType = :entityTypeCard)',
      UpdateExpression: hasNote
        ? 'SET notes = :notes, updatedAt = :updatedAt, entityType = if_not_exists(entityType, :entityTypeCard)'
        : 'SET updatedAt = :updatedAt, entityType = if_not_exists(entityType, :entityTypeCard) REMOVE notes',
      ExpressionAttributeValues: hasNote
        ? {
            ':notes': trimmedNote,
            ':updatedAt': now,
            ':entityTypeCard': 'CARD',
          }
        : {
            ':updatedAt': now,
            ':entityTypeCard': 'CARD',
          },
      ReturnValues: 'ALL_NEW',
    });

    return {
      success: true,
      data: await this.attachDictionaryTags(
        this.normalizeCard(result.Attributes as FlashcardCard),
      ),
    };
  }

  async updateCard(
    userId: string,
    cardId: string,
    dto: UpdateFlashcardCardDto,
  ) {
    const now = new Date().toISOString();
    const current = await this.getCardById(userId, cardId);
    const {
      qualityScoreAvg: _qualityScoreAvg,
      qualityScoreCount: _qualityScoreCount,
      ...currentWithoutQualityScore
    } = current;

    const nextAction =
      dto.expectedAction ||
      dto.direction ||
      current.expectedAction ||
      current.direction;
    const behaviorType =
      dto.behaviorType === undefined ? current.behaviorType : dto.behaviorType;
    const invalidationType =
      dto.invalidationType === undefined
        ? current.invalidationType
        : dto.invalidationType;
    const systemOutcomeType =
      dto.systemOutcomeType === undefined
        ? current.systemOutcomeType
        : dto.systemOutcomeType;
    const earlyExitTag =
      dto.earlyExitTag === undefined ? current.earlyExitTag === true : dto.earlyExitTag === true;
    const earlyExitReason = earlyExitTag
      ? dto.earlyExitReason === undefined
        ? current.earlyExitReason
        : dto.earlyExitReason.trim() || undefined
      : undefined;
    const earlyExitImageUrls = earlyExitTag
      ? dto.earlyExitImageUrls === undefined
        ? current.earlyExitImageUrls
        : dto.earlyExitImageUrls.map((item) => item.trim()).filter(Boolean)
      : undefined;
    const orderFlowImageUrls =
      dto.orderFlowImageUrls === undefined
        ? current.orderFlowImageUrls
        : dto.orderFlowImageUrls.map((item) => item.trim()).filter(Boolean);
    const orderFlowRemark =
      dto.orderFlowRemark === undefined
        ? current.orderFlowRemark
        : dto.orderFlowRemark.trim() || undefined;
    const marketTimeInfo =
      dto.marketTimeInfo === undefined
        ? current.marketTimeInfo
        : dto.marketTimeInfo.trim() || undefined;
    const symbolPairInfo =
      dto.symbolPairInfo === undefined
        ? current.symbolPairInfo
        : dto.symbolPairInfo.trim() || undefined;
    const playbookType =
      dto.playbookType === undefined
        ? current.playbookType
        : (
            await this.dictionaryService.assertCategoryCodesExist(
              userId,
              'playbook_type',
              dto.playbookType ? [dto.playbookType] : undefined,
            )
          )[0];
    const notes =
      dto.notes === undefined ? current.notes : dto.notes.trim() || undefined;
    const normalizedTagCodes =
      dto.tagCodes === undefined
        ? current.tagCodes
        : await this.dictionaryService.assertCategoryCodesExist(
            userId,
            'flashcard_tag',
            dto.tagCodes,
          );

    if (!systemOutcomeType) {
      throw new BadRequestException('systemOutcomeType is required');
    }
    if (!marketTimeInfo?.trim()) {
      throw new BadRequestException('marketTimeInfo is required');
    }
    if (!symbolPairInfo?.trim()) {
      throw new BadRequestException('symbolPairInfo is required');
    }
    if (!playbookType) {
      throw new BadRequestException('playbookType is required');
    }

    const updated: FlashcardCard = {
      ...currentWithoutQualityScore,
      entityType: 'CARD',
      questionImageUrl: dto.questionImageUrl || current.questionImageUrl,
      answerImageUrl: dto.answerImageUrl || current.answerImageUrl,
      expectedAction: nextAction,
      direction: nextAction,
      behaviorType,
      invalidationType,
      systemOutcomeType,
      earlyExitTag,
      earlyExitReason,
      earlyExitImageUrls,
      orderFlowImageUrls,
      orderFlowRemark,
      marketTimeInfo,
      symbolPairInfo,
      playbookType,
      notes,
      tagCodes: normalizedTagCodes,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: updated,
    });

    return {
      success: true,
      data: await this.attachDictionaryTags(this.normalizeCard(updated)),
    };
  }

  async startSession(userId: string, dto: StartFlashcardDrillSessionDto) {
    const cards = await this.pickCardsBySource(userId, dto.source, dto.count);
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const sessionItem: FlashcardDrillSessionItem = {
      userId,
      cardId: this.makeSessionKey(sessionId),
      entityType: 'SESSION',
      sessionId,
      source: dto.source,
      total: cards.length,
      answered: 0,
      correct: 0,
      wrong: 0,
      score: 0,
      status: 'IN_PROGRESS',
      cardIds: cards.map((card) => card.cardId),
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: sessionItem,
    });

    return {
      success: true,
      data: {
        sessionId,
        source: dto.source,
        count: cards.length,
        cards,
      },
    };
  }

  async submitAttempt(
    userId: string,
    sessionId: string,
    dto: CreateFlashcardDrillAttemptDto,
  ) {
    const now = new Date().toISOString();
    const session = await this.getSession(userId, sessionId);

    if (!session.cardIds.includes(dto.cardId)) {
      throw new ResourceNotFoundException(
        `card ${dto.cardId} not in session ${sessionId}`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '该题目不属于当前练习会话',
        { userId, sessionId, cardId: dto.cardId },
      );
    }

    const card = await this.getCardById(userId, dto.cardId);
    const expectedAction = this.resolveExpectedAction(card);
    const isCorrect = expectedAction === dto.userAction;

    const attemptKey = this.makeAttemptKey(sessionId, dto.cardId);
    const existingAttemptResult = await this.db.get({
      TableName: this.tableName,
      Key: { userId, cardId: attemptKey },
    });

    if (existingAttemptResult.Item) {
      const existingAttempt = existingAttemptResult.Item as FlashcardDrillAttemptItem;
      const nextUserAction = dto.userAction;
      const nextIsCorrect = expectedAction === nextUserAction;
      const mistakeReasons = this.resolveDrillMistakeReasons(
        nextIsCorrect,
        dto.mistakeReasons,
        dto.mistakeReason,
        existingAttempt,
      );

      if (typeof dto.isFavorite === 'boolean') {
        await this.setFavorite(userId, dto.cardId, dto.isFavorite, now);
      }

      if (typeof dto.note === 'string') {
        await this.updateCardNote(userId, dto.cardId, dto.note);
      }

      const updateSetParts = [
        'userAction = :userAction',
        'expectedAction = :expectedAction',
        'isCorrect = :isCorrect',
        'isFavorite = :isFavorite',
        'noteSnapshot = :noteSnapshot',
        'updatedAt = :updatedAt',
      ];
      const updateExpressionValues: Record<string, unknown> = {
        ':userAction': nextUserAction,
        ':expectedAction': expectedAction,
        ':isCorrect': nextIsCorrect,
        ':isFavorite': dto.isFavorite === true ? true : existingAttempt.isFavorite === true,
        ':noteSnapshot': typeof dto.note === 'string' ? dto.note.trim() || undefined : existingAttempt.noteSnapshot,
        ':updatedAt': now,
      };
      if (!nextIsCorrect) {
        updateSetParts.push('mistakeReasons = :mistakeReasons');
        updateExpressionValues[':mistakeReasons'] = mistakeReasons;
      }

      await this.db.update({
        TableName: this.tableName,
        Key: { userId, cardId: attemptKey },
        UpdateExpression: `SET ${updateSetParts.join(', ')}${
          nextIsCorrect ? ' REMOVE mistakeReasons, mistakeReason' : ''
        }`,
        ExpressionAttributeValues: updateExpressionValues,
      });

      if (
        existingAttempt.isCorrect !== nextIsCorrect ||
        existingAttempt.userAction !== nextUserAction
      ) {
        const correctDelta = (nextIsCorrect ? 1 : 0) - (existingAttempt.isCorrect ? 1 : 0);
        const wrongDelta = (nextIsCorrect ? 0 : 1) - (existingAttempt.isCorrect ? 0 : 1);

        const sessionUpdate = await this.db.update({
          TableName: this.tableName,
          Key: { userId, cardId: this.makeSessionKey(sessionId) },
          ConditionExpression:
            'attribute_exists(cardId) AND entityType = :entityTypeSession',
          UpdateExpression:
            'SET correct = correct + :incCorrect, wrong = wrong + :incWrong, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':entityTypeSession': 'SESSION',
            ':incCorrect': correctDelta,
            ':incWrong': wrongDelta,
            ':updatedAt': now,
          },
          ReturnValues: 'ALL_NEW',
        });

        return {
          success: true,
          data: {
            isCorrect: nextIsCorrect,
            expectedAction,
            mistakeReasons,
            runningStats: this.toSessionStats(
              sessionUpdate.Attributes as FlashcardDrillSessionItem,
            ),
          },
        };
      }

      return {
        success: true,
        data: {
          isCorrect: nextIsCorrect,
          expectedAction,
          mistakeReasons,
          runningStats: this.toSessionStats(session),
        },
      };
    }

    const mistakeReasons = this.resolveDrillMistakeReasons(
      isCorrect,
      dto.mistakeReasons,
      dto.mistakeReason,
    );

    if (typeof dto.isFavorite === 'boolean') {
      await this.setFavorite(userId, dto.cardId, dto.isFavorite, now);
    }

    if (typeof dto.note === 'string') {
      await this.updateCardNote(userId, dto.cardId, dto.note);
      card.notes = dto.note.trim();
    }

    if (!isCorrect) {
      await this.upsertWrongBook(userId, dto.cardId, sessionId, now);
    }

    const attemptItem: FlashcardDrillAttemptItem = {
      userId,
      cardId: attemptKey,
      entityType: 'ATTEMPT',
      sessionId,
      targetCardId: dto.cardId,
      userAction: dto.userAction,
      expectedAction,
      isCorrect,
      ...(mistakeReasons.length ? { mistakeReasons } : {}),
      isFavorite: dto.isFavorite === true,
      noteSnapshot: card.notes,
      answeredAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: attemptItem,
    });

    const sessionUpdate = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSessionKey(sessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET answered = answered + :incAnswered, correct = correct + :incCorrect, wrong = wrong + :incWrong, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SESSION',
        ':incAnswered': 1,
        ':incCorrect': isCorrect ? 1 : 0,
        ':incWrong': isCorrect ? 0 : 1,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession =
      sessionUpdate.Attributes as FlashcardDrillSessionItem;

    return {
      success: true,
      data: {
        isCorrect,
        expectedAction,
        mistakeReasons,
        runningStats: this.toSessionStats(updatedSession),
      },
    };
  }

  async finishSession(userId: string, sessionId: string) {
    const now = new Date().toISOString();
    const session = await this.getSession(userId, sessionId);

    const score = this.calcScore(session.correct, session.answered);

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSessionKey(sessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET #status = :statusCompleted, endedAt = :endedAt, score = :score, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SESSION',
        ':statusCompleted': 'COMPLETED',
        ':endedAt': now,
        ':score': score,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession = updated.Attributes as FlashcardDrillSessionItem;

    return {
      success: true,
      data: {
        sessionId,
        score: updatedSession.score,
        stats: this.toSessionStats(updatedSession),
      },
    };
  }

  async abandonSession(userId: string, sessionId: string) {
    const now = new Date().toISOString();
    const session = await this.getSession(userId, sessionId);

    if (session.status === 'COMPLETED' || session.status === 'ABANDONED') {
      return {
        success: true,
        data: {
          sessionId,
          score: this.calcScore(session.correct, session.answered),
          stats: this.toSessionStats(session),
        },
      };
    }

    const score = this.calcScore(session.correct, session.answered);

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSessionKey(sessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET #status = :statusAbandoned, endedAt = :endedAt, score = :score, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SESSION',
        ':statusAbandoned': 'ABANDONED',
        ':endedAt': now,
        ':score': score,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession = updated.Attributes as FlashcardDrillSessionItem;

    return {
      success: true,
      data: {
        sessionId,
        score: updatedSession.score,
        stats: this.toSessionStats(updatedSession),
      },
    };
  }

  async startSimulationSession(
    userId: string,
    dto: StartFlashcardSimulationSessionDto,
  ) {
    const mode = dto.mode || 'STANDARD';
    const simulationSessionId = uuidv4();
    const now = new Date().toISOString();

    let pickedCards: FlashcardCard[] = [];
    let source: FlashcardSimulationSessionItem['source'] = dto.filters ? 'FILTERED' : 'ALL';

    if (mode === 'ATTEMPT_REPLAY') {
      const attempts = await this.queryByPrefix<FlashcardSimulationAttemptItem>(
        userId,
        'simulation-attempt#',
      );
      const resolvedAttempts = attempts.filter(
        (item) =>
          item.entityType === 'SIMULATION_ATTEMPT' &&
          item.status === 'RESOLVED' &&
          Boolean(item.result) &&
          (!dto.filters?.result?.length || dto.filters.result.includes(item.result!)),
      );

      this.shuffleInPlace(resolvedAttempts);

      const selectedAttempts = resolvedAttempts.slice(0, dto.count || 5);
      pickedCards = await Promise.all(
        selectedAttempts.map(async (attempt) => {
          const card = await this.getCardById(userId, attempt.targetCardId);
          return {
            ...card,
            prefilledRevealProgress: attempt.revealProgress,
            prefilledHorizontalViewportPercent: attempt.horizontalViewportPercent ?? 0,
            replaySourceAttemptId: attempt.attemptId,
            previousAttemptResult: attempt.result,
            previousEntryDirection: attempt.entryDirection,
            previousEntryReason: attempt.entryReason,
            previousRrValue: attempt.rrValue,
            previousFailureReason: attempt.failureReason,
          } as FlashcardCard;
        }),
      );
      source = 'ATTEMPT_REPLAY';
    } else {
      const cards = await this.listAllCards(userId);
      const filtered = cards.filter((card) => this.matchesFilters(card, dto));
      this.shuffleInPlace(filtered);
      pickedCards = filtered.slice(0, dto.count || 5);
    }

    const sessionItem: FlashcardSimulationSessionItem = {
      userId,
      cardId: this.makeSimulationSessionKey(simulationSessionId),
      entityType: 'SIMULATION_SESSION',
      simulationSessionId,
      mode,
      source,
      count: dto.count || 5,
      totalCards: pickedCards.length,
      completedAttemptCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      status: 'IN_PROGRESS',
      cardIds: pickedCards.map((card) => card.cardId),
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: sessionItem });

    return {
      success: true,
      data: {
        simulationSessionId,
        mode,
        count: pickedCards.length,
        cards: pickedCards,
      },
    };
  }

  async createSimulationAttempt(
    userId: string,
    sessionId: string,
    dto: CreateFlashcardSimulationAttemptDto,
  ) {
    const now = new Date().toISOString();
    const session = await this.getSimulationSession(userId, sessionId);

    if (!session.cardIds.includes(dto.cardId)) {
      throw new ResourceNotFoundException(
        `card ${dto.cardId} not in simulation session ${sessionId}`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '该题目不属于当前模拟盘训练会话',
        { userId, sessionId, cardId: dto.cardId },
      );
    }

    const card = await this.getCardById(userId, dto.cardId);
    const attemptId = uuidv4();
    const attemptItem: FlashcardSimulationAttemptItem = {
      userId,
      cardId: this.makeSimulationAttemptKey(sessionId, attemptId),
      entityType: 'SIMULATION_ATTEMPT',
      attemptId,
      simulationSessionId: sessionId,
      targetCardId: dto.cardId,
      status: 'ENTRY_SAVED',
      questionImageUrlSnapshot: card.questionImageUrl,
      answerImageUrlSnapshot: card.answerImageUrl,
      revealProgress: dto.revealProgress,
      horizontalViewportPercent: dto.horizontalViewportPercent ?? 0,
      replaySourceAttemptId: dto.replaySourceAttemptId,
      entryLineYPercent: dto.entryLineYPercent,
      stopLossLineYPercent: dto.stopLossLineYPercent,
      takeProfitLineYPercent: dto.takeProfitLineYPercent,
      rrValue: dto.rrValue,
      entryDirection: dto.entryDirection,
      entryReason: dto.entryReason.trim(),
      entrySavedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: attemptItem });

    const updatedCard = await this.applySimulationEntryMetricsToCard(userId, dto.cardId, {
      rrValue: dto.rrValue,
      now,
    });

    return {
      success: true,
      data: {
        attemptId,
        status: attemptItem.status,
        attempt: this.toSimulationAttemptDetail(attemptItem),
        cardMetrics: this.toCardSimulationMetrics(updatedCard),
      },
    };
  }

  async resolveSimulationAttempt(
    userId: string,
    attemptId: string,
    dto: ResolveFlashcardSimulationAttemptDto,
  ) {
    const now = new Date().toISOString();
    const attempt = await this.getSimulationAttempt(userId, attemptId);

    if (attempt.status === 'RESOLVED') {
      const session = await this.getSimulationSession(userId, attempt.simulationSessionId);
      const card = await this.getCardById(userId, attempt.targetCardId);
      return {
        success: true,
        data: {
          attemptId: attempt.attemptId,
          status: attempt.status,
          result: attempt.result,
          runningStats: this.toSimulationSessionStats(session),
          cardMetrics: this.toCardSimulationMetrics(card),
        },
      };
    }

    const result = dto.result;
    const cardQualityScore = dto.cardQualityScore || 5;
    const primaryMistakeCode = dto.primaryMistakeCode?.trim();
    const mistakeCodes = dto.mistakeCodes?.map((item) => item.trim()).filter(Boolean);
    const correctionNote = dto.correctionNote?.trim();

    if (result === 'FAILURE') {
      if (!primaryMistakeCode) {
        throw new BadRequestException('primaryMistakeCode is required when result=FAILURE');
      }
      if (!mistakeCodes?.length) {
        throw new BadRequestException('mistakeCodes is required when result=FAILURE');
      }
    }

    const failureReason = dto.failureReason?.trim();
    const resolvedAttemptUpdate = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationAttemptKey(attempt.simulationSessionId, attemptId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeAttempt',
      UpdateExpression:
        result === 'FAILURE'
          ? 'SET #status = :statusResolved, #result = :result, failureReason = :failureReason, primaryMistakeCode = :primaryMistakeCode, mistakeCodes = :mistakeCodes, correctionNote = :correctionNote, cardQualityScore = :cardQualityScore, resolvedAt = :resolvedAt, updatedAt = :updatedAt'
          : 'SET #status = :statusResolved, #result = :result, cardQualityScore = :cardQualityScore, resolvedAt = :resolvedAt, updatedAt = :updatedAt REMOVE failureReason, primaryMistakeCode, mistakeCodes, correctionNote',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#result': 'result',
      },
      ExpressionAttributeValues: {
        ':entityTypeAttempt': 'SIMULATION_ATTEMPT',
        ':statusResolved': 'RESOLVED',
        ':result': result,
        ...(result === 'FAILURE'
          ? {
              ':failureReason': failureReason || '',
              ':primaryMistakeCode': primaryMistakeCode,
              ':mistakeCodes': mistakeCodes,
              ':correctionNote': correctionNote || '',
            }
          : {}),
        ':cardQualityScore': cardQualityScore,
        ':resolvedAt': now,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const sessionUpdate = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationSessionKey(attempt.simulationSessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET completedAttemptCount = if_not_exists(completedAttemptCount, :zero) + :incCompleted, successCount = if_not_exists(successCount, :zero) + :incSuccess, failureCount = if_not_exists(failureCount, :zero) + :incFailure, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SIMULATION_SESSION',
        ':zero': 0,
        ':incCompleted': 1,
        ':incSuccess': result === 'SUCCESS' ? 1 : 0,
        ':incFailure': result === 'FAILURE' ? 1 : 0,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession = sessionUpdate.Attributes as FlashcardSimulationSessionItem;
    const updatedCard = await this.applySimulationResolveMetricsToCard(userId, attempt.targetCardId, {
      result,
      cardQualityScore,
      now,
    });

    const resolvedAttempt = resolvedAttemptUpdate.Attributes as FlashcardSimulationAttemptItem;

    if (result === 'FAILURE' && primaryMistakeCode && mistakeCodes?.length) {
      await this.mistakeService.createSimulationFailureRecord({
        userId,
        attemptId: resolvedAttempt.attemptId,
        cardId: attempt.targetCardId,
        playbookType: updatedCard.playbookType,
        tagCodes: updatedCard.tagCodes,
        primaryMistakeCode,
        mistakeCodes,
        correctionNote,
      });
    }

    return {
      success: true,
      data: {
        attemptId: resolvedAttempt.attemptId,
        status: resolvedAttempt.status,
        result: resolvedAttempt.result,
        runningStats: this.toSimulationSessionStats(updatedSession),
        cardMetrics: this.toCardSimulationMetrics(updatedCard),
      },
    };
  }

  async finishSimulationSession(userId: string, sessionId: string) {
    const now = new Date().toISOString();
    const session = await this.getSimulationSession(userId, sessionId);
    const stats = this.toSimulationSessionStats(session);

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationSessionKey(sessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET #status = :statusCompleted, endedAt = :endedAt, completedAttemptCount = :completedAttemptCount, successRate = :successRate, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SIMULATION_SESSION',
        ':statusCompleted': 'COMPLETED',
        ':endedAt': now,
        ':completedAttemptCount': stats.completedCount,
        ':successRate': Number(stats.successRate.toFixed(4)),
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession = updated.Attributes as FlashcardSimulationSessionItem;
    const updatedStats = this.toSimulationSessionStats(updatedSession);

    return {
      success: true,
      data: {
        simulationSessionId: sessionId,
        totalCards: updatedSession.totalCards,
        completedAttemptCount: updatedStats.completedCount,
        successCount: updatedStats.successCount,
        failureCount: updatedStats.failureCount,
        successRate: Number(updatedStats.successRate.toFixed(4)),
        status: updatedSession.status,
      },
    };
  }

  async listSimulationSessions(
    userId: string,
    dto: ListFlashcardSimulationSessionsDto,
  ) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const sessions = await this.listAllSimulationSessions(userId);
    const filtered = sessions
      .filter((session) => (dto.status ? session.status === dto.status : true))
      .sort((a, b) => this.simulationSessionSortTs(b) - this.simulationSessionSortTs(a));

    const items = filtered.slice(offset, offset + pageSize).map((session) => ({
      simulationSessionId: session.simulationSessionId,
      mode: session.mode || 'STANDARD',
      source: session.source,
      count: session.count,
      totalCards: session.totalCards,
      completedAttemptCount: this.toSimulationSessionStats(session).completedCount,
      successCount: session.successCount,
      failureCount: session.failureCount,
      successRate:
        session.successRate || this.toSimulationSessionStats(session).successRate,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      updatedAt: session.updatedAt,
    }));
    const nextOffset = offset + items.length;

    return {
      success: true,
      data: {
        items,
        nextCursor:
          nextOffset < filtered.length
            ? this.encodeOffsetCursor(nextOffset)
            : null,
      },
    };
  }

  async listSimulationAttempts(
    userId: string,
    dto: ListFlashcardSimulationAttemptsDto,
  ) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const attempts = await this.listAllSimulationAttempts(userId);
    const resultFilter = dto.result || 'ALL';

    const filtered = attempts
      .filter((attempt) => {
        if (resultFilter === 'SUCCESS') {
          return attempt.status === 'RESOLVED' && attempt.result === 'SUCCESS';
        }
        if (resultFilter === 'FAILURE') {
          return attempt.status === 'RESOLVED' && attempt.result === 'FAILURE';
        }
        return true;
      })
      .sort((a, b) => {
        const right = Date.parse(b.resolvedAt || b.updatedAt || b.createdAt);
        const left = Date.parse(a.resolvedAt || a.updatedAt || a.createdAt);
        return right - left;
      });

    const items = filtered
      .slice(offset, offset + pageSize)
      .map((attempt) => this.toSimulationAttemptDetail(attempt));
    const nextOffset = offset + items.length;

    return {
      success: true,
      data: {
        resultFilter,
        totalCount: filtered.length,
        items,
        nextCursor:
          nextOffset < filtered.length
            ? this.encodeOffsetCursor(nextOffset)
            : null,
      },
    };
  }

  async getCard(userId: string, cardId: string) {
    const card = await this.getCardById(userId, cardId);
    return {
      success: true,
      data: card,
    };
  }

  async getSimulationAttemptDetail(userId: string, attemptId: string) {
    const attempt = await this.getSimulationAttempt(userId, attemptId);
    return {
      success: true,
      data: this.toSimulationAttemptDetail(attempt),
    };
  }

  async updateSimulationAttempt(
    userId: string,
    attemptId: string,
    dto: ResolveFlashcardSimulationAttemptDto,
  ) {
    const now = new Date().toISOString();
    const attempt = await this.getSimulationAttempt(userId, attemptId);

    const result = dto.result;
    const cardQualityScore = dto.cardQualityScore || 5;
    const primaryMistakeCode = dto.primaryMistakeCode?.trim();
    const mistakeCodes = dto.mistakeCodes?.map((item) => item.trim()).filter(Boolean);
    const correctionNote = dto.correctionNote?.trim();
    const failureReason = dto.failureReason?.trim();

    if (result === 'FAILURE') {
      if (!primaryMistakeCode) {
        throw new BadRequestException('primaryMistakeCode is required when result=FAILURE');
      }
      if (!mistakeCodes?.length) {
        throw new BadRequestException('mistakeCodes is required when result=FAILURE');
      }
    }

    const updatedAttempt: FlashcardSimulationAttemptItem = {
      ...attempt,
      status: 'RESOLVED',
      result,
      failureReason: result === 'FAILURE' ? failureReason || '' : undefined,
      primaryMistakeCode: result === 'FAILURE' ? primaryMistakeCode : undefined,
      mistakeCodes: result === 'FAILURE' ? mistakeCodes : undefined,
      correctionNote: result === 'FAILURE' ? correctionNote || '' : undefined,
      cardQualityScore,
      resolvedAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: updatedAttempt,
    });

    await this.mistakeService.deleteRecordsBySimulationAttemptId(userId, attemptId);
    if (result === 'FAILURE' && primaryMistakeCode && mistakeCodes?.length) {
      const card = await this.getCardById(userId, attempt.targetCardId);
      await this.mistakeService.createSimulationFailureRecord({
        userId,
        attemptId,
        cardId: attempt.targetCardId,
        playbookType: card.playbookType,
        tagCodes: card.tagCodes,
        primaryMistakeCode,
        mistakeCodes,
        correctionNote,
      });
    }

    await this.recalculateSimulationAggregates(userId, attempt.simulationSessionId, attempt.targetCardId, now);

    return {
      success: true,
      data: this.toSimulationAttemptDetail(updatedAttempt),
    };
  }

  async deleteSimulationAttempt(userId: string, attemptId: string) {
    const attempt = await this.getSimulationAttempt(userId, attemptId);

    await this.db.delete({
      TableName: this.tableName,
      Key: {
        userId,
        cardId: this.makeSimulationAttemptKey(attempt.simulationSessionId, attemptId),
      },
    });

    await this.mistakeService.deleteRecordsBySimulationAttemptId(userId, attemptId);
    await this.recalculateSimulationAggregates(
      userId,
      attempt.simulationSessionId,
      attempt.targetCardId,
      new Date().toISOString(),
    );

    return {
      success: true,
      data: {
        attemptId,
      },
    };
  }

  async getSimulationCardHistory(
    userId: string,
    targetCardId: string,
    dto: ListFlashcardSimulationCardHistoryDto,
  ) {
    await this.getCardById(userId, targetCardId);
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const attempts = await this.listSimulationAttemptsByCardId(userId, targetCardId);
    const sorted = attempts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const items = sorted.slice(offset, offset + pageSize).map((attempt) => ({
      attemptId: attempt.attemptId,
      simulationSessionId: attempt.simulationSessionId,
      status: attempt.status,
      revealProgress: attempt.revealProgress,
      result: attempt.result,
      failureReason: attempt.failureReason,
      entryReason: attempt.entryReason,
      cardQualityScore: attempt.cardQualityScore,
      rrValue: attempt.rrValue,
      createdAt: attempt.createdAt,
      resolvedAt: attempt.resolvedAt,
    }));
    const nextOffset = offset + items.length;
    const summary = this.buildSimulationCardSummary(attempts);

    return {
      success: true,
      data: {
        cardId: targetCardId,
        summary,
        items,
        nextCursor:
          nextOffset < sorted.length
            ? this.encodeOffsetCursor(nextOffset)
            : null,
      },
    };
  }

  async getSimulationPlaybookAnalytics(
    userId: string,
    dto: GetFlashcardSimulationPlaybookAnalyticsDto,
  ) {
    const recentWindow = dto.recentWindow || 30;
    const minResolved = dto.minResolved || 5;
    const attempts = await this.listAllSimulationAttempts(userId);
    const resolvedAttempts = attempts
      .filter((attempt) => attempt.status === 'RESOLVED' && Boolean(attempt.result))
      .sort((a, b) => {
        const right = Date.parse(b.resolvedAt || b.updatedAt || b.createdAt);
        const left = Date.parse(a.resolvedAt || a.updatedAt || a.createdAt);
        return right - left;
      })
      .slice(0, recentWindow);

    const cards = await this.batchGetCardsByIds(
      userId,
      resolvedAttempts.map((attempt) => attempt.targetCardId),
    );
    const cardsById = new Map(cards.map((card) => [card.cardId, card] as const));
    const playbookCodes = Array.from(
      new Set(
        resolvedAttempts
          .map((attempt) => cardsById.get(attempt.targetCardId)?.playbookType)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const playbookDictionaryItems = await this.dictionaryService.resolveCategoryItemsByCodes(
      userId,
      'playbook_type',
      playbookCodes,
    );
    const playbookLabelByCode = new Map(
      (playbookDictionaryItems || []).map((item: any) => [item.code, item.label] as const),
    );

    const grouped = new Map<string, { cardIds: Set<string>; attempts: FlashcardSimulationAttemptItem[] }>();

    for (const attempt of resolvedAttempts) {
      const card = cardsById.get(attempt.targetCardId);
      const playbookType = card?.playbookType;
      if (!playbookType) {
        continue;
      }
      const current = grouped.get(playbookType) || {
        cardIds: new Set<string>(),
        attempts: [],
      };
      current.cardIds.add(attempt.targetCardId);
      current.attempts.push(attempt);
      grouped.set(playbookType, current);
    }

    const items = Array.from(grouped.entries())
      .map(([playbookType, group]) =>
        this.buildSimulationPlaybookAnalyticsItem({
          playbookType,
          label: playbookLabelByCode.get(playbookType) || playbookType,
          attempts: group.attempts,
          cards: Array.from(group.cardIds)
            .map((cardId) => cardsById.get(cardId))
            .filter((card): card is FlashcardCard => Boolean(card)),
          minResolved,
        }),
      )
      .sort((a, b) => {
        if (b.weaknessScore !== a.weaknessScore) {
          return b.weaknessScore - a.weaknessScore;
        }
        if (a.successRate !== b.successRate) {
          return a.successRate - b.successRate;
        }
        return b.resolvedCount - a.resolvedCount;
      });

    return {
      success: true,
      data: {
        summary: {
          totalPlaybooks: grouped.size,
          rankedPlaybooks: items.filter((item) => !item.flags.includes('LOW_SAMPLE')).length,
          minResolved,
          recentWindow,
          totalResolvedAttempts: resolvedAttempts.length,
        },
        weakest: items.filter((item) => !item.flags.includes('LOW_SAMPLE')).slice(0, 3),
        items,
      },
    };
  }

  async listWrongBook(userId: string) {
    const wrongItems = await this.queryByPrefix<FlashcardWrongBookItem>(
      userId,
      'wrong#',
    );

    const cards = await this.batchGetCardsByIds(
      userId,
      wrongItems.map((item) => item.targetCardId),
    );

    return {
      success: true,
      data: cards.filter((card) => this.isDrillTrainable(card)),
    };
  }

  async listFavorites(userId: string) {
    const favoriteItems = await this.queryByPrefix<FlashcardFavoriteItem>(
      userId,
      'favorite#',
    );

    const cards = await this.batchGetCardsByIds(
      userId,
      favoriteItems.map((item) => item.targetCardId),
    );

    return {
      success: true,
      data: cards.filter((card) => this.isDrillTrainable(card)),
    };
  }

  async listDrillSessions(userId: string, dto: ListFlashcardDrillSessionsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);

    const sessions = await this.listAllDrillSessions(userId);
    const filtered = sessions
      .filter((session) => (dto.status ? session.status === dto.status : true))
      .sort((a, b) => this.sessionSortTs(b) - this.sessionSortTs(a));

    const items = filtered.slice(offset, offset + pageSize).map((session) => ({
      sessionId: session.sessionId,
      source: session.source,
      total: session.total,
      answered: session.answered,
      correct: session.correct,
      wrong: session.wrong,
      accuracy: session.answered > 0 ? session.correct / session.answered : 0,
      score: this.calcScore(session.correct, session.answered),
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      updatedAt: session.updatedAt,
    }));
    const nextOffset = offset + items.length;

    return {
      success: true,
      data: {
        items,
        nextCursor:
          nextOffset < filtered.length
            ? this.encodeOffsetCursor(nextOffset)
            : null,
      },
    };
  }

  async getDrillSessionDetail(userId: string, sessionId: string) {
    const session = await this.getSession(userId, sessionId);
    const cards = await this.batchGetCardsByIds(userId, session.cardIds);
    const cardsById = new Map(cards.map((card) => [card.cardId, card] as const));
    const orderedCards = session.cardIds
      .map((cardId) => cardsById.get(cardId))
      .filter((card): card is FlashcardCard => Boolean(card));

    const attempts = await this.queryByPrefix<FlashcardDrillAttemptItem>(
      userId,
      this.makeAttemptPrefix(sessionId),
    );

    return {
      success: true,
      data: {
        session: {
          sessionId: session.sessionId,
          source: session.source,
          total: session.total,
          answered: session.answered,
          correct: session.correct,
          wrong: session.wrong,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          updatedAt: session.updatedAt,
          stats: this.toSessionStats(session),
        },
        cards: orderedCards,
        attempts: attempts
          .filter((item) => item.entityType === 'ATTEMPT')
          .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
          .map((item) => ({
            cardId: item.targetCardId,
            userAction: item.userAction,
            expectedAction: item.expectedAction,
            isCorrect: item.isCorrect,
            mistakeReasons: item.mistakeReasons || (item.mistakeReason ? [item.mistakeReason] : undefined),
            isFavorite: item.isFavorite,
            noteSnapshot: item.noteSnapshot,
            answeredAt: item.answeredAt,
          })),
      },
    };
  }

  async getDrillAnalytics(
    userId: string,
    dto: GetFlashcardDrillAnalyticsDto,
  ) {
    const recentWindow = dto.recentWindow || 30;
    const sessions = await this.listAllDrillSessions(userId);
    const completedSessions = sessions
      .filter((session) => session.status === 'COMPLETED')
      .sort((a, b) => this.sessionSortTs(b) - this.sessionSortTs(a));

    const recent7 = completedSessions.slice(0, 7);
    const previous7 = completedSessions.slice(7, 14);
    const recentN = completedSessions.slice(0, recentWindow);
    const previousN = completedSessions.slice(recentWindow, recentWindow * 2);

    const recentAttempts = await this.listAttemptsForSessions(
      userId,
      recentN.map((session) => session.sessionId),
    );

    const referencedCards = await this.batchGetCardsByIds(
      userId,
      recentAttempts.map((attempt) => attempt.targetCardId),
    );
    const cardsById = new Map(
      referencedCards.map((card) => [card.cardId, card] as const),
    );

    const behaviorAggregation = this.aggregateAttemptDimensionStats(
      recentAttempts,
      cardsById,
      'behaviorType',
    );
    const invalidationAggregation = this.aggregateAttemptDimensionStats(
      recentAttempts,
      cardsById,
      'invalidationType',
    );

    return {
      success: true,
      data: {
        summary: {
          totalCompletedSessions: completedSessions.length,
          averageScore: this.averageScore(completedSessions),
          bestScore: this.bestScore(completedSessions),
          recentScore: completedSessions[0]
            ? this.calcScore(
                completedSessions[0].correct,
                completedSessions[0].answered,
              )
            : 0,
          recentAccuracy:
            completedSessions[0]?.answered && completedSessions[0].answered > 0
              ? completedSessions[0].correct / completedSessions[0].answered
              : 0,
        },
        windows: {
          recent7: this.buildAnalyticsWindow(recent7, previous7),
          recent30: this.buildAnalyticsWindow(recentN, previousN),
        },
        trend: {
          recentWindow,
          points: recentN
            .slice()
            .reverse()
            .map((session): FlashcardDrillAnalyticsTrendPoint => ({
              sessionId: session.sessionId,
              score: this.calcScore(session.correct, session.answered),
              accuracy:
                session.answered > 0 ? session.correct / session.answered : 0,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
            })),
        },
        weaknesses: {
          basedOnCompletedSessions: recentN.length,
          labeledAttemptCount:
            behaviorAggregation.labeledAttemptCount +
            invalidationAggregation.labeledAttemptCount,
          unlabeledBehaviorAttemptCount:
            behaviorAggregation.unlabeledAttemptCount,
          unlabeledInvalidationAttemptCount:
            invalidationAggregation.unlabeledAttemptCount,
          behaviorTypes: behaviorAggregation.stats,
          invalidationTypes: invalidationAggregation.stats,
        },
      },
    };
  }

  async getDrillCardErrorRanking(
    userId: string,
    dto: GetFlashcardDrillCardErrorRankingDto,
  ) {
    const recentWindow = dto.recentWindow || 30;
    const minAnswered = dto.minAnswered || 3;
    const limit = dto.limit || 5;
    const sessions = await this.listAllDrillSessions(userId);
    const completedSessions = sessions
      .filter((session) => session.status === 'COMPLETED')
      .sort((a, b) => this.sessionSortTs(b) - this.sessionSortTs(a));
    const recentSessions = completedSessions.slice(0, recentWindow);
    const attempts = await this.listAttemptsForSessions(
      userId,
      recentSessions.map((session) => session.sessionId),
    );
    const referencedCards = await this.batchGetCardsByIds(
      userId,
      attempts.map((attempt) => attempt.targetCardId),
    );
    const enabledReferencedCards = referencedCards.filter((card) =>
      this.isDrillEnabled(card),
    );
    const cardsById = new Map(
      enabledReferencedCards.map((card) => [card.cardId, card] as const),
    );
    const playbookCodes = Array.from(
      new Set(
        enabledReferencedCards
          .map((card) => card.playbookType)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const drillPlaybookDictionaryItems = await this.dictionaryService.resolveCategoryItemsByCodes(
      userId,
      'playbook_type',
      playbookCodes,
    );
    const playbookLabelByCode = new Map(
      (drillPlaybookDictionaryItems || []).map((item: any) => [item.code, item.label] as const),
    );

    const grouped = new Map<
      string,
      {
        answeredCount: number;
        wrongCount: number;
        correctCount: number;
        mistakeReasonCounts: Map<FlashcardDrillMistakeReason, number>;
        lastAnsweredAt?: string;
      }
    >();
    const playbookGrouped = new Map<
      string,
      {
        playbookType?: string;
        answeredCount: number;
        wrongCount: number;
        correctCount: number;
        cardIds: Set<string>;
        lastAnsweredAt?: string;
      }
    >();
    for (const attempt of attempts) {
      const card = cardsById.get(attempt.targetCardId);
      if (!card) {
        continue;
      }

      const stat = grouped.get(attempt.targetCardId) || {
        answeredCount: 0,
        wrongCount: 0,
        correctCount: 0,
        mistakeReasonCounts: new Map<FlashcardDrillMistakeReason, number>(),
        lastAnsweredAt: undefined,
      };
      stat.answeredCount += 1;
      if (attempt.isCorrect) {
        stat.correctCount += 1;
      } else {
        stat.wrongCount += 1;
        const mistakeReasons = attempt.mistakeReasons || (attempt.mistakeReason ? [attempt.mistakeReason] : []);
        for (const reason of mistakeReasons) {
          stat.mistakeReasonCounts.set(
            reason,
            (stat.mistakeReasonCounts.get(reason) || 0) + 1,
          );
        }
      }
      if (!stat.lastAnsweredAt || attempt.answeredAt > stat.lastAnsweredAt) {
        stat.lastAnsweredAt = attempt.answeredAt;
      }
      grouped.set(attempt.targetCardId, stat);

      const playbookKey = card.playbookType || '__UNSPECIFIED__';
      const playbookStat = playbookGrouped.get(playbookKey) || {
        playbookType: card.playbookType,
        answeredCount: 0,
        wrongCount: 0,
        correctCount: 0,
        cardIds: new Set<string>(),
        lastAnsweredAt: undefined,
      };
      playbookStat.answeredCount += 1;
      if (attempt.isCorrect) {
        playbookStat.correctCount += 1;
      } else {
        playbookStat.wrongCount += 1;
      }
      playbookStat.cardIds.add(attempt.targetCardId);
      if (
        !playbookStat.lastAnsweredAt ||
        attempt.answeredAt > playbookStat.lastAnsweredAt
      ) {
        playbookStat.lastAnsweredAt = attempt.answeredAt;
      }
      playbookGrouped.set(playbookKey, playbookStat);
    }

    const rankedItems = Array.from(grouped.entries())
      .filter(([, stat]) => stat.answeredCount >= minAnswered)
      .map(([cardId, stat]): FlashcardDrillCardErrorRankingItem | null => {
        const card = cardsById.get(cardId);
        if (!card) {
          return null;
        }
        return {
          cardId,
          questionImageUrl: card.questionImageUrl,
          answerImageUrl: card.answerImageUrl,
          symbolPairInfo: card.symbolPairInfo,
          marketTimeInfo: card.marketTimeInfo,
          playbookType: card.playbookType,
          playbookLabel: card.playbookType
            ? playbookLabelByCode.get(card.playbookType) || card.playbookType
            : undefined,
          answeredCount: stat.answeredCount,
          wrongCount: stat.wrongCount,
          correctCount: stat.correctCount,
          errorRate: stat.answeredCount > 0 ? stat.wrongCount / stat.answeredCount : 0,
          mistakeReasonCounts: Array.from(stat.mistakeReasonCounts.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count),
          lastAnsweredAt: stat.lastAnsweredAt,
          drillStatus: (card as FlashcardCard & { drillStatus?: string }).drillStatus,
        };
      })
      .filter((item): item is FlashcardDrillCardErrorRankingItem => Boolean(item))
      .sort((a, b) => {
        if (b.errorRate !== a.errorRate) {
          return b.errorRate - a.errorRate;
        }
        if (b.wrongCount !== a.wrongCount) {
          return b.wrongCount - a.wrongCount;
        }
        return (b.lastAnsweredAt || '').localeCompare(a.lastAnsweredAt || '');
      });
    const allPlaybookItems = Array.from(playbookGrouped.values())
      .filter((stat) => stat.answeredCount >= minAnswered)
      .map((stat): FlashcardDrillPlaybookErrorRankingItem => ({
        playbookType: stat.playbookType,
        playbookLabel: stat.playbookType
          ? playbookLabelByCode.get(stat.playbookType) || stat.playbookType
          : '未标记剧本',
        answeredCount: stat.answeredCount,
        wrongCount: stat.wrongCount,
        correctCount: stat.correctCount,
        errorRate:
          stat.answeredCount > 0 ? stat.wrongCount / stat.answeredCount : 0,
        cardCount: stat.cardIds.size,
        lastAnsweredAt: stat.lastAnsweredAt,
      }));
    const playbookItems = [...allPlaybookItems]
      .sort((a, b) => {
        if (b.errorRate !== a.errorRate) {
          return b.errorRate - a.errorRate;
        }
        if (b.wrongCount !== a.wrongCount) {
          return b.wrongCount - a.wrongCount;
        }
        return (b.lastAnsweredAt || '').localeCompare(a.lastAnsweredAt || '');
      });
    const playbookWrongCountItems = [...allPlaybookItems].sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) {
        return b.wrongCount - a.wrongCount;
      }
      if (b.errorRate !== a.errorRate) {
        return b.errorRate - a.errorRate;
      }
      return (b.lastAnsweredAt || '').localeCompare(a.lastAnsweredAt || '');
    });

    return {
      success: true,
      data: {
        items: rankedItems.slice(0, limit),
        playbookItems: playbookItems.slice(0, limit),
        playbookWrongCountItems: playbookWrongCountItems.slice(0, limit),
        summary: {
          recentWindow,
          minAnswered,
          rankedCardCount: rankedItems.length,
          rankedPlaybookCount: playbookItems.length,
        },
      },
    };
  }

  private async pickCardsBySource(
    userId: string,
    source: FlashcardSource,
    count: number,
  ): Promise<FlashcardCard[]> {
    if (source === 'ALL') {
      const cards = (await this.listAllCards(userId)).filter((card) =>
        this.isDrillTrainable(card),
      );
      this.shuffleInPlace(cards);
      return cards.slice(0, count);
    }

    const relationPrefix = source === 'WRONG_BOOK' ? 'wrong#' : 'favorite#';
    const relationItems = await this.queryByPrefix<
      FlashcardWrongBookItem | FlashcardFavoriteItem
    >(userId, relationPrefix);

    if (!relationItems.length) {
      return [];
    }

    const cardIds = relationItems.map((item) => item.targetCardId);
    const cards = (await this.batchGetCardsByIds(userId, cardIds)).filter(
      (card) => this.isDrillTrainable(card),
    );
    this.shuffleInPlace(cards);
    return cards.slice(0, count);
  }

  private async getSession(
    userId: string,
    sessionId: string,
  ): Promise<FlashcardDrillSessionItem> {
    const result = await this.db.get({
      TableName: this.tableName,
      ConsistentRead: true,
      Key: {
        userId,
        cardId: this.makeSessionKey(sessionId),
      },
    });

    const item = result.Item as FlashcardDrillSessionItem | undefined;

    if (!item || item.entityType !== 'SESSION') {
      throw new ResourceNotFoundException(
        `session not found: ${sessionId}`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '练习会话不存在',
        { userId, sessionId },
      );
    }

    return item;
  }

  private async getCardById(
    userId: string,
    cardId: string,
  ): Promise<FlashcardCard> {
    const result = await this.db.get({
      TableName: this.tableName,
      Key: {
        userId,
        cardId,
      },
    });

    const card = result.Item as FlashcardCard | undefined;
    const isCardEntity =
      !!card &&
      (card.entityType === 'CARD' ||
        (!card.entityType && !!card.questionImageUrl && !!card.answerImageUrl));

    if (!isCardEntity) {
      throw new ResourceNotFoundException(
        `flashcard not found: ${cardId}`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '卡片不存在或已删除',
        { userId, cardId },
      );
    }

    return this.attachDictionaryTags(this.normalizeCard(card));
  }

  private async listAllCards(userId: string): Promise<FlashcardCard[]> {
    return this.queryAllCards(userId);
  }

  private async listAllCardsByCreatedAtDesc(
    userId: string,
  ): Promise<FlashcardCard[]> {
    return this.queryAllCards(userId, {
      indexName: this.createdAtIndexName,
      scanIndexForward: false,
    });
  }

  private async queryAllCards(
    userId: string,
    options?: {
      indexName?: string;
      scanIndexForward?: boolean;
    },
  ): Promise<FlashcardCard[]> {
    const cards: FlashcardCard[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        IndexName: options?.indexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
        ScanIndexForward: options?.scanIndexForward,
      });

      const pageItems = (result.Items || []) as FlashcardCard[];
      const pageCards = pageItems.filter(
        (item) =>
          item.entityType === 'CARD' ||
          (!item.entityType &&
            !!item.questionImageUrl &&
            !!item.answerImageUrl),
      );

      const normalizedCards = await Promise.all(
        pageCards.map((item) => this.attachDictionaryTags(this.normalizeCard(item))),
      );
      cards.push(...normalizedCards);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return cards;
  }

  private async listAllDrillSessions(
    userId: string,
  ): Promise<FlashcardDrillSessionItem[]> {
    const sessions: FlashcardDrillSessionItem[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression:
          'userId = :userId AND begins_with(cardId, :prefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':prefix': 'session#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });

      sessions.push(...((result.Items || []) as FlashcardDrillSessionItem[]));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return sessions.filter((item) => item.entityType === 'SESSION');
  }

  private async listAttemptsForSessions(
    userId: string,
    sessionIds: string[],
  ): Promise<FlashcardDrillAttemptItem[]> {
    const attempts: FlashcardDrillAttemptItem[] = [];

    for (const sessionId of sessionIds) {
      const sessionAttempts =
        await this.queryByPrefix<FlashcardDrillAttemptItem>(
          userId,
          `attempt#${sessionId}#`,
        );
      attempts.push(
        ...sessionAttempts.filter((item) => item.entityType === 'ATTEMPT'),
      );
    }

    return attempts;
  }

  private async batchGetCardsByIds(
    userId: string,
    cardIds: string[],
  ): Promise<FlashcardCard[]> {
    if (!cardIds.length) {
      return [];
    }

    const uniqueCardIds = Array.from(new Set(cardIds));
    const cards: FlashcardCard[] = [];

    for (let i = 0; i < uniqueCardIds.length; i += 100) {
      const chunk = uniqueCardIds.slice(i, i + 100);
      const result = await this.db.batchGet({
        RequestItems: {
          [this.tableName]: {
            Keys: chunk.map((cardId) => ({ userId, cardId })),
          },
        },
      });

      const items = (
        (result.Responses?.[this.tableName] as FlashcardCard[] | undefined) ||
        []
      ).filter(
        (item) =>
          item.entityType === 'CARD' ||
          (!item.entityType &&
            !!item.questionImageUrl &&
            !!item.answerImageUrl),
      );

      const normalizedCards = await Promise.all(
        items.map((item) => this.attachDictionaryTags(this.normalizeCard(item))),
      );
      cards.push(...normalizedCards);
    }

    return cards;
  }

  private async queryByPrefix<T extends { targetCardId: string }>(
    userId: string,
    prefix: string,
  ): Promise<T[]> {
    const items: T[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression:
          'userId = :userId AND begins_with(cardId, :prefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':prefix': prefix,
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });

      items.push(...((result.Items || []) as T[]));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return items;
  }

  private async setFavorite(
    userId: string,
    targetCardId: string,
    isFavorite: boolean,
    now: string,
  ) {
    const key = this.makeFavoriteKey(targetCardId);

    if (!isFavorite) {
      await this.db.delete({
        TableName: this.tableName,
        Key: {
          userId,
          cardId: key,
        },
      });
      return;
    }

    const item: FlashcardFavoriteItem = {
      userId,
      cardId: key,
      entityType: 'FAVORITE',
      targetCardId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: item,
    });
  }

  private async upsertWrongBook(
    userId: string,
    targetCardId: string,
    sessionId: string,
    now: string,
  ) {
    const item: FlashcardWrongBookItem = {
      userId,
      cardId: this.makeWrongBookKey(targetCardId),
      entityType: 'WRONG_BOOK',
      targetCardId,
      lastSessionId: sessionId,
      lastAnsweredAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: item,
    });
  }

  private toSessionStats(session: FlashcardDrillSessionItem) {
    return {
      total: session.total,
      answered: session.answered,
      correct: session.correct,
      wrong: session.wrong,
      accuracy: session.answered > 0 ? session.correct / session.answered : 0,
      score: this.calcScore(session.correct, session.answered),
      status: session.status,
    };
  }

  private calcScore(correct: number, answered: number) {
    if (answered <= 0) return 0;
    return Math.round((correct / answered) * 100);
  }

  private averageScore(sessions: FlashcardDrillSessionItem[]) {
    if (!sessions.length) return 0;
    const total = sessions.reduce(
      (sum, session) => sum + this.calcScore(session.correct, session.answered),
      0,
    );
    return Math.round(total / sessions.length);
  }

  private bestScore(sessions: FlashcardDrillSessionItem[]) {
    if (!sessions.length) return 0;
    return Math.max(
      ...sessions.map((session) =>
        this.calcScore(session.correct, session.answered),
      ),
    );
  }

  private lowestScore(sessions: FlashcardDrillSessionItem[]) {
    if (!sessions.length) return 0;
    return Math.min(
      ...sessions.map((session) =>
        this.calcScore(session.correct, session.answered),
      ),
    );
  }

  private buildAnalyticsWindow(
    current: FlashcardDrillSessionItem[],
    previous: FlashcardDrillSessionItem[],
  ): FlashcardDrillAnalyticsWindow {
    const currentAverage = this.averageScore(current);
    const previousAverage = this.averageScore(previous);

    return {
      sampleSize: current.length,
      averageScore: currentAverage,
      bestScore: this.bestScore(current),
      lowestScore: this.lowestScore(current),
      deltaFromPrevious:
        previous.length > 0 ? currentAverage - previousAverage : null,
    };
  }

  private aggregateAttemptDimensionStats(
    attempts: FlashcardDrillAttemptItem[],
    cardsById: Map<string, FlashcardCard>,
    field: 'behaviorType' | 'invalidationType',
  ): {
    stats: FlashcardDrillAnalyticsDimensionStat[];
    labeledAttemptCount: number;
    unlabeledAttemptCount: number;
  } {
    const grouped = new Map<
      string,
      { total: number; correct: number; wrong: number }
    >();
    let unlabeledAttemptCount = 0;
    let labeledAttemptCount = 0;

    for (const attempt of attempts) {
      const card = cardsById.get(attempt.targetCardId);
      const key = card?.[field];

      if (!key) {
        unlabeledAttemptCount += 1;
        continue;
      }

      labeledAttemptCount += 1;
      const current = grouped.get(key) || { total: 0, correct: 0, wrong: 0 };
      current.total += 1;
      if (attempt.isCorrect) {
        current.correct += 1;
      } else {
        current.wrong += 1;
      }
      grouped.set(key, current);
    }

    const stats = Array.from(grouped.entries())
      .map(([key, value]): FlashcardDrillAnalyticsDimensionStat => ({
        key,
        total: value.total,
        correct: value.correct,
        wrong: value.wrong,
        accuracy: value.total > 0 ? value.correct / value.total : 0,
        wrongRate: value.total > 0 ? value.wrong / value.total : 0,
      }))
      .sort((a, b) => {
        if (b.wrong !== a.wrong) return b.wrong - a.wrong;
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
        return b.total - a.total;
      });

    return { stats, labeledAttemptCount, unlabeledAttemptCount };
  }

  private async listAllSimulationSessions(
    userId: string,
  ): Promise<FlashcardSimulationSessionItem[]> {
    const sessions: FlashcardSimulationSessionItem[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression:
          'userId = :userId AND begins_with(cardId, :prefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':prefix': 'simulation-session#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });

      sessions.push(...((result.Items || []) as FlashcardSimulationSessionItem[]));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return sessions.filter((item) => item.entityType === 'SIMULATION_SESSION');
  }

  private async listSimulationAttemptsByCardId(
    userId: string,
    targetCardId: string,
  ): Promise<FlashcardSimulationAttemptItem[]> {
    const attempts = await this.listAllSimulationAttempts(userId);

    return attempts.filter((item) => item.targetCardId === targetCardId);
  }

  private async listAllSimulationAttempts(
    userId: string,
  ): Promise<FlashcardSimulationAttemptItem[]> {
    const attempts = await this.queryByPrefix<FlashcardSimulationAttemptItem>(
      userId,
      'simulation-attempt#',
    );

    return attempts.filter((item) => item.entityType === 'SIMULATION_ATTEMPT');
  }

  private async getSimulationSession(userId: string, sessionId: string) {
    const result = await this.db.get({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationSessionKey(sessionId) },
    });

    const session = result.Item as FlashcardSimulationSessionItem | undefined;

    if (!session || session.entityType !== 'SIMULATION_SESSION') {
      throw new ResourceNotFoundException(
        `simulation session ${sessionId} not found`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '模拟盘训练会话不存在',
        { userId, sessionId },
      );
    }

    return session;
  }

  private async getSimulationAttempt(userId: string, attemptId: string) {
    const attempts = await this.queryByPrefix<FlashcardSimulationAttemptItem>(
      userId,
      'simulation-attempt#',
    );
    const attempt = attempts.find(
      (item) => item.entityType === 'SIMULATION_ATTEMPT' && item.attemptId === attemptId,
    );

    if (!attempt) {
      throw new ResourceNotFoundException(
        `simulation attempt ${attemptId} not found`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '模拟盘训练记录不存在',
        { userId, attemptId },
      );
    }

    return attempt;
  }

  private async applySimulationEntryMetricsToCard(
    userId: string,
    cardId: string,
    input: {
      rrValue: number;
      now: string;
    },
  ) {
    const card = await this.getCardById(userId, cardId);
    const attemptCount = (card.simulationAttemptCount || 0) + 1;
    const previousRrTotal = (card.simulationAvgRr || 0) * (card.simulationAttemptCount || 0);
    const simulationAvgRr = Number(
      ((previousRrTotal + input.rrValue) / Math.max(attemptCount, 1)).toFixed(2),
    );

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression: 'attribute_exists(cardId)',
      UpdateExpression:
        'SET simulationAttemptCount = :attemptCount, simulationAvgRr = :simulationAvgRr, lastSimulationAt = :lastSimulationAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':attemptCount': attemptCount,
        ':simulationAvgRr': simulationAvgRr,
        ':lastSimulationAt': input.now,
        ':updatedAt': input.now,
      },
      ReturnValues: 'ALL_NEW',
    });

    return this.normalizeCard(updated.Attributes as FlashcardCard);
  }

  private async applySimulationResolveMetricsToCard(
    userId: string,
    cardId: string,
    input: {
      result: 'SUCCESS' | 'FAILURE';
      cardQualityScore: number;
      now: string;
    },
  ) {
    const card = await this.getCardById(userId, cardId);
    const resolvedCount = (card.simulationResolvedCount || 0) + 1;
    const successCount =
      (card.simulationSuccessCount || 0) + (input.result === 'SUCCESS' ? 1 : 0);
    const failureCount =
      (card.simulationFailureCount || 0) + (input.result === 'FAILURE' ? 1 : 0);
    const qualityScoreCount = (card.qualityScoreCount || 0) + 1;
    const previousScoreTotal =
      (card.qualityScoreAvg || 0) * (card.qualityScoreCount || 0);
    const qualityScoreAvg = Number(
      ((previousScoreTotal + input.cardQualityScore) / qualityScoreCount).toFixed(2),
    );
    const simulationSuccessRate = Number(
      (successCount / Math.max(resolvedCount, 1)).toFixed(4),
    );

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression: 'attribute_exists(cardId)',
      UpdateExpression:
        'SET simulationResolvedCount = :resolvedCount, simulationSuccessCount = :successCount, simulationFailureCount = :failureCount, simulationSuccessRate = :simulationSuccessRate, qualityScoreAvg = :qualityScoreAvg, qualityScoreCount = :qualityScoreCount, lastSimulationAt = :lastSimulationAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':resolvedCount': resolvedCount,
        ':successCount': successCount,
        ':failureCount': failureCount,
        ':simulationSuccessRate': simulationSuccessRate,
        ':qualityScoreAvg': qualityScoreAvg,
        ':qualityScoreCount': qualityScoreCount,
        ':lastSimulationAt': input.now,
        ':updatedAt': input.now,
      },
      ReturnValues: 'ALL_NEW',
    });

    return this.normalizeCard(updated.Attributes as FlashcardCard);
  }

  private async recalculateSimulationAggregates(
    userId: string,
    simulationSessionId: string,
    cardId: string,
    now: string,
  ) {
    const attemptsByCard = await this.listSimulationAttemptsByCardId(userId, cardId);
    const cardSummary = this.buildSimulationCardSummary(attemptsByCard);

    await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression: 'attribute_exists(cardId)',
      UpdateExpression:
        'SET simulationAttemptCount = :simulationAttemptCount, simulationResolvedCount = :simulationResolvedCount, simulationSuccessCount = :simulationSuccessCount, simulationFailureCount = :simulationFailureCount, simulationSuccessRate = :simulationSuccessRate, simulationAvgRr = :simulationAvgRr, qualityScoreAvg = :qualityScoreAvg, qualityScoreCount = :qualityScoreCount, lastSimulationAt = :lastSimulationAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':simulationAttemptCount': cardSummary.simulationAttemptCount || 0,
        ':simulationResolvedCount': cardSummary.simulationResolvedCount || 0,
        ':simulationSuccessCount': cardSummary.simulationSuccessCount || 0,
        ':simulationFailureCount': cardSummary.simulationFailureCount || 0,
        ':simulationSuccessRate': cardSummary.simulationSuccessRate || 0,
        ':simulationAvgRr': cardSummary.simulationAvgRr || 0,
        ':qualityScoreAvg': cardSummary.qualityScoreAvg || 0,
        ':qualityScoreCount': cardSummary.qualityScoreCount || 0,
        ':lastSimulationAt': attemptsByCard[0]?.updatedAt || attemptsByCard[0]?.createdAt || null,
        ':updatedAt': now,
      },
    });

    const sessionAttempts = (await this.listAllSimulationAttempts(userId)).filter(
      (item) => item.simulationSessionId === simulationSessionId,
    );
    const resolvedAttempts = sessionAttempts.filter((item) => item.status === 'RESOLVED');
    const successCount = resolvedAttempts.filter((item) => item.result === 'SUCCESS').length;
    const failureCount = resolvedAttempts.filter((item) => item.result === 'FAILURE').length;
    const completedAttemptCount = resolvedAttempts.length;
    const successRate = completedAttemptCount > 0 ? successCount / completedAttemptCount : 0;

    await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationSessionKey(simulationSessionId) },
      ConditionExpression: 'attribute_exists(cardId)',
      UpdateExpression:
        'SET completedAttemptCount = :completedAttemptCount, successCount = :successCount, failureCount = :failureCount, successRate = :successRate, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':completedAttemptCount': completedAttemptCount,
        ':successCount': successCount,
        ':failureCount': failureCount,
        ':successRate': Number(successRate.toFixed(4)),
        ':updatedAt': now,
      },
    });
  }

  private toSimulationSessionStats(session: FlashcardSimulationSessionItem) {
    const totalCompleted =
      typeof session.completedAttemptCount === 'number'
        ? session.completedAttemptCount
        : session.successCount + session.failureCount;
    return {
      completedCount: totalCompleted,
      successCount: session.successCount,
      failureCount: session.failureCount,
      successRate:
        totalCompleted > 0 ? session.successCount / totalCompleted : 0,
    };
  }

  private toCardSimulationMetrics(card: FlashcardCard) {
    return {
      simulationAttemptCount: card.simulationAttemptCount || 0,
      simulationResolvedCount: card.simulationResolvedCount || 0,
      simulationSuccessCount: card.simulationSuccessCount || 0,
      simulationFailureCount: card.simulationFailureCount || 0,
      simulationSuccessRate: card.simulationSuccessRate || 0,
      simulationAvgRr: card.simulationAvgRr || 0,
      qualityScoreAvg: card.qualityScoreAvg || 0,
      qualityScoreCount: card.qualityScoreCount || 0,
      lastSimulationAt: card.lastSimulationAt || null,
    };
  }

  private toSimulationAttemptDetail(attempt: FlashcardSimulationAttemptItem) {
    return {
      attemptId: attempt.attemptId,
      simulationSessionId: attempt.simulationSessionId,
      cardId: attempt.targetCardId,
      status: attempt.status,
      revealProgress: attempt.revealProgress,
      horizontalViewportPercent: attempt.horizontalViewportPercent ?? 0,
      replaySourceAttemptId: attempt.replaySourceAttemptId,
      entryLineYPercent: attempt.entryLineYPercent,
      stopLossLineYPercent: attempt.stopLossLineYPercent,
      takeProfitLineYPercent: attempt.takeProfitLineYPercent,
      rrValue: attempt.rrValue,
      entryDirection: attempt.entryDirection,
      entryReason: attempt.entryReason,
      result: attempt.result,
      failureReason: attempt.failureReason,
      primaryMistakeCode: attempt.primaryMistakeCode,
      mistakeCodes: attempt.mistakeCodes,
      correctionNote: attempt.correctionNote,
      cardQualityScore: attempt.cardQualityScore,
      questionImageUrlSnapshot: attempt.questionImageUrlSnapshot,
      answerImageUrlSnapshot: attempt.answerImageUrlSnapshot,
      entrySavedAt: attempt.entrySavedAt,
      resolvedAt: attempt.resolvedAt,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  private buildSimulationCardSummary(attempts: FlashcardSimulationAttemptItem[]) {
    if (!attempts.length) {
      return {
        simulationAttemptCount: 0,
        simulationResolvedCount: 0,
        simulationSuccessCount: 0,
        simulationFailureCount: 0,
        simulationSuccessRate: 0,
        simulationAvgRr: 0,
        qualityScoreAvg: 0,
        qualityScoreCount: 0,
      };
    }

    const simulationAttemptCount = attempts.length;
    const resolvedAttempts = attempts.filter((attempt) => attempt.status === 'RESOLVED');
    const simulationResolvedCount = resolvedAttempts.length;
    const simulationSuccessCount = resolvedAttempts.filter(
      (attempt) => attempt.result === 'SUCCESS',
    ).length;
    const simulationFailureCount = resolvedAttempts.filter(
      (attempt) => attempt.result === 'FAILURE',
    ).length;
    const simulationAvgRr = Number(
      (
        attempts.reduce((sum, attempt) => sum + (attempt.rrValue || 0), 0) /
        simulationAttemptCount
      ).toFixed(2),
    );
    const qualityAttempts = resolvedAttempts.filter(
      (attempt) => typeof attempt.cardQualityScore === 'number',
    );
    const qualityScoreAvg = qualityAttempts.length
      ? Number(
          (
            qualityAttempts.reduce(
              (sum, attempt) => sum + (attempt.cardQualityScore || 0),
              0,
            ) / qualityAttempts.length
          ).toFixed(2),
        )
      : 0;

    return {
      simulationAttemptCount,
      simulationResolvedCount,
      simulationSuccessCount,
      simulationFailureCount,
      simulationSuccessRate: Number(
        (
          simulationSuccessCount / Math.max(simulationResolvedCount, 1)
        ).toFixed(4),
      ),
      simulationAvgRr,
      qualityScoreAvg,
      qualityScoreCount: qualityAttempts.length,
    };
  }

  private buildSimulationPlaybookAnalyticsItem(input: {
    playbookType: string;
    label: string;
    attempts: FlashcardSimulationAttemptItem[];
    cards: FlashcardCard[];
    minResolved: number;
  }): FlashcardSimulationPlaybookAnalyticsItem {
    const resolvedCount = input.attempts.length;
    const successCount = input.attempts.filter((attempt) => attempt.result === 'SUCCESS').length;
    const failureAttempts = input.attempts.filter((attempt) => attempt.result === 'FAILURE');
    const failureCount = failureAttempts.length;
    const successRate = resolvedCount > 0 ? successCount / resolvedCount : 0;
    const avgRr = Number(
      (
        input.attempts.reduce((sum, attempt) => sum + (attempt.rrValue || 0), 0) /
        Math.max(resolvedCount, 1)
      ).toFixed(2),
    );
    const qualityAttempts = input.attempts.filter(
      (attempt) => typeof attempt.cardQualityScore === 'number',
    );
    const qualityScoreAvg = qualityAttempts.length
      ? Number(
          (
            qualityAttempts.reduce(
              (sum, attempt) => sum + (attempt.cardQualityScore || 0),
              0,
            ) / qualityAttempts.length
          ).toFixed(2),
        )
      : 0;

    const failureReasonMap = new Map<string, number>();
    for (const attempt of failureAttempts) {
      const reason = attempt.failureReason?.trim();
      if (!reason) continue;
      failureReasonMap.set(reason, (failureReasonMap.get(reason) || 0) + 1);
    }
    const topFailureReasons = Array.from(failureReasonMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        share: Number((count / Math.max(failureCount, 1)).toFixed(4)),
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.reason.localeCompare(b.reason);
      })
      .slice(0, 3);

    const topFailureShare = topFailureReasons[0]?.share || 0;
    const successPenalty = (1 - successRate) * 100;
    const lowRRPenalty = avgRr >= 2 ? 0 : avgRr >= 1.5 ? 5 : avgRr >= 1 ? 10 : 15;
    const repeatedFailurePenalty =
      topFailureShare >= 0.6 ? 15 : topFailureShare >= 0.4 ? 8 : 0;
    const weaknessScore = Number(
      (successPenalty + lowRRPenalty + repeatedFailurePenalty).toFixed(2),
    );

    const avgCardQuality = input.cards.length
      ? Number(
          (
            input.cards.reduce((sum, card) => sum + (card.qualityScoreAvg || 0), 0) /
            input.cards.length
          ).toFixed(2),
        )
      : 0;

    const flags: string[] = [];
    if (resolvedCount < input.minResolved) {
      flags.push('LOW_SAMPLE');
    }
    if (weaknessScore >= 60) {
      flags.push('WEAK');
    }
    if (topFailureShare >= 0.4) {
      flags.push('REPEATED_FAILURE');
    }
    if (resolvedCount >= input.minResolved && successRate < 0.5 && avgRr < 1.5) {
      flags.push('HIGH_FREQUENCY_LOW_EFFICIENCY');
    }
    if (avgCardQuality > 0 && avgCardQuality < 4) {
      flags.push('LOW_CARD_QUALITY_SIGNAL');
    }

    return {
      playbookType: input.playbookType,
      label: input.label,
      attemptCount: resolvedCount,
      resolvedCount,
      successCount,
      failureCount,
      successRate: Number(successRate.toFixed(4)),
      avgRr,
      qualityScoreAvg,
      topFailureReasons,
      weaknessScore,
      flags,
    };
  }

  private sortCards(
    cards: FlashcardCard[],
    sortBy: FlashcardCardSortBy,
    sortOrder: FlashcardCardSortOrder,
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...cards].sort((a, b) => {
      if (sortBy === 'UPDATED_AT') {
        const diff =
          (this.safeParseTimestamp(a.updatedAt) -
            this.safeParseTimestamp(b.updatedAt)) *
          direction;
        if (diff !== 0) return diff;
        return this.compareCreatedAtDesc(a, b);
      }

      if (sortBy === 'QUALITY_SCORE_AVG') {
        const aValue = typeof a.qualityScoreAvg === 'number' ? a.qualityScoreAvg : 5;
        const bValue = typeof b.qualityScoreAvg === 'number' ? b.qualityScoreAvg : 5;
        if (aValue !== bValue) {
          return (aValue - bValue) * direction;
        }
        return this.compareCreatedAtDesc(a, b);
      }

      if (sortBy === 'SIMULATION_RESOLVED_COUNT') {
        const aValue = typeof a.simulationResolvedCount === 'number' ? a.simulationResolvedCount : 0;
        const bValue = typeof b.simulationResolvedCount === 'number' ? b.simulationResolvedCount : 0;
        if (aValue !== bValue) {
          return (aValue - bValue) * direction;
        }
        return this.compareCreatedAtDesc(a, b);
      }

      if (sortBy === 'SIMULATION_AVG_RR') {
        const aValue = typeof a.simulationAvgRr === 'number' ? a.simulationAvgRr : 0;
        const bValue = typeof b.simulationAvgRr === 'number' ? b.simulationAvgRr : 0;
        if (aValue !== bValue) {
          return (aValue - bValue) * direction;
        }
        return this.compareCreatedAtDesc(a, b);
      }

      const diff =
        (this.safeParseTimestamp(a.createdAt) -
          this.safeParseTimestamp(b.createdAt)) *
        direction;
      if (diff !== 0) return diff;
      return this.compareUpdatedAtDesc(a, b);
    });
  }

  private compareCreatedAtDesc(a: FlashcardCard, b: FlashcardCard) {
    return (
      this.safeParseTimestamp(b.createdAt) -
      this.safeParseTimestamp(a.createdAt)
    );
  }

  private compareUpdatedAtDesc(a: FlashcardCard, b: FlashcardCard) {
    return (
      this.safeParseTimestamp(b.updatedAt) -
      this.safeParseTimestamp(a.updatedAt)
    );
  }

  private safeParseTimestamp(value?: string) {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private simulationSessionSortTs(session: FlashcardSimulationSessionItem) {
    const updated = Date.parse(session.updatedAt || '');
    if (!Number.isNaN(updated)) return updated;
    const ended = Date.parse(session.endedAt || '');
    if (!Number.isNaN(ended)) return ended;
    const started = Date.parse(session.startedAt || '');
    if (!Number.isNaN(started)) return started;
    return 0;
  }

  private filterCardsByDate(
    cards: FlashcardCard[],
    date: string,
    timezone: string,
  ) {
    return cards.filter((card) => {
      if (!card.createdAt) {
        return false;
      }

      return (
        this.formatDateInTimezone(new Date(card.createdAt), timezone) === date
      );
    });
  }

  private pickBoundaryCreatedAt(
    cards: FlashcardCard[],
    mode: 'first' | 'latest',
  ) {
    const sorted = cards
      .map((card) => card.createdAt)
      .filter((value): value is string => typeof value === 'string')
      .sort((a, b) => Date.parse(a) - Date.parse(b));

    if (!sorted.length) {
      return null;
    }

    return mode === 'first' ? sorted[0] : sorted[sorted.length - 1];
  }

  private buildDistribution(
    cards: FlashcardCard[],
    field: 'behaviorType' | 'symbolPairInfo' | 'marketTimeInfo',
  ): FlashcardCollectionDistributionItem[] {
    const grouped = new Map<string, number>();

    for (const card of cards) {
      const rawValue = card[field];
      const value = typeof rawValue === 'string' ? rawValue.trim() : '';
      if (!value) {
        continue;
      }
      grouped.set(value, (grouped.get(value) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.value.localeCompare(b.value);
      });
  }

  private resolveCollectionState(input: {
    newCardsCount: number;
    latestCreatedAt: string | null;
    behaviorTypeDistribution: FlashcardCollectionDistributionItem[];
    symbolPairDistribution: FlashcardCollectionDistributionItem[];
    marketTimeDistribution: FlashcardCollectionDistributionItem[];
    now: Date;
  }): FlashcardCollectionState {
    const {
      newCardsCount,
      latestCreatedAt,
      behaviorTypeDistribution,
      symbolPairDistribution,
      marketTimeDistribution,
      now,
    } = input;

    if (newCardsCount <= 0) {
      return 'NO_NEW_CARDS';
    }

    if (latestCreatedAt) {
      const minutesSinceLastCreated = Math.floor(
        (now.getTime() - Date.parse(latestCreatedAt)) / 60000,
      );
      if (minutesSinceLastCreated > 180) {
        return 'COLLECTION_PAUSED';
      }
    }

    const distributions = [
      behaviorTypeDistribution,
      symbolPairDistribution,
      marketTimeDistribution,
    ];
    const hasFocusedDimension = distributions.some((items) => {
      const top = items[0];
      return !!top && top.count / newCardsCount >= 0.6;
    });

    if (hasFocusedDimension) {
      return 'FOCUSED_COLLECTION';
    }

    if (newCardsCount >= 10) {
      return 'HEAVY_COLLECTION';
    }

    if (newCardsCount >= 4) {
      const richDimensions = distributions.filter((items) => items.length >= 3);
      if (richDimensions.length >= 2) {
        return 'SCATTERED_COLLECTION';
      }
      return 'ACTIVE_COLLECTION';
    }

    return 'LIGHT_COLLECTION';
  }

  private matchesFilters(card: FlashcardCard, dto: RandomFlashcardCardsDto) {
    const filters = dto.filters;
    if (!filters) return true;

    if (
      filters.behaviorType?.length &&
      (!card.behaviorType || !filters.behaviorType.includes(card.behaviorType))
    ) {
      return false;
    }
    if (
      filters.invalidationType?.length &&
      (!card.invalidationType ||
        !filters.invalidationType.includes(card.invalidationType))
    ) {
      return false;
    }

    return true;
  }

  private normalizeCard(card: FlashcardCard): FlashcardCard {
    const expectedAction = this.resolveExpectedAction(card);

    return {
      ...card,
      expectedAction,
      direction: expectedAction,
      drillStatus: this.resolveDrillStatus(card),
    };
  }

  private resolveDrillStatus(card: FlashcardCard) {
    return card.drillStatus === 'DISABLED' ? 'DISABLED' : 'ENABLED';
  }

  private isDrillEnabled(card: FlashcardCard) {
    return this.resolveDrillStatus(card) === 'ENABLED';
  }

  private isDrillTrainable(card: FlashcardCard) {
    return this.isDrillEnabled(card) && this.isQualityEligibleForDrill(card);
  }

  private isQualityEligibleForDrill(card: FlashcardCard) {
    if (typeof card.qualityScoreAvg !== 'number') {
      return true;
    }

    const hasRatedScore =
      typeof card.qualityScoreCount === 'number'
        ? card.qualityScoreCount > 0
        : true;

    return !hasRatedScore || card.qualityScoreAvg > 3;
  }

  private async attachDictionaryTags(card: FlashcardCard): Promise<FlashcardCard> {
    const tagItems = await this.dictionaryService.resolveCategoryItemsByCodes(
      card.userId,
      'flashcard_tag',
      card.tagCodes,
    );
    return {
      ...card,
      tagItems,
    };
  }

  private resolveExpectedAction(card: FlashcardCard) {
    return card.expectedAction || card.direction || 'NO_TRADE';
  }

  private resolveDrillMistakeReasons(
    isCorrect: boolean,
    incomingReasons?: FlashcardDrillMistakeReason[],
    incomingLegacyReason?: FlashcardDrillMistakeReason,
    existingAttempt?: FlashcardDrillAttemptItem,
  ): FlashcardDrillMistakeReason[] {
    if (isCorrect) {
      if (incomingReasons?.length || incomingLegacyReason) {
        throw new BadRequestException('mistakeReasons is not allowed when answer is correct');
      }
      return [];
    }

    const mistakeReasons =
      incomingReasons ||
      (incomingLegacyReason ? [incomingLegacyReason] : undefined) ||
      existingAttempt?.mistakeReasons ||
      (existingAttempt?.mistakeReason ? [existingAttempt.mistakeReason] : undefined);
    if (!mistakeReasons?.length) {
      throw new BadRequestException('mistakeReasons is required when answer is wrong');
    }
    return Array.from(new Set(mistakeReasons));
  }

  private shuffleInPlace<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private makeSessionKey(sessionId: string) {
    return `session#${sessionId}`;
  }

  private makeAttemptKey(sessionId: string, cardId: string) {
    return `attempt#${sessionId}#${cardId}`;
  }

  private makeAttemptPrefix(sessionId: string) {
    return `attempt#${sessionId}#`;
  }

  private makeWrongBookKey(cardId: string) {
    return `wrong#${cardId}`;
  }

  private makeFavoriteKey(cardId: string) {
    return `favorite#${cardId}`;
  }

  private makeSimulationSessionKey(sessionId: string) {
    return `simulation-session#${sessionId}`;
  }

  private makeSimulationAttemptKey(sessionId: string, attemptId: string) {
    return `simulation-attempt#${sessionId}#${attemptId}`;
  }

  private resolveFileExtension(fileName: string, contentType: string) {
    const trimmed = fileName.trim();
    const dotIdx = trimmed.lastIndexOf('.');
    if (dotIdx > -1 && dotIdx < trimmed.length - 1) {
      return trimmed.slice(dotIdx + 1).toLowerCase();
    }

    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
    };

    return map[contentType] || 'png';
  }

  private buildFileUrl(key: string) {
    if (this.cloudfrontDomain) {
      return `https://${this.cloudfrontDomain}/${key}`;
    }
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private encodeCursor(lastEvaluatedKey: Record<string, unknown>) {
    return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString(
      'base64url',
    );
  }

  private decodeCursor(cursor?: string): Record<string, unknown> | undefined {
    if (!cursor) return undefined;
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private sessionSortTs(session: FlashcardDrillSessionItem) {
    const updated = Date.parse(session.updatedAt || '');
    if (!Number.isNaN(updated)) return updated;
    const ended = Date.parse(session.endedAt || '');
    if (!Number.isNaN(ended)) return ended;
    const started = Date.parse(session.startedAt || '');
    if (!Number.isNaN(started)) return started;
    return 0;
  }

  private normalizeTimezone(timezone?: string) {
    const fallback = 'Asia/Shanghai';
    if (!timezone) {
      return fallback;
    }

    try {
      Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      return timezone;
    } catch {
      return fallback;
    }
  }

  private formatDateInTimezone(date: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private encodeOffsetCursor(offset: number) {
    return Buffer.from(JSON.stringify({ offset }), 'utf8').toString(
      'base64url',
    );
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
