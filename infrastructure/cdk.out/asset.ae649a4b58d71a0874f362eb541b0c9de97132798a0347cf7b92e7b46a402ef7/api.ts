import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({});

export const handler = async (event: any) => {
  try {
    const { path, httpMethod, headers } = event;
    const userId = event.requestContext.authorizer.claims.sub;

    if (path === '/users' && httpMethod === 'GET') {
      // Get user profile
      const queryCommand = new QueryCommand({
        TableName: process.env.USERS_TABLE!,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
        },
      });

      const result = await dynamodb.send(queryCommand);
      const user = result.Items?.[0] ? unmarshall(result.Items[0]) : null;

      return {
        statusCode: 200,
        body: JSON.stringify(user),
      };
    } else if (path === '/tokens' && httpMethod === 'GET') {
      // Get recent tokens
      const scanCommand = new ScanCommand({
        TableName: process.env.TOKENS_TABLE!,
        Limit: 100,
        ScanIndexForward: false,
      });

      const result = await dynamodb.send(scanCommand);
      const tokens = result.Items?.map(item => unmarshall(item)) || [];

      return {
        statusCode: 200,
        body: JSON.stringify({ tokens }),
      };
    } else if (path === '/positions' && httpMethod === 'GET') {
      // Get user positions
      const queryCommand = new QueryCommand({
        TableName: process.env.POSITIONS_TABLE!,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
        },
      });

      const result = await dynamodb.send(queryCommand);
      const positions = result.Items?.map(item => unmarshall(item)) || [];

      return {
        statusCode: 200,
        body: JSON.stringify({ positions }),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Not found' }),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
}; 