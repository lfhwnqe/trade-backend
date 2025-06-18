# CDK 部署指南 - DynamoDB 表结构修复

## 修改概述

已修改 `trade-backend/cdk/lib/cdk-stack.ts` 中的 `ragDocumentsTable` 定义，将其从单一主键结构改为复合主键结构。

### 修改前
```typescript
partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING }
```

### 修改后
```typescript
partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
sortKey: { name: 'documentId', type: dynamodb.AttributeType.STRING }
```

## 修改详情

1. **主键结构变更**：
   - 分区键：`userId` (String)
   - 排序键：`documentId` (String)

2. **GSI 配置优化**：
   - 移除了冗余的 `userId-createdAt-index`（因为 userId 现在是主表的分区键）
   - 保留了 `status-createdAt-index`，用于按状态和创建时间查询

3. **其他配置保持不变**：
   - Billing mode: PAY_PER_REQUEST
   - Removal policy: DESTROY
   - Point-in-time recovery: 启用

## 部署步骤

### 1. 准备工作
```bash
cd trade-backend/cdk
npm install
```

### 2. 构建应用
```bash
cd ..
npm run build
```

### 3. 部署前检查
```bash
cd cdk
npx cdk diff
```

### 4. 执行部署
```bash
npx cdk deploy
```

## ⚠️ 重要注意事项

### 破坏性更改警告
- **这是破坏性更改**：表结构修改会导致 DynamoDB 表重建
- **数据丢失**：现有表中的所有数据将被删除
- **停机时间**：在表重建期间，应用将无法访问 RAG 文档数据

### 建议操作顺序
1. **数据备份**（如果有重要数据）：
   ```bash
   # 使用 AWS CLI 导出现有数据
   aws dynamodb scan --table-name rag-documents-dev --output json > backup.json
   ```

2. **部署新表结构**：
   ```bash
   npx cdk deploy
   ```

3. **验证表结构**：
   ```bash
   aws dynamodb describe-table --table-name rag-documents-dev
   ```

## 预期结果

部署完成后，`rag-documents-{env}` 表将具有以下结构：

- **主键**：
  - 分区键：`userId` (String)
  - 排序键：`documentId` (String)

- **全局二级索引**：
  - `status-createdAt-index`：按状态和创建时间查询

- **功能改进**：
  - 解决 "Query condition missed key schema element: id" 错误
  - 支持高效的按用户ID查询文档列表
  - 支持复合键的单文档查询

## 验证部署

部署完成后，可以通过以下方式验证：

1. **检查表结构**：
   ```bash
   aws dynamodb describe-table --table-name rag-documents-dev
   ```

2. **测试应用功能**：
   - 创建新文档
   - 查询用户文档列表
   - 获取单个文档详情

## 回滚计划

如果需要回滚到原始结构：

1. 修改 `cdk-stack.ts` 恢复原始配置：
   ```typescript
   partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING }
   ```

2. 重新部署：
   ```bash
   npx cdk deploy
   ```

注意：回滚同样是破坏性操作，会丢失所有数据。

## 技术支持

如果在部署过程中遇到问题：

1. 检查 AWS CLI 配置和权限
2. 确认 CDK 版本兼容性
3. 查看 CloudFormation 部署日志
4. 联系开发团队获取支持