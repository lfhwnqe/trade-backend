# Trade Backend

本项目是一个基于 NestJS 的后端服务，使用 AWS CDK进行部署。

## 项目结构

- `src/`: NestJS 应用程序源代码。
  - `lambda.ts`: Lambda 函数的入口点。
- `cdk/`: AWS CDK 代码，用于定义和部署 AWS 资源。
  - `bin/cdk.ts`: CDK 应用程序的入口点。
  - `lib/cdk-stack.ts`: 定义主要的 CDK 堆栈。
  - `lib/lambda.ts`: 定义 Lambda 函数相关的 CDK 构造。
- `webpack.config.js`: Webpack 配置文件，用于打包 Lambda 函数。

## 环境准备

在开始之前，请确保您已安装以下工具：

- Node.js (推荐最新 LTS 版本)
- Yarn (推荐最新版本)
- AWS CLI (已配置好您的 AWS 账户凭证和默认区域)
- AWS CDK Toolkit (全局安装: `npm install -g aws-cdk`)

## 安装依赖

在项目根目录和 `cdk` 目录分别执行以下命令安装依赖：

```bash
# 项目根目录
yarn install

# cdk 目录
cd cdk
yarn install
cd ..
```

## 构建 Lambda 函数

要构建用于部署的 Lambda 函数代码，请在项目根目录运行：

```bash
yarn build:lambda
```
此命令会清除 `dist` 目录，并使用 `webpack.config.js` 配置来构建和打包 Lambda 函数。

## CDK 部署

我们使用 AWS CDK 来部署应用程序。CDK 代码位于 `cdk/` 目录下。

### 首次部署 CDK (引导环境)

如果您是首次在特定 AWS 账户和区域使用 CDK，您可能需要引导 (bootstrap) CDK 环境。在 `cdk` 目录下运行：

```bash
npx cdk bootstrap
```
更多关于 CDK bootstrap 的信息，请参考 [AWS CDK 文档](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)。

### 部署到开发环境 (dev)

要将应用程序部署到开发环境，请在项目根目录运行：

```bash
yarn deploy:dev
```
此命令会首先执行 `yarn build:lambda` 来构建最新的 Lambda 代码，然后进入 `cdk` 目录并执行 `yarn deploy:dev` (即 `cdk deploy --context env=dev`)。

### 部署到生产环境 (prod)

要将应用程序部署到生产环境，请在项目根目录运行：

```bash
yarn deploy:prod
```
此命令会首先执行 `yarn build:lambda` 来构建最新的 Lambda 代码，然后进入 `cdk` 目录并执行 `yarn deploy:prod` (即 `cdk deploy --context env=prod`)。

## CDK 销毁资源

如果您需要删除已部署的 AWS 资源，可以使用以下命令。

### 销毁开发环境资源

```bash
yarn destroy:dev
```
此命令会进入 `cdk` 目录并执行 `yarn destroy:dev` (即 `cdk destroy --context env=dev`)。

### 销毁生产环境资源

```bash
yarn destroy:prod
```
此命令会进入 `cdk` 目录并执行 `yarn destroy:prod` (即 `cdk destroy --context env=prod`)。

## 本地开发与测试 (NestJS 标准命令)

除了 Lambda 部署相关的命令，您仍然可以使用标准的 NestJS 命令进行本地开发和测试。

### 运行开发服务器

```bash
# 启动开发服务器
yarn start

# 启动开发服务器 (watch 模式)
yarn start:dev
```

### 运行测试

```bash
# 单元测试
yarn test

# e2e 测试
yarn test:e2e

# 测试覆盖率
yarn test:cov
```

## 注意事项

- 确保您的 AWS CLI 已正确配置，并且具有部署所需资源的权限。
- CDK 部署命令中的 `--context env=dev` 或 `--context env=prod` 用于向 CDK 应用程序传递当前环境的上下文信息，您可以在 CDK 代码中（例如 [`cdk/bin/cdk.ts`](trade-backend/cdk/bin/cdk.ts:1) 或 [`cdk/lib/cdk-stack.ts`](trade-backend/cdk/lib/cdk-stack.ts:1)）中获取此值以进行环境特定的配置。
