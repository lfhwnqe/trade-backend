/**
 * MindMap服务类
 * 处理脑图相关的业务逻辑
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { MindMapEntityClass } from './entities/mindmap.entity';
import {
  MindMapData,
  MindMapListItem,
  CreateMindMapRequest,
  UpdateMindMapRequest,
  MindMapQueryParams,
  MINDMAP_DEFAULTS
} from './types/mindmap.types';

@Injectable()
export class MindMapService {
  private readonly logger = new Logger(MindMapService.name);
  private readonly db: DynamoDBDocument;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    // 初始化DynamoDB客户端
    const region = this.configService.getOrThrow('AWS_REGION');
    this.tableName = this.configService.get('MINDMAP_TABLE_NAME') || 'mindmap-table-dev';

    this.db = DynamoDBDocument.from(new DynamoDB({ region }), {
      marshallOptions: {
        convertClassInstanceToMap: true,
      },
    });

    this.logger.log('MindMapService initialized');
    this.logger.log(`Using DynamoDB table: ${this.tableName}`);
  }

  /**
   * 创建新的脑图
   */
  async createMindMap(userId: string, createData: CreateMindMapRequest): Promise<MindMapData> {
    this.logger.log(`Creating mind map for user: ${userId}`);
    
    try {
      // 创建实体
      const entity = new MindMapEntityClass({
        userId,
        title: createData.title,
        description: createData.description,
        data: createData.data ? JSON.stringify(createData.data) : undefined,
        layout: createData.layout || MINDMAP_DEFAULTS.LAYOUT,
        theme: createData.theme || MINDMAP_DEFAULTS.THEME,
        viewData: createData.viewData ? JSON.stringify(createData.viewData) : undefined,
        tags: createData.tags,
      });

      // 验证数据
      const validation = entity.validate();
      if (!validation.isValid) {
        throw new BadRequestException(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // 保存到DynamoDB
      const item = entity.toDynamoDBItem();
      await this.db.put({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)', // 防止重复创建
      });

      const result = entity.toMindMapData();
      this.logger.log(`Mind map created successfully: ${result.id}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to create mind map: ${error.message}`, error.stack);
      if (error.name === 'ConditionalCheckFailedException') {
        throw new BadRequestException('Mind map already exists');
      }
      throw error;
    }
  }

  /**
   * 根据ID获取脑图
   */
  async getMindMapById(userId: string, mindMapId: string): Promise<MindMapData> {
    this.logger.log(`Getting mind map: ${mindMapId} for user: ${userId}`);
    
    try {
      // 从DynamoDB获取数据
      const pk = `USER#${userId}`;
      const sk = `MINDMAP#${mindMapId}`;

      const result = await this.db.get({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
      });

      if (!result.Item) {
        throw new NotFoundException(`Mind map not found: ${mindMapId}`);
      }

      // 将DynamoDB项目转换为实体
      const entity = new MindMapEntityClass(result.Item);
      const mindMapData = entity.toMindMapData();

      this.logger.log(`Mind map retrieved successfully: ${mindMapData.id}`);
      return mindMapData;
    } catch (error) {
      this.logger.error(`Failed to get mind map: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * 更新脑图
   */
  async updateMindMap(userId: string, mindMapId: string, updateData: UpdateMindMapRequest): Promise<MindMapData> {
    this.logger.log(`Updating mind map: ${mindMapId} for user: ${userId}`);
    
    try {
      // 从DynamoDB获取现有数据
      const pk = `USER#${userId}`;
      const sk = `MINDMAP#${mindMapId}`;

      const getResult = await this.db.get({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
      });

      if (!getResult.Item) {
        throw new NotFoundException(`Mind map not found: ${mindMapId}`);
      }

      // 创建现有实体
      const existingEntity = new MindMapEntityClass(getResult.Item);

      // 更新实体
      existingEntity.update({
        title: updateData.title,
        description: updateData.description,
        data: updateData.data,
        layout: updateData.layout,
        theme: updateData.theme,
        viewData: updateData.viewData,
        metadata: {
          version: existingEntity.version,
          createdAt: existingEntity.createdAt,
          updatedAt: new Date().toISOString(),
          tags: updateData.tags,
        }
      });

      // 验证更新后的数据
      const validation = existingEntity.validate();
      if (!validation.isValid) {
        throw new BadRequestException(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // 保存到DynamoDB
      const item = existingEntity.toDynamoDBItem();
      await this.db.put({
        TableName: this.tableName,
        Item: item,
      });

      const result = existingEntity.toMindMapData();
      this.logger.log(`Mind map updated successfully: ${result.id}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to update mind map: ${error.message}`, error.stack);
      if (error.name === 'ItemNotFound') {
        throw new NotFoundException(`Mind map not found: ${mindMapId}`);
      }
      throw error;
    }
  }

  /**
   * 删除脑图
   */
  async deleteMindMap(userId: string, mindMapId: string): Promise<void> {
    this.logger.log(`Deleting mind map: ${mindMapId} for user: ${userId}`);
    
    try {
      // 从DynamoDB删除数据
      const pk = `USER#${userId}`;
      const sk = `MINDMAP#${mindMapId}`;

      await this.db.delete({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk },
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)', // 确保项目存在
      });

      this.logger.log(`Mind map deleted successfully: ${mindMapId}`);
    } catch (error) {
      this.logger.error(`Failed to delete mind map: ${error.message}`, error.stack);
      if (error.name === 'ConditionalCheckFailedException') {
        throw new NotFoundException(`Mind map not found: ${mindMapId}`);
      }
      throw error;
    }
  }

  /**
   * 获取用户的脑图列表
   */
  async getMindMapList(userId: string, queryParams: MindMapQueryParams): Promise<{
    items: MindMapListItem[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    this.logger.log(`Getting mind map list for user: ${userId}`, queryParams);
    
    try {
      const page = queryParams.page || 1;
      const pageSize = Math.min(queryParams.pageSize || MINDMAP_DEFAULTS.PAGE_SIZE, MINDMAP_DEFAULTS.MAX_PAGE_SIZE);
      
      // 从DynamoDB查询数据
      const pk = `USER#${userId}`;

      const queryParams_db: any = {
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk_prefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':sk_prefix': 'MINDMAP#',
        },
        ScanIndexForward: false, // 按创建时间倒序
      };

      // 添加分页支持
      if (queryParams.lastEvaluatedKey) {
        queryParams_db.ExclusiveStartKey = JSON.parse(queryParams.lastEvaluatedKey);
      }

      queryParams_db.Limit = pageSize;

      const queryResult = await this.db.query(queryParams_db);

      // 转换为列表项
      const items: MindMapListItem[] = (queryResult.Items || []).map(item => {
        const entity = new MindMapEntityClass(item);
        return {
          id: entity.id,
          title: entity.title,
          description: entity.description,
          tags: entity.tags || [],
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          layout: entity.layout,
          theme: entity.theme,
        };
      });

      const hasMore = !!queryResult.LastEvaluatedKey;
      const total = items.length; // 注意：这里只是当前页的数量，不是总数

      const result = {
        items,
        total,
        page,
        pageSize,
        hasMore,
        lastEvaluatedKey: queryResult.LastEvaluatedKey ? JSON.stringify(queryResult.LastEvaluatedKey) : undefined,
      };

      this.logger.log(`Mind map list retrieved successfully: ${result.items.length} items`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get mind map list: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 检查用户是否有权限访问指定脑图
   */
  async checkPermission(userId: string, mindMapId: string): Promise<boolean> {
    this.logger.log(`Checking permission for user: ${userId}, mind map: ${mindMapId}`);
    
    try {
      // TODO: 实现权限检查逻辑
      // const entity = await this.dynamoDBRepository.findOne(userId, mindMapId);
      // return entity.userId === userId;
      
      // 暂时返回true
      return true;
    } catch (error) {
      this.logger.error(`Failed to check permission: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * 获取服务健康状态
   */
  async getHealthStatus(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}
