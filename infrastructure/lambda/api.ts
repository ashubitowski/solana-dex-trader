import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handler as authHandler } from './auth'; // Import the handler from auth.ts
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'; // Added Solana imports
import { 
    SecretsManagerClient, 
    GetSecretValueCommand, 
    PutSecretValueCommand, 
    ResourceNotFoundException // To handle secret not found
} from "@aws-sdk/client-secrets-manager"; // Added Secrets Manager imports
import * as bs58 from 'bs58'; // Import bs58 using namespace import

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const smClient = new SecretsManagerClient({}); // Secrets Manager client

// Define CORS headers - ensure this is added to ALL responses
const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Or specify your CloudFront domain `https://${process.env.CLOUDFRONT_DOMAIN}`
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('LAMBDA_HANDLER_START: api.ts - v2 CORS Headers Added');
    console.log('Incoming Event:', JSON.stringify(event, null, 2)); // Log the incoming event

    let response: APIGatewayProxyResult;
    const method = event.httpMethod;
    const path = event.path;
    const secretPrefix = process.env.SECRET_NAME_PREFIX || 'solana-dex-trader/wallet'; // Get prefix from env

    try {
        // Get userId for protected routes (place here for DRY)
        const userId = event.requestContext.authorizer?.claims?.sub;
        let secretName: string | undefined;
        if (userId) {
            secretName = `${secretPrefix}/${userId}`;
        }

        // Simple router based on path
        if (path.startsWith('/auth') && method === 'POST') {
            console.log('Routing to /auth POST handler (auth.ts)');
            const authResponse = await authHandler(event); // Delegate to auth handler
            console.log('Response from authHandler:', JSON.stringify(authResponse, null, 2));

            // Build final headers: Start with CORS, add Set-Cookie if present from authHandler
            const finalHeaders: { [header: string]: string | number | boolean } = {
                ...corsHeaders, // Start with CORS headers
            };
            // Check if Set-Cookie exists and is valid before adding
            const setCookieHeader = authResponse.headers?.['Set-Cookie'];
            if (setCookieHeader && typeof setCookieHeader === 'string') { 
                finalHeaders['Set-Cookie'] = setCookieHeader;
            }
            // Add Content-Type, as authHandler might not set it consistently
            finalHeaders['Content-Type'] = 'application/json';

            response = {
                statusCode: authResponse.statusCode,
                headers: finalHeaders,
                body: authResponse.body,
            };
        } else if (path.startsWith('/config/wallet') && method === 'POST') {
            console.log('Routing to /config/wallet POST handler (Base58)');
            if (!userId || !secretName) {
                console.error('Unauthorized access attempt to /config/wallet');
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Unauthorized' }) };
            }
            if (!event.body) {
                 return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Missing request body' }) };
            }
            
            try {
                const body = JSON.parse(event.body);
                const secretKeyBase58 = body.secretKeyBase58; // Expecting Base58 string
                
                if (!secretKeyBase58 || typeof secretKeyBase58 !== 'string') {
                     return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Missing or invalid secretKeyBase58 in body' }) };
                }
                
                // Basic Base58 validation (can add more robust checks if needed)
                try {
                    const decoded = bs58.decode(secretKeyBase58);
                    if (decoded.length !== 64) { // Standard Solana secret keys are 64 bytes
                         throw new Error('Decoded key is not 64 bytes long.');
                    }
                } catch (e: any) {
                    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ message: 'Invalid Base58 secret key format.', error: e.message }) };
                }
                
                console.log(`Storing Base58 secret for user ${userId} in secret ${secretName}`);
                
                const command = new PutSecretValueCommand({
                    SecretId: secretName,
                    SecretString: secretKeyBase58, // Store the Base58 string
                });
                await smClient.send(command);
                
                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Wallet configuration saved successfully.' })
                };
                
            } catch (configError: any) {
                 console.error(`Error saving Base58 config for user ${userId}:`, configError);
                  response = {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Failed to save wallet configuration', error: configError.message })
                 };
            }
        } else if (path.startsWith('/wallet') && method === 'GET') {
            console.log('Routing to /wallet GET handler (Base58)');
            if (!userId || !secretName) {
                console.error('User ID not found in authorizer claims for /wallet');
                return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ message: 'Unauthorized' }) };
            }
            
            try {
                console.log(`Fetching wallet info for user: ${userId} from secret ${secretName}`);
                let secretKeyBase58: string | undefined;
                
                // 1. Fetch Base58 secret string from Secrets Manager
                try {
                    const command = new GetSecretValueCommand({ SecretId: secretName });
                    const secretResponse = await smClient.send(command);
                    secretKeyBase58 = secretResponse.SecretString;
                } catch (error: any) {
                    if (error instanceof ResourceNotFoundException) {
                        console.log(`Secret ${secretName} not found for user ${userId}. Wallet not configured.`);
                        // Return specific status indicating not configured
                        return {
                            statusCode: 200, // Or maybe 404? Let's use 200 with status for now
                            headers: corsHeaders,
                            body: JSON.stringify({ address: null, balance: 0, status: { message: 'Wallet not configured', type: 'warning'} })
                        };
                    } else {
                        throw error; // Re-throw other errors
                    }
                }

                if (!secretKeyBase58) {
                     throw new Error('Fetched secret string is empty.');
                }
                
                // 2. Decode Base58 string into Uint8Array
                let secretKeyBytes: Uint8Array;
                 try {
                    secretKeyBytes = bs58.decode(secretKeyBase58);
                     if (secretKeyBytes.length !== 64) { 
                         throw new Error('Decoded key is not 64 bytes long.');
                    }
                 } catch (e: any) {
                     throw new Error(`Invalid Base58 secret key format stored in Secrets Manager: ${e.message}`);
                 }
                
                // 3. Use the bytes to get address and balance
                const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT;
                if (!rpcEndpoint) {
                    throw new Error('SOLANA_RPC_ENDPOINT environment variable not set.');
                }
                const connection = new Connection(rpcEndpoint, 'confirmed');
                const keypair = Keypair.fromSecretKey(secretKeyBytes); // Use decoded bytes
                const publicKey = keypair.publicKey;

                const balanceLamports = await connection.getBalance(publicKey);
                const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

                console.log(`Wallet Address: ${publicKey.toBase58()}, Balance: ${balanceSol} SOL`);

                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ 
                        address: publicKey.toBase58(), 
                        balance: balanceSol,
                        status: { message: 'Connected', type: 'success'} 
                    })
                };

            } catch (walletError: any) {
                console.error('Error fetching wallet data (Base58):', walletError);
                response = {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Failed to fetch wallet data', error: walletError.message })
                };
            }
        } else if (path.startsWith('/stats') && method === 'GET') {
            console.log('Routing to /stats GET handler');
            // TODO: Implement stats logic - requires authenticated user ID from authorizer context
            if (!userId) {
                console.error('User ID not found in authorizer claims for /stats');
                response = {
                    statusCode: 401,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Unauthorized' }),
                };
            } else {
                 console.log(`Fetching stats for user: ${userId}`);
                // Placeholder for stats logic
                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: `Stats for user ${userId} (placeholder)` }),
                };
            }

        } else if (path.startsWith('/tokens') && method === 'GET') {
            console.log('Routing to /tokens GET handler');
            // Example: Fetch token data (requires auth)
            if (!userId) {
                console.error('User ID not found in authorizer claims for /tokens');
                response = {
                    statusCode: 401,
                    headers: corsHeaders, 
                    body: JSON.stringify({ message: 'Unauthorized' })
                };
            } else {
                console.log(`Fetching tokens for user: ${userId}`);
                // Replace with actual logic
                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify([{ token: 'TOKEN1' }, { token: 'TOKEN2' }])
                };
            }
        } else if (path.startsWith('/positions') && method === 'GET') {
            console.log('Routing to /positions GET handler');
            // Example: Fetch positions data (requires auth)
            if (!userId) {
                console.error('User ID not found in authorizer claims for /positions');
                response = {
                    statusCode: 401,
                    headers: corsHeaders, 
                    body: JSON.stringify({ message: 'Unauthorized' })
                };
            } else {
                console.log(`Fetching positions for user: ${userId}`);
                // Replace with actual logic
                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify([{ position: 'POS1' }, { position: 'POS2' }])
                };
            }
        } else if (path.startsWith('/logs') && method === 'GET') {
            console.log('Routing to /logs GET handler');
            if (!userId) {
                console.error('User ID not found in authorizer claims for /logs');
                response = {
                    statusCode: 401,
                    headers: corsHeaders, 
                    body: JSON.stringify({ message: 'Unauthorized' })
                };
            } else {
                console.log(`Fetching logs for user: ${userId}`);
                // Placeholder for logs logic
                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify([{ level: 'info', message: 'Log entry 1' }, { level: 'error', message: 'Log entry 2' }])
                };
            }
        } else if (path.startsWith('/dashboard') && method === 'GET') {
            console.log('Routing to /dashboard GET handler');
            if (!userId) {
                console.error('User ID not found in authorizer claims for /dashboard');
                response = {
                    statusCode: 401,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Unauthorized' })
                };
            } else {
                console.log(`Fetching dashboard data for user: ${userId}`);
                // TODO: Implement actual dashboard data aggregation logic
                response = {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        message: `Dashboard data for user ${userId} (placeholder)`,
                        stats: { totalTrades: 10, profitableTrades: 7, successRate: '70.0%', totalProfit: '+0.5 SOL' },
                        tokens: [{ symbol: 'MOCK1', price: 0.001 }, { symbol: 'MOCK2', price: 0.002 }],
                        positions: [{ symbol: 'ACTIVE1', pnl: '+10%' }],
                        logs: [{ level: 'info', message: 'Dashboard loaded' }]
                    })
                };
            }
        } else {
            console.log(`Unhandled path/method: ${method} ${path}`);
            response = {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ message: 'Not Found' }),
            };
        }
    } catch (error: any) {
        console.error('Unhandled Exception in api.ts handler:', error);
        response = {
            statusCode: 500,
            headers: corsHeaders, // Ensure CORS headers on errors too
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
        };
    }

    // Ensure CORS headers are always included (This might override headers set by authHandler)
    // response.headers = { ...corsHeaders, ...(response.headers || {}) }; // Headers merged individually per route now

    console.log('Returning Response from api.ts:', JSON.stringify(response, null, 2)); // Log the response before returning
    return response;
}; 