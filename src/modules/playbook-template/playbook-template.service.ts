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
import { CreatePlaybookTemplateDto } from './dto/create-playbook-template.dto';
import { GetPlaybookTemplateUploadUrlDto } from './dto/get-playbook-template-upload-url.dto';
import { ListPlaybookTemplatesDto } from './dto/list-playbook-templates.dto';
import { UpdatePlaybookTemplateDto } from './dto/update-playbook-template.dto';
import {
  PlaybookTemplate,
  PlaybookTemplateCountItem,
  PlaybookTemplateSortBy,
  PlaybookTemplateSortOrder,
} from './playbook-template.types';

const TEMPLATE_LIMIT_PER_PLAYBOOK = 5;

@Injectable()
export class PlaybookTemplateService {
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

  async getUploadUrl(userId: string, dto: GetPlaybookTemplateUploadUrlDto) {
    const ext = this.resolveFileExtension(dto.fileName, dto.contentType);
    const date = new Date().toISOString().slice(0, 10);
    const key = `playbook-templates/${userId}/${date}/${dto.scope}/${uuidv4()}.${ext}`;

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

  async createTemplate(userId: string, dto: CreatePlaybookTemplateDto) {
    const playbookType = await this.resolvePlaybookType(userId, dto.playbookType);
    await this.assertTemplateLimit(userId, playbookType);

    const title = dto.title?.trim();
    const analysisImageUrl = dto.analysisImageUrl?.trim();
    const inProgressImageUrl = dto.inProgressImageUrl?.trim();
    const completedTrendImageUrl = dto.completedTrendImageUrl?.trim();
    if (!title) throw new BadRequestException('title is required');
    if (!analysisImageUrl) throw new BadRequestException('analysisImageUrl is required');
    if (!inProgressImageUrl) throw new BadRequestException('inProgressImageUrl is required');
    if (!completedTrendImageUrl) throw new BadRequestException('completedTrendImageUrl is required');

    const now = new Date().toISOString();
    const templateId = uuidv4();
    const item: PlaybookTemplate = {
      id: templateId,
      userId,
      cardId: templateId,
      templateId,
      entityType: 'PLAYBOOK_TEMPLATE',
      playbookType,
      title,
      analysisImageUrl,
      analysisImageKey: dto.analysisImageKey?.trim() || undefined,
      inProgressImageUrl,
      inProgressImageKey: dto.inProgressImageKey?.trim() || undefined,
      completedTrendImageUrl,
      completedTrendImageKey: dto.completedTrendImageKey?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
      sortOrder: dto.sortOrder,
      status: dto.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put({ TableName: this.tableName, Item: item });

    return {
      success: true,
      data: await this.attachPlaybookItem(item),
    };
  }

  async listTemplates(userId: string, dto: ListPlaybookTemplatesDto) {
    const pageSize = dto.pageSize || 20;
    const offset = this.decodeOffsetCursor(dto.cursor);
    const templates = await this.listAllTemplates(userId);
    const filtered = this.filterTemplates(templates, dto);
    const sorted = this.sortTemplates(filtered, dto.sortBy || 'CREATED_AT', dto.sortOrder || 'desc');
    const items = sorted.slice(offset, offset + pageSize);
    const nextOffset = offset + items.length;

    return {
      success: true,
      data: {
        items,
        totalCount: filtered.length,
        nextCursor: nextOffset < filtered.length ? this.encodeOffsetCursor(nextOffset) : null,
        playbookTemplateCounts: this.buildTemplateCounts(templates),
      },
    };
  }

  async listActiveTemplatesByPlaybook(userId: string, playbookTypeParam: string) {
    const playbookType = await this.resolvePlaybookType(userId, playbookTypeParam);
    const templates = await this.listTemplatesByPlaybook(userId, playbookType, 'ACTIVE');
    const items = this.sortTemplates(
      templates,
      'SORT_ORDER',
      'asc',
    ).slice(0, TEMPLATE_LIMIT_PER_PLAYBOOK);
    const playbookItems = await this.dictionaryService.resolveCategoryItemsByCodes(userId, 'playbook_type', [playbookType]);

    return {
      success: true,
      data: {
        playbookType,
        playbookItem: playbookItems[0],
        items,
        count: items.length,
        limit: TEMPLATE_LIMIT_PER_PLAYBOOK,
      },
    };
  }

  async getTemplate(userId: string, templateId: string) {
    return {
      success: true,
      data: await this.getTemplateOrThrow(userId, templateId),
    };
  }

  async updateTemplate(userId: string, templateId: string, dto: UpdatePlaybookTemplateDto) {
    const existing = await this.getTemplateOrThrow(userId, templateId);
    const playbookType = dto.playbookType !== undefined
      ? await this.resolvePlaybookType(userId, dto.playbookType)
      : existing.playbookType;
    if (playbookType !== existing.playbookType) {
      await this.assertTemplateLimit(userId, playbookType);
    }

    const title = dto.title !== undefined ? dto.title.trim() || undefined : existing.title;
    const analysisImageUrl = dto.analysisImageUrl !== undefined
      ? dto.analysisImageUrl.trim() || undefined
      : existing.analysisImageUrl;
    const inProgressImageUrl = dto.inProgressImageUrl !== undefined
      ? dto.inProgressImageUrl.trim() || undefined
      : existing.inProgressImageUrl;
    const completedTrendImageUrl = dto.completedTrendImageUrl !== undefined
      ? dto.completedTrendImageUrl.trim() || undefined
      : existing.completedTrendImageUrl;
    if (!title) throw new BadRequestException('title is required');
    if (!analysisImageUrl) throw new BadRequestException('analysisImageUrl is required');
    if (!inProgressImageUrl) throw new BadRequestException('inProgressImageUrl is required');
    if (!completedTrendImageUrl) throw new BadRequestException('completedTrendImageUrl is required');

    const updated: PlaybookTemplate = {
      ...existing,
      playbookType,
      title,
      analysisImageUrl,
      analysisImageKey: dto.analysisImageKey !== undefined ? dto.analysisImageKey.trim() || undefined : existing.analysisImageKey,
      inProgressImageUrl,
      inProgressImageKey: dto.inProgressImageKey !== undefined ? dto.inProgressImageKey.trim() || undefined : existing.inProgressImageKey,
      completedTrendImageUrl,
      completedTrendImageKey: dto.completedTrendImageKey !== undefined ? dto.completedTrendImageKey.trim() || undefined : existing.completedTrendImageKey,
      notes: dto.notes !== undefined ? dto.notes.trim() || undefined : existing.notes,
      sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder,
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

  async deleteTemplate(userId: string, templateId: string) {
    await this.getTemplateOrThrow(userId, templateId);
    await this.db.delete({ TableName: this.tableName, Key: { userId, cardId: templateId } });
    return { success: true, data: true };
  }

  private async getTemplateOrThrow(userId: string, templateId: string) {
    const result = await this.db.get({ TableName: this.tableName, Key: { userId, cardId: templateId } });
    const item = result.Item as PlaybookTemplate | undefined;
    if (!item || item.entityType !== 'PLAYBOOK_TEMPLATE') {
      throw new ResourceNotFoundException(
        'Playbook template not found',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        '剧本模板不存在',
      );
    }
    return this.attachPlaybookItem(this.normalizeTemplate(item));
  }

  private async listAllTemplates(userId: string) {
    const templates: PlaybookTemplate[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#entityType = :entityType',
        ProjectionExpression: this.getTemplateProjectionExpression(),
        ExpressionAttributeNames: this.getTemplateProjectionAttributeNames(),
        ExpressionAttributeValues: {
          ':userId': userId,
          ':entityType': 'PLAYBOOK_TEMPLATE',
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      templates.push(
        ...((result.Items || []) as PlaybookTemplate[])
          .filter((item) => item.entityType === 'PLAYBOOK_TEMPLATE')
          .map((item) => this.normalizeTemplate(item)),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Promise.all(templates.map((item) => this.attachPlaybookItem(item)));
  }

  private async listTemplatesByPlaybook(
    userId: string,
    playbookType: string,
    status?: 'ACTIVE' | 'DISABLED',
  ) {
    const templates: PlaybookTemplate[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    do {
      const expressionAttributeValues: Record<string, unknown> = {
        ':userId': userId,
        ':entityType': 'PLAYBOOK_TEMPLATE',
        ':playbookType': playbookType,
      };
      const filterExpressions = [
        '#entityType = :entityType',
        'playbookType = :playbookType',
      ];
      if (status) {
        expressionAttributeValues[':status'] = status;
        filterExpressions.push('#status = :status');
      }

      const result = await this.db.query({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: filterExpressions.join(' AND '),
        ProjectionExpression: this.getTemplateProjectionExpression(),
        ExpressionAttributeNames: this.getTemplateProjectionAttributeNames(),
        ExpressionAttributeValues: expressionAttributeValues,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 200,
      });
      templates.push(
        ...((result.Items || []) as PlaybookTemplate[])
          .filter((item) => item.entityType === 'PLAYBOOK_TEMPLATE')
          .filter((item) => item.playbookType === playbookType)
          .filter((item) => !status || (item.status || 'ACTIVE') === status)
          .map((item) => this.normalizeTemplate(item)),
      );
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey && templates.length < TEMPLATE_LIMIT_PER_PLAYBOOK);

    return templates.map((item) => this.normalizeTemplate(item));
  }

  private filterTemplates(templates: PlaybookTemplate[], dto: ListPlaybookTemplatesDto) {
    const status = dto.status || 'ALL';
    const keyword = dto.keyword?.trim().toLowerCase();
    return templates.filter((template) => {
      const templateStatus = template.status || 'ACTIVE';
      if (status !== 'ALL' && templateStatus !== status) return false;
      if (dto.playbookType && template.playbookType !== dto.playbookType) return false;
      if (keyword) {
        const haystack = `${template.title || ''} ${template.notes || ''} ${template.playbookType || ''} ${template.playbookItem?.label || ''}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  private async assertTemplateLimit(userId: string, playbookType: string) {
    const templates = await this.listAllTemplates(userId);
    const count = templates.filter((template) => template.playbookType === playbookType).length;
    if (count >= TEMPLATE_LIMIT_PER_PLAYBOOK) {
      throw new BadRequestException('该剧本最多只能保存 5 个模板，请先删除或调整已有模板');
    }
  }

  private async resolvePlaybookType(userId: string, value?: string) {
    const code = value?.trim();
    if (!code) throw new BadRequestException('playbookType is required');
    return (await this.dictionaryService.assertCategoryCodesExist(userId, 'playbook_type', [code]))[0];
  }

  private async attachPlaybookItem(template: PlaybookTemplate) {
    const normalized = this.normalizeTemplate(template);
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

  private normalizeTemplate(template: PlaybookTemplate): PlaybookTemplate {
    return {
      ...template,
      templateId: template.templateId || template.cardId || template.id,
      cardId: template.cardId || template.templateId || template.id,
      status: template.status || 'ACTIVE',
    };
  }

  private buildTemplateCounts(templates: PlaybookTemplate[]): PlaybookTemplateCountItem[] {
    const countsByPlaybook = new Map<string, PlaybookTemplateCountItem>();
    for (const template of templates) {
      const existing = countsByPlaybook.get(template.playbookType) || {
        playbookType: template.playbookType,
        playbookItem: template.playbookItem,
        totalCount: 0,
        activeCount: 0,
        disabledCount: 0,
        limit: TEMPLATE_LIMIT_PER_PLAYBOOK,
      };
      existing.totalCount += 1;
      if ((template.status || 'ACTIVE') === 'DISABLED') existing.disabledCount += 1;
      else existing.activeCount += 1;
      countsByPlaybook.set(template.playbookType, existing);
    }

    return Array.from(countsByPlaybook.values()).sort((a, b) => b.totalCount - a.totalCount);
  }

  private sortTemplates(
    templates: PlaybookTemplate[],
    sortBy: PlaybookTemplateSortBy,
    sortOrder: PlaybookTemplateSortOrder,
  ) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...templates].sort((a, b) => {
      if (sortBy === 'SORT_ORDER') {
        const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
        const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
        const orderDiff = (aOrder - bOrder) * direction;
        if (orderDiff !== 0) return orderDiff;
        return this.safeParseTimestamp(b.updatedAt) - this.safeParseTimestamp(a.updatedAt);
      }
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

  private getTemplateProjectionExpression() {
    return [
      'id',
      'userId',
      'cardId',
      'templateId',
      '#entityType',
      'playbookType',
      'title',
      'analysisImageUrl',
      'analysisImageKey',
      'inProgressImageUrl',
      'inProgressImageKey',
      'completedTrendImageUrl',
      'completedTrendImageKey',
      'notes',
      'sortOrder',
      '#status',
      'createdAt',
      'updatedAt',
    ].join(', ');
  }

  private getTemplateProjectionAttributeNames() {
    return {
      '#entityType': 'entityType',
      '#status': 'status',
    };
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
