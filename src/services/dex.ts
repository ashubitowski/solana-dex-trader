import { Connection, PublicKey, Transaction, SystemProgram, Keypair, VersionedTransaction } from '@solana/web3.js';
import { WalletService } from './wallet';

interface QuoteResponse {
    inputMint: string;
    outputMint: string;
    inAmount: number;
    outAmount: number;
    otherAmountThreshold: number;
    swapMode: string;
    slippageBps: number;
    platformFee: null | {
        amount: string;
        feeBps: number;
    };
    priceImpactPct: number;
    routePlan: any[];
    contextSlot: number;
}

interface SwapResponse {
    swapTransaction: string;
    lastValidBlockHeight: number;
}

interface TokenInfo {
    address: string;
    chainId: number;
    decimals: number;
    name: string;
    symbol: string;
    logoURI?: string;
    tags?: string[];
    extensions?: Record<string, any>;
    holders: number;
}

interface TokenMetrics {
    price: number;
    volume24h: number;
    liquidity: number;
    marketCap: number;
    priceChange24h: number;
    holders: number;
    age?: number;
}

interface TokenHolder {
    address: string;
    amount: number;
}

export class DexService {
    private connection: Connection;
    private lastRequestTime: number = 0;
    private readonly MIN_REQUEST_INTERVAL = 10000; // Increased from 5000 to 10000ms
    private readonly MAX_RETRIES = 15; // Increased from 10 to 15
    private readonly walletService: WalletService;
    private requestQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue: boolean = false;
    private readonly MAX_QUEUE_SIZE = 50;
    private readonly RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
    private requestCount: number = 0;
    private lastWindowReset: number = Date.now();
    private readonly MAX_REQUESTS_PER_WINDOW = 20;
    private readonly BACKOFF_MULTIPLIER = 1.5;
    private readonly MAX_BACKOFF = 30000; // 30 seconds
    private readonly ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
    private readonly isUsingAlchemy = process.env.SOLANA_RPC_URL?.includes('alchemy.com') || false;

    // Cache for API responses
    private tokenCache: Map<string, {
        price?: number;
        volume?: number;
        timestamp: number;
    }> = new Map();

    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private poolCache: {
        data: any[];
        timestamp: number;
    } | null = null;
    private readonly POOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Add this to the class-level cache declarations
    private tokenAgeCache: Map<string, {
        age: number;
        timestamp: number;
    }> = new Map();
    private readonly TOKEN_AGE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
    private pendingTokenRequests: Map<string, Promise<number>> = new Map();
    private promiseResolvers: Map<string, (value: number) => void> = new Map();
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly BATCH_DELAY = 1000; // 1 second to collect requests
    private tokenBatch: Set<string> = new Set();

    private heliusApiHits: number = 0;
    private readonly HELIUS_API_HITS_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    constructor(connection: Connection, walletService: WalletService) {
        this.connection = connection;
        this.walletService = walletService;
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) return;

