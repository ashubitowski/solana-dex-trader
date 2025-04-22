import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { createHash } from 'crypto';

const cognito = new CognitoIdentityProviderClient({});
const dynamodb = new DynamoDBClient({});

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 300; // 5 minutes
const MAX_ATTEMPTS = 5;

interface RateLimitRecord {
  attempts: number;
  windowStart: number;
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const key = createHash('sha256').update(ip).digest('hex');

  try {
    const getItemCommand = new GetItemCommand({
      TableName: process.env.RATE_LIMIT_TABLE!,
      Key: marshall({ key: key }),
    });

    const record = await dynamodb.send(getItemCommand);
    const rateLimitData: RateLimitRecord = record.Item ? unmarshall(record.Item) as RateLimitRecord : { attempts: 0, windowStart: now };

    // Reset if window has expired
    if (now - rateLimitData.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitData.attempts = 0;
      rateLimitData.windowStart = now;
    }

    // Check if limit exceeded
    if (rateLimitData.attempts >= MAX_ATTEMPTS) {
      return false;
    }

    // Update attempts
    const updateCommand = new UpdateItemCommand({
      TableName: process.env.RATE_LIMIT_TABLE!,
      Key: marshall({ key: key }),
      UpdateExpression: 'SET attempts = :attempts, windowStart = :windowStart',
      ExpressionAttributeValues: marshall({
        ':attempts': rateLimitData.attempts + 1,
        ':windowStart': rateLimitData.windowStart,
      }),
    });

    await dynamodb.send(updateCommand);
    return true;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open if rate limiting fails
  }
}

function generateSecureCookies(tokens: any, domain: string): string[] {
  const maxAge = 3600; // 1 hour
  const secure = true;
  const sameSite = 'Strict';
  
  return [
    `accessToken=${tokens.AccessToken}; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge}; Domain=${domain}`,
    `idToken=${tokens.IdToken}; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge}; Domain=${domain}`,
    `refreshToken=${tokens.RefreshToken}; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge * 24 * 30}; Domain=${domain}` // 30 days
  ];
}

export const handler = async (event: any) => {
  try {
    const { action, email, password, name } = JSON.parse(event.body);
    const clientIp = event.requestContext.identity.sourceIp;
    const domain = event.headers.Host || 'localhost';

    // Check rate limit for login attempts
    if (action === 'login' && !(await checkRateLimit(clientIp))) {
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': MAX_ATTEMPTS.toString(),
          'X-RateLimit-Window': RATE_LIMIT_WINDOW.toString(),
        },
        body: JSON.stringify({ message: 'Too many login attempts. Please try again later.' })
      };
    }

    if (action === 'signup') {
      // Sign up user in Cognito
      const signUpCommand = new SignUpCommand({
        ClientId: process.env.CLIENT_ID!,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'name', Value: name },
          { Name: 'email', Value: email },
        ],
      });

      const signUpResponse = await cognito.send(signUpCommand);

      // Create user record in DynamoDB
      const putItemCommand = new PutItemCommand({
        TableName: process.env.USERS_TABLE!,
        Item: marshall({
          userId: signUpResponse.UserSub,
          email,
          name,
          createdAt: Date.now(),
        }),
      });

      await dynamodb.send(putItemCommand);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'",
        },
        body: JSON.stringify({ message: 'User created successfully' })
      };
    } else if (action === 'login') {
      // Authenticate user
      const authCommand = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.CLIENT_ID!,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const authResponse = await cognito.send(authCommand);
      const cookies = generateSecureCookies(authResponse.AuthenticationResult, domain);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'",
          'Set-Cookie': cookies,
        },
        body: JSON.stringify({
          message: 'Login successful'
        })
      };
    }

    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Invalid action' })
    };
  } catch (error: any) {
    console.error('Auth error:', error);
    
    // Generic error messages for security
    const errorMessages: { [key: string]: string } = {
      UserNotConfirmedException: 'Please verify your email address',
      UserNotFoundException: 'Authentication failed',
      NotAuthorizedException: 'Authentication failed',
      InvalidParameterException: 'Invalid input provided',
    };

    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: errorMessages[error.code] || 'An error occurred. Please try again later.'
      })
    };
  }
}; 