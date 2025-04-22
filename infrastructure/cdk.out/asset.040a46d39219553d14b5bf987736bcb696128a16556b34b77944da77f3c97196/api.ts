import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({});

// Define allowed origins - Use environment variable in production if possible
const ALLOWED_ORIGIN = 'https://d3rntcg47zepho.cloudfront.net'; // Or get from process.env

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Credentials': true, // Important for credentials like Authorization header
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' // Add methods as needed
};

export const handler = async (event: any) => {
  try {
    const { path, httpMethod, headers } = event;
    const origin = headers?.origin || headers?.Origin; // Handle case variations

    // Basic check if origin is allowed (optional but good practice)
    // Note: API GW CORS config handles preflight, this is for the actual request response
    if (origin !== ALLOWED_ORIGIN && origin !== 'http://localhost:3000') { 
        // Potentially return 403, but for now rely on browser CORS block
        console.warn(`Origin ${origin} not explicitly allowed, but proceeding.`);
    }

    // Handle OPTIONS request for CORS preflight (though API GW might handle it)
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ message: 'CORS Preflight OK' })
        };
    }

    const userId = event.requestContext.authorizer.claims.sub;
    let responseBody = {};
    let statusCode = 200;

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

      responseBody = user || {};
    } else if (path === '/tokens' && httpMethod === 'GET') {
      // Get recent tokens
      const scanCommand = new ScanCommand({
        TableName: process.env.TOKENS_TABLE!,
        Limit: 100,
      });

      const result = await dynamodb.send(scanCommand);
      const tokens = result.Items?.map(item => unmarshall(item)) || [];

      responseBody = { tokens };
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

      responseBody = { positions };
    } else {
      statusCode = 404;
      responseBody = { message: 'Not found' };
    }

    return {
      statusCode: statusCode,
      headers: CORS_HEADERS, // Add CORS headers to success response
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS, // Add CORS headers to error response
      body: JSON.stringify({ message: error.message || 'Internal Server Error' }),
    };
  }
}; 