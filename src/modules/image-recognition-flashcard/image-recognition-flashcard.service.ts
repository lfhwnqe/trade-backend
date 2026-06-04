import { BadRequestException, Injectable } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { ResourceNotFoundException } from '../../base/exceptions/custom.exceptions';
import { ConfigService } from '../common/config.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { CreateImageRecognitionFlashcardCardDto } from './dto/create-image-recognition-flashcard-card.dto';
import { GetImageRecognitionFlashcardUploadUrlDto } from './dto/get-image-recognition-flashcard-upload-url.dto';
import { ListImageRecognitionFlashcardCardsDto } from './dto/list-image-recognition-flashcard-cards.dto';
import { RandomImageRecognitionFlashcardTrainingDto } from './dto/random-image-recognition-flashcard-training.dto';
import { UpdateImageRecognitionFlashcardCardDto } from './dto/update-image-recognition-flashcard-card.dto';
import {
  ImageRecognitionFlashcardCard,
  ImageRecognitionFlashcardCardSortBy,
  ImageRecognitionFlashcardCardSortOrder,
} from './image-recognition-flashcard.types';

@Injectable()
export class ImageRecognitionFlashcardService {
  private readonly db: DynamoDBDocument;
  private readonly s3: S3Client;
  private readonly tableName: string;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cloudfrontDomain?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dictionaryService: DictionaryService,
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

  async getUploadUrl(userId: string, dto: GetImageRecognitionFlashcardUploadUrlDto) {
    const ext = this.resolveFileExtension(dto.fileName, dto.contentType);
    const date = new Date().toISOString().slice(0, 10);
    const key = `image-recognition-flashcards/${userId}/${date}/${uuidv4()}.${ext}`;

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

  async createCard(userId: string, dto: CreateImageRecognitionFlashcardCardDto, ownerRole?: string) {
    const playbookType = await this.resolvePlaybookType(userId, dto.playbookType);
    const imageUrl = dto.imageUrl?.trim();
    if (!imageUrl) throw new BadRequestException('imageUrl is required');

    const now = new Date().toISOString();
    const cardId = uuidv4();
    const item: ImageRecognitionFlashcardCard = {
      id: cardId,
      userId,
      cardId,
      entityType: 'IMAGE_RECOGNITION_FLASHCARD',
      imageUrl,
      imageKey: dto.imageKey?.trim() || undefined,
      playbookType,
      sampleResult: dto.sampleResult,
      notes: dto.notes?.trim() || undefined,
      status: dto.status || 'ACTIVE',
      ownerRole,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: item });

    return {
      success: true,
      data: await this.attachPlaybookItem(item),
    };
  }

  async listCards(userId: string, dto: ListImageRecognitionFlashcardCardsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const cards = await this.listAllCards(userId);
    const filtered = this.filterCards(cards, dto, true);
    const sorted = this.sortCards(filtered, dto.sortBy || 'CREATED_AT', dto.sortOrder || 'desc');
    const items = sorted.slice(offset, offset + pageSize);
    const nextOffset = offset + items.length;
    const playbookStats = this.buildPlaybookStats(filtered);

    return {
      success: true,
      data: {
        items,
        totalCount: filtered.length,
        nextCursor: nextOffset < filtered.length ? this.encodeOffsetCursor(nextOffset) : null,
        playbookStats,
      },
    };
  }

  async updateCard(userId: string, cardId: string, dto: UpdateImageRecognitionFlashcardCardDto) {
    const existing = await this.getCardOrThrow(userId, cardId);
    const playbookType = dto.playbookType !== undefined
      ? await this.resolvePlaybookType(userId, dto.playbookType)
      : existing.playbookType;
    const imageUrl = dto.imageUrl !== undefined
      ? dto.imageUrl.trim() || undefined
      : existing.imageUrl;
    if (!imageUrl) throw new BadRequestException('imageUrl is required');

    const updated: ImageRecognitionFlashcardCard = {
      ...existing,
      imageUrl,
      imageKey: dto.imageKey !== undefined ? dto.imageKey.trim() || undefined : existing.imageKey,
      playbookType,
      sampleResult: dto.sampleResult !== undefined ? dto.sampleResult : existing.sampleResult,
      notes: dto.notes !== undefined ? dto.notes.trim() || undefined : existing.notes,
      status: dto.status || existing.status || 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };
    delete updated.playbookItem;

    await this.db.put({ TableName: this.tableName, Item: updated });

    return {
      success: true,
      data: await this.attachPlaybookItem(updated),
    };
  }

  async deleteCard(userId: string, cardId: string) {
    await this.getCardOrThrow(userId, cardId);
    await this.db.delete({ TableName: this.tableName, Key: { userId, cardId } });
    return { success: true, data: true };
  }

  async randomTraining(userId: string, dto: RandomImageRecognitionFlashcardTrainingDto) {
    const count = dto.count || 20;
    if (dto.playbookType) {
      await this.resolvePlaybookType(userId, dto.playbookType);
    }
    const cards = await this.listTrainingCardsForUser(userId);
    const filtered = cards.filter((card) => {
      if ((card.status || 'ACTIVE') !== 'ACTIVE') return false;
      if (dto.playbookType && card.playbookType !== dto.playbookType) return false;
      return true;
    });
    const shuffled = this.shuffle(filtered).slice(0, count);

    return {
      success: true,
      data: {
        cards: shuffled,
        count: shuffled.length,
      },
    };
  }

