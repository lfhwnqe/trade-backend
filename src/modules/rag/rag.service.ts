import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import { MetadataService } from './metadata.service';
import { Index } from '@upstash/vector';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { embed } from 'ai';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  SearchQueryDto,
} from './dto';
import { DocumentEntity } from './entities/document.entity';
import {
  RetrievalResultDto,
} from './dto/rag-response.dto';
import {
  DocumentFilter,
  DocumentStatus,
  DocumentType,
  SearchResult,
  TextChunk,
} from './types/rag.types';
import { TextProcessor } from './utils/text-processor';

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);
  private readonly vectorIndex: Index;

  constructor(
    private readonly configService: ConfigService,
    private readonly metadataService: MetadataService,
  ) {
    // 初始化 Upstash Vector
    this.vectorIndex = new Index({
      url: this.configService.getOrThrow('UPSTASH_VECTOR_REST_URL'),
      token: this.configService.getOrThrow('UPSTASH_VECTOR_REST_TOKEN'),
    });

    this.logger.log('RAG Service initialized');
  }

  /**
   * 上传并处理文档
   */
  async uploadDocument(
    userId: string,
    documentData: CreateDocumentDto,
  ): Promise<DocumentEntity> {
    this.logger.log(
      `Processing document upload for user ${userId}: ${documentData.title}`,
    );

    // [DEBUG] 检查传入的 DTO 对象类型
    this.logger.debug('=== RAG Service 调试信息 ===');
    this.logger.debug(`Received documentData type: ${typeof documentData}`);
    this.logger.debug(`documentData constructor: ${documentData.constructor.name}`);
    this.logger.debug(`documentData prototype: ${Object.getPrototypeOf(documentData).constructor.name}`);

    try {
      // 1. 创建文档元数据（处理中状态）
      const document = await this.metadataService.createDocument(
        userId,
        documentData,
      );

      // 2. 异步处理文档内容
      this.processDocumentAsync(
        userId,
        document.documentId,
        documentData.content,
      );

      return document;
    } catch (error) {
      this.logger.error('Failed to upload document', error);
      throw error;
    }
  }

  /**
   * 异步处理文档内容
   */
  private async processDocumentAsync(
    userId: string,
    documentId: string,
    content: string,
  ): Promise<void> {
    try {
      this.logger.log(`Starting document processing for ${documentId}`);

      // 1. 文档预处理和分析
      const processedContent = await this.preprocessDocument(content);
      const documentAnalysis = this.analyzeDocument(processedContent);

      // 2. 智能文本分块
      const chunks = this.splitText(processedContent);

      // 3. 生成嵌入向量
      const embeddings = await this.generateEmbeddings(
        chunks.map((chunk) => chunk.content),
      );

      // 4. 存储向量到 Upstash Vector
      const embeddingIds = await this.storeVectors(
        userId,
        documentId,
        chunks,
        embeddings,
      );

      // 5. 更新文档状态和分析结果
      const updateData = {
        status: DocumentStatus.COMPLETED,
        processingProgress: 100,
        embeddingIds,
        chunkCount: chunks.length,
        totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        metadata: {
          ...documentAnalysis,
          processedAt: new Date().toISOString(),
        },
      };

      this.logger.debug(`Updating document ${documentId} with processing results:`, {
        status: updateData.status,
        chunkCount: updateData.chunkCount,
        embeddingIdsCount: embeddingIds.length,
        totalTokens: updateData.totalTokens
      });

      await this.metadataService.updateDocument(userId, documentId, updateData);

      this.logger.log(
        `Document processing completed for ${documentId}: ${chunks.length} chunks, ${embeddingIds.length} vectors`,
      );
    } catch (error) {
      this.logger.error(`Document processing failed for ${documentId}`, {
        error: error.message,
        stack: error.stack,
        userId,
        documentId
      });

      // 更新文档状态为失败
      try {
        const failureUpdateData = {
          status: DocumentStatus.FAILED,
          errorMessage: error.message,
          processingProgress: 0,
        };

        this.logger.debug(`Updating document ${documentId} status to failed:`, failureUpdateData);
        
        await this.metadataService.updateDocument(userId, documentId, failureUpdateData);
      } catch (updateError) {
        this.logger.error(`Failed to update document status to failed for ${documentId}`, {
          originalError: error.message,
          updateError: updateError.message,
          userId,
          documentId
        });
      }
    }
  }

  /**
   * 获取文档列表
   */
  async getDocuments(
    userId: string,
    filters?: DocumentFilter,
  ): Promise<DocumentEntity[]> {
    return this.metadataService.listDocuments(userId, filters);
  }

  /**
   * 获取单个文档
   */
  async getDocument(
    userId: string,
    documentId: string,
  ): Promise<DocumentEntity> {
    return this.metadataService.getDocument(userId, documentId);
  }

  /**
   * 更新文档
   */
  async updateDocument(
    userId: string,
    documentId: string,
    updateData: UpdateDocumentDto,
  ): Promise<DocumentEntity> {
    return this.metadataService.updateDocument(userId, documentId, updateData);
  }

  /**
   * 删除文档
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    try {
      // 1. 获取文档信息
      const document = await this.metadataService.getDocument(
        userId,
        documentId,
      );

      // 2. 删除向量数据
      if (document.embeddingIds && document.embeddingIds.length > 0) {
        await this.deleteVectors(document.embeddingIds);
      }

      // 3. 删除元数据
      await this.metadataService.deleteDocument(userId, documentId);

      this.logger.log(`Document ${documentId} deleted for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to delete document', error);
      throw error;
    }
  }

  /**
   * 搜索文档
   */
  async searchDocuments(
    userId: string,
    searchQuery: SearchQueryDto,
  ): Promise<RetrievalResultDto> {
    const startTime = Date.now();

    try {
      // 1. 生成查询向量
      const queryEmbedding = await this.generateEmbedding(searchQuery.query);

      // 2. 向量搜索
      const searchResults = await this.vectorSearch(
        userId,
        queryEmbedding,
        searchQuery,
      );

      // 3. 构建上下文
      const context = this.buildContext(searchResults);

      const processingTime = Date.now() - startTime;

      return {
        query: searchQuery.query,
        results: searchResults.map((result) => ({
          id: result.id,
          score: result.score,
          content: result.content,
          metadata: result.metadata,
        })),
        totalResults: searchResults.length,
        processingTime,
        context,
      };
    } catch (error) {
      this.logger.error('Failed to search documents', error);
      throw error;
    }
  }


  /**
   * 文本分块 - 使用增强的文本处理器
   */
  private splitText(text: string): TextChunk[] {
    const chunkSize = parseInt(
      this.configService.get('RAG_CHUNK_SIZE') || '1000',
    );
    const chunkOverlap = parseInt(
      this.configService.get('RAG_CHUNK_OVERLAP') || '200',
    );
    const minChunkSize = parseInt(
      this.configService.get('RAG_MIN_CHUNK_SIZE') || '100',
    );
    const maxChunkSize = parseInt(
      this.configService.get('RAG_MAX_CHUNK_SIZE') || '2000',
    );

    // 使用增强的文本处理器进行智能分块
    const processedChunks = TextProcessor.splitText(text, {
      chunkSize,
      chunkOverlap,
      minChunkSize,
      maxChunkSize,
      preserveParagraphs: true,
      preserveSentences: true,
    });

    // 转换为 RAG 服务期望的格式
    return processedChunks.map(chunk => ({
      content: chunk.content,
      index: chunk.index,
      tokenCount: chunk.tokenCount,
    }));
  }

  /**
   * 生成嵌入向量
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings: number[][] = [];

      // 创建带有API密钥的openai provider
      const openaiProvider = createOpenAI({
        apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
      });

      // 批量处理嵌入
      for (const text of texts) {
        const { embedding } = await embed({
          model: openaiProvider.embedding('text-embedding-3-small'),
          value: text,
        });
        embeddings.push(embedding);
      }

      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate embeddings', error);
      throw error;
    }
  }

  /**
   * 生成单个嵌入向量
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  /**
   * 存储向量到 Upstash Vector
   */
  private async storeVectors(
    userId: string,
    documentId: string,
    chunks: TextChunk[],
    embeddings: number[][],
  ): Promise<string[]> {
    const vectors = chunks.map((chunk, index) => ({
      id: `${documentId}-${chunk.index}`,
      vector: embeddings[index],
      metadata: {
        userId,
        documentId,
        chunkIndex: chunk.index,
        content: chunk.content,
        documentType: DocumentType.KNOWLEDGE,
        title: 'Document',
        timestamp: new Date().toISOString(),
        tokenCount: chunk.tokenCount,
      },
    }));

    try {
      await this.vectorIndex.upsert(vectors);
      return vectors.map((v) => v.id);
    } catch (error) {
      this.logger.error('Failed to store vectors', error);
      throw error;
    }
  }

  /**
   * 向量搜索
   */
  private async vectorSearch(
    userId: string,
    queryEmbedding: number[],
    options: SearchQueryDto,
  ): Promise<SearchResult[]> {
    try {
      const results = await this.vectorIndex.query({
        vector: queryEmbedding,
        topK: options.maxResults || 10,
        includeMetadata: true,
        filter: `userId = "${userId}"`,
      });

      return results
        .filter(
          (result) =>
            (result.score || 0) >= (options.similarityThreshold || 0.7),
        )
        .map((result) => ({
          id: String(result.id),
          score: result.score || 0,
          content: (result.metadata?.content as string) || '',
          metadata: result.metadata as any,
        }));
    } catch (error) {
      this.logger.error('Failed to perform vector search', error);
      throw error;
    }
  }

  /**
   * 删除向量
   */
  private async deleteVectors(vectorIds: string[]): Promise<void> {
    try {
      await this.vectorIndex.delete(vectorIds);
    } catch (error) {
      this.logger.error('Failed to delete vectors', error);
      throw error;
    }
  }

  /**
   * 构建上下文
   */
  private buildContext(searchResults: SearchResult[]): string {
    return searchResults
      .map((result, index) => `[文档 ${index + 1}] ${result.content}`)
      .join('\n\n');
  }


  /**
   * 估算 token 数量 - 使用增强的估算逻辑
   */
  private estimateTokenCount(text: string): number {
    return TextProcessor.estimateTokenCount(text);
  }

  /**
   * 文档预处理
   */
  private async preprocessDocument(content: string): Promise<string> {
    // 使用 TextProcessor 清理和预处理文本
    return TextProcessor.cleanText(content);
  }

  /**
   * 分析文档内容
   */
  private analyzeDocument(content: string): any {
    const analysis = {
      language: TextProcessor.detectLanguage(content),
      keywords: TextProcessor.extractKeywords(content, 15),
      summary: TextProcessor.generateSummary(content, 3),
      structure: TextProcessor.extractDocumentStructure(content),
      wordCount: content.length,
      estimatedReadingTime: Math.ceil(content.split(/\s+/).length / 200), // 假设每分钟读200词
    };

    return analysis;
  }

  /**
   * 简单的文本向量化和存储方法（用于测试接口）
   */
  async vectorizeAndStoreText(content: string): Promise<{
    model: string;
    vectorId: string;
    storageStatus: 'success' | 'failed';
    tokenUsage: {
      inputTokens: number;
      embeddingDimensions: number;
    };
    processingTimeMs: number;
    chunkInfo: {
      chunkCount: number;
      totalCharacters: number;
      averageChunkSize: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting simple vectorization for content length: ${content.length}`);

      // 1. 文本预处理
      const processedContent = await this.preprocessDocument(content);
      
      // 2. 智能文本分块
      const chunks = this.splitText(processedContent);
      
      // 3. 生成嵌入向量（只处理第一个块用于测试）
      const firstChunk = chunks[0];
      
      // 创建带有API密钥的openai provider
      const openaiProvider = createOpenAI({
        apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
      });
      
      const { embedding } = await embed({
        model: openaiProvider.embedding('text-embedding-3-small'),
        value: firstChunk.content,
      });

      // 4. 生成唯一的向量ID
      const vectorId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 5. 存储向量到 Upstash Vector
      const vector = {
        id: vectorId,
        vector: embedding,
        metadata: {
          userId: 'test-user',
          documentId: 'test-document',
          chunkIndex: 0,
          content: firstChunk.content,
          documentType: DocumentType.KNOWLEDGE,
          title: 'Simple Test Document',
          timestamp: new Date().toISOString(),
          tokenCount: firstChunk.tokenCount,
          isTestData: true, // 标记为测试数据
        },
      };

      await this.vectorIndex.upsert([vector]);

      const processingTime = Date.now() - startTime;

      this.logger.log(`Simple vectorization completed for vector ID: ${vectorId}`);

      return {
        model: 'text-embedding-3-small',
        vectorId,
        storageStatus: 'success',
        tokenUsage: {
          inputTokens: firstChunk.tokenCount,
          embeddingDimensions: embedding.length,
        },
        processingTimeMs: processingTime,
        chunkInfo: {
          chunkCount: chunks.length,
          totalCharacters: content.length,
          averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Simple vectorization failed', error);
      
      return {
        model: 'text-embedding-3-small',
        vectorId: '',
        storageStatus: 'failed',
        tokenUsage: {
          inputTokens: 0,
          embeddingDimensions: 0,
        },
        processingTimeMs: processingTime,
        chunkInfo: {
          chunkCount: 0,
          totalCharacters: content.length,
          averageChunkSize: 0,
        },
      };
    }
  }

}
