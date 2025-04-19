import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

export class WalletService {
    private connection: Connection;
    private keypair: Keypair;

    constructor() {
        const network = process.env.SOLANA_NETWORK || 'devnet';
        const rpcUrl = process.env.SOLANA_RPC_URL || (
            network === 'mainnet-beta' 
                ? 'https://api.mainnet-beta.solana.com'
                : network === 'testnet'
                    ? 'https://api.testnet.solana.com'
                    : 'https://api.devnet.solana.com'
        );
                
        this.connection = new Connection(rpcUrl, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000
        });
        
        const privateKeyString = process.env.SOLANA_PRIVATE_KEY;
        if (!privateKeyString) {
            throw new Error('SOLANA_PRIVATE_KEY is not set in .env file');
        }
        
        try {
            // Remove any whitespace or newlines from the private key
            const cleanPrivateKey = privateKeyString.trim();
            
            // Try to decode as base58
            const privateKeyBytes = bs58.decode(cleanPrivateKey);
            
            // Verify the length is correct (should be 64 bytes for a Solana private key)
            if (privateKeyBytes.length !== 64) {
                throw new Error('Invalid private key length. Expected 64 bytes.');
            }
            
            this.keypair = Keypair.fromSecretKey(privateKeyBytes);
            console.log('Wallet initialized with public key:', this.keypair.publicKey.toString());
        } catch (error) {
            console.error('Error initializing wallet:', error);
            throw new Error('Invalid private key format. Please ensure it is a valid base58 encoded string.');
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
            
            return true;
        } catch (error) {
            console.error('Error connecting to Solana network:', error);
            return false;
        }
    }

    async disconnect(): Promise<void> {
        // No need to disconnect when using a keypair
        console.log('Wallet disconnected');
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
} 