import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'node:path';

export interface TradingStackProps extends cdk.StackProps {
  /**
   * The name of the environment (e.g., 'dev', 'staging', 'prod')
   */
  readonly envName: string;
  /**
   * The name of the application (e.g., 'trading', 'user-service')
   */
  readonly appName: string;
}

export class TradingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TradingStackProps) {
    super(scope, id, props);

    const { envName, appName } = props;

    const functionName = `${appName}-lambda-${envName}`;
    const apiName = `${appName}-api-${envName}`;

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
        },
      },
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

    new cdk.CfnOutput(this, 'ApiEndpointUrl', {
      value: endpoint.url,
      description: `The URL of the API Gateway endpoint for ${appName} ${envName}`,
    });
  }
}
