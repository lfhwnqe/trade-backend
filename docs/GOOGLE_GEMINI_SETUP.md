# Google Gemini API 配置指南

## 概述

本项目已将embedding模型从OpenAI切换到Google Gemini的`text-embedding-004`模型，以提供更好的性能和成本效益。

## 获取Google API密钥

### 1. 访问Google AI Studio

1. 打开浏览器，访问 [Google AI Studio](https://aistudio.google.com/)
2. 使用你的Google账号登录

### 2. 创建API密钥

1. 在Google AI Studio中，点击左侧菜单的 **"Get API key"**
2. 点击 **"Create API key"** 按钮
3. 选择一个现有的Google Cloud项目，或创建新项目
4. 复制生成的API密钥

### 3. 配置环境变量

将获取的API密钥添加到项目的环境变量文件中：

```bash
# 在 trade-backend/.env 文件中添加
GOOGLE_GENERATIVE_AI_API_KEY=your_actual_api_key_here
```

**重要提示：**
- 请将 `your_actual_api_key_here` 替换为你实际获取的API密钥
- 不要将真实的API密钥提交到版本控制系统中
- 确保 `.env` 文件已添加到 `.gitignore` 中

## 模型配置详情

### 当前使用的模型配置

```typescript
const embeddingModel = google.textEmbeddingModel('text-embedding-004', {
  outputDimensionality: 768, // 768维度向量
  taskType: 'SEMANTIC_SIMILARITY', // 语义相似性任务
});
```

### 配置参数说明

- **模型名称**: `text-embedding-004` - Google最新的文本嵌入模型
- **输出维度**: `768` - 向量维度，适合大多数向量数据库
- **任务类型**: `SEMANTIC_SIMILARITY` - 针对语义相似性搜索优化

## 费用说明

Google Gemini API的embedding服务按使用量计费：

- **text-embedding-004**: 每1000个token约 $0.00001 USD
- 相比OpenAI的embedding服务更具成本效益
- 详细定价请参考 [Google AI Pricing](https://ai.google.dev/pricing)

## 使用限制

### 速率限制
- 每分钟最多1500个请求
- 每天最多100万个token

### 文本限制
- 单次请求最大文本长度：2048个token
- 支持多种语言，包括中文

## 验证配置

启动应用后，检查日志确认embedding服务正常工作：

```bash
# 启动开发服务器
npm run start:dev

# 查看日志，确认没有API密钥相关错误
# 成功的日志应该显示：
[RAGService] RAG Service initialized
```

## 故障排除

### 常见错误及解决方案

#### 1. API密钥无效
```
Error: Invalid API key
```
**解决方案**: 检查API密钥是否正确设置，确保没有多余的空格或字符

#### 2. 配额超限
```
Error: Quota exceeded
```
**解决方案**: 检查Google Cloud Console中的API配额设置，或等待配额重置

#### 3. 网络连接问题
```
Error: Network timeout
```
**解决方案**: 检查网络连接，确保可以访问Google AI服务

## 迁移说明

### 从OpenAI迁移的变更

1. **依赖包变更**:
   - 新增: `@ai-sdk/google`
   - 保留: `@ai-sdk/openai` (用于其他功能)

2. **向量维度变更**:
   - OpenAI: 1536维 → Google: 768维
   - 如果已有向量数据，需要重新生成embedding

3. **模型性能**:
   - Google text-embedding-004 在多语言支持上表现更好
   - 特别适合中英文混合的文档处理

## 环境变量完整列表

```bash
# Google Gemini API
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# 其他必需的环境变量
UPSTASH_VECTOR_REST_URL=your_upstash_vector_url
UPSTASH_VECTOR_REST_TOKEN=your_upstash_vector_token
RAG_DOCUMENTS_TABLE_NAME=rag-documents-dev
```

## 支持与帮助

如果在配置过程中遇到问题：

1. 检查 [Google AI Studio 文档](https://ai.google.dev/docs)
2. 查看项目的错误日志
3. 确认所有环境变量都已正确设置
4. 验证Google Cloud项目的API配额和计费设置

---

**注意**: 请妥善保管你的API密钥，不要在公共场所或代码仓库中暴露。
