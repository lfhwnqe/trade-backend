# RAG模块功能说明

## 概述

RAG（Retrieval-Augmented Generation）模块提供知识库管理和交易历史检索功能，支持向量化存储和智能搜索。

## 主要功能

### 1. 知识库管理（RAGService）

#### 功能特性
- ✅ 文档增删改查（CRUD）
- ✅ 与Upstash Vector集成
- ✅ 文档删除时同步删除Upstash中的向量数据
- ✅ 文档更新时同步更新向量数据
- ✅ 智能文本分块和向量化
- ✅ 语义搜索和检索

#### API接口
- `POST /rag/documents` - 添加文档
- `GET /rag/documents` - 获取文档列表
- `GET /rag/documents/:id` - 获取单个文档
- `PUT /rag/documents/:id` - 更新文档
- `DELETE /rag/documents/:id` - 删除文档
- `POST /rag/search` - 搜索文档

### 2. 交易历史RAG（TradeHistoryRAGService）

#### 功能特性
- ✅ 自动将完结的交易分析添加到向量库
- ✅ 支持交易历史的语义搜索
- ✅ 删除交易时同步清理向量数据
- ✅ 智能构建交易内容摘要

#### 触发条件
交易数据在以下情况下会自动添加到RAG历史库：
- `analysisExpired = true` （分析已过期）
- `lessonsLearned` 字段存在且不为空

#### 数据结构
```typescript
interface TradeHistoryVector {
  id: string; // trade-history-{transactionId}
  vector: number[]; // 1536维向量
  data: string; // 交易内容摘要
  metadata: {
    userId: string;
    documentId: string;
    documentType: 'trade_history';
    tradeId: string;
    tradeSubject: string;
    tradeResult: string;
    analysisTime: string;
    // ... 其他元数据
  }
}
```

## 集成说明

### Trade模块集成

Trade服务已集成RAG功能：

1. **创建交易** (`createTrade`)
   - 创建交易记录后检查RAG条件
   - 符合条件时自动添加到历史库

2. **更新交易** (`updateTrade`)
   - 更新交易记录后检查RAG条件
   - 符合条件时自动添加到历史库

3. **删除交易** (`deleteTrade`)
   - 删除交易记录前先清理RAG历史
   - 确保数据一致性

### 错误处理

- RAG操作失败不会影响主要的交易操作
- 所有RAG错误都会记录日志但不抛出异常
- 提供详细的错误信息用于调试

## 配置要求

### 环境变量
```bash
# Upstash Vector配置
UPSTASH_VECTOR_REST_URL=https://your-vector-db.upstash.io
UPSTASH_VECTOR_REST_TOKEN=your-token

# OpenAI配置（用于生成嵌入向量）
OPENAI_API_KEY=your-openai-key
```

### 依赖模块
- `@upstash/vector` - 向量数据库
- `@ai-sdk/openai` - OpenAI集成
- `ai` - AI SDK

## 使用示例

### 搜索相似交易历史
```typescript
const similarTrades = await tradeHistoryRAGService.searchSimilarTrades(
  userId,
  'BTC多头策略失败经验',
  5
);
```

### 手动添加交易到历史
```typescript
await tradeHistoryRAGService.addTradeToHistory(trade);
```

### 删除交易历史
```typescript
await tradeHistoryRAGService.removeTradeFromHistory(tradeId);
```

## 监控和日志

- 所有RAG操作都有详细的日志记录
- 包含性能指标（处理时间、向量数量等）
- 错误日志包含完整的上下文信息

## 扩展性

- 支持多种文档类型（知识库、交易历史等）
- 可配置的分块策略
- 支持自定义元数据字段
- 可扩展的搜索过滤器