        this.isProcessingQueue = true;
        try {
            while (this.requestQueue.length > 0) {
                const request = this.requestQueue.shift();
                if (request) {
                    try {
                        await request();
                    } catch (error) {
                        console.error('Error processing queued request:', error);
                    }
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    private async enqueueRequest<T>(operation: () => Promise<T>): Promise<T> {
        if (this.requestQueue.length >= this.MAX_QUEUE_SIZE) {
            throw new Error('Request queue is full');
        }

        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        
        // If using Alchemy, use different rate limit settings
        const isAlchemy = process.env.SOLANA_RPC_URL?.includes('alchemy.com') || false;
        
        if (isAlchemy) {
            // Alchemy has higher rate limits but still needs some throttling
            const minIntervalForAlchemy = 200; // 200ms between requests is reasonable for Alchemy
            const timeSinceLastRequest = now - this.lastRequestTime;
            
            if (timeSinceLastRequest < minIntervalForAlchemy) {
                await new Promise(resolve => setTimeout(resolve, minIntervalForAlchemy - timeSinceLastRequest));
            }
            
            this.lastRequestTime = Date.now();
            return;
        }
        
        // Reset request count if window has passed
        if (now - this.lastWindowReset >= this.RATE_LIMIT_WINDOW) {
            this.requestCount = 0;
            this.lastWindowReset = now;
        }

        // Check if we're within rate limits
        if (this.requestCount >= this.MAX_REQUESTS_PER_WINDOW) {
            const waitTime = this.RATE_LIMIT_WINDOW - (now - this.lastWindowReset);
            console.log(`⚠️ Rate limit reached, waiting ${Math.ceil(waitTime / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.lastWindowReset = Date.now();
        }

        // Ensure minimum interval between requests
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    private async retryWithBackoff<T>(fn: () => Promise<T>, retries: number = this.MAX_RETRIES): Promise<T> {
        let lastError: Error | null = null;
        let backoff = this.MIN_REQUEST_INTERVAL;
        
        // Adjust backoff for Alchemy
        const isAlchemy = process.env.SOLANA_RPC_URL?.includes('alchemy.com') || false;
        const initialBackoff = isAlchemy ? 200 : this.MIN_REQUEST_INTERVAL;
        const maxBackoff = isAlchemy ? 10000 : this.MAX_BACKOFF; // 10 seconds max for Alchemy
        const backoffMultiplier = isAlchemy ? 1.2 : this.BACKOFF_MULTIPLIER; // Gentler backoff for Alchemy
        
        backoff = initialBackoff;

        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;
                const isRateLimit = error instanceof Error && 
                    (error.message.includes('429') || error.message.includes('Too many requests'));
                    
                if (isRateLimit) {
                    console.log(`Server responded with 429 Too Many Requests. Retrying after ${Math.ceil(backoff)}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    backoff = Math.min(backoff * backoffMultiplier, maxBackoff);
                } else {
                    throw error;
                }
            }
        }

        throw lastError || new Error('Max retries reached');
    }

    async getMarketInfo(marketAddress: string): Promise<any> {
        try {
            const marketPubkey = new PublicKey(marketAddress);
            const accountInfo = await this.connection.getAccountInfo(marketPubkey);
            if (!accountInfo) {
                throw new Error('Market account not found');
            }
            return accountInfo;
        } catch (error) {
            console.error('Error getting market info:', error);
            return null;
        }
    }

    async getBestPrice(inputMint: string, outputMint: string, amount: number): Promise<{ bestBid: number; bestAsk: number } | null> {
        return this.retryWithBackoff(async () => {
            await this.waitForRateLimit();
            const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`);
            if (!response.ok) {
                throw new Error(`Failed to get quote: ${response.statusText}`);
            }
            const quoteResponse = await response.json() as QuoteResponse;
            
            return {
                bestBid: Number(quoteResponse.outAmount) / Number(quoteResponse.inAmount),
                bestAsk: (Number(quoteResponse.inAmount) / Number(quoteResponse.outAmount)) * (1 + Number(quoteResponse.priceImpactPct))
            };
        });
    }

    async executeTrade(
        inputMint: string,
        outputMint: string,
        amount: number,
        slippageBps: number = 50
    ): Promise<string | null> {
        return this.retryWithBackoff(async () => {
            console.log(`Executing trade: ${amount} ${inputMint} -> ${outputMint} (slippage: ${slippageBps} bps)`);
            
            try {
                // For SOL as input, we need to convert to lamports
                let amountInSmallestUnits = amount;
                if (inputMint === 'So11111111111111111111111111111111111111112') {
                    amountInSmallestUnits = amount * 1e9; // Convert SOL to lamports
                } else {
                    // Get token info to determine decimals
                    const tokenInfo = await this.getTokenInfo(inputMint);
                    if (tokenInfo && tokenInfo.decimals) {
                        amountInSmallestUnits = amount * Math.pow(10, tokenInfo.decimals);
                    }
                }
                
                console.log(`Amount in smallest units: ${amountInSmallestUnits}`);
                
                // 1. Get quote
                await this.waitForRateLimit();
                console.log(`Getting quote from Jupiter...`);
                const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.floor(amountInSmallestUnits)}&slippageBps=${slippageBps}`;
                console.log(`Quote URL: ${quoteUrl}`);
                
                const quoteResponse = await fetch(quoteUrl);
                
                if (!quoteResponse.ok) {
                    const errorText = await quoteResponse.text();
                    throw new Error(`Failed to get quote: ${quoteResponse.statusText} - ${errorText}`);
                }
                
                const quote = await quoteResponse.json();
                console.log(`Quote received: ${JSON.stringify(quote, null, 2).substring(0, 200)}...`);
                
                // 2. Get swap transaction
                await this.waitForRateLimit();
                console.log(`Getting swap transaction...`);
                const swapResponse = await fetch(`https://quote-api.jup.ag/v6/swap`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        quoteResponse: quote,
                        userPublicKey: this.walletService.getKeypair().publicKey.toString(),
                        wrapUnwrapSOL: true
                    })
                });
                
                if (!swapResponse.ok) {
                    const errorText = await swapResponse.text();
                    throw new Error(`Failed to get swap transaction: ${swapResponse.statusText} - ${errorText}`);
                }
                
                const swapResult = await swapResponse.json();
                
                // 3. Execute the transaction
                console.log(`Signing and sending transaction...`);
                const transactionBuffer = Buffer.from(swapResult.swapTransaction, 'base64');
                
                // Handle both versioned and legacy transactions
                let transaction;
                try {
                    // First try to deserialize as a versioned transaction
                    transaction = VersionedTransaction.deserialize(transactionBuffer);
                    console.log('Detected versioned transaction');
                    
                    // Add the signer
                    transaction.sign([this.walletService.getKeypair()]);
                    
                    // Send and confirm the transaction
                    const signature = await this.connection.sendTransaction(transaction);
                    console.log(`Transaction sent with signature: ${signature}`);
                    
                    // Wait for confirmation with timeout
                    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
                    const confirmation = await this.connection.confirmTransaction({
                        signature,
                        blockhash,
                        lastValidBlockHeight
                    }, 'confirmed');
                    
                    if (confirmation.value.err) {
                        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                    }
                    
                    console.log(`Trade executed successfully! Signature: ${signature}`);
                    return signature;
                } catch (error) {
                    // If it fails, try as a legacy transaction
                    console.log('Failed to process as versioned transaction, trying legacy format:', error);
                    transaction = Transaction.from(transactionBuffer);
                    
                    // Get a fresh blockhash
                    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
                    transaction.recentBlockhash = blockhash;
                    transaction.feePayer = this.walletService.getKeypair().publicKey;
                    
                    // Sign the transaction
                    transaction.sign(this.walletService.getKeypair());
                    
                    // Send and confirm the transaction
                    const signature = await this.connection.sendRawTransaction(transaction.serialize());
                    console.log(`Transaction sent with signature: ${signature}`);
                    
                    // Wait for confirmation with timeout
                    const confirmation = await this.connection.confirmTransaction({
                        signature,
                        blockhash,
                        lastValidBlockHeight
                    }, 'confirmed');
                    
                    if (confirmation.value.err) {
                        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                    }
                    
                    console.log(`Trade executed successfully! Signature: ${signature}`);
                    return signature;
                }
            } catch (error) {
                console.error(`Error in executeTrade:`, error);
                throw error;
            }
        });
    }

    private async getRaydiumPools(retries = 3): Promise<any[]> {
        try {
            // Check cache first
            if (this.poolCache && Date.now() - this.poolCache.timestamp < this.POOL_CACHE_TTL) {
                console.log('Using cached pool data');
                return this.poolCache.data;
            }

            const response = await fetch('https://api.raydium.io/v2/main/pairs', {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Raydium API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const pools = data
                .filter((pool: any) => pool && pool.liquidity && !isNaN(parseFloat(pool.liquidity)))
                .map((pool: any) => ({
                    id: pool.ammId,
                    baseMint: pool.baseMint,
                    quoteMint: pool.quoteMint,
                    baseSymbol: pool.baseSymbol,
                    quoteSymbol: pool.quoteSymbol,
                    liquidity: parseFloat(pool.liquidity),
                    volume24h: parseFloat(pool.volume24h || '0'),
                    price: parseFloat(pool.price || '0')
                }));

            // Update cache
            this.poolCache = {
                data: pools,
                timestamp: Date.now()
            };

            return pools;
        } catch (error) {
            console.error('Error fetching Raydium pools:', error);
            if (retries > 0) {
                console.log(`Retrying Raydium pools fetch (${retries} attempts remaining)...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.getRaydiumPools(retries - 1);
            }
            return this.getFallbackPools();
        }
    }

    private async getJupiterPrice(tokenMint: string): Promise<number | null> {
        const jupiterEndpoints = [
            'https://api.jup.ag/v4',
            'https://price.jup.ag/v4',
            'https://quote-api.jup.ag/v6',
            'https://jupiter.rpcpool.com/price/v4',
            'https://jupiter-api.rpcpool.com/v4'
        ];

        try {
            // Try each endpoint in sequence
            for (const baseEndpoint of jupiterEndpoints) {
                try {
                    console.log(`Trying Jupiter endpoint: ${baseEndpoint}`);
                    
                    if (baseEndpoint.includes('quote-api')) {
                        // Use quote endpoint format
                        const response = await fetch(`${baseEndpoint}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenMint}&amount=1000000000&slippageBps=50`);
                        if (response.ok) {
                            const data = await response.json();
                            return data.outAmount / 1000000000; // Convert to SOL price
                        }
                    } else {
                        // Use price endpoint format
                        const response = await fetch(`${baseEndpoint}/price?ids=${tokenMint}&vsToken=So11111111111111111111111111111111111111112`);
                        if (response.ok) {
                            const data = await response.json();
                            const price = data.data?.[tokenMint]?.price;
                            if (price) return price;
                        }
                    }
                } catch (endpointError) {
                    console.warn(`Failed to fetch from ${baseEndpoint}:`, endpointError);
                    continue; // Try next endpoint
                }
            }

            console.log('All Jupiter endpoints failed, trying Raydium pools...');

            // If all Jupiter endpoints fail, try Raydium pools
            const pools = await this.getRaydiumPools();
            const tokenPools = pools.filter(pool => 
                pool.baseMint === tokenMint || pool.quoteMint === tokenMint
            );

            if (tokenPools.length > 0) {
                let totalLiquidity = 0;
                let totalValue = 0;
                
                for (const pool of tokenPools) {
                    const poolLiquidity = parseFloat(pool.liquidity || '0');
                    if (poolLiquidity > 0) {
                        totalLiquidity += poolLiquidity;
                        const poolPrice = parseFloat(pool.price || '0');
                        if (poolPrice > 0) {
                            totalValue += poolLiquidity * (pool.baseMint === tokenMint ? poolPrice : 1/poolPrice);
                        }
                    }
                }

                if (totalLiquidity > 0 && totalValue > 0) {
                    return totalValue / totalLiquidity;
                }
            }

            // If all methods fail, try one last time with Birdeye if available
            if (process.env.BIRDEYE_API_KEY) {
                try {
                    const response = await fetch(
                        `https://public-api.birdeye.so/public/price?address=${tokenMint}`,
                        { headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY } }
                    );
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data?.value > 0) {
                            return data.data.value;
                        }
                    }
                } catch (error) {
                    // Ignore Birdeye errors
                }
            }
            
            return null;
        } catch (error) {
            console.warn(`Error fetching price for ${tokenMint}:`, error);
            return null;
        }
    }

    private async getJupiterVolume(tokenMint: string): Promise<number | null> {
        try {
            const response = await fetch(`https://stats.jup.ag/api/token/${tokenMint}`);
            if (!response.ok) {
                throw new Error(`Jupiter API returned ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.volume24h || null;
        } catch (error) {
            console.error('Error fetching Jupiter volume:', error);
            return null;
        }
    }

    private cacheTokenAge(tokenMint: string, age: number): void {
        console.log(`Caching age ${age.toFixed(2)} days for token ${tokenMint}`);
        this.tokenAgeCache.set(tokenMint, {
            age,
            timestamp: Date.now()
        });
        console.log(`Cache size: ${this.tokenAgeCache.size} entries`);
    }

    private trackHeliusApiHit(): void {
        this.heliusApiHits++;
        console.log(`Helius API hits today: ${this.heliusApiHits}`);
        
        // Reset counter every 24 hours
        if (this.heliusApiHits === 1) {
            setTimeout(() => {
                this.heliusApiHits = 0;
                console.log('Helius API hit counter reset');
            }, this.HELIUS_API_HITS_RESET_INTERVAL);
        }
    }

    /**
     * Get token age in days using the most efficient method available
     */
    public async getTokenAge(tokenMint: string): Promise<number> {
        // Check cache first
        if (this.tokenAgeCache.has(tokenMint)) {
            const cacheEntry = this.tokenAgeCache.get(tokenMint);
            return cacheEntry?.age || 0;
        }
        
        try {
            // For new tokens, use direct blockchain lookup
            const mintPubkey = new PublicKey(tokenMint);
            const signatures = await this.connection.getSignaturesForAddress(
                mintPubkey,
                { limit: 1 },
                'confirmed'
            );
            
            if (signatures.length === 0) {
                return 0;
            }
            
            // Get age from oldest transaction
            const oldestTx = signatures[signatures.length - 1];
            if (!oldestTx.blockTime) {
                return 0;
            }
            
            const now = Date.now() / 1000;
            const ageInDays = (now - oldestTx.blockTime) / (24 * 60 * 60);
            
            // Cache the result
            this.cacheTokenAge(tokenMint, ageInDays);
            
            return ageInDays;
        } catch (error) {
            console.warn(`Error getting token age for ${tokenMint}:`, error);
            return 0;
        }
    }

    public async getTokenMetrics(mintAddress: string): Promise<TokenMetrics> {
        try {
            console.log(`🔍 Fetching metrics for token: ${mintAddress}`);
            
            // Try Birdeye first
            try {
                const birdeyeData = await this.getBirdeyeData(mintAddress);
                if (birdeyeData) {
                    console.log(`✅ Successfully fetched Birdeye metrics for ${mintAddress}`);
                    return birdeyeData;
                }
            } catch (error) {
                console.log(`⚠️ Birdeye fetch failed for ${mintAddress}:`, error instanceof Error ? error.message : 'Unknown error');
            }

            // Fallback to Raydium
            try {
                const raydiumData = await this.getRaydiumData(mintAddress);
                if (raydiumData) {
                    console.log(`✅ Successfully fetched Raydium metrics for ${mintAddress}`);
                    return raydiumData;
                }
            } catch (error) {
                console.log(`⚠️ Raydium fetch failed for ${mintAddress}:`, error instanceof Error ? error.message : 'Unknown error');
            }

            // Final fallback to Jupiter
            try {
                const jupiterData = await this.getJupiterData(mintAddress);
                if (jupiterData) {
                    console.log(`✅ Successfully fetched Jupiter metrics for ${mintAddress}`);
                    return jupiterData;
                }
            } catch (error) {
                console.log(`⚠️ Jupiter fetch failed for ${mintAddress}:`, error instanceof Error ? error.message : 'Unknown error');
            }

            console.log(`❌ All metric fetch attempts failed for ${mintAddress}`);
            return {
                price: 0,
                volume24h: 0,
                liquidity: 0,
                marketCap: 0,
                holders: 0,
                priceChange24h: 0
            };
        } catch (error) {
            console.error(`❌ Error fetching metrics for ${mintAddress}:`, error);
            throw error;
        }
    }

    public async getTokenHolders(mintAddress: string): Promise<{ count: number; holders: { address: string; amount: number; }[] }> {
        try {
            const response = await fetch(`https://public-api.solscan.io/token/holders?tokenAddress=${mintAddress}&limit=100`, {
                headers: {
                    'Accept': 'application/json',
                    'token': process.env.SOLSCAN_API_KEY || ''
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch token holders: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                count: data.total || 0,
                holders: data.data || []
            };
        } catch (error) {
            console.error('Error fetching token holders:', error);
            return { count: 0, holders: [] };
        }
    }

    private async getBirdeyeData(tokenAddress: string): Promise<TokenMetrics | null> {
        if (!process.env.BIRDEYE_API_KEY) return null;
        
        try {
            const [priceResponse, volumeResponse] = await Promise.all([
                fetch(`https://public-api.birdeye.so/public/price?address=${tokenAddress}`, {
                    headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY }
                }),
                fetch(`https://public-api.birdeye.so/public/token_volume?address=${tokenAddress}`, {
                    headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY }
                })
            ]);

            if (!priceResponse.ok || !volumeResponse.ok) return null;

            const [priceData, volumeData] = await Promise.all([
                priceResponse.json(),
                volumeResponse.json()
            ]);

            if (!priceData.success || !volumeData.success) return null;

            return {
                price: priceData.data?.value || 0,
                volume24h: volumeData.data?.volume24h || 0,
                liquidity: 0, // Will be set by caller
                marketCap: priceData.data?.marketCap || 0,
                priceChange24h: priceData.data?.priceChange24h || 0,
                holders: 0  // Default to 0, will be updated by caller
            };
        } catch (error) {
            console.error(`Error getting Birdeye data for ${tokenAddress}:`, error);
            return null;
        }
    }

    private async getRaydiumData(tokenAddress: string): Promise<TokenMetrics | null> {
        try {
            const pools = await this.getRaydiumPools();
            const tokenPools = pools.filter(pool => 
                pool.baseMint === tokenAddress || pool.quoteMint === tokenAddress
            );

            if (tokenPools.length === 0) return null;

            let totalLiquidity = 0;
            let totalValue = 0;
            let totalVolume = 0;
            
            for (const pool of tokenPools) {
                const poolLiquidity = parseFloat(pool.liquidity || '0');
                if (poolLiquidity > 0) {
                    totalLiquidity += poolLiquidity;
                    const poolPrice = parseFloat(pool.price || '0');
                    if (poolPrice > 0) {
                        totalValue += poolLiquidity * (pool.baseMint === tokenAddress ? poolPrice : 1/poolPrice);
                    }
                    const poolVolume = parseFloat(pool.volume24h || '0');
                    if (poolVolume > 0) {
                        totalVolume += poolVolume;
                    }
                }
            }

            if (totalLiquidity === 0) return null;

            return {
                price: totalValue / totalLiquidity,
                volume24h: totalVolume,
                liquidity: totalLiquidity,
                marketCap: 0, // Not available from Raydium
                priceChange24h: 0, // Not available from Raydium
                holders: 0  // Default to 0, will be updated by caller
            };
        } catch (error) {
            console.error(`Error getting Raydium data for ${tokenAddress}:`, error);
            return null;
        }
    }

    private async getJupiterData(tokenAddress: string): Promise<TokenMetrics | null> {
        try {
            const [price, volume] = await Promise.all([
                this.getJupiterPrice(tokenAddress),
                this.getJupiterVolume(tokenAddress)
            ]);

            if (!price && !volume) return null;

            return {
                price: price || 0,
                volume24h: volume || 0,
                liquidity: 0, // Will be set by caller
                marketCap: 0, // Not available from Jupiter
                priceChange24h: 0, // Not available from Jupiter
                holders: 0  // Default to 0, will be updated by caller
            };
        } catch (error) {
            console.error(`Error getting Jupiter data for ${tokenAddress}:`, error);
            return null;
        }
    }

    private calculateTokenScore(metrics: TokenMetrics, holders: TokenHolder[]): number {
        let score = 0;
        
        // Price stability (lower volatility is better)
        const priceStability = Math.max(0, 1 - Math.abs(metrics.priceChange24h) / 100);
        score += priceStability * 0.2;
        
        // Volume relative to liquidity (higher is better)
        const volumeLiquidityRatio = metrics.volume24h / (metrics.liquidity || 1);
        score += Math.min(1, volumeLiquidityRatio) * 0.2;
        
        // Liquidity score (higher is better)
        const liquidityScore = Math.min(1, metrics.liquidity / 1000000);
        score += liquidityScore * 0.2;
        
        // Holder distribution (more holders is better)
        const holderScore = Math.min(1, holders.length / 1000);
        score += holderScore * 0.2;
        
        // Age score (older is better)
        const ageScore = metrics.age ? Math.min(1, metrics.age / 30) : 0;
        score += ageScore * 0.2;
        
        return score;
    }

    public async getTokenLiquidity(tokenAddress: string): Promise<number> {
        try {
            // Try Jupiter API first
            const jupiterPrice = await this.getJupiterPrice(tokenAddress);
            if (jupiterPrice && jupiterPrice > 0) {
                const jupiterVolume = await this.getJupiterVolume(tokenAddress);
                if (jupiterVolume && jupiterVolume > 0) {
                    // If we have both price and volume from Jupiter, estimate liquidity
                    const estimatedLiquidity = jupiterVolume / (jupiterPrice * 2);
                    console.log(`Estimated liquidity from Jupiter for ${tokenAddress}: ${estimatedLiquidity} SOL`);
                    return estimatedLiquidity;
                }
            }

            // Try Raydium pools as fallback
            const pools = await this.getRaydiumPools(3); // Reduced retries for faster checks
            const tokenPools = pools.filter(pool => 
                pool.baseMint === tokenAddress || pool.quoteMint === tokenAddress
            );

            if (tokenPools.length > 0) {
                const totalLiquidity = tokenPools.reduce((sum, pool) => sum + (pool.liquidity || 0), 0);
                console.log(`Found ${tokenPools.length} Raydium pools for ${tokenAddress} with total liquidity: ${totalLiquidity} SOL`);
                return totalLiquidity;
            }

            // If no liquidity found, return 0
            console.log(`No liquidity found for token ${tokenAddress}`);
            return 0;
        } catch (error) {
            console.error('Error checking token liquidity:', error);
            return 0;
        }
    }

    public async getTokenPrice(tokenAddress: string): Promise<number> {
        return this.enqueueRequest(async () => {
            try {
                // Try Jupiter API first
                try {
                    const jupiterResponse = await fetch(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
                    if (jupiterResponse.ok) {
                        const data = await jupiterResponse.json();
                        const price = data.data[tokenAddress]?.price;
                        if (price && price > 0) {
                            console.log(`Found price from Jupiter: $${price.toFixed(6)}`);
                            return price;
                        }
                    }
                } catch (error) {
                    console.warn('Jupiter API failed:', error);
                }

                // Try Raydium pools for price estimation
                try {
                    const pools = await this.getRaydiumPools();
                    const tokenPools = pools.filter(pool => 
                        pool.baseMint === tokenAddress || pool.quoteMint === tokenAddress
                    );

                    if (tokenPools.length > 0) {
                        let totalLiquidity = 0;
                        let totalValue = 0;
                        
                        for (const pool of tokenPools) {
                            const poolLiquidity = parseFloat(pool.liquidity || pool.tvl || '0');
                            if (poolLiquidity > 0) {
                                totalLiquidity += poolLiquidity;
                                const price = parseFloat(pool.price || pool.price || '0');
                                if (price > 0) {
                                    totalValue += poolLiquidity * (pool.baseMint === tokenAddress ? price : 1/price);
                                }
                            }
                        }

                        if (totalLiquidity > 0 && totalValue > 0) {
                            const estimatedPrice = totalValue / totalLiquidity;
                            console.log(`Found price from Raydium: $${estimatedPrice.toFixed(6)}`);
                            return estimatedPrice;
                        }
                    }
                } catch (error) {
                    console.warn('Raydium price check failed:', error);
                }

                // Try Birdeye API if available
                if (process.env.BIRDEYE_API_KEY) {
                    try {
                        const birdeyeResponse = await fetch(
                            `https://public-api.birdeye.so/public/price?address=${tokenAddress}`,
                            { headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY } }
                        );
                        if (birdeyeResponse.ok) {
                            const data = await birdeyeResponse.json();
                            if (data.success && data.data?.value > 0) {
                                console.log(`Found price from Birdeye: $${data.data.value.toFixed(6)}`);
                                return data.data.value;
                            }
                        }
                    } catch (error) {
                        console.warn('Birdeye API failed:', error);
                    }
                }

                return 0;
            } catch (error) {
                console.warn('Error getting token price:', error);
                return 0;
            }
        });
    }

    async getTokenBalance(tokenAddress: string): Promise<number> {
        try {
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                this.walletService.getKeypair().publicKey,
                { mint: new PublicKey(tokenAddress) }
            );

            if (tokenAccounts.value.length === 0) {
                return 0;
            }

            return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        } catch (error) {
            console.error('Error getting token balance:', error);
            throw error;
        }
    }

    /**
     * Get all tokens owned by the wallet with non-zero balances
     * @returns Array of token information including address, balance and metadata
     */
    async getAllWalletTokens(): Promise<Array<{
        address: string;
        balance: number;
        info: TokenInfo | null;
    }>> {
        try {
            console.log('Fetching all token balances for wallet...');
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                this.walletService.getKeypair().publicKey,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );
            
            const result = [];
            
            for (const account of tokenAccounts.value) {
                const parsedInfo = account.account.data.parsed.info;
                const tokenAddress = parsedInfo.mint;
                const balance = parsedInfo.tokenAmount.uiAmount;
                
                // Skip tokens with zero balance
                if (balance === 0) continue;
                
                // Get token metadata if possible
                let tokenInfo = null;
                try {
                    tokenInfo = await this.getTokenInfo(tokenAddress);
                } catch (error) {
                    console.warn(`Could not fetch token info for ${tokenAddress}`);
                }
                
                result.push({
                    address: tokenAddress,
                    balance,
                    info: tokenInfo
                });
            }
            
            console.log(`Found ${result.length} tokens with non-zero balances in wallet`);
            return result;
        } catch (error) {
            console.error('Error getting all wallet tokens:', error);
            return [];
        }
    }

    public async getTokenInfo(tokenMint: string): Promise<TokenInfo | null> {
        try {
            await this.waitForRateLimit();
            
            // Try Jupiter API first
            try {
                const response = await fetch('https://token.jup.ag/all');
                if (response.ok) {
                    const tokens = await response.json() as TokenInfo[];
                    const tokenInfo = tokens.find(token => token.address === tokenMint);
                    if (tokenInfo) return tokenInfo;
                }
            } catch (error) {
                console.warn('Jupiter API failed:', error);
            }

            // Try Raydium pools for basic info
            try {
                const pools = await this.getRaydiumPools();
                const pool = pools.find(p => p.baseMint === tokenMint || p.quoteMint === tokenMint);
                if (pool) {
                    const symbol = pool.baseSymbol || pool.quoteSymbol || 'Unknown';
                    const name = pool.baseName || pool.quoteName || symbol;
                    return {
                        address: tokenMint,
                        chainId: 101, // Solana mainnet
                        decimals: 9, // Default for most Solana tokens
                        name,
                        symbol,
                        holders: 0
                    };
                }
            } catch (error) {
                console.warn('Raydium pools check failed:', error);
            }

            // Try Solscan API as backup
            try {
                const solscanResponse = await fetch(`https://public-api.solscan.io/token/meta?tokenAddress=${tokenMint}`);
                if (solscanResponse.ok) {
                    const data = await solscanResponse.json();
                    if (data.symbol && data.name) {
                        return {
                            address: tokenMint,
                            chainId: 101,
                            decimals: data.decimals || 9,
                            name: data.name,
                            symbol: data.symbol,
                            holders: 0
                        };
                    }
                }
            } catch (error) {
                console.warn('Solscan API failed:', error);
            }

            // Try Birdeye API as last resort
            if (process.env.BIRDEYE_API_KEY) {
                try {
                    const birdeyeResponse = await fetch(
                        `https://public-api.birdeye.so/public/token_metadata?address=${tokenMint}`,
                        { headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY } }
                    );
                    if (birdeyeResponse.ok) {
                        const data = await birdeyeResponse.json();
                        if (data.success && data.data?.symbol) {
                            return {
                                address: tokenMint,
                                chainId: 101,
                                decimals: data.data.decimals || 9,
                                name: data.data.name || data.data.symbol,
                                symbol: data.data.symbol,
                                holders: 0
                            };
                        }
                    }
                } catch (error) {
                    console.warn('Birdeye API failed:', error);
                }
            }

            console.warn(`Could not get token info for ${tokenMint} from any source`);
            return null;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error(`Error getting token info for ${tokenMint}:`, error.message);
            } else {
                console.error(`Unknown error getting token info for ${tokenMint}`);
            }
            return null;
        }
    }

    public async getQuote(inputMint: string, outputMint: string, amount: number): Promise<QuoteResponse | null> {
        const quoteEndpoints = [
            'https://quote-api.jup.ag/v6',
            'https://jupiter.rpcpool.com/quote/v6',
            'https://quote.jup.ag/v6'
        ];

        return this.retryWithBackoff(async () => {
            await this.waitForRateLimit();

            // Try each endpoint in sequence
            for (const endpoint of quoteEndpoints) {
                try {
                    const response = await fetch(`${endpoint}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`);
                    if (response.ok) {
                        return await response.json() as QuoteResponse;
                    }
                } catch (endpointError) {
                    continue; // Try next endpoint
                }
            }

            return null; // No quote available from any endpoint
        });
    }

    public async getAllTokens(): Promise<TokenInfo[]> {
        return this.retryWithBackoff(async () => {
            await this.waitForRateLimit();
            const response = await fetch('https://token.jup.ag/all');
            if (!response.ok) {
                throw new Error('Failed to fetch tokens from Jupiter');
            }
            return await response.json() as TokenInfo[];
        });
    }

    private isValidToken(tokenInfo: TokenInfo | null, metrics: {
        liquidity: number;
        price: number;
        volume24h: number;
        age: number;
    }): boolean {
        if (!tokenInfo) {
            console.log('Invalid token: No token info available');
            return false;
        }

        // Basic token validation
        if (!tokenInfo.symbol || !tokenInfo.name || !tokenInfo.address) {
            console.log('Invalid token: Missing basic info');
            return false;
        }

        // Filter out suspicious token names
        const suspiciousKeywords = ['test', 'scam', 'fake', 'pump', 'dump'];
        if (suspiciousKeywords.some(keyword => 
            tokenInfo.name.toLowerCase().includes(keyword) || 
            tokenInfo.symbol.toLowerCase().includes(keyword))) {
            console.log('Invalid token: Suspicious name or symbol');
            return false;
        }

        // Liquidity validation
        if (metrics.liquidity <= 0) {
            console.log('Invalid token: No liquidity');
            return false;
        }
        if (metrics.liquidity > 1000000) {
            console.log('Invalid token: Suspiciously high liquidity');
            return false;
        }

        // Price validation
        if (metrics.price <= 0) {
            console.log('Invalid token: Invalid price');
            return false;
        }
        if (metrics.price > 10000) {
            console.log('Invalid token: Suspiciously high price');
            return false;
        }

        // Volume validation
        if (metrics.volume24h <= 0) {
            console.log('Invalid token: No trading volume');
            return false;
        }
        if (metrics.volume24h > metrics.liquidity * 100) {
            console.log('Invalid token: Suspicious volume/liquidity ratio');
            return false;
        }

        // Age validation
        if (metrics.age <= 0) {
            console.log('Invalid token: Could not determine age');
            return false;
        }
        if (metrics.age > 30) {
            console.log('Invalid token: Too old');
            return false;
        }

        return true;
    }

    private async getTokenVolume24h(tokenAddress: string): Promise<number> {
        try {
            // Try Jupiter API first
            try {
                const jupiterResponse = await fetch(`https://stats.jup.ag/api/token/${tokenAddress}`);
                if (jupiterResponse.ok) {
                    const data = await jupiterResponse.json();
                    if (data.volume24h && data.volume24h > 0) {
                        console.log(`Found volume from Jupiter: $${data.volume24h.toFixed(2)}`);
                        return data.volume24h;
                    }
                }
            } catch (error) {
                console.warn('Jupiter API failed:', error);
            }

            // Try Raydium pools for volume estimation
            try {
                const pools = await this.getRaydiumPools();
                const tokenPools = pools.filter(pool => 
                    pool.baseMint === tokenAddress || pool.quoteMint === tokenAddress
                );

                if (tokenPools.length > 0) {
                    let totalVolume = 0;
                    for (const pool of tokenPools) {
                        const volume = parseFloat(pool.volume24h || pool.tvl || '0');
                        if (volume > 0) {
                            totalVolume += volume;
                        }
                    }

                    if (totalVolume > 0) {
                        console.log(`Found volume from Raydium: $${totalVolume.toFixed(2)}`);
                        return totalVolume;
                    }
                }
            } catch (error) {
                console.warn('Raydium volume check failed:', error);
            }

            // Try Birdeye API as backup
            if (process.env.BIRDEYE_API_KEY) {
                try {
                    const birdeyeResponse = await fetch(
                        `https://public-api.birdeye.so/public/token_volume?address=${tokenAddress}`,
                        { headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY } }
                    );
                    if (birdeyeResponse.ok) {
                        const data = await birdeyeResponse.json();
                        if (data.success && data.data?.volume24h > 0) {
                            console.log(`Found volume from Birdeye: $${data.data.volume24h.toFixed(2)}`);
                            return data.data.volume24h;
                        }
                    }
                } catch (error) {
                    console.warn('Birdeye API failed:', error);
                }
            }

            return 0;
        } catch (error) {
            console.warn('Error getting token volume:', error);
            return 0;
        }
    }

    public async findSnipeTargets(): Promise<string[]> {
        try {
            console.log('\n🔍 Starting token discovery process...');
            console.log('Fetching Raydium pools...');
            
            const pools = await this.getRaydiumPools();
            console.log(`Found ${pools.length} total pools to analyze`);
            
            let totalPoolsChecked = 0;
            let poolsWithLiquidity = 0;
            let errorCount = 0;
            const maxErrors = 5;
            const targets: string[] = [];
            
            // Initialize set of known tokens to skip
            const knownTokens = new Set<string>();
            
            // First pass: quick filtering and scoring with more lenient criteria
            console.log('\n=== Initial Pool Filtering ===');
            const potentialTargets = pools
                .filter(pool => {
                    totalPoolsChecked++;
                    if (!pool || !pool.baseMint) {
                        console.log(`❌ Pool ${pool?.id || 'unknown'} skipped: Missing baseMint`);
                        return false;
                    }
                    if (knownTokens.has(pool.baseMint)) {
                        console.log(`ℹ️ Pool ${pool.id} skipped: Known token`);
                        return false;
                    }
                    knownTokens.add(pool.baseMint); // Add to known tokens
                    
                    const liquidity = parseFloat(pool.liquidity || pool.tvl || '0');
                    if (isNaN(liquidity)) {
                        console.log(`❌ Pool ${pool.id} skipped: Invalid liquidity value`);
                        return false;
                    }
                    // More lenient liquidity filtering
                    if (liquidity >= 100) {
                        poolsWithLiquidity++;
                        console.log(`✅ Pool ${pool.id} passed liquidity check: ${liquidity} SOL`);
                        return true;
                    }
                    console.log(`❌ Pool ${pool.id} skipped: Insufficient liquidity (${liquidity} SOL)`);
                    return false;
                })
                .map(pool => {
                    const score = this.calculateQuickScore(
                        parseFloat(pool.liquidity || pool.tvl || '0'),
                        parseFloat(pool.volume24h || '0'),
                        parseFloat(pool.price || '0'),
                        parseFloat(pool.poolCount || '1')
                    );
                    console.log(`📊 Pool ${pool.id} score: ${score.toFixed(2)}`);
                    return {
                        tokenMint: pool.baseMint,
                        liquidity: parseFloat(pool.liquidity || pool.tvl || '0'),
                        score
                    };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 50); // Limit to top 50 tokens
                
            console.log(`\n=== Filtering Statistics ===`);
            console.log(`Total pools checked: ${totalPoolsChecked}`);
            console.log(`Pools with sufficient liquidity: ${poolsWithLiquidity}`);
            console.log(`Found ${potentialTargets.length} high-scoring tokens to analyze\n`);
            
            // Second pass: detailed analysis
            console.log('\n=== Detailed Token Analysis ===');
            const BATCH_SIZE = 5;
            const validTokens = [];
            
            for (let i = 0; i < potentialTargets.length; i += BATCH_SIZE) {
                const batch = potentialTargets.slice(i, i + BATCH_SIZE);
                console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE + 1)}/${Math.ceil(potentialTargets.length / BATCH_SIZE)}...`);
                
                const batchResults = await Promise.all(batch.map(async (target) => {
                    try {
                        console.log(`\n🔍 Analyzing token: ${target.tokenMint}`);
                        
                        // Get metrics in parallel
                        const [metrics, holders] = await Promise.all([
                            this.getTokenMetrics(target.tokenMint),
                            this.getTokenHolders(target.tokenMint)
                        ]);
                        
                        if (!metrics) {
                            console.log(`❌ Failed to get metrics for token ${target.tokenMint}`);
                            return null;
                        }
                        
                        console.log(`📊 Token metrics:`);
                        console.log(`- Volume 24h: ${metrics.volume24h}`);
                        console.log(`- Holders: ${holders}`);
                        console.log(`- Age: ${metrics.age} seconds`);
                        
                        // More lenient validation checks
                        if (metrics.volume24h < 5000) {
                            console.log(`❌ Token ${target.tokenMint} has insufficient volume (${metrics.volume24h})`);
                            return null;
                        }
                        
                        const holderInfo = await this.getTokenHolders(target.tokenMint);
                        if (holderInfo.count < 50) {
                            console.log(`❌ Token ${target.tokenMint} has insufficient holders (${holderInfo.count})`);
                            return null;
                        }
                        
                        const tokenAge = metrics.age || 0;
                        if (tokenAge < 12 * 60 * 60) {
                            console.log(`❌ Token ${target.tokenMint} is too new (${tokenAge} seconds)`);
                            return null;
                        }
                        
                        console.log(`✅ Token ${target.tokenMint} passed all validation checks`);
                        return target.tokenMint;
                    } catch (error) {
                        errorCount++;
                        console.error(`❌ Error processing token ${target.tokenMint}:`, error);
                        
                        if (errorCount >= maxErrors) {
                            console.error('⚠️ Too many errors encountered, stopping discovery process');
                            throw new Error('Too many errors encountered');
                        }
                        
                        // Wait a bit before continuing
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        return null;
                    }
                }));
                
                // Filter out null results and add to valid tokens
                const validBatchResults = batchResults.filter(result => result !== null);
                validTokens.push(...validBatchResults);
                
                // Add delay between batches
                if (i + BATCH_SIZE < potentialTargets.length) {
                    console.log('\nWaiting before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`\n=== Discovery Complete ===`);
            console.log(`Found ${validTokens.length} valid tokens out of ${potentialTargets.length} potential targets`);
            return validTokens;
            
        } catch (error) {
            console.error('❌ Error in findSnipeTargets:', error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : error);
            return [];
        }
    }

    private calculateQuickScore(liquidity: number, volume24h: number, price: number, poolCount: number): number {
        // Normalize values
        const normalizedLiquidity = Math.log10(liquidity + 1);
        const normalizedVolume = Math.log10(volume24h + 1);
        const normalizedPrice = Math.log10(price + 1);
        
        // Weights for different factors
        const liquidityWeight = 0.4;
        const volumeWeight = 0.3;
        const priceWeight = 0.2;
        const poolCountWeight = 0.1;
        
        // Calculate score
        return (
            normalizedLiquidity * liquidityWeight +
            normalizedVolume * volumeWeight +
            normalizedPrice * priceWeight +
            Math.log10(poolCount + 1) * poolCountWeight
        );
    }

    private getFallbackPools(): any[] {
        return [
            {
                id: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
                baseMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
                quoteMint: "So11111111111111111111111111111111111111112",  // SOL
                liquidity: 50000
            },
            {
                id: "6UmmUiYoBEWsRtnusSNGBKnRQAm26RrPcryQ7tH3sBXf",
                baseMint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
                quoteMint: "So11111111111111111111111111111111111111112",  // SOL
                liquidity: 40000
            }
        ];
    }

    private async validateToken(mintAddress: string): Promise<boolean> {
        try {
            console.log(`\n🔍 Validating token: ${mintAddress}`);
            
            // Get token metrics
            const metrics = await this.getTokenMetrics(mintAddress);
            console.log('📊 Token metrics:', {
                price: metrics.price,
                volume24h: metrics.volume24h,
                liquidity: metrics.liquidity,
                marketCap: metrics.marketCap,
                holders: metrics.holders,
                priceChange24h: metrics.priceChange24h
            });

            // Check if token has liquidity
            if (metrics.liquidity <= 0) {
                console.log('❌ Token has no liquidity');
                return false;
            }

            // Get holder information
            const holderInfo = await this.getTokenHolders(mintAddress);
            
            // Check if token has holders
            if (holderInfo.count < 50) {
                console.log('❌ Token has too few holders');
                return false;
            }

            console.log('✅ Token validation passed');
            return true;
        } catch (error) {
            console.error('❌ Error validating token:', error);
            return false;
        }
    }
} 