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
import { CreateTradingViewTrainingRecordDto } from './dto/create-tradingview-training-record.dto';
import { GetTradingViewTrainingRecordAnalyticsDto } from './dto/get-tradingview-training-record-analytics.dto';
import { GetTradingViewTrainingRecordUploadUrlDto } from './dto/get-tradingview-training-record-upload-url.dto';
import { ListTradingViewTrainingRecordsDto } from './dto/list-tradingview-training-records.dto';
import { UpdateTradingViewTrainingRecordDto } from './dto/update-tradingview-training-record.dto';
import {
  TradingViewTrainingRecord,
  TradingViewTrainingRecordAnalyticsSummary,
  TradingViewTrainingRecordSortBy,
  TradingViewTrainingRecordSortOrder,
} from './tradingview-training-record.types';

@Injectable()
export class TradingViewTrainingRecordService {
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

  async getUploadUrl(userId: string, dto: GetTradingViewTrainingRecordUploadUrlDto) {
    const ext = this.resolveFileExtension(dto.fileName, dto.contentType);
    const date = new Date().toISOString().slice(0, 10);
    const key = `tradingview-training-records/${userId}/${date}/${uuidv4()}.${ext}`;
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

  async createRecord(userId: string, dto: CreateTradingViewTrainingRecordDto) {
    const playbookType = await this.resolvePlaybookType(userId, dto.playbookType);
    const symbolPair = this.normalizeSymbol(dto.symbolPair);
    const imageUrl = dto.imageUrl?.trim();
    if (!imageUrl) throw new BadRequestException('imageUrl is required');

    const now = new Date().toISOString();
    const recordId = uuidv4();
    const item: TradingViewTrainingRecord = {
      id: recordId,
      userId,
      cardId: recordId,
      recordId,
      entityType: 'TRADINGVIEW_TRAINING_RECORD',
      symbolPair: symbolPair || undefined,
      imageUrl,
      imageKey: dto.imageKey?.trim() || undefined,
      tradeResult: dto.tradeResult,
      playbookType,
      entryConfidenceRating: dto.entryConfidenceRating,
      notes: dto.notes?.trim() || undefined,
      reviewCandleTime: dto.reviewCandleTime || undefined,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: item });
    return { success: true, data: await this.attachPlaybookItem(item) };
  }

