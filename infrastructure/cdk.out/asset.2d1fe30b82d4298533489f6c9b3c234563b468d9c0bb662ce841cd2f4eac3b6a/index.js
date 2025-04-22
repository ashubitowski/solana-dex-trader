"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/api.ts
var api_exports = {};
__export(api_exports, {
  handler: () => handler2
});
module.exports = __toCommonJS(api_exports);
var import_client_dynamodb2 = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");

// lambda/auth.ts
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_util_dynamodb = require("@aws-sdk/util-dynamodb");
var import_crypto = require("crypto");
var cognito = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
var dynamodb = new import_client_dynamodb.DynamoDBClient({});
var RATE_LIMIT_WINDOW = 300;
var MAX_ATTEMPTS = 5;
async function checkRateLimit(ip) {
  const now = Math.floor(Date.now() / 1e3);
  const key = (0, import_crypto.createHash)("sha256").update(ip).digest("hex");
  try {
    const getItemCommand = new import_client_dynamodb.GetItemCommand({
      TableName: process.env.RATE_LIMIT_TABLE,
      Key: (0, import_util_dynamodb.marshall)({ key })
    });
    const record = await dynamodb.send(getItemCommand);
    const rateLimitData = record.Item ? (0, import_util_dynamodb.unmarshall)(record.Item) : { attempts: 0, windowStart: now };
    if (now - rateLimitData.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitData.attempts = 0;
      rateLimitData.windowStart = now;
    }
    if (rateLimitData.attempts >= MAX_ATTEMPTS) {
      return false;
    }
    const updateCommand = new import_client_dynamodb.UpdateItemCommand({
      TableName: process.env.RATE_LIMIT_TABLE,
      Key: (0, import_util_dynamodb.marshall)({ key }),
      UpdateExpression: "SET attempts = :attempts, windowStart = :windowStart",
      ExpressionAttributeValues: (0, import_util_dynamodb.marshall)({
        ":attempts": rateLimitData.attempts + 1,
        ":windowStart": rateLimitData.windowStart
      })
    });
    await dynamodb.send(updateCommand);
    return true;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return true;
  }
}
function generateSecureCookies(tokens, domain) {
  const maxAge = 3600;
  const secure = true;
  const sameSite = "Strict";
  return [
    `accessToken=${tokens.AccessToken}; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge}; Domain=${domain}`,
    `idToken=${tokens.IdToken}; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge}; Domain=${domain}`,
    `refreshToken=${tokens.RefreshToken}; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge * 24 * 30}; Domain=${domain}`
    // 30 days
  ];
}
var handler = async (event) => {
  try {
    const { action, email, password, name } = JSON.parse(event.body);
    const clientIp = event.requestContext.identity.sourceIp;
    const domain = event.headers.Host || "localhost";
    if (action === "login" && !await checkRateLimit(clientIp)) {
      return {
        statusCode: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": MAX_ATTEMPTS.toString(),
          "X-RateLimit-Window": RATE_LIMIT_WINDOW.toString()
        },
        body: JSON.stringify({ message: "Too many login attempts. Please try again later." })
      };
    }
    if (action === "signup") {
      const signUpCommand = new import_client_cognito_identity_provider.SignUpCommand({
        ClientId: process.env.CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "name", Value: name },
          { Name: "email", Value: email }
        ]
      });
      const signUpResponse = await cognito.send(signUpCommand);
      const putItemCommand = new import_client_dynamodb.PutItemCommand({
        TableName: process.env.USERS_TABLE,
        Item: (0, import_util_dynamodb.marshall)({
          userId: signUpResponse.UserSub,
          email,
          name,
          createdAt: Date.now()
        })
      });
      await dynamodb.send(putItemCommand);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Content-Security-Policy": "default-src 'self'"
        },
        body: JSON.stringify({ message: "User created successfully" })
      };
    } else if (action === "login") {
      const authCommand = new import_client_cognito_identity_provider.InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });
      const authResponse = await cognito.send(authCommand);
      const cookies = generateSecureCookies(authResponse.AuthenticationResult, domain);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Content-Security-Policy": "default-src 'self'",
          "Set-Cookie": cookies
        },
        body: JSON.stringify({
          message: "Login successful"
        })
      };
    }
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "Invalid action" })
    };
  } catch (error) {
    console.error("Auth error:", error);
    const errorMessages = {
      UserNotConfirmedException: "Please verify your email address",
      UserNotFoundException: "Authentication failed",
      NotAuthorizedException: "Authentication failed",
      InvalidParameterException: "Invalid input provided"
    };
    return {
      statusCode: error.statusCode || 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: errorMessages[error.code] || "An error occurred. Please try again later."
      })
    };
  }
};

