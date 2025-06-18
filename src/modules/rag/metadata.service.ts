import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '../common/config.service';
import { DocumentEntity } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentFilter, DocumentStatus } from './types/rag.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly docClient: DynamoDBDocumentClient;
  private readonly documentsTableName: string;

  constructor(private readonly configService: ConfigService) {
    // 初始化 DynamoDB 客户端
    this.dynamoDBClient = new DynamoDBClient({
      region: this.configService.get('AWS_REGION') || 'us-east-1',
    });
    this.docClient = DynamoDBDocumentClient.from(this.dynamoDBClient);

    // 获取表名
    this.documentsTableName = this.configService.getOrThrow(
      'RAG_DOCUMENTS_TABLE_NAME',
    );

    this.logger.log(`Documents table: ${this.documentsTableName}`);
  }

  /**
   * 创建文档元数据
   */
  async createDocument(
    userId: string,
    documentData: CreateDocumentDto,
    embeddingIds: string[] = [],
    chunkCount: number = 0,
    totalTokens: number = 0,
  ): Promise<DocumentEntity> {
    const documentId = uuidv4();
    const now = new Date().toISOString();

    const document: DocumentEntity = {
      id: documentId, // 使用 documentId 作为主键
      userId,
      documentId, // 保留为向后兼容
      title: documentData.title,
      documentType: documentData.documentType,
      contentType: documentData.contentType,
      originalFileName: documentData.originalFileName || documentData.title,
      fileSize: documentData.fileSize || 0,
      embeddingIds,
      chunkCount,
      totalTokens,
      embeddingModel: 'text-embedding-3-small', // 默认模型
      metadata: documentData.metadata || {},
      status: DocumentStatus.PROCESSING,
      processingProgress: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.documentsTableName,
          Item: document,
        }),
      );

      this.logger.log(
        `Created document metadata for user ${userId}, document ${documentId}`,
      );
      return document;
    } catch (error) {
      this.logger.error('Failed to create document metadata', error);
      throw error;
    }
  }

  /**
   * 获取单个文档
   */
  async getDocument(
    userId: string,
    documentId: string,
  ): Promise<DocumentEntity> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.documentsTableName,
          Key: { id: documentId }, // 使用 id 作为主键
        }),
      );

      if (!result.Item) {
        throw new NotFoundException(
          `Document ${documentId} not found for user ${userId}`,
        );
      }

      // 验证文档属于该用户
      const document = result.Item as DocumentEntity;
      if (document.userId !== userId) {
        throw new NotFoundException(
          `Document ${documentId} not found for user ${userId}`,
        );
      }

      // 更新最后访问时间
      await this.updateLastAccessed(documentId);

      return document;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to get document', error);
      throw error;
    }
  }

  /**
   * 更新文档元数据
   */
  async updateDocument(
    userId: string,
    documentId: string,
    updates: Partial<DocumentEntity>,
  ): Promise<DocumentEntity> {
    const now = new Date().toISOString();

    // 先验证文档存在且属于该用户
    await this.getDocument(userId, documentId);

    // 构建更新表达式
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // 动态构建更新表达式
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'userId' && key !== 'documentId') {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    // 总是更新 updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    try {
      const result = await this.docClient.send(
        new UpdateCommand({
          TableName: this.documentsTableName,
          Key: { id: documentId }, // 使用 id 作为主键
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        }),
      );

      this.logger.log(`Updated document ${documentId} for user ${userId}`);

      return result.Attributes as DocumentEntity;
    } catch (error) {
      this.logger.error('Failed to update document', error);
      throw error;
    }
  }

  /**
   * 删除文档元数据
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    try {
      // 先验证文档存在且属于该用户
      await this.getDocument(userId, documentId);

      await this.docClient.send(
        new DeleteCommand({
          TableName: this.documentsTableName,
          Key: { id: documentId }, // 使用 id 作为主键
        }),
      );

      this.logger.log(`Deleted document ${documentId} for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to delete document', error);
      throw error;
    }
  }

  /**
   * 列出用户的文档
   */
  async listDocuments(
    userId: string,
    filters?: DocumentFilter,
  ): Promise<DocumentEntity[]> {
    this.logger.log(`Querying documents for userId: ${userId}`);
    
    try {
      const params: any = {
        TableName: this.documentsTableName,
        IndexName: 'userId-createdAt-index', // 使用 GSI
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      };

      // 添加过滤条件
      if (filters) {
        const filterExpressions: string[] = [];

        if (filters.documentType) {
          filterExpressions.push('documentType = :documentType');
          params.ExpressionAttributeValues[':documentType'] =
            filters.documentType;
        }

        if (filters.status) {
          filterExpressions.push('#status = :status');
          params.ExpressionAttributeNames = {
            ...params.ExpressionAttributeNames,
            '#status': 'status',
          };
          params.ExpressionAttributeValues[':status'] = filters.status;
        }

        if (filters.tags && filters.tags.length > 0) {
          filterExpressions.push('contains(metadata.tags, :tag)');
          params.ExpressionAttributeValues[':tag'] = filters.tags[0]; // 简化实现，只支持单个标签
        }

        if (filterExpressions.length > 0) {
          params.FilterExpression = filterExpressions.join(' AND ');
        }
      }

      const result = await this.docClient.send(new QueryCommand(params));

      let documents = (result.Items || []) as DocumentEntity[];

      // 客户端分页（简化实现）
      if (filters?.page && filters?.pageSize) {
        const startIndex = (filters.page - 1) * filters.pageSize;
        const endIndex = startIndex + filters.pageSize;
        documents = documents.slice(startIndex, endIndex);
      }

      return documents;
    } catch (error) {
      this.logger.error('Failed to list documents', error);
      throw error;
    }
  }


  /**
   * 更新文档最后访问时间
   */
  private async updateLastAccessed(documentId: string): Promise<void> {
    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.documentsTableName,
          Key: { id: documentId }, // 使用 id 作为主键
          UpdateExpression: 'SET lastAccessedAt = :timestamp',
          ExpressionAttributeValues: {
            ':timestamp': new Date().toISOString(),
          },
        }),
      );
    } catch (error) {
      // 忽略更新访问时间的错误，不影响主要功能
      this.logger.warn('Failed to update last accessed time', error);
    }
  }
}
