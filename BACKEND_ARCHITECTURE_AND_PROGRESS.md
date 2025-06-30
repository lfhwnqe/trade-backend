# Trade Backend 项目架构与开发进度文档

## 📋 项目概述

Trade Backend 是一个基于 NestJS 的交易复盘管理系统后端服务，专为交易者提供完整的交易记录、分析和复盘功能。系统采用 AWS 云原生架构，部署在 Lambda 上，支持真实交易和模拟交易的全生命周期管理。

### 核心价值主张
- **专业交易复盘**：提供完整的交易生命周期管理和分析工具
- **云原生架构**：基于 AWS Serverless 的高可用、低成本解决方案
- **智能增强**：集成 RAG 系统提供智能文档处理和查询能力
- **模块化设计**：清晰的模块划分，便于维护和扩展

## 🏗️ 技术架构

### 系统架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   Lambda        │────│   DynamoDB      │
│   (REST API)    │    │   (NestJS App)  │    │   (NoSQL DB)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   S3 + CDN      │              │
         └──────────────│   (图片存储)     │──────────────┘
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Cognito       │
                        │   (用户认证)     │
                        └─────────────────┘
```

### 技术栈
- **框架**: NestJS 10.x + TypeScript
- **运行时**: AWS Lambda (Serverless)
- **数据库**: AWS DynamoDB (NoSQL)
- **存储**: AWS S3 + CloudFront CDN
- **认证**: AWS Cognito + JWT
- **API**: RESTful API + Swagger 文档
- **部署**: AWS CDK (基础设施即代码)
- **AI增强**: Upstash Vector + Mastra RAG

## 📁 项目结构

```
trade-backend/
├── src/
│   ├── app.module.ts              # 应用主模块
│   ├── main.ts                    # 应用入口
│   ├── lambda.ts                  # Lambda 入口
│   ├── base/                      # 基础设施层
│   │   ├── constants/             # 常量定义
│   │   ├── exceptions/            # 自定义异常
│   │   └── filters/               # 异常过滤器
│   └── modules/                   # 业务模块
│       ├── common/                # 通用模块
│       ├── user/                  # 用户管理
│       ├── trade/                 # 交易管理
│       ├── image/                 # 图片管理
│       ├── rag/                   # RAG 智能检索
│       └── mindmap-parser/        # 思维导图解析
├── cdk/                           # AWS CDK 部署配置
├── test/                          # 测试文件
└── dist/                          # 编译输出
```

## 🔧 核心模块详解

### 1. Common 模块 (通用基础)
**状态**: ✅ 已完成，🔄 持续优化

**功能职责**:
- 配置管理 (ConfigService)
- AWS Cognito 集成 (CognitoService)
- JWT 认证中间件 (AuthMiddleware)
- 全局异常处理

**核心文件**:
- `config.service.ts` - 环境配置管理
- `cognito.service.ts` - Cognito 用户池集成
- `auth.middleware.ts` - JWT 认证中间件

**API 白名单**:
```typescript
const whitelist = [
  '/user/register',
  '/user/confirm', 
  '/user/login',
  '/user/registration/status'
];
```

### 2. User 模块 (用户管理)
**状态**: ✅ 已完成

**功能特性**:
- ✅ 用户注册 (邮箱验证)
- ✅ 用户登录 (JWT Token)
- ✅ 邮箱确认
- ✅ 密码重置
- ✅ 注册开关控制

**API 接口**:
```
POST /user/register          # 用户注册
POST /user/confirm           # 邮箱确认
POST /user/login             # 用户登录
POST /user/forgot-password   # 忘记密码
POST /user/reset-password    # 重置密码
GET  /user/registration/status # 注册状态查询
```

**数据模型**: 基于 AWS Cognito 用户池

### 3. Trade 模块 (交易管理)
**状态**: ✅ 核心功能完成，🔄 RAG 集成优化中

**功能特性**:
- ✅ 交易记录 CRUD 操作
- ✅ 交易状态管理 (已分析/已入场/已离场)
- ✅ 交易类型支持 (真实/模拟)
- ✅ 月度统计分析
- ✅ 交易复制功能
- ✅ RAG 智能评估系统

**核心实体**:
```typescript
interface Trade {
  transactionId: string;        // 交易唯一标识
  userId: string;              // 用户ID
  status: TradeStatus;         // 交易状态
  tradeType: TradeType;        // 交易类型
  tradeSubject: string;        // 交易标的
  marketStructure: MarketStructure; // 市场结构
  // ... 更多字段
}
```

**API 接口**:
```
GET    /trade/stats           # 月度统计
GET    /trade                 # 交易列表查询
POST   /trade                 # 创建交易
GET    /trade/:id             # 获取交易详情
PUT    /trade/:id             # 更新交易
DELETE /trade/:id             # 删除交易
POST   /trade/:id/copy        # 复制交易
```

**RAG 评估系统**:
- 智能评估交易价值 (总分100分)
- 自动添加高价值交易到知识库
- 支持交易历史语义搜索

### 4. Image 模块 (图片管理)
**状态**: ✅ 已完成

**功能特性**:
- ✅ S3 预签名 URL 生成
- ✅ CloudFront CDN 加速
- ✅ 图片类型验证
- ✅ 用户隔离存储
- ✅ 图片删除管理

**存储结构**:
```
s3://bucket/images/YYYY-MM-DD/userId/filename
```

**API 接口**:
```
POST /image/upload-url        # 获取上传URL
GET  /image/url/:key          # 获取访问URL
DELETE /image/:key            # 删除图片
```

### 5. RAG 模块 (智能检索)
**状态**: ✅ 已完成

**功能特性**:
- ✅ 文档知识库管理
- ✅ Upstash Vector 集成
- ✅ 智能文本分块
- ✅ 语义搜索
- ✅ 交易历史 RAG

**技术栈**:
- Upstash Vector Database (向量存储)
- Mastra RAG 引擎
- OpenAI Embeddings

**API 接口**:
```
POST /rag/documents           # 添加文档
GET  /rag/documents           # 文档列表
PUT  /rag/documents/:id       # 更新文档
DELETE /rag/documents/:id     # 删除文档
POST /rag/search              # 语义搜索
```

### 6. MindMap Parser 模块 (思维导图解析)
**状态**: ✅ 已完成

**功能特性**:
- ✅ 多格式支持 (FreeMind, OPML, JSON)
- ✅ 图数据结构转换
- ✅ DynamoDB 存储
- ✅ 反向索引构建
- ✅ 图遍历查询

**API 接口**:
```
POST /parser/mindmap/upload-and-store  # 上传解析
GET  /parser/graphs/search             # 节点搜索
POST /parser/graphs/g-rag/test         # G-RAG 测试
```

## 🗄️ 数据模型设计

### DynamoDB 表结构

#### 1. 交易表 (Trades)
```
PartitionKey: userId
SortKey: transactionId
Attributes: 交易详细信息
```

#### 2. 用户配置表 (UserConfigs)
```
PartitionKey: configType
SortKey: configKey
Attributes: 配置值
```

#### 3. RAG 文档表 (RAGDocuments)
```
PartitionKey: userId
SortKey: documentId
Attributes: 文档元数据
```

#### 4. 图数据表 (GraphData)
```
PartitionKey: graphId
SortKey: nodeId
Attributes: 节点信息
```

## 🔐 安全架构

### 认证流程
```
1. 用户登录 → Cognito 验证
2. 返回 JWT Token → 前端存储
3. 请求携带 Token → AuthMiddleware 验证
4. Token 有效 → 业务处理
5. Token 无效 → 返回 401
```

### 权限控制
- 基于 JWT Token 的用户身份验证
- 用户数据隔离 (userId 分区)
- API 白名单机制
- 预签名 URL 安全访问

## 📊 监控与日志

### 日志系统
- 结构化日志输出
- 关键操作审计
- 错误堆栈追踪
- 性能指标记录

### 监控指标
- Lambda 执行时间
- DynamoDB 读写延迟
- API 响应时间
- 错误率统计

## 🚀 部署架构

### AWS CDK 配置
```typescript
// 主要资源
- Lambda Function (NestJS 应用)
- API Gateway (REST API)
- DynamoDB Tables (数据存储)
- S3 Bucket + CloudFront (图片 CDN)
- Cognito User Pool (用户认证)
```

### 环境配置
- **开发环境**: 本地开发 + AWS 资源
- **生产环境**: 完全 Serverless 部署
- **CI/CD**: GitHub Actions + AWS CDK

## 📈 开发进度

### ✅ 已完成功能 (90%)

#### 核心业务模块
- [x] 用户注册登录系统
- [x] 交易记录 CRUD 操作
- [x] 图片上传管理
- [x] RAG 智能检索系统
- [x] 思维导图解析
- [x] AWS 基础设施部署

#### 技术基础设施
- [x] NestJS 框架搭建
- [x] AWS Lambda 部署
- [x] DynamoDB 数据模型
- [x] Cognito 认证集成
- [x] S3 + CloudFront CDN
- [x] Swagger API 文档

### 🔄 进行中功能 (10%)

#### Common 模块增强
- [ ] 统一响应格式标准化
- [ ] 全局异常处理优化
- [ ] 细粒度权限控制
- [ ] 结构化日志系统
- [ ] 性能监控集成

#### 代码质量提升
- [ ] 单元测试覆盖率提升
- [ ] 集成测试完善
- [ ] 代码规范统一
- [ ] 文档完善

### 📋 待开发功能

#### 高级功能
- [ ] 交易策略模板系统
- [ ] 高级数据分析报表
- [ ] 实时通知系统
- [ ] 数据导入导出
- [ ] 多语言支持

#### 性能优化
- [ ] 数据库查询优化
- [ ] 缓存策略实施
- [ ] 图片压缩优化
- [ ] API 响应时间优化

## 🎯 下一步计划

### 短期目标 (1-2周)
1. **Common 模块增强完成**
   - 统一响应格式实现
   - 全局异常处理优化
   - API 文档标准化

2. **测试覆盖率提升**
   - 核心模块单元测试
   - API 集成测试
   - 错误场景测试

### 中期目标 (1个月)
1. **性能优化**
   - 数据库查询优化
   - 缓存策略实施
   - 监控系统完善

2. **功能增强**
   - 高级数据分析
   - 实时通知系统
   - 数据导入导出

### 长期目标 (3个月)
1. **系统扩展**
   - 多租户支持
   - 微服务架构演进
   - 国际化支持

2. **AI 能力增强**
   - 智能交易建议
   - 风险评估模型
   - 预测分析功能

## 🔧 开发环境配置

### 本地开发环境
```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 AWS 相关参数

