import { BadRequestException, Injectable } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { ResourceNotFoundException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { ConfigService } from '../common/config.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { FlashcardService } from '../flashcard/flashcard.service';
import { CreateTradeFlashcardCardDto } from './dto/create-trade-flashcard-card.dto';
import { ConvertTradeFlashcardToFlashcardDto } from './dto/convert-trade-flashcard-to-flashcard.dto';
import { GetTradeFlashcardUploadUrlDto } from './dto/get-trade-flashcard-upload-url.dto';
import { ListTradeFlashcardCardsDto } from './dto/list-trade-flashcard-cards.dto';
import { UpdateTradeFlashcardCardDto } from './dto/update-trade-flashcard-card.dto';
import {
  TradeFlashcardCard,
  TradeFlashcardCardSortBy,
  TradeFlashcardCardSortOrder,
  TradeFlashcardPlaybookCondition,
} from './trade-flashcard.types';

const PRE_ENTRY_IMAGE_LIMIT = 10;

@Injectable()
export class TradeFlashcardService {
  private readonly db: DynamoDBDocument;
  private readonly s3: S3Client;
  private readonly tableName: string;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cloudfrontDomain?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dictionaryService: DictionaryService,
    private readonly flashcardService: FlashcardService,
  ) {
    this.region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow('FLASHCARDS_TABLE_NAME');
    this.bucketName = this.configService.getOrThrow('IMAGE_BUCKET_NAME');
    this.cloudfrontDomain = this.configService.get('CLOUDFRONT_DOMAIN_NAME');

    this.db = DynamoDBDocument.from(new DynamoDB({ region: this.region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
    this.s3 = new S3Client({ region: this.region });
  }

  async getUploadUrl(userId: string, dto: GetTradeFlashcardUploadUrlDto) {
    const ext = this.resolveFileExtension(dto.fileName, dto.contentType);
    const date = new Date().toISOString().slice(0, 10);
    const key = `trade-flashcards/${userId}/${dto.scope}/${date}/${uuidv4()}.${ext}`;

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

  async createCard(userId: string, dto: CreateTradeFlashcardCardDto) {
    const preEntryImageUrls = this.normalizeImageUrls(
      dto.preEntryImageUrls !== undefined ? dto.preEntryImageUrls : dto.preEntryImageUrl ? [dto.preEntryImageUrl] : [],
    );
    this.assertImageUrlLimit(preEntryImageUrls, PRE_ENTRY_IMAGE_LIMIT, 'preEntryImageUrls');
    if (!preEntryImageUrls.length) {
      throw new BadRequestException('preEntryImageUrls[0] is required');
    }

    const now = new Date().toISOString();
    const cardId = uuidv4();
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
    const normalizedPossiblePlaybookTypes = await this.dictionaryService.assertCategoryCodesExist(
      userId,
      'playbook_type',
      dto.possiblePlaybookTypes,
    );
    const playbookConditions = this.normalizePlaybookConditions(
      dto.playbookConditions,
      normalizedPossiblePlaybookTypes,
    );

    const entryImageUrls = this.normalizeImageUrls(dto.entryImageUrls);
    const finalTrendImageUrl = dto.finalTrendImageUrl?.trim() || dto.postEntryImageUrl?.trim() || undefined;

    const item: TradeFlashcardCard = {
      id: cardId,
      userId,
      cardId,
      entityType: 'TRADE_FLASHCARD',
      tradeFlashcardType: dto.tradeFlashcardType,
      lifecycleStatus: this.resolveLifecycleStatus(finalTrendImageUrl),
      processResult: dto.processResult,
      isSystemAligned: dto.isSystemAligned,
      preEntryImageUrl: preEntryImageUrls[0],
      preEntryImageUrls,
      entryImageUrls,
      entryTimeInfo: dto.entryTimeInfo?.trim() || undefined,
      finalTrendImageUrl,
      postEntryImageUrl: dto.postEntryImageUrl?.trim() || undefined,
      progressImageUrls: this.normalizeImageUrls(dto.progressImageUrls),
      marketTimeInfo: dto.marketTimeInfo?.trim() || undefined,
      symbolPairInfo: dto.symbolPairInfo?.trim() || undefined,
      playbookType: normalizedPlaybookType,
      marketStructure: dto.marketStructure?.trim() || undefined,
      possiblePlaybookTypes: normalizedPossiblePlaybookTypes.length ? normalizedPossiblePlaybookTypes : undefined,
      playbookConditions,
      firstSignal: dto.firstSignal?.trim() || undefined,
      secondSignalConfirmation: dto.secondSignalConfirmation?.trim() || undefined,
      stopLossSetting: dto.stopLossSetting?.trim() || undefined,
      tagCodes: normalizedTagCodes,
      notes: dto.notes?.trim() || undefined,
      summary: dto.summary?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: item });

    return {
      success: true,
      data: await this.attachDictionaryTags(item),
    };
  }

  async listCards(userId: string, dto: ListTradeFlashcardCardsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const cards = await this.listAllCards(userId);
    const filtered = cards.filter((card) => {
      if (dto.tradeFlashcardType && card.tradeFlashcardType !== dto.tradeFlashcardType) {
        return false;
      }
      if (dto.lifecycleStatus && card.lifecycleStatus !== dto.lifecycleStatus) {
        return false;
      }
      if (dto.symbolPairInfo) {
        const keyword = dto.symbolPairInfo.trim().toLowerCase();
        if (keyword && !(card.symbolPairInfo || '').toLowerCase().includes(keyword)) {
          return false;
        }
      }
      if (dto.playbookType && card.playbookType !== dto.playbookType) {
        return false;
      }
      if (dto.marketTimeInfo) {
        const keyword = dto.marketTimeInfo.trim().toLowerCase();
        if (keyword && !(card.marketTimeInfo || '').toLowerCase().includes(keyword)) {
          return false;
        }
      }
      return true;
    });

    const sorted = this.sortCards(
      filtered,
      dto.sortBy || 'CREATED_AT',
      dto.sortOrder || 'desc',
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

  async updateCard(userId: string, cardId: string, dto: UpdateTradeFlashcardCardDto) {
    const existing = await this.getCardOrThrow(userId, cardId);
    const normalizedTagCodes = dto.tagCodes
      ? await this.dictionaryService.assertCategoryCodesExist(userId, 'flashcard_tag', dto.tagCodes)
      : existing.tagCodes;
    const normalizedPlaybookType = dto.playbookType !== undefined
      ? (
          await this.dictionaryService.assertCategoryCodesExist(
            userId,
            'playbook_type',
            dto.playbookType ? [dto.playbookType] : undefined,
          )
        )[0]
      : existing.playbookType;
    const possiblePlaybookTypesChanged = dto.possiblePlaybookTypes !== undefined;
    const normalizedPossiblePlaybookTypes = possiblePlaybookTypesChanged
      ? await this.dictionaryService.assertCategoryCodesExist(
          userId,
          'playbook_type',
          dto.possiblePlaybookTypes,
        )
      : existing.possiblePlaybookTypes || [];
    const playbookConditions = dto.playbookConditions !== undefined || possiblePlaybookTypesChanged
      ? this.normalizePlaybookConditions(
          dto.playbookConditions !== undefined ? dto.playbookConditions : existing.playbookConditions,
          normalizedPossiblePlaybookTypes,
        )
      : existing.playbookConditions;
    const nextPreEntryImageUrls = this.resolveNextPreEntryImageUrls(existing, dto);

    const updated: TradeFlashcardCard = {
      ...existing,
      tradeFlashcardType: dto.tradeFlashcardType || existing.tradeFlashcardType,
      lifecycleStatus: this.resolveLifecycleStatus(this.resolveNextFinalTrendImageUrl(existing, dto)),
      processResult:
        dto.processResult !== undefined ? dto.processResult : existing.processResult,
      isSystemAligned:
        dto.isSystemAligned !== undefined ? dto.isSystemAligned : existing.isSystemAligned,
      preEntryImageUrl: nextPreEntryImageUrls[0],
      preEntryImageUrls: nextPreEntryImageUrls,
      entryImageUrls:
        dto.entryImageUrls !== undefined
          ? this.normalizeImageUrls(dto.entryImageUrls)
          : existing.entryImageUrls,
      entryTimeInfo:
        dto.entryTimeInfo !== undefined
          ? dto.entryTimeInfo.trim() || undefined
          : existing.entryTimeInfo,
      finalTrendImageUrl: this.resolveNextFinalTrendImageUrl(existing, dto),
      postEntryImageUrl:
        dto.finalTrendImageUrl !== undefined
          ? dto.finalTrendImageUrl.trim() || undefined
          : dto.postEntryImageUrl !== undefined
            ? dto.postEntryImageUrl.trim() || undefined
            : existing.postEntryImageUrl,
      progressImageUrls:
        dto.progressImageUrls !== undefined
          ? dto.progressImageUrls.map((item) => item.trim()).filter(Boolean)
          : existing.progressImageUrls,
      marketTimeInfo:
        dto.marketTimeInfo !== undefined
          ? dto.marketTimeInfo.trim() || undefined
          : existing.marketTimeInfo,
      symbolPairInfo:
        dto.symbolPairInfo !== undefined
          ? dto.symbolPairInfo.trim() || undefined
          : existing.symbolPairInfo,
      playbookType: normalizedPlaybookType,
      marketStructure:
        dto.marketStructure !== undefined
          ? dto.marketStructure.trim() || undefined
          : existing.marketStructure,
      possiblePlaybookTypes: normalizedPossiblePlaybookTypes.length ? normalizedPossiblePlaybookTypes : undefined,
      playbookConditions,
      firstSignal:
        dto.firstSignal !== undefined ? dto.firstSignal.trim() || undefined : existing.firstSignal,
      secondSignalConfirmation:
        dto.secondSignalConfirmation !== undefined
          ? dto.secondSignalConfirmation.trim() || undefined
          : existing.secondSignalConfirmation,
      stopLossSetting:
        dto.stopLossSetting !== undefined
          ? dto.stopLossSetting.trim() || undefined
          : existing.stopLossSetting,
      tagCodes: normalizedTagCodes,
      notes: dto.notes !== undefined ? dto.notes.trim() || undefined : existing.notes,
      summary: dto.summary !== undefined ? dto.summary.trim() || undefined : existing.summary,
      updatedAt: new Date().toISOString(),
    };

    await this.db.put({ TableName: this.tableName, Item: updated });

    return {
      success: true,
      data: await this.attachDictionaryTags(updated),
    };
  }

  async deleteCard(userId: string, cardId: string) {
    await this.getCardOrThrow(userId, cardId);
    await this.db.delete({ TableName: this.tableName, Key: { userId, cardId } });
    return { success: true, data: true };
  }

  async convertToFlashcard(userId: string, cardId: string, dto: ConvertTradeFlashcardToFlashcardDto) {
    const card = await this.getCardOrThrow(userId, cardId);
    if (card.lifecycleStatus !== 'COMPLETED') {
      throw new BadRequestException('Only completed trade flashcards can be converted');
    }
    if (card.convertedToFlashcardAt || card.convertedFlashcardId) {
      throw new BadRequestException('This trade flashcard has already been converted');
    }
    const entryImageUrl = card.entryImageUrls?.[0]?.trim();
    const finalTrendImageUrl = card.finalTrendImageUrl?.trim();
    if (!entryImageUrl) {
      throw new BadRequestException('entryImageUrls[0] is required for conversion');
    }
    if (!finalTrendImageUrl) {
      throw new BadRequestException('finalTrendImageUrl is required for conversion');
    }

    const marketTimeInfo = dto.marketTimeInfo?.trim() || card.entryTimeInfo?.trim() || card.marketTimeInfo?.trim();
    const symbolPairInfo = dto.symbolPairInfo?.trim() || card.symbolPairInfo?.trim();
    const fallbackPossiblePlaybookType = card.possiblePlaybookTypes?.length === 1 ? card.possiblePlaybookTypes[0]?.trim() : undefined;
    const playbookType = dto.playbookType?.trim() || card.playbookType?.trim() || fallbackPossiblePlaybookType;

    if (!marketTimeInfo || !symbolPairInfo || !playbookType) {
      throw new BadRequestException('marketTimeInfo, symbolPairInfo and playbookType are required for conversion');
    }

    const created = await this.flashcardService.createCard(userId, {
      questionImageUrl: entryImageUrl,
      answerImageUrl: finalTrendImageUrl,
      expectedAction: dto.expectedAction,
      direction: dto.expectedAction,
      systemOutcomeType: dto.systemOutcomeType,
      marketTimeInfo,
      symbolPairInfo,
      playbookType,
      tagCodes: card.tagCodes,
      notes: [card.notes, card.summary, dto.notes].filter(Boolean).join('\n\n') || undefined,
    });

    const convertedFlashcardId = created.data?.cardId;
    const convertedAt = new Date().toISOString();

    await this.db.put({
      TableName: this.tableName,
      Item: {
        ...card,
        convertedToFlashcardAt: convertedAt,
        convertedFlashcardId,
        updatedAt: convertedAt,
      },
    });

    return {
      success: true,
      data: created.data,
    };
  }

  private async getCardOrThrow(userId: string, cardId: string) {
    const result = await this.db.get({ TableName: this.tableName, Key: { userId, cardId } });
    const item = result.Item as TradeFlashcardCard | undefined;
    if (!item || item.entityType !== 'TRADE_FLASHCARD') {
      throw new ResourceNotFoundException('Trade flashcard not found', ERROR_CODES.RESOURCE_NOT_FOUND, '交易闪卡不存在');
    }
    return this.attachDictionaryTags(item);
  }

  private async listAllCards(userId: string): Promise<TradeFlashcardCard[]> {
    const cards: TradeFlashcardCard[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });

      const pageItems = (result.Items || []) as TradeFlashcardCard[];
      const pageCards = pageItems.filter((item) => item.entityType === 'TRADE_FLASHCARD');
      const normalized = await Promise.all(pageCards.map((item) => this.attachDictionaryTags(item)));
      cards.push(...normalized);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return cards;
  }

  private async attachDictionaryTags(card: TradeFlashcardCard): Promise<TradeFlashcardCard> {
    const normalizedCard = this.normalizeCard(card);
    const tagItems = await this.dictionaryService.resolveCategoryItemsByCodes(
      normalizedCard.userId,
      'flashcard_tag',
      normalizedCard.tagCodes,
    );
    return { ...normalizedCard, tagItems };
  }

  private normalizeImageUrls(urls?: string[]) {
    return (urls || []).map((item) => item.trim()).filter(Boolean);
  }

  private assertImageUrlLimit(urls: string[], limit: number, fieldName: string) {
    if (urls.length > limit) {
      throw new BadRequestException(`${fieldName} must contain no more than ${limit} images`);
    }
  }

  private resolveLifecycleStatus(finalTrendImageUrl?: string) {
    if (finalTrendImageUrl?.trim()) return 'COMPLETED';
    return 'IN_PROGRESS';
  }

  private normalizeCard(card: TradeFlashcardCard): TradeFlashcardCard {
    const finalTrendImageUrl = card.finalTrendImageUrl || card.postEntryImageUrl;
    const preEntryImageUrls = this.normalizeImageUrls(
      card.preEntryImageUrls?.length ? card.preEntryImageUrls : [card.preEntryImageUrl],
    );
    const normalized: TradeFlashcardCard = {
      ...card,
      preEntryImageUrl: preEntryImageUrls[0],
      preEntryImageUrls,
      entryImageUrls: this.normalizeImageUrls(card.entryImageUrls),
      finalTrendImageUrl,
      lifecycleStatus: this.resolveLifecycleStatus(finalTrendImageUrl),
      possiblePlaybookTypes: this.normalizeCodes(card.possiblePlaybookTypes),
      playbookConditions: this.normalizeStoredPlaybookConditions(card.playbookConditions, card.possiblePlaybookTypes),
    };
    delete normalized.progressImageUrls;

    if (!normalized.postEntryImageUrl) {
      delete normalized.postEntryImageUrl;
    }

    return {
      ...normalized,
    };
  }

  private resolveNextPreEntryImageUrls(
    existing: TradeFlashcardCard,
    dto: UpdateTradeFlashcardCardDto,
  ) {
    const existingUrls = this.normalizeImageUrls(
      existing.preEntryImageUrls?.length ? existing.preEntryImageUrls : [existing.preEntryImageUrl],
    );
    const nextUrls = dto.preEntryImageUrls !== undefined
      ? this.normalizeImageUrls(dto.preEntryImageUrls)
      : dto.preEntryImageUrl !== undefined
        ? this.normalizeImageUrls([dto.preEntryImageUrl])
        : existingUrls;

    this.assertImageUrlLimit(nextUrls, PRE_ENTRY_IMAGE_LIMIT, 'preEntryImageUrls');
    if (!nextUrls.length) {
      throw new BadRequestException('preEntryImageUrls[0] is required');
    }
    return nextUrls;
  }

  private resolveNextFinalTrendImageUrl(
    existing: TradeFlashcardCard,
    dto: UpdateTradeFlashcardCardDto,
  ) {
    if (dto.finalTrendImageUrl !== undefined) {
      return dto.finalTrendImageUrl.trim() || undefined;
    }
    if (dto.postEntryImageUrl !== undefined) {
      return dto.postEntryImageUrl.trim() || undefined;
    }
    return existing.finalTrendImageUrl || existing.postEntryImageUrl;
  }

  private normalizeCodes(codes?: string[]) {
    const normalized = Array.from(
      new Set((codes || []).map((item) => `${item}`.trim()).filter(Boolean)),
    );
    return normalized.length ? normalized : undefined;
  }

  private normalizePlaybookConditions(
    conditions: TradeFlashcardPlaybookCondition[] | undefined,
    possiblePlaybookTypes: string[],
  ) {
    const possibleSet = new Set(possiblePlaybookTypes);
    const normalized: TradeFlashcardPlaybookCondition[] = [];

    for (const item of conditions || []) {
      const playbookType = `${item?.playbookType || ''}`.trim();
      const condition = `${item?.condition || ''}`.trim();
      if (!playbookType && !condition) continue;
      if (!possibleSet.has(playbookType)) {
        throw new BadRequestException('playbookConditions contains a playbookType outside possiblePlaybookTypes');
      }
      if (!condition) {
        throw new BadRequestException('playbookConditions condition is required');
      }
      normalized.push({ playbookType, condition });
    }

    const conditionMap = new Map(normalized.map((item) => [item.playbookType, item.condition]));
    const missing = possiblePlaybookTypes.filter((playbookType) => !conditionMap.get(playbookType));
    if (missing.length) {
      throw new BadRequestException(`playbookConditions is required for: ${missing.join(', ')}`);
    }

    return normalized.length ? normalized : undefined;
  }

  private normalizeStoredPlaybookConditions(
    conditions: TradeFlashcardPlaybookCondition[] | undefined,
    possiblePlaybookTypes?: string[],
  ) {
    const possibleSet = new Set(this.normalizeCodes(possiblePlaybookTypes) || []);
    const normalized = (conditions || [])
      .map((item) => ({
        playbookType: `${item?.playbookType || ''}`.trim(),
        condition: `${item?.condition || ''}`.trim(),
      }))
      .filter((item) => item.playbookType && item.condition && (!possibleSet.size || possibleSet.has(item.playbookType)));
    return normalized.length ? normalized : undefined;
  }

  private sortCards(
    cards: TradeFlashcardCard[],
    sortBy: TradeFlashcardCardSortBy,
    sortOrder: TradeFlashcardCardSortOrder,
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...cards].sort((a, b) => {
      const aTs = this.safeParseTimestamp(sortBy === 'UPDATED_AT' ? a.updatedAt : a.createdAt);
      const bTs = this.safeParseTimestamp(sortBy === 'UPDATED_AT' ? b.updatedAt : b.createdAt);
      const diff = (aTs - bTs) * direction;
      if (diff !== 0) return diff;
      return this.safeParseTimestamp(b.updatedAt) - this.safeParseTimestamp(a.updatedAt);
    });
  }

  private safeParseTimestamp(value?: string) {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
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