// lambda/api.ts
var client = new import_client_dynamodb2.DynamoDBClient({});
var docClient = import_lib_dynamodb.DynamoDBDocumentClient.from(client);
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Or specify your CloudFront domain `https://${process.env.CLOUDFRONT_DOMAIN}`
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
};
var handler2 = async (event) => {
  console.log("LAMBDA_HANDLER_START: api.ts - v2 CORS Headers Added");
  console.log("Incoming Event:", JSON.stringify(event, null, 2));
  let response;
  try {
    const method = event.httpMethod;
    const path = event.path;
    if (path.startsWith("/auth") && method === "POST") {
      console.log("Routing to /auth POST handler (auth.ts)");
      const authResponse = await handler(event);
      console.log("Response from authHandler:", JSON.stringify(authResponse, null, 2));
      const finalHeaders = {
        ...corsHeaders
        // Start with CORS headers
      };
      const setCookieHeader = authResponse.headers?.["Set-Cookie"];
      if (setCookieHeader && typeof setCookieHeader === "string") {
        finalHeaders["Set-Cookie"] = setCookieHeader;
      }
      finalHeaders["Content-Type"] = "application/json";
      response = {
        statusCode: authResponse.statusCode,
        headers: finalHeaders,
        body: authResponse.body
      };
    } else if (path.startsWith("/stats") && method === "GET") {
      console.log("Routing to /stats GET handler");
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        console.error("User ID not found in authorizer claims for /stats");
        response = {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unauthorized" })
        };
      } else {
        console.log(`Fetching stats for user: ${userId}`);
        response = {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: `Stats for user ${userId} (placeholder)` })
        };
      }
    } else if (path.startsWith("/tokens") && method === "GET") {
      console.log("Routing to /tokens GET handler");
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        console.error("User ID not found in authorizer claims for /tokens");
        response = {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unauthorized" })
        };
      } else {
        console.log(`Fetching tokens for user: ${userId}`);
        response = {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify([{ token: "TOKEN1" }, { token: "TOKEN2" }])
        };
      }
    } else if (path.startsWith("/positions") && method === "GET") {
      console.log("Routing to /positions GET handler");
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        console.error("User ID not found in authorizer claims for /positions");
        response = {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unauthorized" })
        };
      } else {
        console.log(`Fetching positions for user: ${userId}`);
        response = {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify([{ position: "POS1" }, { position: "POS2" }])
        };
      }
    } else if (path.startsWith("/logs") && method === "GET") {
      console.log("Routing to /logs GET handler");
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        console.error("User ID not found in authorizer claims for /logs");
        response = {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unauthorized" })
        };
      } else {
        console.log(`Fetching logs for user: ${userId}`);
        response = {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify([{ level: "info", message: "Log entry 1" }, { level: "error", message: "Log entry 2" }])
        };
      }
    } else if (path.startsWith("/wallet") && method === "GET") {
      console.log("Routing to /wallet GET handler");
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        console.error("User ID not found in authorizer claims for /wallet");
        response = {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Unauthorized" })
        };
      } else {
        console.log(`Fetching wallet info for user: ${userId}`);
        response = {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ address: "SampleWalletAddress", balance: 1.23, status: { message: "Connected", type: "success" } })
        };
      }
    } else {
      console.log(`Unhandled path/method: ${method} ${path}`);
      response = {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Not Found" })
      };
    }
  } catch (error) {
    console.error("Unhandled Exception in api.ts handler:", error);
    response = {
      statusCode: 500,
      headers: corsHeaders,
      // Ensure CORS headers on errors too
      body: JSON.stringify({ message: "Internal Server Error", error: error.message })
    };
  }
  console.log("Returning Response from api.ts:", JSON.stringify(response, null, 2));
  return response;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
