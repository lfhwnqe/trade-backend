import { Injectable } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
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
  FlashcardDrillAnalyticsDimensionStat,
  FlashcardDrillAnalyticsTrendPoint,
  FlashcardDrillAnalyticsWindow,
  FlashcardDrillAttemptItem,
  FlashcardDrillSessionItem,
  FlashcardFavoriteItem,
  FlashcardSimulationAttemptItem,
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
import { GetFlashcardDrillAnalyticsDto } from './dto/get-flashcard-drill-analytics.dto';
import { StartFlashcardSimulationSessionDto } from './dto/start-flashcard-simulation-session.dto';
import { CreateFlashcardSimulationAttemptDto } from './dto/create-flashcard-simulation-attempt.dto';
import { ListFlashcardSimulationSessionsDto } from './dto/list-flashcard-simulation-sessions.dto';
import { ListFlashcardSimulationCardHistoryDto } from './dto/list-flashcard-simulation-card-history.dto';

@Injectable()
export class FlashcardService {
  private readonly db: DynamoDBDocument;
  private readonly s3: S3Client;
  private readonly tableName: string;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cloudfrontDomain?: string;
  private readonly createdAtIndexName = 'userId-createdAt-index';

  constructor(private readonly configService: ConfigService) {
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
      marketTimeInfo: dto.marketTimeInfo?.trim() || undefined,
      symbolPairInfo: dto.symbolPairInfo?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: item,
    });

    return {
      success: true,
      data: this.normalizeCard(item),
    };
  }

  async randomCards(userId: string, dto: RandomFlashcardCardsDto) {
    const cards = await this.listAllCards(userId);
    const filtered = cards.filter((card) => this.matchesFilters(card, dto));

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

    const cards = await this.listAllCardsByCreatedAtDesc(userId);
    const filtered = cards.filter((card) => {
      if (dto.behaviorType && card.behaviorType !== dto.behaviorType) {
        return false;
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
      if (dto.marketTimeInfo) {
        const keyword = dto.marketTimeInfo.trim().toLowerCase();
        if (
          keyword &&
          !(card.marketTimeInfo || '').toLowerCase().includes(keyword)
        ) {
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
     const nextOffset = offset + items.length;

    return {
      success: true,
      data: {
        items,
        totalCount: filtered.length,
        nextCursor:
          nextOffset < filtered.length
            ? this.encodeOffsetCursor(nextOffset)
            : null,
      },
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
      data: this.normalizeCard(result.Attributes as FlashcardCard),
    };
  }

  async updateCard(
    userId: string,
    cardId: string,
    dto: UpdateFlashcardCardDto,
  ) {
    const now = new Date().toISOString();
    const current = await this.getCardById(userId, cardId);

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
    const marketTimeInfo =
      dto.marketTimeInfo === undefined
        ? current.marketTimeInfo
        : dto.marketTimeInfo.trim() || undefined;
    const symbolPairInfo =
      dto.symbolPairInfo === undefined
        ? current.symbolPairInfo
        : dto.symbolPairInfo.trim() || undefined;
    const notes =
      dto.notes === undefined ? current.notes : dto.notes.trim() || undefined;

    const updated: FlashcardCard = {
      ...current,
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
      marketTimeInfo,
      symbolPairInfo,
      notes,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: updated,
    });

    return {
      success: true,
      data: this.normalizeCard(updated),
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
      if (typeof dto.isFavorite === 'boolean') {
        await this.setFavorite(userId, dto.cardId, dto.isFavorite, now);
        await this.db.update({
          TableName: this.tableName,
          Key: { userId, cardId: attemptKey },
          UpdateExpression:
            'SET isFavorite = :isFavorite, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':isFavorite': dto.isFavorite,
            ':updatedAt': now,
          },
        });
      }

      if (typeof dto.note === 'string') {
        await this.updateCardNote(userId, dto.cardId, dto.note);
      }

      return {
        success: true,
        data: {
          isCorrect: (existingAttemptResult.Item as FlashcardDrillAttemptItem)
            .isCorrect,
          expectedAction,
          runningStats: this.toSessionStats(session),
        },
      };
    }

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

  async startSimulationSession(
    userId: string,
    dto: StartFlashcardSimulationSessionDto,
  ) {
    const cards = await this.listAllCards(userId);
    const filtered = cards.filter((card) => this.matchesFilters(card, dto));
    this.shuffleInPlace(filtered);

    const pickedCards = filtered.slice(0, dto.count || 5);
    const simulationSessionId = uuidv4();
    const now = new Date().toISOString();

    const sessionItem: FlashcardSimulationSessionItem = {
      userId,
      cardId: this.makeSimulationSessionKey(simulationSessionId),
      entityType: 'SIMULATION_SESSION',
      simulationSessionId,
      source: dto.filters ? 'FILTERED' : 'ALL',
      count: dto.count || 5,
      totalCards: pickedCards.length,
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
        count: pickedCards.length,
        cards: pickedCards,
      },
    };
  }

  async submitSimulationAttempt(
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

    const attemptKey = this.makeSimulationAttemptKey(sessionId, dto.cardId);
    const existingAttemptResult = await this.db.get({
      TableName: this.tableName,
      Key: { userId, cardId: attemptKey },
    });

    if (existingAttemptResult.Item) {
      const existingAttempt =
        existingAttemptResult.Item as FlashcardSimulationAttemptItem;
      const card = await this.getCardById(userId, dto.cardId);
      return {
        success: true,
        data: {
          attemptId: existingAttempt.attemptId,
          runningStats: this.toSimulationSessionStats(session),
          cardMetrics: this.toCardSimulationMetrics(card),
        },
      };
    }

    const attemptId = uuidv4();
    const result = dto.result;
    const cardQualityScore = dto.cardQualityScore || 5;
    const attemptItem: FlashcardSimulationAttemptItem = {
      userId,
      cardId: attemptKey,
      entityType: 'SIMULATION_ATTEMPT',
      attemptId,
      simulationSessionId: sessionId,
      targetCardId: dto.cardId,
      entryLineYPercent: dto.entryLineYPercent,
      stopLossLineYPercent: dto.stopLossLineYPercent,
      takeProfitLineYPercent: dto.takeProfitLineYPercent,
      rrValue: dto.rrValue,
      entryDirection: dto.entryDirection,
      entryReason: dto.entryReason.trim(),
      rrReason: dto.rrReason.trim(),
      result,
      failureNote:
        result === 'FAILURE' ? dto.failureNote?.trim() || undefined : undefined,
      cardQualityScore,
      revealedAt: now,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: attemptItem });

    const sessionUpdate = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationSessionKey(sessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET successCount = successCount + :incSuccess, failureCount = failureCount + :incFailure, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SIMULATION_SESSION',
        ':incSuccess': result === 'SUCCESS' ? 1 : 0,
        ':incFailure': result === 'FAILURE' ? 1 : 0,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession =
      sessionUpdate.Attributes as FlashcardSimulationSessionItem;

    const updatedCard = await this.applySimulationMetricsToCard(
      userId,
      dto.cardId,
      {
        result,
        cardQualityScore,
        now,
      },
    );

    return {
      success: true,
      data: {
        attemptId,
        runningStats: this.toSimulationSessionStats(updatedSession),
        cardMetrics: this.toCardSimulationMetrics(updatedCard),
      },
    };
  }

  async finishSimulationSession(userId: string, sessionId: string) {
    const now = new Date().toISOString();
    const session = await this.getSimulationSession(userId, sessionId);
    const totalCompleted = session.successCount + session.failureCount;
    const successRate =
      totalCompleted > 0 ? Number((session.successCount / totalCompleted).toFixed(4)) : 0;

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId: this.makeSimulationSessionKey(sessionId) },
      ConditionExpression:
        'attribute_exists(cardId) AND entityType = :entityTypeSession',
      UpdateExpression:
        'SET #status = :statusCompleted, endedAt = :endedAt, successRate = :successRate, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':entityTypeSession': 'SIMULATION_SESSION',
        ':statusCompleted': 'COMPLETED',
        ':endedAt': now,
        ':successRate': successRate,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    });

    const updatedSession = updated.Attributes as FlashcardSimulationSessionItem;

    return {
      success: true,
      data: {
        simulationSessionId: sessionId,
        totalCards: updatedSession.totalCards,
        successCount: updatedSession.successCount,
        failureCount: updatedSession.failureCount,
        successRate:
          updatedSession.successRate ||
          this.toSimulationSessionStats(updatedSession).successRate,
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
      source: session.source,
      count: session.count,
      totalCards: session.totalCards,
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
      result: attempt.result,
      failureNote: attempt.failureNote,
      entryReason: attempt.entryReason,
      rrReason: attempt.rrReason,
      cardQualityScore: attempt.cardQualityScore,
      rrValue: attempt.rrValue,
      createdAt: attempt.createdAt,
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
      data: cards,
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
      data: cards,
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

  private async pickCardsBySource(
    userId: string,
    source: FlashcardSource,
    count: number,
  ): Promise<FlashcardCard[]> {
    if (source === 'ALL') {
      const cards = await this.listAllCards(userId);
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
    const cards = await this.batchGetCardsByIds(userId, cardIds);
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

    return this.normalizeCard(card);
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

      cards.push(...pageCards.map((item) => this.normalizeCard(item)));
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

      cards.push(...items.map((item) => this.normalizeCard(item)));
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
    const attempts = await this.queryByPrefix<FlashcardSimulationAttemptItem>(
      userId,
      'simulation-attempt#',
    );

    return attempts.filter(
      (item) =>
        item.entityType === 'SIMULATION_ATTEMPT' &&
        item.targetCardId === targetCardId,
    );
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

  private async applySimulationMetricsToCard(
    userId: string,
    cardId: string,
    input: {
      result: 'SUCCESS' | 'FAILURE';
      cardQualityScore: number;
      now: string;
    },
  ) {
    const card = await this.getCardById(userId, cardId);
    const attemptCount = (card.simulationAttemptCount || 0) + 1;
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
      (successCount / Math.max(attemptCount, 1)).toFixed(4),
    );

    const updated = await this.db.update({
      TableName: this.tableName,
      Key: { userId, cardId },
      ConditionExpression: 'attribute_exists(cardId)',
      UpdateExpression:
        'SET simulationAttemptCount = :attemptCount, simulationSuccessCount = :successCount, simulationFailureCount = :failureCount, simulationSuccessRate = :simulationSuccessRate, qualityScoreAvg = :qualityScoreAvg, qualityScoreCount = :qualityScoreCount, lastSimulationAt = :lastSimulationAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':attemptCount': attemptCount,
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

  private toSimulationSessionStats(session: FlashcardSimulationSessionItem) {
    const totalCompleted = session.successCount + session.failureCount;
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
      simulationSuccessCount: card.simulationSuccessCount || 0,
      simulationFailureCount: card.simulationFailureCount || 0,
      simulationSuccessRate: card.simulationSuccessRate || 0,
      qualityScoreAvg: card.qualityScoreAvg || 0,
      qualityScoreCount: card.qualityScoreCount || 0,
      lastSimulationAt: card.lastSimulationAt || null,
    };
  }

  private buildSimulationCardSummary(attempts: FlashcardSimulationAttemptItem[]) {
    if (!attempts.length) {
      return {
        simulationAttemptCount: 0,
        simulationSuccessCount: 0,
        simulationFailureCount: 0,
        simulationSuccessRate: 0,
        qualityScoreAvg: 0,
      };
    }

    const simulationAttemptCount = attempts.length;
    const simulationSuccessCount = attempts.filter(
      (attempt) => attempt.result === 'SUCCESS',
    ).length;
    const simulationFailureCount = simulationAttemptCount - simulationSuccessCount;
    const qualityScoreAvg = Number(
      (
        attempts.reduce((sum, attempt) => sum + attempt.cardQualityScore, 0) /
        simulationAttemptCount
      ).toFixed(2),
    );

    return {
      simulationAttemptCount,
      simulationSuccessCount,
      simulationFailureCount,
      simulationSuccessRate: Number(
        (simulationSuccessCount / simulationAttemptCount).toFixed(4),
      ),
      qualityScoreAvg,
    };
  }

  private sortCards(
    cards: FlashcardCard[],
    sortBy: FlashcardCardSortBy,
    sortOrder: FlashcardCardSortOrder,
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...cards].sort((a, b) => {
      if (sortBy === 'QUALITY_SCORE_AVG') {
        const aValue = typeof a.qualityScoreAvg === 'number' ? a.qualityScoreAvg : 5;
        const bValue = typeof b.qualityScoreAvg === 'number' ? b.qualityScoreAvg : 5;
        if (aValue !== bValue) {
          return (aValue - bValue) * direction;
        }
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }

      return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * direction;
    });
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
    };
  }

  private resolveExpectedAction(card: FlashcardCard) {
    return card.expectedAction || card.direction || 'NO_TRADE';
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

  private makeWrongBookKey(cardId: string) {
    return `wrong#${cardId}`;
  }

  private makeFavoriteKey(cardId: string) {
    return `favorite#${cardId}`;
  }

  private makeSimulationSessionKey(sessionId: string) {
    return `simulation-session#${sessionId}`;
  }

  private makeSimulationAttemptKey(sessionId: string, cardId: string) {
    return `simulation-attempt#${sessionId}#${cardId}`;
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
