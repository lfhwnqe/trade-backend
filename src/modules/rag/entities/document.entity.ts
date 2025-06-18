import { DocumentType, DocumentStatus, Priority } from '../types/rag.types';

/**
 * 文档实体定义
 * 对应 DynamoDB RAG Documents 表结构
 */
export interface DocumentEntity {
  // 主键
  id: string; // 主键 - 文档ID（对应 DynamoDB 表的 partition key）
  userId: string; // 用户ID（用于 GSI）
  documentId: string; // 文档ID（保留为向后兼容）

  // 文档基本信息
  title: string; // 文档标题
  documentType: DocumentType; // 文档类型
  contentType: string; // 内容类型 (pdf, docx, txt, md)
  originalFileName: string; // 原始文件名
  fileSize: number; // 文件大小

  // 向量化信息
  embeddingIds: string[]; // Upstash Vector 中的向量ID列表
  chunkCount: number; // 分块数量
  totalTokens: number; // 总token数
  embeddingModel: string; // 使用的嵌入模型

  // 元数据
  metadata: {
    source?: string; // 来源
    author?: string; // 作者
    tags?: string[]; // 标签
    category?: string; // 分类
    priority?: Priority; // 优先级
    isPublic?: boolean; // 是否公开
    tradeSymbol?: string; // 交易品种 (交易相关文档)
    dateRange?: {
      // 时间范围
      from: string;
      to: string;
    };
  };

  // 状态信息
  status: DocumentStatus; // 处理状态
  processingProgress?: number; // 处理进度 (0-100)
  errorMessage?: string; // 错误信息

  // 时间戳
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
  lastAccessedAt?: string; // 最后访问时间
}

