import { Connection, PublicKey, Commitment, Finality } from '@solana/web3.js';
import { DexService } from './dex';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { WalletService } from './wallet';

dotenv.config();

interface TokenData {
  address: string;
  symbol: string;
  name: string;
}

interface BirdeyeToken {
  address: string;
  symbol: string;
  name: string;
}

// Add interface for raw API response token data
interface BirdeyeApiResponse {
  data: {
    tokens: Array<{
      address?: string;
      symbol?: string;
      name?: string;
      [key: string]: any;
    }>;
  };
}

// Add this interface at the file level
interface TokenResult {
  address: string;
  symbol: string;
  name: string;
}

export class PumpTokenDiscovery {
  private connection: Connection;
  private dexService: DexService;
  private isScanning: boolean = false;
  private scanInterval: number = 5000; // 5 seconds
  private minLiquidityThreshold: number;
  private readonly EXCLUDED_TOKENS: Set<string>;
  private knownTokensCache: Set<string>;
  private readonly TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  private readonly CACHE_FILE_PATH = path.join(process.cwd(), '.cache/pump_tokens.json');
  private readonly BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';
  
  // Token age filtering parameters
  private readonly MIN_TOKEN_AGE_HOURS = Number(process.env.MIN_TOKEN_AGE_HOURS || '24'); // Minimum age in hours (default 24h)
  private readonly MAX_TOKEN_AGE_HOURS = Number(process.env.MAX_TOKEN_AGE_HOURS || '72'); // Maximum age in hours (default 72h)
  
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    const walletService = new WalletService();
    this.dexService = new DexService(this.connection, walletService);
    this.minLiquidityThreshold = parseFloat(process.env.MIN_LIQUIDITY_THRESHOLD || '5');
    this.EXCLUDED_TOKENS = new Set([
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
    ]);
    this.knownTokensCache = new Set();
    this.loadCache();
  }
  
  private loadCache(): void {
    try {
      if (!fs.existsSync(path.dirname(this.CACHE_FILE_PATH))) {
        fs.mkdirSync(path.dirname(this.CACHE_FILE_PATH), { recursive: true });
      }
      
      if (fs.existsSync(this.CACHE_FILE_PATH)) {
        const cache = JSON.parse(fs.readFileSync(this.CACHE_FILE_PATH, 'utf8'));
        this.knownTokensCache = new Set(cache.tokens || []);
        console.log(`Loaded ${this.knownTokensCache.size} known pump tokens`);
      } else {
        console.log('No pump token cache found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading token cache:', error);
      this.knownTokensCache = new Set();
    }
  }
  
  private saveCache(): void {
    try {
      fs.writeFileSync(
        this.CACHE_FILE_PATH,
        JSON.stringify({
          tokens: Array.from(this.knownTokensCache),
          lastUpdate: new Date().toISOString()
        }, null, 2)
      );
    } catch (error) {
      console.error('Error saving pump token cache:', error);
    }
  }
  
  public async startMonitoring(callback: (newToken: string) => Promise<void>): Promise<void> {
    if (this.isScanning) {
      console.log('Already monitoring for new pump tokens');
      return;
    }
    
    this.isScanning = true;
    console.log('🔍 Starting pump token monitoring...');
    
    // Use multiple sources to find new tokens
    let lastCheckTime = Date.now();
    
    const scanForTokens = async () => {
      if (!this.isScanning) return;
      
      try {
        // Method 1: Check Jupiter token list (good for established tokens)
        const jupiterTokens = await this.checkJupiterTokens();
        
        // Method 2: Check pump.fun API for latest tokens (direct source)
        const pumpFunTokens = await this.checkPumpFunTokens();
        
        // Method 3: Check Birdeye for newest tokens (if API key is available)
        const birdeyeTokens = await this.checkBirdeyeTokens();
        
        // Combine results from all sources
        const allNewTokens = [...jupiterTokens, ...pumpFunTokens, ...birdeyeTokens];
        
        // Process new tokens
        for (const token of allNewTokens) {
          // Add to known tokens cache
          this.knownTokensCache.add(token.address);
          
          try {
            // Quick validation to ensure it's a real token
            const isValid = await this.quickValidateToken(token.address);
            
            if (isValid) {
              console.log(`🔔 New token detected: ${token.address} (${token.symbol} - ${token.name})`);
              // Call the callback with the new token
              await callback(token.address);
            }
          } catch (tokenError) {
            console.warn(`Error validating token ${token.address}:`, tokenError);
          }
        }
        
        // Schedule next scan
        setTimeout(scanForTokens, this.scanInterval);
      } catch (error) {
        console.error('Error monitoring pump tokens:', error);
        // Continue monitoring despite errors
        setTimeout(scanForTokens, 5000);
      }
    };
    
    // Start the scanning process
    scanForTokens();
  }
  
  private async checkJupiterTokens(): Promise<Array<{address: string, symbol: string, name: string}>> {
    try {
      // Use Jupiter token list which is regularly updated
      const response = await fetch('https://token.jup.ag/all');
      const allTokens = await response.json() as Array<{address: string, symbol: string, name: string}>;
      
      console.log(`Fetched ${allTokens.length} tokens from Jupiter`);
      
      // Filter new tokens
      const recentTokens = allTokens.filter(token => {
        // Skip tokens we've already processed
        if (this.knownTokensCache.has(token.address)) {
          return false;
        }
        
        // Skip tokens in our exclusion list
        if (this.EXCLUDED_TOKENS.has(token.address)) {
          return false;
        }
        
        return true;
      });
      
      console.log(`Found ${recentTokens.length} potentially new tokens from Jupiter`);
      return recentTokens;
    } catch (error) {
      console.error('Error fetching Jupiter token list:', error);
      return [];
    }
  }
  
  private async checkPumpFunTokens(): Promise<Array<{address: string, symbol: string, name: string}>> {
    try {
      // Try to fetch recently created tokens from pump.fun or a related API
      // Note: This is a placeholder - pump.fun might not have a public API
      // You would need to replace this with the actual API endpoint or method
      
      // Attempt to get newest pump.fun tokens
      try {
        const response = await fetch('https://api.pump.fun/tokens/recent');
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.tokens)) {
            const newTokens = data.tokens.map((token: any) => ({
              address: token.address,
              symbol: token.symbol || 'PUMP',
              name: token.name || 'Pump Token'
            })).filter((token: any) => {
              // Skip tokens we've already processed
              if (this.knownTokensCache.has(token.address)) {
                return false;
              }
              
              // Skip tokens in our exclusion list
              if (this.EXCLUDED_TOKENS.has(token.address)) {
                return false;
              }
              
              return true;
            });
            
            console.log(`Found ${newTokens.length} potentially new tokens from pump.fun`);
            return newTokens;
          }
        }
      } catch (pumpApiError) {
        console.log('pump.fun API not available or returned an error');
      }
      
      // Alternative approach: scan recent transactions for token creation
      // This is a more complex but more reliable method
      // For now, return empty array as this is just a placeholder
      return [];
    } catch (error) {
      console.error('Error fetching pump.fun tokens:', error);
      return [];
    }
  }
  
  private async checkBirdeyeTokens(): Promise<TokenData[]> {
    try {
      const birdeyeApiKey = process.env.BIRDEYE_API_KEY;
      if (!birdeyeApiKey) {
        console.warn('BIRDEYE_API_KEY not set, skipping Birdeye token check');
        return [];
      }

      const response = await fetch('https://public-api.birdeye.so/defi/new_tokens?chain=solana&offset=0&limit=100', {
        headers: {
          'X-API-KEY': birdeyeApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '5';
          console.log(`Rate limited by Birdeye API. Waiting ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          return this.checkBirdeyeTokens(); // Retry the request
        }
        if (response.status === 404) {
          // Silently skip 404 errors as they're expected when no new tokens are found
          return [];
        }
        console.warn(`Birdeye API returned ${response.status}: ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      if (!data?.data?.tokens || !Array.isArray(data.data.tokens)) {
        throw new Error('Invalid response from Birdeye API');
      }

      const tokens: TokenData[] = data.data.tokens
        .filter((token: BirdeyeToken) => 
          token.address && 
          token.symbol && 
          token.name &&
          !this.knownTokensCache.has(token.address) &&
          !this.EXCLUDED_TOKENS.has(token.address)
        )
        .map((token: BirdeyeToken) => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name
        }));

      console.log(`Found ${tokens.length} new tokens from Birdeye`);
      return tokens;
    } catch (error) {
      console.error('Error checking Birdeye tokens:', error);
      return [];
    }
  }
  
  public stopMonitoring(): void {
    this.isScanning = false;
    console.log('Pump token monitoring stopped');
    this.saveCache();
  }
  
  private async quickValidateToken(mintAddress: string): Promise<boolean> {
    try {
      // Skip validation for excluded tokens - they're already valid
      if (this.EXCLUDED_TOKENS.has(mintAddress)) {
        return true;
      }
      
      console.log(`Validating token: ${mintAddress}`);
      
      // 1. Basic validation - check it's a real account
      try {
        const publicKey = new PublicKey(mintAddress);
        
        // Check if it's a valid public key
        if (!PublicKey.isOnCurve(publicKey)) {
          console.log(`${mintAddress} is not a valid public key`);
          return false;
        }
        
        // Use more efficient account info fetching with smaller commitment
        // This is faster with Alchemy's optimized RPC
        const isAlchemy = process.env.SOLANA_RPC_URL?.includes('alchemy.com') || false;
        
        const mintInfo = await this.connection.getAccountInfo(
          publicKey, 
          { commitment: 'confirmed' } // Using confirmed as it's a valid commitment
        );
        
        if (!mintInfo || !mintInfo.data) {
          console.log(`${mintAddress}: Invalid token account - no data found`);
          return false;
        }
        
        // Verify it's owned by the token program
        if (mintInfo.owner.toString() !== this.TOKEN_PROGRAM_ID) {
          console.log(`${mintAddress}: Not owned by token program`);
          return false;
        }
        
        // 2. Check token age to ensure it falls within our target window
        try {
          // Get the token's age in hours
          const tokenAgeHours = await this.getTokenAgeInHours(mintAddress);
          
          // Check if the token age is within our target window
          if (tokenAgeHours < this.MIN_TOKEN_AGE_HOURS) {
            console.log(`${mintAddress}: Token too new (${tokenAgeHours.toFixed(2)} hours), minimum is ${this.MIN_TOKEN_AGE_HOURS} hours`);
            return false;
          }
          
          if (tokenAgeHours > this.MAX_TOKEN_AGE_HOURS) {
            console.log(`${mintAddress}: Token too old (${tokenAgeHours.toFixed(2)} hours), maximum is ${this.MAX_TOKEN_AGE_HOURS} hours`);
            return false;
          }
          
          console.log(`${mintAddress}: Token age check passed (${tokenAgeHours.toFixed(2)} hours)`);
        } catch (ageError) {
          console.warn(`${mintAddress}: Error checking token age:`, ageError);
          // Continue with validation even if age check fails
        }
        
        // For pump tokens, we'll skip the suspicious name check since many pump tokens
        // intentionally have funny/scammy-sounding names
        return true;
      } catch (error) {
        console.log(`${mintAddress}: Error checking token account`);
        return false;
      }
    } catch (error) {
      console.error(`Error validating token ${mintAddress}:`, error);
      return false;
    }
  }
  
  /**
   * Get the token's age in hours by checking its first transaction
   */
  private async getTokenAgeInHours(mintAddress: string): Promise<number> {
    try {
      // Try to get the token age from our DexService if available
      try {
        // The DexService now uses Alchemy's optimized methods when available
        const tokenAgeDays = await this.dexService.getTokenAge(mintAddress);
        if (tokenAgeDays > 0) {
          // Convert days to hours
          const ageInHours = tokenAgeDays * 24;
          console.log(`Found token age for ${mintAddress} using optimized methods: ${ageInHours.toFixed(2)} hours`);
          return ageInHours;
        }
      } catch (dexError) {
        console.warn(`Failed to get token age from DexService: ${dexError}`);
        // Continue with fallback method
      }
      
      // Fallback method: Check the mint account's transaction history
      // This is more efficient with Alchemy due to their optimized transaction history endpoints
      const isAlchemy = process.env.SOLANA_RPC_URL?.includes('alchemy.com') || false;
      const limit = isAlchemy ? 3 : 1; // Get slightly more signatures with Alchemy for better reliability
      
      const mintPubkey = new PublicKey(mintAddress);
      const signatures = await this.connection.getSignaturesForAddress(
        mintPubkey,
        { limit },
        'confirmed' // Using confirmed as it's a valid Finality value
      );

      if (signatures && signatures.length > 0) {
        // Get the oldest signature in our list
        const oldestTx = signatures[signatures.length - 1];
        if (oldestTx.blockTime) {
          const nowSeconds = Date.now() / 1000;
          const ageInSeconds = nowSeconds - oldestTx.blockTime;
          const hours = ageInSeconds / 3600;
          console.log(`Found token age for ${mintAddress} using transaction history: ${hours.toFixed(2)} hours`);
          return hours; // Convert seconds to hours
        }
      }
      
      // If we couldn't determine the age, return a very large number to fail the filter
      console.log(`Could not determine age for token ${mintAddress}`);
      return Number.MAX_SAFE_INTEGER;
    } catch (error) {
      console.error(`Error getting token age for ${mintAddress}:`, error);
      // If we can't determine the age, return a very large number to fail the filter
      return Number.MAX_SAFE_INTEGER;
    }
  }
  
  public async waitForLiquidity(mintAddress: string, maxWaitTimeMs: number = 300000): Promise<boolean> {
    console.log(`Waiting for liquidity for token: ${mintAddress}`);
    
    // Don't wait for liquidity for excluded tokens
    if (this.EXCLUDED_TOKENS.has(mintAddress)) {
      console.log(`${mintAddress} is an established token, skipping liquidity check`);
      return true;
    }
    
    const startTime = Date.now();
    
    // Quick check methods first - these are faster but less reliable
    try {
      // Method 1: Fast initial check using Jupiter quote
      try {
        console.log(`Attempting quick liquidity check via Jupiter quote for ${mintAddress}`);
        const quoteResult = await this.dexService.getQuote(
          'So11111111111111111111111111111111111111112', // SOL
          mintAddress, 
          0.01 // Small amount for faster quote
        );
        
        if (quoteResult) {
          console.log(`✅ ${mintAddress}: Quote available immediately, expected output: ${quoteResult.outAmount} tokens`);
          return true;
        }
      } catch (quoteError) {
        // Ignore quote errors, continue to next check
      }
      
      // Method 2: Direct liquidity check
      try {
        console.log(`Attempting direct liquidity check for ${mintAddress}`);
        const liquidity = await this.dexService.getTokenLiquidity(mintAddress);
        if (liquidity >= this.minLiquidityThreshold) {
          console.log(`✅ ${mintAddress}: Immediate liquidity found (${liquidity} SOL)`);
          return true;
        }
      } catch (liquidityError) {
        // Ignore liquidity check errors, continue to polling
      }
      
      // Method 3: Try to get token price - if it has a price, it has liquidity
      try {
        console.log(`Checking if token ${mintAddress} has a price`);
        const price = await this.dexService.getTokenPrice(mintAddress);
        if (price > 0) {
          console.log(`✅ ${mintAddress}: Token has a price (${price}), assuming it has liquidity`);
          return true;
        }
      } catch (priceError) {
        // Ignore price check errors, continue to polling
      }
    } catch (fastCheckError) {
      console.warn(`Error during fast liquidity checks: ${fastCheckError}`);
    }
    
    console.log(`Initial liquidity checks failed for ${mintAddress}, starting polling...`);
    
    // Poll in a loop with exponential backoff
    let delay = 2000; // Start with 2 seconds
    const maxDelay = 15000; // Max 15 seconds
    let attempts = 0;
    const maxAttempts = 10; // Maximum 10 polling attempts
    
    while (Date.now() - startTime < maxWaitTimeMs && attempts < maxAttempts) {
      attempts++;
      console.log(`Liquidity check attempt ${attempts}/${maxAttempts} for ${mintAddress}`);
      
      try {
        // Try method 1: Check direct liquidity
        const liquidity = await this.dexService.getTokenLiquidity(mintAddress);
        console.log(`${mintAddress}: Current liquidity: ${liquidity} SOL`);
        
        if (liquidity >= this.minLiquidityThreshold) {
          console.log(`✅ ${mintAddress}: Sufficient liquidity found (${liquidity} SOL)`);
          return true;
        }
        
        // Try method 2: Jupiter quote check
        try {
          const quoteResult = await this.dexService.getQuote(
            'So11111111111111111111111111111111111111112', // SOL
            mintAddress, 
            0.01 // Small amount for faster quote
          );
          
          if (quoteResult) {
            console.log(`✅ ${mintAddress}: Quote available, token appears tradable`);
            return true;
          }
        } catch (quoteError) {
          // Ignore quote errors, continue checking
        }
        
        // Try method 3: Check if token has a price
        try {
          const price = await this.dexService.getTokenPrice(mintAddress);
          if (price > 0) {
            console.log(`✅ ${mintAddress}: Token has a price (${price}), assuming it has liquidity`);
            return true;
          }
        } catch (priceError) {
          // Ignore price errors, continue checking
        }
        
        // If we've used most of our time allocation, try one last method - direct Jupiter swap quote
        if (Date.now() - startTime > (maxWaitTimeMs * 0.7)) {
          try {
            // Try a final direct Jupiter API call
            const response = await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=10000000&slippageBps=50`);
            const data = await response.json();
            
            if (data && data.outAmount && Number(data.outAmount) > 0) {
              console.log(`✅ ${mintAddress}: Direct Jupiter API response indicates liquidity`);
              return true;
            }
          } catch (jupiterError) {
            // Last attempt failed, continue to next loop iteration
          }
        }
        
        // Wait before checking again with exponential backoff
        console.log(`Waiting ${delay/1000} seconds before next liquidity check for ${mintAddress}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff with max cap
        delay = Math.min(delay * 1.5, maxDelay);
      } catch (error) {
        console.error(`Error checking liquidity for ${mintAddress}:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, maxDelay);
      }
    }
    
    console.log(`⚠️ ${mintAddress}: No liquidity found after ${attempts} attempts and ${(Date.now() - startTime)/1000} seconds`);
    return false;
  }
} 