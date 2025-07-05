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
            'https://*.maomaocong.site',
            'https://en.maomaocong.site',
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

    // RAG DynamoDB Tables

    // 1. Documents Table (rag-documents)
    const ragDocumentsTable = new dynamodb.Table(
      this,
      `${appName}RagDocumentsTable${envName}`,
      {
        tableName: `rag-documents-${envName.toLowerCase()}`,
        partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        pointInTimeRecovery: true,
      },
    );

    // Add GSI for Documents Table: userId-createdAt-index
    ragDocumentsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for Documents Table: status-createdAt-index
    ragDocumentsTable.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. Chat Sessions Table (rag-chat-sessions)
    const ragChatSessionsTable = new dynamodb.Table(
      this,
      `${appName}RagChatSessionsTable${envName}`,
      {
        tableName: `rag-chat-sessions-${envName.toLowerCase()}`,
        partitionKey: {
          name: 'sessionId',
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        pointInTimeRecovery: true,
      },
    );

    // Add GSI for Chat Sessions Table: userId-createdAt-index
    ragChatSessionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-createdAt-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 3. Chat Messages Table (rag-chat-messages)
    const ragChatMessagesTable = new dynamodb.Table(
      this,
      `${appName}RagChatMessagesTable${envName}`,
      {
        tableName: `rag-chat-messages-${envName.toLowerCase()}`,
        partitionKey: {
          name: 'sessionId',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: { name: 'messageId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        pointInTimeRecovery: true,
      },
    );

    // Add GSI for Chat Messages Table: sessionId-timestamp-index
    ragChatMessagesTable.addGlobalSecondaryIndex({
      indexName: 'sessionId-timestamp-index',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 4. Analytics Table (rag-analytics)
    const ragAnalyticsTable = new dynamodb.Table(
      this,
      `${appName}RagAnalyticsTable${envName}`,
      {
        tableName: `rag-analytics-${envName.toLowerCase()}`,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        pointInTimeRecovery: true,
      },
    );

    // 5. MindMap Table (mindmap)
    const mindMapTable = new dynamodb.Table(
      this,
      `${appName}MindMapTable${envName}`,
      {
        tableName: `mindmap-${envName.toLowerCase()}`,
        partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // USER#{userId}
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // MINDMAP#{mindmapId}
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecovery: true,
      },
    );

    // Add GSI for MindMap Table: GSI1PK-GSI1SK-index (for tag-based queries)
    mindMapTable.addGlobalSecondaryIndex({
      indexName: 'GSI1PK-GSI1SK-index',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // TAG#{tag}
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING }, // MINDMAP#{mindmapId}
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
        environment: {
          APP_ENV: envName,
          APP_NAME: appName,
          IMAGE_BUCKET_NAME: imageBucket.bucketName,
          CLOUDFRONT_DOMAIN_NAME: distribution.distributionDomainName,
          TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
          USER_POOL_ID: userPool.userPoolId,
          USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
          COGNITO_ADMIN_GROUP_NAME: adminGroupName, // Add admin group name to Lambda environment
          // RAG DynamoDB Tables
          RAG_DOCUMENTS_TABLE_NAME: ragDocumentsTable.tableName,
          RAG_CHAT_SESSIONS_TABLE_NAME: ragChatSessionsTable.tableName,
          RAG_CHAT_MESSAGES_TABLE_NAME: ragChatMessagesTable.tableName,
          RAG_ANALYTICS_TABLE_NAME: ragAnalyticsTable.tableName,
          // MindMap DynamoDB Table
          MINDMAP_TABLE_NAME: mindMapTable.tableName,
        },
      },
    );

    // Grant Lambda permissions
    imageBucket.grantReadWrite(fn);
    transactionsTable.grantReadWriteData(fn);

    // Grant Lambda permissions for RAG tables
    ragDocumentsTable.grantReadWriteData(fn);
    ragChatSessionsTable.grantReadWriteData(fn);
    ragChatMessagesTable.grantReadWriteData(fn);
    ragAnalyticsTable.grantReadWriteData(fn);

    // Grant Lambda permissions for MindMap table
    mindMapTable.grantReadWriteData(fn);

    // 授予Lambda对Cognito用户池的权限
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminRespondToAuthChallenge',
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

    // RAG DynamoDB Tables Outputs
    new cdk.CfnOutput(this, 'RAG_DOCUMENTS_TABLE_NAME', {
      value: ragDocumentsTable.tableName,
      description: `Name of the DynamoDB table for RAG documents in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'RAG_CHAT_SESSIONS_TABLE_NAME', {
      value: ragChatSessionsTable.tableName,
      description: `Name of the DynamoDB table for RAG chat sessions in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'RAG_CHAT_MESSAGES_TABLE_NAME', {
      value: ragChatMessagesTable.tableName,
      description: `Name of the DynamoDB table for RAG chat messages in ${appName} ${envName}`,
    });

    new cdk.CfnOutput(this, 'RAG_ANALYTICS_TABLE_NAME', {
      value: ragAnalyticsTable.tableName,
      description: `Name of the DynamoDB table for RAG analytics in ${appName} ${envName}`,
    });

    // MindMap DynamoDB Table Output
    new cdk.CfnOutput(this, 'MINDMAP_TABLE_NAME', {
      value: mindMapTable.tableName,
      description: `Name of the DynamoDB table for MindMap in ${appName} ${envName}`,
    });

    // Environment Variables Output for easy copying to .env file
    const envVarsString = `# Environment Variables for ${appName} ${envName}
# Copy the following lines to your .env file

AWS_REGION=${region}
USER_POOL_ID=${userPool.userPoolId}
USER_POOL_CLIENT_ID=${userPoolClient.userPoolClientId}
IMAGE_BUCKET_NAME=${imageBucket.bucketName}
CLOUDFRONT_DOMAIN_NAME=${distribution.distributionDomainName}
TRANSACTIONS_TABLE_NAME=${transactionsTable.tableName}
API_ENDPOINT_URL=${endpoint.url}
COGNITO_ADMIN_GROUP_NAME=${adminGroupName}

# RAG Module Environment Variables
RAG_DOCUMENTS_TABLE_NAME=${ragDocumentsTable.tableName}
RAG_CHAT_SESSIONS_TABLE_NAME=${ragChatSessionsTable.tableName}
RAG_CHAT_MESSAGES_TABLE_NAME=${ragChatMessagesTable.tableName}
RAG_ANALYTICS_TABLE_NAME=${ragAnalyticsTable.tableName}

# MindMap Module Environment Variables
MINDMAP_TABLE_NAME=${mindMapTable.tableName}`;

    new cdk.CfnOutput(this, 'EnvironmentVariables', {
      value: envVarsString,
      description: 'Environment variables for .env file - copy and paste directly',
    });
  }
}
