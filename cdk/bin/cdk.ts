#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TradingStack } from '../lib/cdk-stack';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load repo-root .env (trade-backend/.env) for local `cdk deploy`
// This makes sure secrets like TELEGRAM_WEBHOOK_SECRET are injected into Lambda env.
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const app = new cdk.App();

// 从 CDK context 获取参数，允许通过 -c 命令行参数传递
// 例如: cdk deploy -c appName=myApp -c envName=dev -c account=123456789012 -c region=us-east-1
const appName = app.node.tryGetContext('appName') || 'trading-app'; // 默认应用名称
const envName = app.node.tryGetContext('envName') || 'dev'; // 默认环境名称

// 优先从 context 获取 account 和 region，其次是环境变量，最后是 CDK 默认值
const account =
  app.node.tryGetContext('account') ||
  process.env.CDK_DEPLOY_ACCOUNT ||
  process.env.CDK_DEFAULT_ACCOUNT;
const region =
  app.node.tryGetContext('region') ||
  process.env.CDK_DEPLOY_REGION ||
  process.env.CDK_DEFAULT_REGION;

if (!account || !region) {
  throw new Error(
    'Account and Region must be specified either in context (account, region), ' +
      'environment variables (CDK_DEPLOY_ACCOUNT, CDK_DEPLOY_REGION), ' +
      'or AWS CLI configuration (CDK_DEFAULT_ACCOUNT, CDK_DEFAULT_REGION).',
  );
}

const stackName = `${appName}-${envName}-stack`;

new TradingStack(app, stackName, {
  appName: appName,
  envName: envName,
  region,
  env: {
    account: account,
    region: region,
  },
  description: `Stack for ${appName} in ${envName} environment.`,
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

app.synth();
