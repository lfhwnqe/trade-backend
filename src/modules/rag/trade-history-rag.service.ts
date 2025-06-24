import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../common/config.service';
import { Index } from '@upstash/vector';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { DocumentType, VectorMetadata } from './types/rag.types';
import { Trade } from '../trade/entities/trade.entity';
import {
  VectorDBException,
  AIServiceException,
} from '../../base/exceptions/custom.exceptions';
import { ERROR_CODES } from '../../base/constants/error-codes';

@Injectable()
export class TradeHistoryRAGService {
  private readonly logger = new Logger(TradeHistoryRAGService.name);
  private readonly vectorIndex: Index;

  constructor(private readonly configService: ConfigService) {
    // 初始化 Upstash Vector
    this.vectorIndex = new Index({
      url: this.configService.getOrThrow('UPSTASH_VECTOR_REST_URL'),
      token: this.configService.getOrThrow('UPSTASH_VECTOR_REST_TOKEN'),
    });

    this.logger.log('Trade History RAG Service initialized');
  }

  /**
   * 将交易数据添加到向量数据库
   */
  // todo 如果该交易之前已经入库过了，需要先删除旧的向量记录，以便更新
  async addTradeToHistory(trade: Trade): Promise<void> {
    try {
      this.logger.log(
        `Adding trade ${trade.transactionId} to history for user ${trade.userId}`,
      );

      // 构建交易历史文本内容
      const tradeContent = this.buildTradeContent(trade);

      // 生成嵌入向量
      const embedding = await this.generateEmbedding(tradeContent);

      // 构建向量记录
      const vectorRecord = {
        id: `trade-history-${trade.transactionId}`,
        vector: embedding,
        data: tradeContent, // Upstash Vector 需要 data 字段
        metadata: this.buildTradeMetadata(trade, tradeContent) as any,
      };

      // 存储到向量数据库
      await this.vectorIndex.upsert([vectorRecord]);

      this.logger.log(
        `Successfully added trade ${trade.transactionId} to history`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to add trade ${trade.transactionId} to history`,
        error,
      );
      throw new VectorDBException(
        `Failed to add trade to history: ${error.message}`,
        ERROR_CODES.VECTOR_DB_STORE_FAILED,
        '交易历史添加失败',
        {
          tradeId: trade.transactionId,
          userId: trade.userId,
          originalError: error.message,
        },
      );
    }
  }

  /**
   * 从向量数据库删除交易历史
   */
  async removeTradeFromHistory(tradeId: string): Promise<void> {
    try {
      const vectorId = `trade-history-${tradeId}`;
      await this.vectorIndex.delete([vectorId]);

      this.logger.log(`Successfully removed trade ${tradeId} from history`);
    } catch (error) {
      this.logger.error(
        `Failed to remove trade ${tradeId} from history`,
        error,
      );
      throw new VectorDBException(
        `Failed to remove trade from history: ${error.message}`,
        ERROR_CODES.VECTOR_DB_DELETE_FAILED,
        '交易历史删除失败',
        {
          tradeId,
          originalError: error.message,
        },
      );
    }
  }

  /**
   * 搜索相似的交易历史
   */
  async searchSimilarTrades(
    userId: string,
    query: string,
    maxResults: number = 5,
  ): Promise<any[]> {
    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query);

      // 执行向量搜索
      const results = await this.vectorIndex.query({
        vector: queryEmbedding,
        topK: maxResults,
        includeMetadata: true,
        filter: `userId = "${userId}" AND documentType = "${DocumentType.TRADE_HISTORY}"`,
      });

      return results || [];
    } catch (error) {
      this.logger.error('Failed to search similar trades', error);
      throw new VectorDBException(
        `Failed to search similar trades: ${error.message}`,
        ERROR_CODES.VECTOR_DB_QUERY_FAILED,
        '交易历史搜索失败',
        {
          userId,
          query,
          originalError: error.message,
        },
      );
    }
  }

  /**
   * 生成嵌入向量
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: text,
      });
      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      throw new AIServiceException(
        `Failed to generate embedding: ${error.message}`,
        ERROR_CODES.AI_SERVICE_EMBEDDING_FAILED,
        '嵌入向量生成失败',
        { originalError: error.message },
      );
    }
  }

  /**
   * 构建交易内容文本
   */
  private buildTradeContent(trade: Trade): string {
    const parts = [
      `交易标的: ${trade.tradeSubject}`,
      `交易类型: ${trade.tradeType}`,
      `分析时间: ${trade.analysisTime}`,
      `入场方向: ${trade.entryDirection || '未知'}`,
      `交易结果: ${trade.tradeResult || '未知'}`,
    ];

    if (trade.marketStructureAnalysis) {
      parts.push(`市场结构分析: ${trade.marketStructureAnalysis}`);
    }

    if (trade.expectedPathAnalysis) {
      parts.push(`预期路径分析: ${trade.expectedPathAnalysis}`);
    }

    if (trade.actualPathAnalysis) {
      parts.push(`实际路径分析: ${trade.actualPathAnalysis}`);
    }

    if (trade.lessonsLearned) {
      parts.push(`经验总结: ${trade.lessonsLearned}`);
    }

    if (trade.remarks) {
      parts.push(`备注: ${trade.remarks}`);
    }

    return parts.join('\n');
  }

  /**
   * 构建交易元数据
   */
  private buildTradeMetadata(trade: Trade, content: string): VectorMetadata {
    return {
      userId: trade.userId,
      documentId: trade.transactionId,
      chunkIndex: 0,
      content,
      documentType: DocumentType.TRADE_HISTORY,
      title: `${trade.tradeSubject} 交易历史 - ${trade.analysisTime}`,
      timestamp: new Date().toISOString(),
      tokenCount: this.estimateTokenCount(content),
      // 交易特有字段
      tradeId: trade.transactionId,
      tradeSubject: trade.tradeSubject,
      tradeResult: trade.tradeResult,
      analysisTime: trade.analysisTime,
      tags: [
        trade.tradeType,
        trade.tradeSubject,
        trade.entryDirection,
        trade.tradeResult,
      ].filter(Boolean),
    };
  }

  /**
   * 估算 token 数量
   */
  private estimateTokenCount(text: string): number {
    // 简单估算：英文约4字符/token，中文约1.5字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}
