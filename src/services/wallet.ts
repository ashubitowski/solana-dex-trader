import { Connection, PublicKey, Transaction, Keypair, LogsCallback } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import { WebSocketWrapper } from './websocket-wrapper';

dotenv.config();

export class WalletService {
    private connection!: Connection;
    private keypair!: Keypair;
    private wsConnected: boolean = false;
    private webSocketWrapper: WebSocketWrapper | null = null;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private logsSubscriptionId: number | null = null;

    constructor() {
        this.initializeConnection();
    }

    private async initializeConnection(): Promise<void> {
        try {
            const rpcUrl = process.env.SOLANA_RPC_URL;
            if (!rpcUrl) {
                throw new Error('SOLANA_RPC_URL not found in environment variables');
            }

            const wsEndpoint = rpcUrl.replace('https://', 'wss://');
            console.log(`Connecting to Solana RPC: ${rpcUrl}`);

            // Configure connection with better rate limit handling
            this.connection = new Connection(rpcUrl, {
                commitment: 'confirmed',
                confirmTransactionInitialTimeout: 60000,
                wsEndpoint,
                disableRetryOnRateLimit: false,
                httpHeaders: {
                    'Content-Type': 'application/json',
                },
            });

            // Initialize keypair first
            const privateKeyStr = process.env.SOLANA_PRIVATE_KEY;
            if (!privateKeyStr) {
                throw new Error('SOLANA_PRIVATE_KEY not found in environment variables');
            }

            try {
                // Try parsing as base58 first
                const privateKey = bs58.decode(privateKeyStr);
                this.keypair = Keypair.fromSecretKey(privateKey);
            } catch (error) {
                // If base58 fails, try parsing as JSON array
                try {
                    const privateKey = new Uint8Array(JSON.parse(privateKeyStr));
                    this.keypair = Keypair.fromSecretKey(privateKey);
                } catch (jsonError) {
                    throw new Error('Invalid private key format. Must be base58 encoded or JSON array');
                }
            }

            console.log(`Using wallet: ${this.keypair.publicKey.toString()}`);

            // Set up logs subscription with improved error handling
            let retries = 0;
            const maxRetries = 5;
            let lastErrorTime = 0;
            const errorCooldown = 5000; // 5 seconds between error logs

            // Create a wrapper for the logs callback that filters out 404 errors
            const handleLogsCallback: LogsCallback = (logs, context) => {
                if (!logs.err) {
                    // Only log non-error messages if they're significant
                    if (logs.signature) {
                        console.log('Received transaction logs:', logs);
                    }
                } else {
                    const errorMessage = logs.err.toString().toLowerCase();
                    // Skip logging for common WebSocket errors
                    const isCommonError = 
                        errorMessage.includes('404') ||
                        errorMessage.includes('unexpected server response') ||
                        errorMessage.includes('getaddrinfo enotfound') ||
                        errorMessage.includes('websocket') ||
                        errorMessage.includes('connection closed');

                    if (!isCommonError) {
                        const now = Date.now();
                        if (now - lastErrorTime > errorCooldown) {
                            console.warn('Non-WebSocket error occurred:', logs.err);
                            lastErrorTime = now;
                        }
                    }
                }
            };

            const subscribeToLogs = async () => {
                try {
                    if (this.logsSubscriptionId !== null) {
                        try {
                            await this.connection.removeOnLogsListener(this.logsSubscriptionId);
                        } catch (error) {
                            // Ignore removal errors
                        }
                    }

                    this.logsSubscriptionId = this.connection.onLogs(
                        this.keypair.publicKey,
                        handleLogsCallback,
                        'confirmed'
                    );
                    console.log('WebSocket subscription established');
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
                    // Only log non-404 errors
                    if (!errorMessage.includes('404') && 
                        !errorMessage.includes('unexpected server response')) {
                        const now = Date.now();
                        if (now - lastErrorTime > errorCooldown) {
                            console.warn('Error in logs subscription. Will retry...');
                            lastErrorTime = now;
                        }
                    }
                    
                    if (retries < maxRetries) {
                        retries++;
                        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        await subscribeToLogs();
                    }
                }
            };

            await subscribeToLogs();
            
            // Set up periodic subscription check
            setInterval(async () => {
                if (this.logsSubscriptionId === null) {
                    console.log('Reestablishing logs subscription...');
                    await subscribeToLogs();
                }
            }, 30000); // Check every 30 seconds
            
        } catch (error) {
            console.error('Error initializing connection:', error);
            throw error;
        }
    }

    private async setupLogsSubscription(): Promise<void> {
        if (!this.webSocketWrapper) {
            throw new Error('WebSocket wrapper not initialized');
        }

        await this.webSocketWrapper.subscribe(
            this.keypair.publicKey,
            (logs) => {
                // Handle valid logs here
                // This callback will only receive non-error logs
                // as errors are handled by the wrapper
            }
        );

        this.wsConnected = true;
    }

    private async handleWebSocketError(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached. Please restart the application.');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        try {
            await this.connect();
            this.wsConnected = true;
            this.reconnectAttempts = 0;
            console.log('Successfully reconnected to WebSocket');
        } catch (error) {
            console.error('Failed to reconnect:', error);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                await this.handleWebSocketError();
            }
        }
    }

    async connect(): Promise<boolean> {
        try {
            // First verify the connection is working
            await this.connection.getVersion();
            console.log('Successfully connected to Solana network');

            // Then check the account
            const accountInfo = await this.connection.getAccountInfo(this.keypair.publicKey);
            if (accountInfo) {
                console.log('Account info retrieved for public key:', this.keypair.publicKey.toString());
                console.log('Account balance:', accountInfo.lamports / 1e9, 'SOL');
            } else {
                console.log('Account not found for public key:', this.keypair.publicKey.toString());
                console.log('Account balance: 0 SOL');
                
                // Only request airdrop on devnet or testnet
                if (process.env.SOLANA_NETWORK !== 'mainnet-beta') {
                    try {
                        const signature = await this.connection.requestAirdrop(this.keypair.publicKey, 2 * 1e9); // 2 SOL
                        await this.connection.confirmTransaction(signature);
                        console.log('Successfully airdropped 2 SOL to the account');
                    } catch (airdropError) {
                        console.error('Error requesting airdrop:', airdropError);
                    }
                }
            }
            
            this.wsConnected = true;
            return true;
        } catch (error) {
            console.error('Error connecting to Solana network:', error);
            this.wsConnected = false;
            return false;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.webSocketWrapper) {
                await this.webSocketWrapper.unsubscribe(this.keypair.publicKey);
                this.webSocketWrapper.cleanup();
                this.webSocketWrapper = null;
            }
            this.wsConnected = false;
            console.log('Wallet disconnected');
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
        }
    }

    getPublicKey(): PublicKey {
        return this.keypair.publicKey;
    }

    async signTransaction(transaction: Transaction): Promise<Transaction> {
        try {
            transaction.sign(this.keypair);
            return transaction;
        } catch (error) {
            console.error('Error signing transaction:', error);
            throw error;
        }
    }

    getConnection(): Connection {
        return this.connection;
    }

    getKeypair(): Keypair {
        return this.keypair;
    }

    isWebSocketConnected(): boolean {
        return this.webSocketWrapper?.isWebSocketConnected() || false;
    }
} 