# 技术栈与开发环境

## 核心技术栈

### 后端框架
- **NestJS** v10.0.0 - Node.js 企业级框架
- **TypeScript** v5.1.3 - 类型安全的 JavaScript
- **Node.js** v22.x - 运行时环境

### AWS 服务
- **AWS Lambda** - 无服务器计算
- **API Gateway** - RESTful API 网关
- **DynamoDB** - NoSQL 数据库
- **S3** - 对象存储服务
- **CloudFront** - CDN 内容分发
- **Cognito** - 用户认证服务

### 数据库与存储
- **DynamoDB** - 主数据库，存储交易记录
- **S3** - 图片和文件存储
- **CloudFront** - 全球 CDN 加速

### 认证与安全
- **AWS Cognito** - 用户池管理
- **JWT** - JSON Web Token 认证
- **aws-jwt-verify** v5.1.0 - JWT 验证库

### 开发工具

#### 构建与打包
- **Webpack** - Lambda 函数打包
- **ts-loader** v9.4.3 - TypeScript 加载器
- **nest build** - NestJS 构建工具

#### 代码质量
- **ESLint** v8.0.0 - 代码检查
- **Prettier** v3.0.0 - 代码格式化
- **class-validator** v0.14.2 - 数据验证
- **class-transformer** v0.5.1 - 数据转换

#### 测试框架
- **Jest** v29.5.0 - 单元测试框架
- **Supertest** v7.0.0 - HTTP 端点测试

### 基础设施即代码
- **AWS CDK** v2.195.0 - 云基础设施定义
- **TypeScript** - CDK 脚本语言

## 项目结构

### 源代码组织
```
src/
├── main.ts                 # 本地开发入口
├── lambda.ts              # Lambda 函数入口
├── app.module.ts          # 应用根模块
├── base/                  # 基础组件
│   ├── filters/           # 异常过滤器
│   └── interfaces/        # 通用接口
└── modules/               # 功能模块
    ├── common/            # 通用服务
    ├── user/              # 用户管理
    ├── trade/             # 交易管理
    ├── simulation-train/  # 模拟训练
    └── image/             # 图片管理
```

### CDK 基础设施
```
cdk/
├── bin/cdk.ts            # CDK 应用入口
├── lib/cdk-stack.ts      # 主要堆栈定义
└── test/                 # CDK 测试
```

## 环境配置

### 开发环境要求
- **Node.js** 最新 LTS 版本
- **Yarn** 包管理器
- **AWS CLI** 已配置凭证
- **AWS CDK** 全局安装

### 环境变量
#### Lambda 运行时环境变量
- `APP_ENV` - 环境标识 (dev/prod)
- `APP_NAME` - 应用名称
- `AWS_REGION` - AWS 区域
- `USER_POOL_ID` - Cognito 用户池 ID
- `USER_POOL_CLIENT_ID` - Cognito 客户端 ID
- `IMAGE_BUCKET_NAME` - S3 存储桶名称
- `CLOUDFRONT_DOMAIN_NAME` - CloudFront 域名
- `TRANSACTIONS_TABLE_NAME` - 交易表名
- `SIMULATION_TRAIN_TABLE_NAME` - 模拟训练表名
- `COGNITO_ADMIN_GROUP_NAME` - 管理员组名

#### 本地开发环境变量 (.env)
```bash
AWS_REGION=ap-southeast-1
USER_POOL_ID=ap-southeast-1_xxxxxx
USER_POOL_CLIENT_ID=xxxxxxxxxx
# 其他环境变量...
```

## 构建与部署

### 构建脚本
- `yarn build` - 标准 NestJS 构建
- `yarn build:lambda` - Lambda 专用构建（Webpack）
- `yarn start:dev` - 本地开发服务器
- `yarn test` - 运行测试

### 部署脚本
- `yarn deploy:dev` - 部署到开发环境
- `yarn deploy:prod` - 部署到生产环境
- `yarn destroy:dev` - 销毁开发环境资源
- `yarn destroy:prod` - 销毁生产环境资源

### Lambda 打包配置
- **入口文件**：[`src/lambda.ts`](src/lambda.ts:1)
- **打包工具**：Webpack + ts-loader
- **输出格式**：CommonJS2
- **排除依赖**：`@nestjs/microservices`, `@nestjs/websockets`, `cache-manager`

## API 文档

### Swagger 集成
- **访问路径**：`/api/docs`
- **配置文件**：[`src/main.ts`](src/main.ts:17)
- **认证支持**：Bearer Token
- **文档特性**：
  - 自动生成 API 文档
  - 交互式测试界面
  - 完整的请求/响应示例

## 数据验证

### 验证管道
- **全局验证管道**：ValidationPipe
- **验证规则**：
  - `whitelist: true` - 自动过滤非白名单属性
  - `forbidNonWhitelisted: true` - 禁止非白名单属性
  - `transform: true` - 自动转换为 DTO 实例

### DTO 验证装饰器
- `@IsString()` - 字符串验证
- `@IsNumber()` - 数字验证
- `@IsEnum()` - 枚举验证
- `@IsDateString()` - 日期字符串验证
- `@ValidateNested()` - 嵌套对象验证
- `@ArrayMaxSize()` - 数组大小限制

## 性能优化

### 代码分割
- 模块化架构减少冷启动时间
- Webpack Tree Shaking 移除未使用代码
- 依赖注入延迟加载

### 缓存策略
- CloudFront CDN 缓存静态资源
- DynamoDB 查询优化
- Lambda 函数实例复用

### 监控与日志
- 结构化日志输出
- AWS CloudWatch 集成
- 错误追踪和性能监控

## 开发工作流

### 代码规范
- ESLint 配置强制代码规范
- Prettier 自动格式化
- 提交前代码检查

### 测试策略
- 单元测试覆盖核心业务逻辑
- 集成测试验证 API 端点
- E2E 测试确保功能完整性

### 版本控制
- Git 版本控制
- 语义化版本号
- 功能分支开发模式