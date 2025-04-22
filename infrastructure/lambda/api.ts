import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handler as authHandler } from './auth'; // Import the handler from auth.ts
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'; // Added Solana imports

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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

    try {
        const method = event.httpMethod;
        const path = event.path;

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
        } else if (path.startsWith('/stats') && method === 'GET') {
            console.log('Routing to /stats GET handler');
            // TODO: Implement stats logic - requires authenticated user ID from authorizer context
            const userId = event.requestContext.authorizer?.claims?.sub; // Example: Get user ID from Cognito claims
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
            const userId = event.requestContext.authorizer?.claims?.sub;
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
            const userId = event.requestContext.authorizer?.claims?.sub;
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
            const userId = event.requestContext.authorizer?.claims?.sub;
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
        } else if (path.startsWith('/wallet') && method === 'GET') {
            console.log('Routing to /wallet GET handler');
            const userId = event.requestContext.authorizer?.claims?.sub;
            if (!userId) {
                console.error('User ID not found in authorizer claims for /wallet');
                response = {
                    statusCode: 401,
                    headers: corsHeaders, 
                    body: JSON.stringify({ message: 'Unauthorized' })
                };
            } else {
                console.log(`Fetching wallet info for user: ${userId}`);
                try {
                    // --- Replace Placeholder Logic with Real Logic --- 
                    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT;
                    if (!rpcEndpoint) {
                        throw new Error('SOLANA_RPC_ENDPOINT environment variable not set.');
                    }
                    const connection = new Connection(rpcEndpoint, 'confirmed');

                    // TODO: Replace this hardcoded key with retrieval from DB later
                    // IMPORTANT: This is a placeholder key. Generate a new burner keypair for testing.
                    // Never commit real secret keys.
                    const tempSecretKey = new Uint8Array([
                        // Replace with a generated test key (e.g., from Phantom export or `solana-keygen new`)
                        // Example only - DO NOT USE THIS KEY
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 
                        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
                        33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 
                        49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64 
                    ]); 
                    const keypair = Keypair.fromSecretKey(tempSecretKey);
                    const publicKey = keypair.publicKey;

                    const balanceLamports = await connection.getBalance(publicKey);
                    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

                    console.log(`Wallet Address: ${publicKey.toBase58()}, Balance: ${balanceSol} SOL`);

                    response = {
                        statusCode: 200,
                        headers: corsHeaders,
                        // Return real address and balance
                        body: JSON.stringify({ 
                            address: publicKey.toBase58(), 
                            balance: balanceSol,
                            // Keep status for potential UI updates (e.g., connected/disconnected from RPC)
                            status: { message: 'Connected', type: 'success'} 
                        })
                    };
                } catch (walletError: any) {
                    console.error('Error fetching wallet data:', walletError);
                    response = {
                        statusCode: 500,
                        headers: corsHeaders,
                        body: JSON.stringify({ message: 'Failed to fetch wallet data', error: walletError.message })
                    };
                }
            }
        } else if (path.startsWith('/dashboard') && method === 'GET') {
            console.log('Routing to /dashboard GET handler');
            const userId = event.requestContext.authorizer?.claims?.sub;
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