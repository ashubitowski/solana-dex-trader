import { Handler } from 'aws-lambda';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  GetSecretValueCommand,
  ResourceNotFoundException
} from '@aws-sdk/client-secrets-manager';

const smClient = new SecretsManagerClient({});

export const handler: Handler = async (event, context) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { walletKey } = body;
    // Get user info from Cognito claims if present
    const userId = event.requestContext?.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: 'Unauthorized: No user ID' })
      };
    }
    if (!walletKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Missing walletKey' })
      };
    }
    const secretName = `solana-dex-trader/wallet/${userId}`;
    // Try to create or update the secret
    try {
      // Try to get the secret (if it exists)
      await smClient.send(new GetSecretValueCommand({ SecretId: secretName }));
      // If found, update it
      await smClient.send(new PutSecretValueCommand({ SecretId: secretName, SecretString: walletKey }));
    } catch (err: any) {
      if (err.name === 'ResourceNotFoundException') {
        // If not found, create it
        await smClient.send(new CreateSecretCommand({ Name: secretName, SecretString: walletKey }));
      } else {
        throw err;
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : error })
    };
  }
};
