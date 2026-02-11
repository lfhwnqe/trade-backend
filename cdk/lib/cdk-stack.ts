import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'node:path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface TradingStackProps extends cdk.StackProps {
  /**
   * The name of the environment (e.g., 'dev', 'staging', 'prod')
   */
  readonly envName: string;
  /**
   * The name of the application (e.g., 'trading', 'user-service')
   */
  readonly appName: string;
  readonly region: string;
}

export class TradingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TradingStackProps) {
    super(scope, id, props);

    const { envName, appName, region } = props;

    console.log(`TradingStack Props:`, props);

    const functionName = `${appName}-lambda-${envName}`;
    const apiName = `${appName}-api-${envName}`;

    // S3 Bucket for images
    const imageBucket = new s3.Bucket(this, `${appName}ImageBucket${envName}`, {
      bucketName: `${appName}-image-bucket-${envName.toLowerCase()}`,
      removalPolicy:
        envName === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: envName !== 'prod', // Only for non-production environments
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://*.maomaocong.com',
            'https://en.maomaocong.com',
          ],
          allowedHeaders: ['*'],
          exposedHeaders: [
            'ETag',
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
          ],
        },
      ],
    });

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      `${appName}OAI${envName}`,
      {
        comment: `OAI for ${appName} image bucket in ${envName}`,
      },
    );
    imageBucket.grantRead(originAccessIdentity);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(
      this,
      `${appName}ImageDistribution${envName}`,
      {
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessIdentity(imageBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy:
            cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
        },
        comment: `CloudFront distribution for ${appName} images in ${envName}`,
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
        enableLogging: true,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      },
    );

    // DynamoDB Table for transactions
    const transactionsTable = new dynamodb.Table(
      this,
      `${appName}TransactionsTable${envName}`,
      {
        tableName: `${appName}-transactions-${envName.toLowerCase()}`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // Optional: if you need streams
      },
    );

    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-exitTime-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'exitTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'shareId-index',
      partitionKey: { name: 'shareId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDB Table for common config
    const configTable = new dynamodb.Table(
      this,
      `${appName}ConfigTable${envName}`,
      {
        tableName: `${appName}-config-${envName.toLowerCase()}`,
        partitionKey: {
          name: 'configKey',
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    // DynamoDB Table for API tokens (personal API keys)
    const apiTokensTable = new dynamodb.Table(
      this,
      `${appName}ApiTokensTable${envName}`,
      {
        tableName: `${appName}-api-tokens-${envName.toLowerCase()}`,
        partitionKey: { name: 'tokenHash', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    apiTokensTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDB Table for telegram bindings
    const telegramBindingsTable = new dynamodb.Table(
      this,
      `${appName}TelegramBindingsTable${envName}`,
      {
        tableName: `${appName}-telegram-bindings-${envName.toLowerCase()}`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    // DynamoDB Table for webhook hooks
    const webhookHooksTable = new dynamodb.Table(
      this,
      `${appName}WebhookHooksTable${envName}`,
      {
        tableName: `${appName}-webhook-hooks-${envName.toLowerCase()}`,
        partitionKey: { name: 'hookId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    // ===== Exchange Integrations (Binance Futures) =====
    const binanceFuturesKeysTable = new dynamodb.Table(
      this,
      `${appName}BinanceFuturesKeysTable${envName}`,
      {
        tableName: `${appName}-binance-futures-keys-${envName.toLowerCase()}`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    const binanceFuturesFillsTable = new dynamodb.Table(
      this,
      `${appName}BinanceFuturesFillsTable${envName}`,
      {
        tableName: `${appName}-binance-futures-fills-${envName.toLowerCase()}`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'tradeKey', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    binanceFuturesFillsTable.addGlobalSecondaryIndex({
      indexName: 'userId-time-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'time', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const binanceFuturesPositionsTable = new dynamodb.Table(
      this,
      `${appName}BinanceFuturesPositionsTable${envName}`,
      {
        tableName: `${appName}-binance-futures-positions-${envName.toLowerCase()}`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'positionKey', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      },
    );

    binanceFuturesPositionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-closeTime-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'closeTime', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    webhookHooksTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    webhookHooksTable.addGlobalSecondaryIndex({
      indexName: 'triggerToken-index',
      partitionKey: { name: 'triggerToken', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(
      this,
      `${appName}UserPool${envName}`,
      {
        userPoolName: `${appName}-user-pool-${envName.toLowerCase()}`,
        selfSignUpEnabled: true,
        signInAliases: { email: true, username: true },
        autoVerify: { email: true },
        standardAttributes: {
          email: { required: true, mutable: true },
        },
        customAttributes: {
          role: new cognito.StringAttribute({ mutable: true }),
        },
        passwordPolicy: {
          minLength: 8,
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: true,
        },
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
        // DESTROY for dev, RETAIN for prod
      },
    );

    const userPoolClient = new cognito.UserPoolClient(
      this,
      `${appName}UserPoolClient${envName}`,
      {
        userPool,
        userPoolClientName: `${appName}-user-pool-client-${envName.toLowerCase()}`,
        authFlows: {
          userPassword: true,
          adminUserPassword: true,
        },
        readAttributes: new cognito.ClientAttributes()
          .withStandardAttributes({ email: true })
          .withCustomAttributes('role'),
        writeAttributes: new cognito.ClientAttributes()
          .withStandardAttributes({ email: true })
          .withCustomAttributes('role'),
        accessTokenValidity: cdk.Duration.hours(1),
        idTokenValidity: cdk.Duration.hours(1),
        refreshTokenValidity: cdk.Duration.days(30),
      },
    );

    // Create Cognito User Group "Admins"
    const adminGroupName = 'Admins'; // Define the group name
    new cognito.CfnUserPoolGroup(this, `${appName}AdminGroup${envName}`, {
      groupName: adminGroupName,
      userPoolId: userPool.userPoolId,
      description: 'Administrator group',
      // precedence: 0, // Optional: set precedence if you have multiple groups
    });

    const fn = new lambda.Function(
      this,
      `${appName}LambdaFunction${envName.charAt(0).toUpperCase() + envName.slice(1)}`,
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'lambda.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../dist')),
        functionName: functionName,
        memorySize: 512,
        timeout: cdk.Duration.seconds(120),
        environment: {
          APP_ENV: envName,
          APP_NAME: appName,
          IMAGE_BUCKET_NAME: imageBucket.bucketName,
          CLOUDFRONT_DOMAIN_NAME: distribution.distributionDomainName,
          TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
          CONFIG_TABLE_NAME: configTable.tableName,
          API_TOKENS_TABLE_NAME: apiTokensTable.tableName,
          TELEGRAM_BINDINGS_TABLE_NAME: telegramBindingsTable.tableName,
          WEBHOOK_HOOKS_TABLE_NAME: webhookHooksTable.tableName,
          BINANCE_FUTURES_KEYS_TABLE_NAME: binanceFuturesKeysTable.tableName,
          BINANCE_FUTURES_FILLS_TABLE_NAME: binanceFuturesFillsTable.tableName,
          BINANCE_FUTURES_POSITIONS_TABLE_NAME: binanceFuturesPositionsTable.tableName,
          EXCHANGE_KEY_ENC_SECRET: process.env.EXCHANGE_KEY_ENC_SECRET || '',

          // Telegram/webhook secrets (provided at deploy time via CDK env)
          TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
          TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '',
          TELEGRAM_BIND_SECRET: process.env.TELEGRAM_BIND_SECRET || '',
          TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || '',
          WEBHOOK_BIND_SECRET: process.env.WEBHOOK_BIND_SECRET || '',

          // Image resolve controls
          ALLOW_LEGACY_PUBLIC_IMAGE:
            process.env.ALLOW_LEGACY_PUBLIC_IMAGE || 'true',
          IMAGE_RESOLVE_RATE_LIMIT_PER_MINUTE:
            process.env.IMAGE_RESOLVE_RATE_LIMIT_PER_MINUTE || '120',

          USER_POOL_ID: userPool.userPoolId,
          USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
          COGNITO_ADMIN_GROUP_NAME: adminGroupName, // Add admin group name to Lambda environment
          // RAG DynamoDB Tables
        },
      },
    );

    // Grant Lambda permissions
    imageBucket.grantReadWrite(fn);
    transactionsTable.grantReadWriteData(fn);
    configTable.grantReadWriteData(fn);
    apiTokensTable.grantReadWriteData(fn);
    telegramBindingsTable.grantReadWriteData(fn);
    webhookHooksTable.grantReadWriteData(fn);
    binanceFuturesKeysTable.grantReadWriteData(fn);
    binanceFuturesFillsTable.grantReadWriteData(fn);
    binanceFuturesPositionsTable.grantReadWriteData(fn);

    // Grant Lambda permissions for RAG tables

    // 授予Lambda对Cognito用户池的权限
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:GetGroup',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminRespondToAuthChallenge',
          'cognito-idp:InitiateAuth',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    const endpoint = new apigw.LambdaRestApi(
      this,
      `${appName}ApiGatewayEndpoint${envName.charAt(0).toUpperCase() + envName.slice(1)}`,
      {
        handler: fn,
        restApiName: apiName,
        deployOptions: {
          stageName: envName,
        },
        description: `API Gateway for ${appName} in ${envName} environment`,
      },
    );

    new cdk.CfnOutput(this, 'API_ENDPOINT_URL', {
      value: endpoint.url,
      description: `The URL of the API Gateway endpoint for ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'IMAGE_BUCKET_NAME', {
      value: imageBucket.bucketName,
      description: `Name of the S3 bucket for images in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'CLOUDFRONT_DOMAIN_NAME', {
      value: distribution.distributionDomainName,
      description: `Domain name of the CloudFront distribution for ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'TRANSACTIONS_TABLE_NAME', {
      value: transactionsTable.tableName,
      description: `Name of the DynamoDB table for transactions in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'CONFIG_TABLE_NAME', {
      value: configTable.tableName,
      description: `Name of the DynamoDB table for common config in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'API_TOKENS_TABLE_NAME', {
      value: apiTokensTable.tableName,
      description: `Name of the DynamoDB table for API tokens in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'TELEGRAM_BINDINGS_TABLE_NAME', {
      value: telegramBindingsTable.tableName,
      description: `Name of the DynamoDB table for telegram bindings in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'WEBHOOK_HOOKS_TABLE_NAME', {
      value: webhookHooksTable.tableName,
      description: `Name of the DynamoDB table for webhook hooks in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'USER_POOL_ID', {
      value: userPool.userPoolId,
      description: `ID of the Cognito User Pool for ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'USER_POOL_CLIENT_ID', {
      value: userPoolClient.userPoolClientId,
      description: `Client ID of the Cognito User Pool Client for ${appName} ${envName}`,
    });
    new cdk.CfnOutput(this, 'AWS_REGION', {
      value: region,
      description: `AWS Region for ${appName} ${envName}`,
    });
  }
}