# 3. 启动开发服务器
npm run start:dev

# 4. 运行测试
npm run test
npm run test:e2e

# 5. 构建项目
npm run build
```

### 环境变量配置
```env
# AWS 配置
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Cognito 配置
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_CLIENT_ID=your_client_id

# DynamoDB 配置
DYNAMODB_TABLE_PREFIX=trade-dev

# S3 配置
S3_BUCKET_NAME=your-bucket-name
CLOUDFRONT_DOMAIN=your-cloudfront-domain

# Upstash 配置
UPSTASH_VECTOR_URL=your_vector_url
UPSTASH_VECTOR_TOKEN=your_vector_token
```

### AWS CDK 部署
```bash
# 1. 安装 CDK
npm install -g aws-cdk

# 2. 进入 CDK 目录
cd cdk

# 3. 安装依赖
npm install

# 4. 部署到 AWS
cdk deploy --profile your-aws-profile
```

## 🧪 测试策略

### 测试金字塔
```
    /\     E2E Tests (少量)
   /  \    Integration Tests (适量)
  /____\   Unit Tests (大量)
```

### 测试覆盖范围
- **单元测试**: 服务层业务逻辑
- **集成测试**: API 接口功能
- **E2E 测试**: 完整业务流程

### 测试命令
```bash
# 单元测试
npm run test

