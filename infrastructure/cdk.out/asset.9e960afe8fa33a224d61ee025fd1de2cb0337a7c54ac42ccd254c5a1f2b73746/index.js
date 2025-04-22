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
  handler: () => handler
});
module.exports = __toCommonJS(api_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_util_dynamodb = require("@aws-sdk/util-dynamodb");
var dynamodb = new import_client_dynamodb.DynamoDBClient({});
var ALLOWED_ORIGIN = "https://d3rntcg47zepho.cloudfront.net";
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Credentials": true,
  // Important for credentials like Authorization header
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  // Add methods as needed
};
var handler = async (event) => {
  console.log("LAMBDA_HANDLER_START: api.ts - v2 CORS Headers Added");
  try {
    const { path, httpMethod, headers } = event;
    const origin = headers?.origin || headers?.Origin;
    if (origin !== ALLOWED_ORIGIN && origin !== "http://localhost:3000") {
      console.warn(`Origin ${origin} not explicitly allowed, but proceeding.`);
    }
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "CORS Preflight OK" })
      };
    }
    const userId = event.requestContext.authorizer.claims.sub;
    let responseBody = {};
    let statusCode = 200;
    if (path === "/users" && httpMethod === "GET") {
      const queryCommand = new import_client_dynamodb.QueryCommand({
        TableName: process.env.USERS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": { S: userId }
        }
      });
      const result = await dynamodb.send(queryCommand);
      const user = result.Items?.[0] ? (0, import_util_dynamodb.unmarshall)(result.Items[0]) : null;
      responseBody = user || {};
    } else if (path === "/tokens" && httpMethod === "GET") {
      const scanCommand = new import_client_dynamodb.ScanCommand({
        TableName: process.env.TOKENS_TABLE,
        Limit: 100
      });
      const result = await dynamodb.send(scanCommand);
      const tokens = result.Items?.map((item) => (0, import_util_dynamodb.unmarshall)(item)) || [];
      responseBody = { tokens };
    } else if (path === "/positions" && httpMethod === "GET") {
      const queryCommand = new import_client_dynamodb.QueryCommand({
        TableName: process.env.POSITIONS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": { S: userId }
        }
      });
      const result = await dynamodb.send(queryCommand);
      const positions = result.Items?.map((item) => (0, import_util_dynamodb.unmarshall)(item)) || [];
      responseBody = { positions };
    } else {
      statusCode = 404;
      responseBody = { message: "Not found" };
    }
    return {
      statusCode,
      headers: CORS_HEADERS,
      // Add CORS headers to success response
      body: JSON.stringify(responseBody)
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      // Add CORS headers to error response
      body: JSON.stringify({ message: error.message || "Internal Server Error" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
