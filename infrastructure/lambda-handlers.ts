import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export function createLambdaHandlers(scope: Construct) {
  const lambdaEnv: { [key: string]: string } = {
    SOLANA_RPC_ENDPOINT: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  };

  const tradeHandler = new NodejsFunction(scope, 'TradeHandler', {
    entry: path.join(__dirname, '../lambda/trade-handler.ts'),
    handler: 'handler',
    environment: lambdaEnv,
    timeout: Duration.seconds(30),
  });

  const positionsHandler = new NodejsFunction(scope, 'PositionsHandler', {
    entry: path.join(__dirname, '../lambda/positions-handler.ts'),
    handler: 'handler',
    environment: lambdaEnv,
    timeout: Duration.seconds(10),
  });

  const walletHandler = new NodejsFunction(scope, 'WalletHandler', {
    entry: path.join(__dirname, '../lambda/wallet-handler.ts'),
    handler: 'handler',
    environment: lambdaEnv,
    timeout: Duration.seconds(10),
  });

  const logsHandler = new NodejsFunction(scope, 'LogsHandler', {
    entry: path.join(__dirname, '../lambda/logs-handler.ts'),
    handler: 'handler',
    environment: lambdaEnv,
    timeout: Duration.seconds(10),
  });

  const configWalletHandler = new NodejsFunction(scope, 'ConfigWalletHandler', {
    entry: path.join(__dirname, '../lambda/config-wallet-handler.ts'),
    handler: 'handler',
    environment: lambdaEnv,
    timeout: Duration.seconds(10),
  });

  return {
    tradeHandler,
    positionsHandler,
    walletHandler,
    logsHandler,
    configWalletHandler,
  };
}
