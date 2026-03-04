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
import { FlashcardCard } from './flashcard.types';
import { ListFlashcardCardsDto } from './dto/list-flashcard-cards.dto';
import { ResourceNotFoundException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

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

    const item: FlashcardCard = {
      id: cardId,
      userId,
      cardId,
      questionImageUrl: dto.questionImageUrl,
      answerImageUrl: dto.answerImageUrl,
      direction: dto.direction,
      context: dto.context,
      orderFlowFeature: dto.orderFlowFeature,
      result: dto.result,
      notes: dto.notes,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({
      TableName: this.tableName,
      Item: item,
    });

    return {
      success: true,
      data: item,
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

  async listCards(userId: string, dto: ListFlashcardCardsDto) {
    const filterExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {
      ':userId': userId,
    };

    if (dto.direction) {
      filterExpressions.push('#direction = :direction');
      expressionAttributeNames['#direction'] = 'direction';
      expressionAttributeValues[':direction'] = dto.direction;
    }
    if (dto.context) {
      filterExpressions.push('#context = :context');
      expressionAttributeNames['#context'] = 'context';
      expressionAttributeValues[':context'] = dto.context;
    }
    if (dto.orderFlowFeature) {
      filterExpressions.push('#orderFlowFeature = :orderFlowFeature');
      expressionAttributeNames['#orderFlowFeature'] = 'orderFlowFeature';
      expressionAttributeValues[':orderFlowFeature'] = dto.orderFlowFeature;
    }
    if (dto.result) {
      filterExpressions.push('#result = :result');
      expressionAttributeNames['#result'] = 'result';
      expressionAttributeValues[':result'] = dto.result;
    }

    const queryResult = await this.db.query({
      TableName: this.tableName,
      IndexName: this.createdAtIndexName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: expressionAttributeValues,
      ...(filterExpressions.length
        ? { FilterExpression: filterExpressions.join(' AND ') }
        : {}),
      ...(Object.keys(expressionAttributeNames).length
        ? { ExpressionAttributeNames: expressionAttributeNames }
        : {}),
      ScanIndexForward: false,
      Limit: dto.pageSize || 20,
      ExclusiveStartKey: this.decodeCursor(dto.cursor),
    });

    const items = (queryResult.Items || []) as FlashcardCard[];

    return {
      success: true,
      data: {
        items,
        nextCursor: queryResult.LastEvaluatedKey
          ? this.encodeCursor(queryResult.LastEvaluatedKey)
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

  private async listAllCards(userId: string): Promise<FlashcardCard[]> {
    const cards: FlashcardCard[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });

      const pageCards = (result.Items || []) as FlashcardCard[];
      cards.push(...pageCards);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return cards;
  }

  private matchesFilters(card: FlashcardCard, dto: RandomFlashcardCardsDto) {
    const filters = dto.filters;
    if (!filters) return true;

    if (filters.direction?.length && !filters.direction.includes(card.direction)) {
      return false;
    }
    if (filters.context?.length && !filters.context.includes(card.context)) {
      return false;
    }
    if (
      filters.orderFlowFeature?.length &&
      !filters.orderFlowFeature.includes(card.orderFlowFeature)
    ) {
      return false;
    }
    if (filters.result?.length && !filters.result.includes(card.result)) {
      return false;
    }

    return true;
  }

  private shuffleInPlace<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
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
}
