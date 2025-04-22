import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const cognito = new CognitoIdentityProviderClient({});
const dynamodb = new DynamoDBClient({});

export const handler = async (event: any) => {
  try {
    const { action, email, password, name } = JSON.parse(event.body);

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
        body: JSON.stringify({ message: 'User created successfully' }),
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

      return {
        statusCode: 200,
        body: JSON.stringify({
          accessToken: authResponse.AuthenticationResult?.AccessToken,
          idToken: authResponse.AuthenticationResult?.IdToken,
          refreshToken: authResponse.AuthenticationResult?.RefreshToken,
        }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid action' }),
    };
  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
}; 