# 集成测试
npm run test:e2e

# 测试覆盖率
npm run test:cov

# 监听模式
npm run test:watch
```

## 🔍 故障排查指南

### 常见问题

#### 1. Lambda 冷启动问题
**现象**: 首次请求响应慢
**解决方案**:
- 使用 Provisioned Concurrency
- 优化依赖包大小
- 实施预热策略

#### 2. DynamoDB 热分区
**现象**: 读写延迟高
**解决方案**:
- 优化分区键设计
- 使用复合索引
- 实施读写分离

#### 3. Cognito Token 过期
**现象**: 401 认证失败
**解决方案**:
- 实施 Token 刷新机制
- 优化 Token 生命周期
- 添加重试逻辑

### 日志查看
```bash
# CloudWatch 日志
aws logs tail /aws/lambda/trade-backend --follow

# 本地日志
tail -f logs/application.log
```

## 📊 性能指标

### 关键指标
- **API 响应时间**: < 500ms (P95)
- **Lambda 冷启动**: < 2s
- **DynamoDB 延迟**: < 10ms
- **错误率**: < 0.1%

### 监控工具
- AWS CloudWatch (基础监控)
- AWS X-Ray (分布式追踪)
- Custom Metrics (业务指标)

## 🔒 安全最佳实践

### 数据安全
- 用户数据隔离 (userId 分区)
- 敏感数据加密存储
- API 访问频率限制
- 输入数据验证

### 网络安全
- HTTPS 强制加密
- CORS 跨域控制
- JWT Token 安全
- 预签名 URL 时效控制

### 合规要求
- 数据备份策略
- 访问日志记录
- 用户隐私保护
- GDPR 合规支持

## 📚 相关文档

### 技术文档
- [RAG 架构设计](./RAG-Architecture-Design.md)
- [RAG 使用指南](./RAG-Usage-Guide.md)
- [Common 模块增强计划](./COMMON_MODULE_ENHANCEMENT_PLAN.md)
- [需求文档](./requirements-document.md)
- [项目状态](/.taskmaster/PROJECT_STATUS.md)

### API 文档
- Swagger UI: `/api/docs` (开发环境)
- API 接口规范文档
- 错误码对照表

### 运维文档
- 部署指南
- 监控配置
- 故障处理手册
- 性能调优指南

## 🤝 开发团队与协作

### 开发流程
1. **需求分析** → 产品需求文档
2. **技术设计** → 架构设计文档
3. **编码实现** → 代码审查
4. **测试验证** → 自动化测试
5. **部署发布** → CI/CD 流水线

### 代码规范
- **TypeScript** 严格模式
- **ESLint** 代码检查
- **Prettier** 代码格式化
- **Husky** Git Hooks

### 分支策略
```
main (生产)
├── develop (开发)
├── feature/* (功能分支)
├── hotfix/* (热修复)
└── release/* (发布分支)
```

### 版本管理
- 语义化版本控制 (SemVer)
- 变更日志维护
- 发布标签管理

---

**最后更新**: 2025-06-30
**文档版本**: v1.0
**维护者**: Trade Backend Team
**联系方式**: backend-team@trade-system.com
