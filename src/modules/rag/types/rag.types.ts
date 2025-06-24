/**
 * RAG 相关类型定义
 */

// 文档类型枚举
export enum DocumentType {
  TRADE = 'trade',
  TRADE_HISTORY = 'trade_history', // 新增：交易历史类型
  KNOWLEDGE = 'knowledge',
  MANUAL = 'manual',
  REPORT = 'report',
}

// 文档状态枚举
export enum DocumentStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELETED = 'deleted',
}

// 优先级枚举
export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// 向量搜索选项
export interface SearchOptions {
  userId: string;
  maxResults?: number;
  similarityThreshold?: number;
  documentTypes?: DocumentType[];
  dateRange?: {
    from: string;
    to: string;
  };
}

// 检索选项
export interface RetrievalOptions extends SearchOptions {
  rerankResults?: boolean;
  includeMetadata?: boolean;
  contextWindowSize?: number;
}

// 向量记录元数据
export interface VectorMetadata {
  userId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  documentType: DocumentType;
  title: string;
  tags?: string[];
  timestamp: string;
  tokenCount: number;
  // 交易历史特有字段
  tradeId?: string; // 交易ID
  tradeSubject?: string; // 交易标的
  tradeResult?: string; // 交易结果
  analysisTime?: string; // 分析时间
}

// 向量记录
export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: VectorMetadata;
}

// 搜索结果
export interface SearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
  content: string;
}

// 检索结果
export interface RetrievalResult {
  query: string;
  results: SearchResult[];
  totalResults: number;
  processingTime: number;
  context: string;
}

// 文档摘要
export interface DocumentSummary {
  documentId: string;
  title: string;
  summary: string;
  keyPoints: string[];
  wordCount: number;
  generatedAt: string;
}

// 文本分块
export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata?: Record<string, any>;
}

// 搜索过滤器
export interface SearchFilters {
  documentTypes?: DocumentType[];
  tags?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  userId: string;
  isPublic?: boolean;
}

// 文档过滤器
export interface DocumentFilter {
  documentType?: DocumentType;
  status?: DocumentStatus;
  tags?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  page?: number;
  pageSize?: number;
}

// RAG 分析数据
export interface RAGAnalytics {
  totalQueries: number;
  totalDocuments: number;
  avgResponseTime: number;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
  documentUsage: Array<{
    documentId: string;
    title: string;
    accessCount: number;
  }>;
  dailyStats: Array<{
    date: string;
    queries: number;
    documents: number;
  }>;
}

// 嵌入配置
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  batchSize: number;
  maxTokens: number;
}

// 分块配置
export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  maxChunkSize: number;
}
