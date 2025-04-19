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

    constructor() {
        this.initializeConnection();
    }

    private async initializeConnection(): Promise<void> {
        try {
            const rpcUrl = process.env.SOLANA_RPC_URL;
            if (!rpcUrl) {
                throw new Error('SOLANA_RPC_URL is not set in environment variables');
            }

            // Initialize keypair first
            const privateKeyString = process.env.SOLANA_PRIVATE_KEY;
            if (!privateKeyString) {
                throw new Error('SOLANA_PRIVATE_KEY is not set in environment variables');
            }
            const privateKey = bs58.decode(privateKeyString);
            this.keypair = Keypair.fromSecretKey(privateKey);

            // Create connection with websocket configuration
            const wsEndpoint = rpcUrl.replace('https://', 'wss://');
            console.log('Connecting to WebSocket endpoint:', wsEndpoint);

            this.connection = new Connection(rpcUrl, {
                commitment: 'confirmed',
                wsEndpoint: wsEndpoint,
                confirmTransactionInitialTimeout: 60000,
                disableRetryOnRateLimit: false
            });

            // Initialize WebSocket wrapper
            this.webSocketWrapper = new WebSocketWrapper(this.connection);

            // Set up logs subscription
            await this.setupLogsSubscription();
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