  async listRecords(userId: string, dto: ListTradingViewTrainingRecordsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const records = await this.listAllRecords(userId);
    const filtered = this.filterRecords(records, dto);
    const sorted = this.sortRecords(filtered, dto.sortBy || 'CREATED_AT', dto.sortOrder || 'desc');
    const items = await this.attachPlaybookItems(sorted.slice(offset, offset + pageSize));
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

  async getRecord(userId: string, recordId: string) {
    return { success: true, data: await this.getRecordOrThrow(userId, recordId) };
  }

  async updateRecord(userId: string, recordId: string, dto: UpdateTradingViewTrainingRecordDto) {
    const existing = await this.getRecordOrThrow(userId, recordId);
    const playbookType = dto.playbookType !== undefined
      ? await this.resolvePlaybookType(userId, dto.playbookType)
      : existing.playbookType;
    const symbolPair = dto.symbolPair !== undefined ? this.normalizeSymbol(dto.symbolPair) : existing.symbolPair;
    const imageUrl = dto.imageUrl !== undefined ? dto.imageUrl.trim() || undefined : existing.imageUrl;
    if (!imageUrl) throw new BadRequestException('imageUrl is required');

    const updated: TradingViewTrainingRecord = {
      ...existing,
      symbolPair: symbolPair || undefined,
      imageUrl,
      imageKey: dto.imageKey !== undefined ? dto.imageKey.trim() || undefined : existing.imageKey,
      tradeResult: dto.tradeResult || existing.tradeResult,
      playbookType,
      entryConfidenceRating: dto.entryConfidenceRating || existing.entryConfidenceRating,
      notes: dto.notes !== undefined ? dto.notes.trim() || undefined : existing.notes,
      reviewCandleTime: dto.reviewCandleTime !== undefined ? dto.reviewCandleTime || undefined : existing.reviewCandleTime,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };
    delete updated.playbookItem;

    await this.db.put({ TableName: this.tableName, Item: updated });
    return { success: true, data: await this.attachPlaybookItem(updated) };
  }

  async deleteRecord(userId: string, recordId: string) {
    const existing = await this.getRecordOrThrow(userId, recordId);
    const updated: TradingViewTrainingRecord = {
      ...existing,
      status: 'DELETED',
      updatedAt: new Date().toISOString(),
    };
    delete updated.playbookItem;
    await this.db.put({ TableName: this.tableName, Item: updated });
    return { success: true, data: true };
  }

  async getAnalytics(userId: string, dto: GetTradingViewTrainingRecordAnalyticsDto) {
    const records = await this.listAllRecords(userId);
    const filtered = this.filterRecords(records, dto);
    const summary = this.buildSummary(filtered);
    const grouped = new Map<string, TradingViewTrainingRecord[]>();
    for (const record of filtered) {
      const items = grouped.get(record.playbookType) || [];
      items.push(record);
      grouped.set(record.playbookType, items);
    }
    const playbookItemMap = await this.resolvePlaybookItemMap(userId, Array.from(grouped.keys()));
    const playbookItems = Array.from(grouped.entries())
      .map(([playbookType, items]) => ({
        playbookType,
        playbookItem: playbookItemMap.get(playbookType),
        ...this.buildSummary(items),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    return {
      success: true,
      data: {
        summary,
        playbookItems,
        filters: {
          from: dto.from,
          to: dto.to,
          playbookType: dto.playbookType,
          symbolPair: dto.symbolPair,
        },
      },
    };
  }

  private async getRecordOrThrow(userId: string, recordId: string) {
    const result = await this.db.get({ TableName: this.tableName, Key: { userId, cardId: recordId } });
    const item = result.Item as TradingViewTrainingRecord | undefined;
    if (!item || item.entityType !== 'TRADINGVIEW_TRAINING_RECORD' || item.status === 'DELETED') {
      throw new ResourceNotFoundException(
        'TradingView training record not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'TradingView 训练记录不存在',
      );
    }
    return this.attachPlaybookItem(this.normalizeRecord(item));
  }

  private async listAllRecords(userId: string) {
    const records: TradingViewTrainingRecord[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#entityType = :entityType',
        ProjectionExpression: [
          'id',
          'userId',
          'cardId',
          'recordId',
          '#entityType',
          'symbolPair',
          'imageUrl',
          'imageKey',
          'tradeResult',
          'playbookType',
          'entryConfidenceRating',
          'notes',
          'reviewCandleTime',
          '#status',
          'createdAt',
          'updatedAt',
        ].join(', '),
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':entityType': 'TRADINGVIEW_TRAINING_RECORD',
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      records.push(
        ...((result.Items || []) as TradingViewTrainingRecord[])
          .filter((item) => item.entityType === 'TRADINGVIEW_TRAINING_RECORD')
          .map((item) => this.normalizeRecord(item))
          .filter((item) => item.status !== 'DELETED'),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return records;
  }

  private filterRecords(
    records: TradingViewTrainingRecord[],
    dto: ListTradingViewTrainingRecordsDto | GetTradingViewTrainingRecordAnalyticsDto,
  ) {
    const keyword = 'keyword' in dto ? dto.keyword?.trim().toLowerCase() : undefined;
    const symbolPair = dto.symbolPair ? this.normalizeSymbol(dto.symbolPair) : undefined;
    const fromTs = this.safeParseTimestamp(dto.from);
    const toTs = this.safeParseTimestamp(dto.to);
    return records.filter((record) => {
      if (dto.playbookType && record.playbookType !== dto.playbookType) return false;
      if (symbolPair && !(record.symbolPair || '').includes(symbolPair)) return false;
      if ('tradeResult' in dto && dto.tradeResult && record.tradeResult !== dto.tradeResult) return false;
      if ('entryConfidenceRating' in dto && dto.entryConfidenceRating && record.entryConfidenceRating !== dto.entryConfidenceRating) {
        return false;
      }
      const recordTs = this.safeParseTimestamp(record.createdAt);
      if (fromTs > 0 && recordTs < fromTs) return false;
      if (toTs > 0 && recordTs > toTs) return false;
      if (keyword) {
        const haystack = `${record.notes || ''} ${record.symbolPair || ''} ${record.playbookType}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  private buildSummary(records: TradingViewTrainingRecord[]): TradingViewTrainingRecordAnalyticsSummary {
    const totalCount = records.length;
    const winCount = records.filter((item) => item.tradeResult === 'WIN').length;
    const lossCount = records.filter((item) => item.tradeResult === 'LOSS').length;
    const breakevenCount = records.filter((item) => item.tradeResult === 'BREAKEVEN').length;
    const notEnteredCount = records.filter((item) => item.tradeResult === 'NOT_ENTERED').length;
    const notExitedCount = records.filter((item) => item.tradeResult === 'NOT_EXITED').length;
    const decisiveCount = winCount + lossCount;
    const ratingSum = records.reduce((sum, item) => sum + item.entryConfidenceRating, 0);
    return {
      totalCount,
      winCount,
      lossCount,
      breakevenCount,
      notEnteredCount,
      notExitedCount,
      decisiveCount,
      winRate: decisiveCount > 0 ? winCount / decisiveCount : null,
      avgEntryConfidenceRating: totalCount > 0 ? ratingSum / totalCount : null,
    };
  }

  private async resolvePlaybookType(userId: string, value?: string) {
    const code = value?.trim();
    if (!code) throw new BadRequestException('playbookType is required');
    return (await this.dictionaryService.assertCategoryCodesExist(userId, 'playbook_type', [code]))[0];
  }

  private async attachPlaybookItem(record: TradingViewTrainingRecord) {
    return (await this.attachPlaybookItems([record]))[0];
  }

  private async attachPlaybookItems(records: TradingViewTrainingRecord[]) {
    if (!records.length) return [];
    const normalizedRecords = records.map((record) => this.normalizeRecord(record));
    const codes = Array.from(new Set(normalizedRecords.map((record) => record.playbookType).filter(Boolean)));
    const itemMap = await this.resolvePlaybookItemMap(normalizedRecords[0].userId, codes);
    return normalizedRecords.map((record) => ({
      ...record,
      playbookItem: itemMap.get(record.playbookType),
    }));
  }

  private async resolvePlaybookItemMap(userId: string, codes: string[]) {
    if (!codes.length) return new Map<string, { code: string; label: string; color?: string; status?: string }>();
    const items = await this.dictionaryService.resolveCategoryItemsByCodes(userId, 'playbook_type', codes);
    return new Map(items.filter(Boolean).map((item) => [item.code, item]));
  }

  private normalizeRecord(record: TradingViewTrainingRecord): TradingViewTrainingRecord {
    return {
      ...record,
      cardId: record.cardId || record.recordId,
      recordId: record.recordId || record.cardId,
      symbolPair: this.normalizeSymbol(record.symbolPair) || undefined,
      status: record.status || 'ACTIVE',
    };
  }

  private normalizeSymbol(value?: string) {
    return (value || '').trim().toUpperCase();
  }

  private sortRecords(
    records: TradingViewTrainingRecord[],
    sortBy: TradingViewTrainingRecordSortBy,
    sortOrder: TradingViewTrainingRecordSortOrder,
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const aTs = this.safeParseTimestamp(this.getSortTimestamp(a, sortBy));
      const bTs = this.safeParseTimestamp(this.getSortTimestamp(b, sortBy));
      const diff = (aTs - bTs) * direction;
      if (diff !== 0) return diff;
      return this.safeParseTimestamp(b.updatedAt) - this.safeParseTimestamp(a.updatedAt);
    });
  }

  private getSortTimestamp(record: TradingViewTrainingRecord, sortBy: TradingViewTrainingRecordSortBy) {
    if (sortBy === 'UPDATED_AT') return record.updatedAt;
    return record.createdAt;
  }

  private safeParseTimestamp(value?: string) {
    const parsed = Date.parse(value || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private resolveFileExtension(fileName: string, contentType: string) {
    const trimmed = fileName.trim();
    const dotIdx = trimmed.lastIndexOf('.');
    if (dotIdx > -1 && dotIdx < trimmed.length - 1) return trimmed.slice(dotIdx + 1).toLowerCase();
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
    if (this.cloudfrontDomain) return `https://${this.cloudfrontDomain}/${key}`;
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
