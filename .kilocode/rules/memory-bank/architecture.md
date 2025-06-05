# 系统架构

## 整体架构
```
Frontend (未在此项目中) ←→ API Gateway ←→ Lambda ←→ AWS Services
                                            ↓
                                   ┌─────────────────┐
                                   │   AWS Services  │
                                   │                 │
                                   │ • DynamoDB      │
                                   │ • S3            │
                                   │ • CloudFront    │
                                   │ • Cognito       │
                                   └─────────────────┘
```

## 核心组件

### 1. 应用层 (NestJS)
- **入口点**：[`src/main.ts`](src/main.ts:1) - 本地开发服务器
- **Lambda 入口**：[`src/lambda.ts`](src/lambda.ts:1) - AWS Lambda 处理器
- **应用模块**：[`src/app.module.ts`](src/app.module.ts:1) - 根模块配置

### 2. 功能模块

#### 用户管理模块 (`src/modules/user/`)
- **控制器**：[`user.controller.ts`](src/modules/user/user.controller.ts:1)
- **服务**：[`user.service.ts`](src/modules/user/user.service.ts:1)
- **核心功能**：用户注册、登录、确认、管理员功能
- **认证方式**：AWS Cognito 用户池

#### 交易管理模块 (`src/modules/trade/`)
- **控制器**：[`trade.controller.ts`](src/modules/trade/trade.controller.ts:1)
- **服务**：[`trade.service.ts`](src/modules/trade/trade.service.ts:1)
- **实体**：[`entities/trade.entity.ts`](src/modules/trade/entities/trade.entity.ts:1)
- **核心功能**：真实交易记录的 CRUD、统计、复制

#### 模拟训练模块 (`src/modules/simulation-train/`)
- **控制器**：[`simulation-train.controller.ts`](src/modules/simulation-train/simulation-train.controller.ts:1)
- **服务**：[`simulation-train.service.ts`](src/modules/simulation-train/simulation-train.service.ts:1)
- **核心功能**：模拟交易记录管理

#### 图片管理模块 (`src/modules/image/`)
- **控制器**：[`image.controller.ts`](src/modules/image/image.controller.ts:1)
- **服务**：[`image.service.ts`](src/modules/image/image.service.ts:1)
- **核心功能**：图片上传 URL 生成、访问 URL 获取、删除

#### 通用模块 (`src/modules/common/`)
- **认证中间件**：[`auth.middleware.ts`](src/modules/common/auth.middleware.ts:1)
- **Cognito 服务**：[`cognito.service.ts`](src/modules/common/cognito.service.ts:1)
- **配置服务**：[`config.service.ts`](src/modules/common/config.service.ts:1)

### 3. 数据层

#### DynamoDB 表结构
1. **交易表** (`{appName}-transactions-{env}`)
   - **分区键**：`userId` (string)
   - **排序键**：`transactionId` (string)
   - **用途**：存储真实交易记录

2. **模拟训练表** (`{appName}-simulation-train-{env}`)
   - **分区键**：`userId` (string)
   - **排序键**：`transactionId` (string)
   - **用途**：存储模拟交易记录

#### S3 存储
- **图片存储桶**：`{appName}-image-bucket-{env}`
- **路径结构**：`images/日期/用户ID/文件名`
- **访问方式**：通过 CloudFront CDN

### 4. 基础设施 (AWS CDK)

#### CDK 配置 (`cdk/`)
- **堆栈定义**：[`lib/cdk-stack.ts`](cdk/lib/cdk-stack.ts:1)
- **入口点**：[`bin/cdk.ts`](cdk/bin/cdk.ts:1)
- **部署脚本**：[`package.json`](cdk/package.json:1)

#### AWS 资源
1. **Lambda 函数**：运行 NestJS 应用
2. **API Gateway**：RESTful API 端点
3. **DynamoDB**：NoSQL 数据库
4. **S3 + CloudFront**：图片存储和 CDN
5. **Cognito**：用户认证和授权

## 关键设计模式

### 1. 依赖注入
- NestJS 内置的 IoC 容器
- 服务间通过构造函数注入依赖

### 2. 模块化架构
- 功能按模块组织
- 每个模块包含控制器、服务、DTO、实体

### 3. 中间件模式
- 认证中间件统一处理 JWT 验证
- 白名单机制排除特定端点

### 4. DTO 模式
- 数据传输对象确保类型安全
- 使用 class-validator 进行数据验证

## 数据流

### 1. 用户认证流程
```
用户登录 → Cognito 验证 → 返回 JWT → 前端存储 Cookie → 后续请求携带 Token
```

### 2. 交易记录创建流程
```
前端请求 → 认证中间件验证 → 控制器接收 → 服务层处理 → DynamoDB 存储
```

### 3. 图片上传流程
```
前端请求预签名 URL → Lambda 生成 S3 上传 URL → 前端直接上传到 S3 → CloudFront 提供访问
```

## 部署架构

### 环境配置
- **开发环境** (`dev`)：用于开发测试
- **生产环境** (`prod`)：正式环境

### 部署流程
1. **构建**：`yarn build:lambda` - Webpack 打包
2. **部署**：CDK 部署 AWS 资源
3. **配置**：环境变量自动注入 Lambda

## 安全考虑

### 1. 认证授权
- AWS Cognito 用户池管理
- JWT Token 验证
- 用户数据隔离

### 2. 数据安全
- HTTPS 强制加密
- S3 服务端加密
- DynamoDB 数据加密

### 3. 访问控制
- API 路径级别的访问控制
- 图片访问权限验证
- 管理员权限分离