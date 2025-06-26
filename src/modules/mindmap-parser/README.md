# 思维导图解析模块

## 概述

思维导图解析模块是一个功能完善的思维导图文件解析系统，专门设计用于解析多种格式的思维导图文件，并将其转换为标准化的图数据结构，存储到DynamoDB中用于RAG系统。

## 功能特性

### 核心功能
- ✅ **多格式支持**: 支持FreeMind(.mm)、OPML(.opml)、JSON、Markdown等格式
- ✅ **文件上传解析**: 支持直接上传文件进行解析
- ✅ **数据存储**: 自动将解析结果存储到DynamoDB
- ✅ **反向索引**: 为节点文本建立反向索引，支持快速搜索
- ✅ **图遍历**: 支持获取节点的上下文子图

### 数据库功能
- ✅ **DynamoDB集成**: 使用DynamoDB存储图数据和索引
- ✅ **关键词搜索**: 基于反向索引的快速节点搜索
- ✅ **子图查询**: 获取指定节点及其相关节点的上下文信息
- ✅ **批量操作**: 支持批量写入和删除操作

### 错误处理
- ✅ **格式验证**: 自动检测和验证思维导图格式
- ✅ **错误日志**: 详细的解析过程日志记录
- ✅ **优雅降级**: 解析失败时提供详细的错误信息

## API接口

### 1. 上传并存储思维导图
```http
POST /parser/mindmap/upload-and-store
Content-Type: multipart/form-data

file: [思维导图文件]
format: "freemind" (可选，自动检测)
```

### 2. 搜索节点
```http
GET /parser/graphs/search?keyword=关键词
```

### 3. 获取子图
```http
GET /parser/graphs/{graphId}/nodes/{nodeId}/subgraph
```

## 响应格式

### 上传成功响应
```json
{
  "message": "Graph created successfully",
  "graphId": "mindmap-12345-uuid",
  "nodeCount": 15,
  "edgeCount": 14
}
```

### 搜索结果响应
```json
[
  {
    "graphId": "mindmap-12345-uuid",
    "nodeId": "node_1",
    "text": "匹配的节点文本"
  }
]
```

### 子图响应
```json
[
  {
    "id": "node_1",
    "text": "节点文本",
    "level": 1,
    "parentId": "root"
  }
]
```

## 支持的思维导图格式

| 格式 | 文件扩展名 | 描述 |
|------|------------|------|
| FreeMind | .mm | FreeMind思维导图XML格式 |
| OPML | .opml | Outline Processor Markup Language |
| JSON | .json | 标准JSON格式或simple-mind-map格式 |
| Markdown | .md, .markdown | Markdown列表格式 |

## 测试

### 运行单元测试
```bash
npm test -- --testPathPattern=mindmap-parser.service.spec.ts
```

## 数据库结构

### DynamoDB表结构
- **PK**: 主键，格式为 `graphId` 或 `WORD#{keyword}`
- **SK**: 排序键，格式为 `METADATA`、`NODE#{nodeId}` 或 `{graphId}|NODE#{nodeId}`

### 索引结构
- 使用反向索引支持关键词搜索
- 每个节点的文本会被分词并建立索引
- 支持快速的全文搜索功能

## 使用示例

### TypeScript示例
```typescript
import { MindMapParserService } from './services/mindmap-parser.service';
import { GraphRepositoryService } from './services/graph-repository.service';

const mindMapParser = new MindMapParserService();
const graphRepository = new GraphRepositoryService();

// 解析思维导图
const mindMapData = await mindMapParser.parseMindMap(content, 'freemind');

// 存储到数据库
await graphRepository.createGraph('my-graph-id', mindMapData);

// 搜索节点
const searchResults = await graphRepository.searchNodesByKeyword('关键词');

// 获取子图
const subgraph = await graphRepository.getSubgraphForNode('my-graph-id', 'node-id');
```

## 架构设计

```
MindMapParserController
    ↓
┌─────────────────────┬─────────────────────┐
│ MindMapParserService │ GraphRepositoryService │
└─────────────────────┴─────────────────────┘
    ↓                       ↓
┌─────────────────────┬─────────────────────┐
│ 多格式解析支持        │ DynamoDB存储        │
│ - FreeMind          │ - 图数据存储        │
│ - OPML              │ - 反向索引          │
│ - JSON              │ - 快速搜索          │
│ - Markdown          │ - 子图查询          │
└─────────────────────┴─────────────────────┘
```

## 扩展性

模块设计采用依赖注入和服务分离的架构，便于扩展：

1. **新的思维导图格式**: 在`MindMapParserService`中添加新的格式解析逻辑
2. **新的存储后端**: 在`GraphRepositoryService`中添加新的存储实现
3. **新的搜索功能**: 扩展反向索引和搜索算法
4. **新的图遍历算法**: 添加更复杂的子图查询功能

## 注意事项

1. **文件大小限制**: 建议单个思维导图文件不超过10MB
2. **节点数量限制**: 建议单个图的节点数量不超过10000个
3. **DynamoDB配置**: 确保DynamoDB表已正确配置
4. **错误处理**: 始终检查解析和存储操作的结果
5. **日志记录**: 生产环境中启用适当的日志级别
