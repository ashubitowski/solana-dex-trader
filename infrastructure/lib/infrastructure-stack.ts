import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { createLambdaHandlers } from '../lambda-handlers';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create an S3 bucket to host the website
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    cdk.Tags.of(websiteBucket).add('ForceUpdate', new Date().toISOString());

    // Create an Origin Access Identity (OAI) for CloudFront
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');

    // Grant the OAI read permissions on the S3 bucket
    websiteBucket.grantRead(oai);

    // Create a CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        // Use the OAI for the S3 origin
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Deploy the website content
    // new s3deploy.BucketDeployment(this, 'DeployWebsite', {
    //   sources: [s3deploy.Source.asset(path.join(__dirname, '../../web-server/public'))],
    //   destinationBucket: websiteBucket,
    //   distribution,
    //   distributionPaths: ['/*'],
    //   prune: true, 
    // });

    // Create a Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Create a User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
        },
        callbackUrls: [
          `https://${distribution.distributionDomainName}`,
          'http://localhost:3000',
        ],
        logoutUrls: [
          `https://${distribution.distributionDomainName}`,
          'http://localhost:3000',
        ],
      },
      preventUserExistenceErrors: true,
    });

    // Create DynamoDB tables
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add rate limiting table
    const rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // This table can be destroyed as it only contains temporary data
    });

    const tokensTable = new dynamodb.Table(this, 'TokensTable', {
      partitionKey: { name: 'tokenAddress', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const positionsTable = new dynamodb.Table(this, 'PositionsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'tokenAddress', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda functions for endpoints
    const { tradeHandler, positionsHandler, walletHandler, logsHandler, configWalletHandler } = createLambdaHandlers(this);

    // Create API Gateway
    // const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayAccessLogs'); // Comment out for now
    const api = new apigateway.RestApi(this, 'Api', {
      // deployOptions: { // Comment out logging options until role is set in account
      //   accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
      //   accessLogFormat: apigateway.AccessLogFormat.clf(), 
      //   loggingLevel: apigateway.MethodLoggingLevel.INFO, 
      //   metricsEnabled: true,
      //   dataTraceEnabled: true, 
      // },
      defaultCorsPreflightOptions: {
        allowOrigins: [
          `https://${distribution.distributionDomainName}`,
          'http://localhost:3000' // Keep for local development
        ],
        allowMethods: apigateway.Cors.ALL_METHODS, // Or specify methods like ['GET', 'POST', 'OPTIONS']
        allowHeaders: [
            'Content-Type',
            'Authorization', // Allow the Authorization header used by fetchData
            'X-Amz-Date', 
            'X-Api-Key', 
            'X-Amz-Security-Token' 
        ],
        allowCredentials: true, // Important when sending Authorization header
      },
    });

    // Add Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
    });

    // Add routes (directly under root)
    // const apiRoot = api.root.addResource('api'); // No longer using /api prefix
    // const usersResource = apiRoot.addResource('users');
    // const tokensResource = apiRoot.addResource('tokens');
    // const positionsResource = apiRoot.addResource('positions');

    // Lambda integrations for each endpoint
    const tradeIntegration = new apigateway.LambdaIntegration(tradeHandler);
    const positionsIntegration = new apigateway.LambdaIntegration(positionsHandler);
    const walletIntegration = new apigateway.LambdaIntegration(walletHandler);
    const logsIntegration = new apigateway.LambdaIntegration(logsHandler);

    // usersResource.addMethod('GET', lambdaIntegration, {
    //   authorizer,
    //   authorizationType: apigateway.AuthorizationType.COGNITO,
    // });
    
    // Add /trade endpoint (POST)
    const tradeResource = api.root.addResource('trade');
    tradeResource.addMethod('POST', tradeIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add /positions endpoint (GET)
    const positionsResource = api.root.addResource('positions');
    positionsResource.addMethod('GET', positionsIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add /wallet endpoint (GET)
    const walletResource = api.root.addResource('wallet');
    walletResource.addMethod('GET', walletIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add /logs endpoint (GET)
    const logsResource = api.root.addResource('logs');
    logsResource.addMethod('GET', logsIntegration, {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add /config/wallet endpoint (POST)
    const configResource = api.root.addResource('config');
    const walletConfigResource = configResource.addResource('wallet');
    walletConfigResource.addMethod('POST', new apigateway.LambdaIntegration(configWalletHandler), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Output the CloudFront domain
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
    });

    // Output User Pool ID and Client ID
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    // Output API Gateway endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
    });
  }
} 