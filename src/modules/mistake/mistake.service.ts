import { Injectable } from '@nestjs/common';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../common/config.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { ResourceNotFoundException, ValidationException } from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';
import { CreateMistakeRecordDto } from './dto/create-mistake-record.dto';
import { ListMistakeRecordsDto } from './dto/list-mistake-records.dto';
import { UpdateMistakeRecordDto } from './dto/update-mistake-record.dto';
import { MistakeDomain, MistakeRecordItem } from './mistake.types';

@Injectable()
export class MistakeService {
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;
  private readonly region: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dictionaryService: DictionaryService,
  ) {
    this.region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.getOrThrow('MISTAKES_TABLE_NAME');
    this.db = DynamoDBDocument.from(new DynamoDB({ region: this.region }), {
      marshallOptions: { convertClassInstanceToMap: true },
    });
  }

  async createRecord(userId: string, dto: CreateMistakeRecordDto) {
    const validated = await this.validateAndNormalize(userId, dto);
    const now = new Date().toISOString();
    const item: MistakeRecordItem = {
      userId,
      mistakeRecordId: uuidv4(),
      sourceType: validated.sourceType,
      sourceId: validated.sourceId,
      simulationAttemptId: validated.simulationAttemptId,
      tradeFlashcardId: validated.tradeFlashcardId,
      cardId: validated.cardId,
      playbookType: validated.playbookType,
      tagCodes: validated.tagCodes,
      primaryMistakeCode: validated.primaryMistakeCode,
      mistakeCodes: validated.mistakeCodes,
      mistakeDomain: validated.mistakeDomain,
      note: validated.note,
      correctionNote: validated.correctionNote,
      reviewStatus: validated.reviewStatus || 'NEW',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: item });
    return { success: true, data: item };
  }

  async getRecord(userId: string, mistakeRecordId: string) {
    const item = await this.getRecordOrThrow(userId, mistakeRecordId);
    return { success: true, data: item };
  }

  async updateRecord(userId: string, mistakeRecordId: string, dto: UpdateMistakeRecordDto) {
    const current = await this.getRecordOrThrow(userId, mistakeRecordId);
    const validated = await this.validateAndNormalize(userId, {
      ...current,
      ...dto,
      sourceType: dto.sourceType || current.sourceType,
      sourceId: dto.sourceId || current.sourceId,
      primaryMistakeCode: dto.primaryMistakeCode || current.primaryMistakeCode,
      mistakeCodes: dto.mistakeCodes || current.mistakeCodes,
      mistakeDomain: dto.mistakeDomain || current.mistakeDomain,
      reviewStatus: dto.reviewStatus || current.reviewStatus,
    });

    const item: MistakeRecordItem = {
      ...current,
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    await this.db.put({ TableName: this.tableName, Item: item });
    return { success: true, data: item };
  }

  async listRecords(userId: string, dto: ListMistakeRecordsDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const items = await this.listAllRecords(userId);
    const filtered = items
      .filter((item) => {
        if (dto.sourceType && item.sourceType !== dto.sourceType) return false;
        if (dto.primaryMistakeCode && item.primaryMistakeCode !== dto.primaryMistakeCode) return false;
        if (dto.mistakeDomain && item.mistakeDomain !== dto.mistakeDomain) return false;
        if (dto.playbookType && item.playbookType !== dto.playbookType) return false;
        if (dto.reviewStatus && item.reviewStatus !== dto.reviewStatus) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const page = filtered.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;

    return {
      success: true,
      data: {
        totalCount: filtered.length,
        items: page,
        nextCursor: nextOffset < filtered.length ? this.encodeOffsetCursor(nextOffset) : null,
      },
    };
  }

  async createSimulationFailureRecord(input: {
    userId: string;
    attemptId: string;
    cardId: string;
    playbookType?: string;
    tagCodes?: string[];
    primaryMistakeCode: string;
    mistakeCodes: string[];
    correctionNote?: string;
  }) {
    const mistakeDomain = this.inferMistakeDomain(input.primaryMistakeCode);
    return this.createRecord(input.userId, {
      sourceType: 'FLASHCARD_SIMULATION',
      sourceId: input.attemptId,
      simulationAttemptId: input.attemptId,
      cardId: input.cardId,
      playbookType: input.playbookType,
      tagCodes: input.tagCodes,
      primaryMistakeCode: input.primaryMistakeCode,
      mistakeCodes: input.mistakeCodes,
      mistakeDomain,
      correctionNote: input.correctionNote,
      reviewStatus: 'NEW',
    });
  }

  async deleteRecordsBySimulationAttemptId(userId: string, attemptId: string) {
    const items = await this.listAllRecords(userId);
    const targets = items.filter(
      (item) => item.simulationAttemptId === attemptId || item.sourceId === attemptId,
    );

    await Promise.all(
      targets.map((item) =>
        this.db.delete({
          TableName: this.tableName,
          Key: { userId, mistakeRecordId: item.mistakeRecordId },
        }),
      ),
    );
  }

  inferMistakeDomain(primaryMistakeCode: string): MistakeDomain {
    const code = primaryMistakeCode.trim().toUpperCase();
    if (
      [
        'MISREAD_PLAYBOOK',
        'MISREAD_MARKET_STRUCTURE',
        'MISREAD_BREAKOUT_QUALITY',
        'MISREAD_FAKE_BREAK',
        'MISREAD_CONTEXT_ALIGNMENT',
        'MISREAD_REVERSAL_SIGNAL',
      ].includes(code)
    ) {
      return 'RECOGNITION';
    }
    if (
      [
        'ENTRY_TOO_EARLY',
        'ENTRY_TOO_LATE',
        'NO_CONFIRMATION_WAIT',
        'MISREAD_SECOND_TEST',
        'CHASING_AFTER_EXPANSION',
        'LATE_REACTION_AFTER_SIGNAL',
      ].includes(code)
    ) {
      return 'TRIGGER_TIMING';
    }
    if (
      [
        'INVALID_STOP_LOGIC',
        'RR_NOT_ACCEPTABLE',
        'POSITION_NOT_ACTIONABLE',
        'INVALID_ENTRY_STOP_RELATION',
        'NO_CLEAR_INVALIDATION',
        'TARGET_NOT_STRUCTURALLY_SUPPORTED',
      ].includes(code)
    ) {
      return 'RISK_FRAMEWORK';
    }
    if (
      [
        'SHOULD_BE_NO_TRADE',
        'RANGE_CHOP_ENVIRONMENT',
        'LOW_EDGE_SESSION_TIME',
        'HTF_CONFLICT',
        'NEWS_OR_EVENT_RISK_IGNORED',
        'OVERCROWDING_SIGNALS',
      ].includes(code)
    ) {
      return 'CONTEXT_FILTER';
    }
    return 'EXECUTION';
  }

  private async getRecordOrThrow(userId: string, mistakeRecordId: string) {
    const result = await this.db.get({
      TableName: this.tableName,
      Key: { userId, mistakeRecordId },
    });
    const item = result.Item as MistakeRecordItem | undefined;
    if (!item) {
      throw new ResourceNotFoundException(
        'Mistake record not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '误判记录不存在',
      );
    }
    return item;
  }

  private async listAllRecords(userId: string) {
    const items: MistakeRecordItem[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ExclusiveStartKey: lastKey,
      });
      items.push(...((result.Items || []) as MistakeRecordItem[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  private async validateAndNormalize(userId: string, dto: CreateMistakeRecordDto) {
    const mistakeCodes = await this.dictionaryService.assertCategoryCodesExist(
      userId,
      'mistake_type',
      dto.mistakeCodes,
    );
    const primaryMistakeCodes = await this.dictionaryService.assertCategoryCodesExist(
      userId,
      'mistake_type',
      dto.primaryMistakeCode ? [dto.primaryMistakeCode] : undefined,
    );
    const primaryMistakeCode = primaryMistakeCodes[0];
    if (!mistakeCodes.includes(primaryMistakeCode)) {
      throw new ValidationException(
        'Primary mistake code must be included in mistakeCodes',
        ERROR_CODES.VALIDATION_INVALID_VALUE,
        '主误判类型必须包含在 mistakeCodes 中',
      );
    }

    const playbookType = (
      await this.dictionaryService.assertCategoryCodesExist(
        userId,
        'playbook_type',
        dto.playbookType ? [dto.playbookType] : undefined,
      )
    )[0];

    return {
      ...dto,
      sourceId: dto.sourceId.trim(),
      simulationAttemptId: dto.simulationAttemptId?.trim() || undefined,
      tradeFlashcardId: dto.tradeFlashcardId?.trim() || undefined,
      cardId: dto.cardId?.trim() || undefined,
      playbookType,
      tagCodes: dto.tagCodes?.map((item) => item.trim()).filter(Boolean) || undefined,
      primaryMistakeCode,
      mistakeCodes,
      note: dto.note?.trim() || undefined,
      correctionNote: dto.correctionNote?.trim() || undefined,
    };
  }

  private encodeOffsetCursor(offset: number) {
    return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
  }

  private decodeOffsetCursor(cursor?: string) {
    if (!cursor) return 0;
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { offset?: number };
      return typeof parsed.offset === 'number' && parsed.offset >= 0 ? parsed.offset : 0;
    } catch {
      return 0;
    }
  }
}