  private async getCardOrThrow(userId: string, cardId: string) {
    const result = await this.db.get({ TableName: this.tableName, Key: { userId, cardId } });
    const item = result.Item as ImageRecognitionFlashcardCard | undefined;
    if (!item || item.entityType !== 'IMAGE_RECOGNITION_FLASHCARD') {
      throw new ResourceNotFoundException(
        'Image recognition flashcard not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '图片识别闪卡不存在',
      );
    }
    return this.attachPlaybookItem(this.normalizeCard(item));
  }

  private async listAllCards(userId: string) {
    const cards: ImageRecognitionFlashcardCard[] = [];
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
        ...((result.Items || []) as ImageRecognitionFlashcardCard[])
          .filter((item) => item.entityType === 'IMAGE_RECOGNITION_FLASHCARD')
          .map((item) => this.normalizeCard(item)),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Promise.all(cards.map((item) => this.attachPlaybookItem(item)));
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

  private async scanSystemTrainingCards() {
    const cards: ImageRecognitionFlashcardCard[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await this.db.scan({
        TableName: this.tableName,
        FilterExpression: '#entityType = :entityType',
        ExpressionAttributeNames: { '#entityType': 'entityType' },
        ExpressionAttributeValues: { ':entityType': 'IMAGE_RECOGNITION_FLASHCARD' },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      cards.push(
        ...((result.Items || []) as ImageRecognitionFlashcardCard[])
          .filter((item) => this.isSystemTrainingCard(item))
          .map((item) => this.normalizeCard(item)),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Promise.all(cards.map((item) => this.attachPlaybookItem(item)));
  }

  private isSystemTrainingCard(card: ImageRecognitionFlashcardCard) {
    if (card.entityType !== 'IMAGE_RECOGNITION_FLASHCARD') return false;
    return !card.ownerRole || card.ownerRole === 'Admins' || card.ownerRole === 'SuperAdmins';
  }

  private filterCards(
    cards: ImageRecognitionFlashcardCard[],
    dto: ListImageRecognitionFlashcardCardsDto,
    defaultActiveOnly: boolean,
  ) {
    const status = dto.status || (defaultActiveOnly ? 'ACTIVE' : 'ALL');
    const keyword = dto.keyword?.trim().toLowerCase();
    return cards.filter((card) => {
      const cardStatus = card.status || 'ACTIVE';
      if (status !== 'ALL' && cardStatus !== status) return false;
      if (dto.playbookType && card.playbookType !== dto.playbookType) return false;
      if (dto.sampleResult && card.sampleResult !== dto.sampleResult) return false;
      if (keyword) {
        const haystack = `${card.notes || ''} ${card.playbookType || ''} ${card.playbookItem?.label || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  private async resolvePlaybookType(userId: string, value?: string) {
    const code = value?.trim();
    if (!code) throw new BadRequestException('playbookType is required');
    return (await this.dictionaryService.assertCategoryCodesExist(userId, 'playbook_type', [code]))[0];
  }

  private async attachPlaybookItem(card: ImageRecognitionFlashcardCard) {
    const normalized = this.normalizeCard(card);
    const items = await this.dictionaryService.resolveCategoryItemsByCodes(
      normalized.userId,
      'playbook_type',
      [normalized.playbookType],
    );
    return {
      ...normalized,
      playbookItem: items[0],
    };
  }

  private normalizeCard(card: ImageRecognitionFlashcardCard): ImageRecognitionFlashcardCard {
    return {
      ...card,
      status: card.status || 'ACTIVE',
    };
  }

  private buildPlaybookStats(cards: ImageRecognitionFlashcardCard[]) {
    const statsByPlaybook = new Map<
      string,
      {
        playbookType: string;
        playbookItem?: { code: string; label: string; color?: string; status?: string };
        totalCount: number;
        successCount: number;
        failCount: number;
        unknownCount: number;
        successRate: number | null;
      }
    >();

    for (const card of cards) {
      const existing = statsByPlaybook.get(card.playbookType) || {
        playbookType: card.playbookType,
        playbookItem: card.playbookItem,
        totalCount: 0,
        successCount: 0,
        failCount: 0,
        unknownCount: 0,
        successRate: null,
      };

      existing.totalCount += 1;
      if (card.sampleResult === 'SUCCESS') existing.successCount += 1;
      else if (card.sampleResult === 'FAIL') existing.failCount += 1;
      else existing.unknownCount += 1;

      const resolvedCount = existing.successCount + existing.failCount;
      existing.successRate = resolvedCount > 0 ? existing.successCount / resolvedCount : null;
      statsByPlaybook.set(card.playbookType, existing);
    }

    return Array.from(statsByPlaybook.values()).sort((a, b) => {
      const rateA = a.successRate ?? -1;
      const rateB = b.successRate ?? -1;
      if (rateA !== rateB) return rateB - rateA;
      return b.totalCount - a.totalCount;
    });
  }

  private sortCards(
    cards: ImageRecognitionFlashcardCard[],
    sortBy: ImageRecognitionFlashcardCardSortBy,
    sortOrder: ImageRecognitionFlashcardCardSortOrder,
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

  private shuffle<T>(items: T[]) {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
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
