import { Connection, PublicKey, Commitment, Finality } from '@solana/web3.js';
import { DexService } from './dex';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

interface TokenData {
  address: string;
  timestamp: number;
  validatedLiquidity: boolean;
}

export class PumpTokenDiscovery {
  private connection: Connection;
  private dexService: DexService;
  private isScanning: boolean = false;
  private readonly scanInterval: number = 1000; // Reduced to 1 second for faster pump token discovery
  private readonly minLiquidityThreshold: number = Number(process.env.MIN_LIQUIDITY_THRESHOLD || '1'); // Reduced to 1 SOL for pump tokens
  private lastScanBlockHeight: number = 0;
  private knownTokensCache: Set<string> = new Set();
  private readonly TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  private readonly CACHE_FILE_PATH = path.join(process.cwd(), '.cache/pump_tokens.json');
  
  // Common tokens to exclude from sniping - these are well-established tokens
  private readonly EXCLUDED_TOKENS = new Set<string>([
    'So11111111111111111111111111111111111111112', // SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    'DUSTawucrTsGU8hcqRdHDCbuYhCPADMLM2VcCb8VnFnQ', // DUST
    'AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB', // GST
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // SAMO
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
    'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6', // KIN
    'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', // PYTH
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', // bSOL
    'DFL1zNkaGPWm1BwrQXq4ewV6VC37WJ8DkD61YqD6U9ay', // wBTC
    '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // BTC
    '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk', // ETH
    'EPeUFDgHRxs9xxEPVaL6kfGQvCon7jmAWKVUHuux1Tpz', // wETH
  ]);
  
  constructor(connection: Connection, dexService: DexService) {
    this.connection = connection;
    this.dexService = dexService;
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
        this.lastScanBlockHeight = cache.lastBlockHeight || 0;
        console.log(`Loaded ${this.knownTokensCache.size} known pump tokens`);
        console.log(`Last scan block height: ${this.lastScanBlockHeight}`);
      } else {
        console.log('No pump token cache found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading token cache:', error);
      this.knownTokensCache = new Set();
      this.lastScanBlockHeight = 0;
    }
  }
  
  private saveCache(): void {
    try {
      fs.writeFileSync(
        this.CACHE_FILE_PATH,
        JSON.stringify({
          tokens: Array.from(this.knownTokensCache),
          lastBlockHeight: this.lastScanBlockHeight,
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
    
    // Start from current slot if no previous data
    if (this.lastScanBlockHeight === 0) {
      const slot = await this.connection.getSlot();
      this.lastScanBlockHeight = await this.connection.getBlockHeight();
      this.saveCache();
      console.log(`Starting from block height: ${this.lastScanBlockHeight}`);
    }
    
    // Use multiple sources to find new tokens
    let lastCheckTime = Date.now();
    
    const scanForTokens = async () => {
      if (!this.isScanning) return;
      
      try {
        // Update the block height for logging
        const currentBlockHeight = await this.connection.getBlockHeight();
        
        if (currentBlockHeight > this.lastScanBlockHeight) {
          console.log(`Scanning for new tokens (blocks ${this.lastScanBlockHeight} to ${currentBlockHeight})`);
          
          // Method 1: Check Jupiter token list (good for established tokens)
          const jupiterTokens = await this.checkJupiterTokens();
          
          // Method 2: Check pump.fun API for latest tokens (direct source)
          const pumpFunTokens = await this.checkPumpFunTokens();
          
          // Combine results from both sources
          const allNewTokens = [...jupiterTokens, ...pumpFunTokens];
          
          // Process new tokens
          for (const token of allNewTokens) {
            // Add to known tokens cache
            this.knownTokensCache.add(token.address);
            
            try {
              // Quick validation to ensure it's a real token
              const isValid = await this.quickValidateToken(token.address);
              
              if (isValid) {
                console.log(`🔔 New token detected: ${token.address} (${token.symbol || 'Unknown'} - ${token.name || 'Unknown'})`);
                // Call the callback with the new token
                await callback(token.address);
              }
            } catch (tokenError) {
              console.warn(`Error validating token ${token.address}:`, tokenError);
            }
          }
          
          // Update last scanned block height
          this.lastScanBlockHeight = currentBlockHeight;
          this.saveCache();
          lastCheckTime = Date.now();
        } else {
          console.log(`No new blocks since last scan (current: ${currentBlockHeight})`);
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
  
  public stopMonitoring(): void {
    this.isScanning = false;
    console.log('Pump token monitoring stopped');
    this.saveCache();
  }
  
  private async quickValidateToken(mintAddress: string): Promise<boolean> {
    try {
      console.log(`Validating token: ${mintAddress}`);
      
      // 1. Basic validation - check it's a real account
      try {
        const publicKey = new PublicKey(mintAddress);
        
        // Check if it's a valid public key
        if (!PublicKey.isOnCurve(publicKey)) {
          console.log(`${mintAddress} is not a valid public key`);
          return false;
        }
        
        const mintInfo = await this.connection.getAccountInfo(publicKey);
        if (!mintInfo || !mintInfo.data) {
          console.log(`${mintAddress}: Invalid token account - no data found`);
          return false;
        }
        
        // Verify it's owned by the token program
        if (mintInfo.owner.toString() !== this.TOKEN_PROGRAM_ID) {
          console.log(`${mintAddress}: Not owned by token program`);
          return false;
        }
        
        // For pump tokens, we'll skip the suspicious name check since many pump tokens
        // intentionally have funny/scammy-sounding names
        return true;
      } catch (error) {
        console.log(`${mintAddress}: Error checking token account`);
        return false;
      }
      
      console.log(`${mintAddress}: Validation passed - appears to be a valid token`);
      return true;
    } catch (error) {
      console.error(`Error validating token ${mintAddress}:`, error);
      return false;
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
    let liquidityFound = false;
    
    // Poll in a loop with exponential backoff
    let delay = 2000; // Start with 2 seconds
    const maxDelay = 15000; // Max 15 seconds
    
    // First quick check for liquidity
    try {
      const liquidity = await this.dexService.getTokenLiquidity(mintAddress);
      if (liquidity >= this.minLiquidityThreshold) {
        console.log(`✅ ${mintAddress}: Immediate liquidity found (${liquidity} SOL)`);
        return true;
      }
      
      // For pump tokens, also try a quick quote check since some DEXes might not report liquidity correctly
      try {
        const quoteResult = await this.dexService.getQuote(
          'So11111111111111111111111111111111111111112', // SOL
          mintAddress, 
          0.01 // Small amount for faster quote
        );
        
        if (quoteResult) {
          console.log(`✅ ${mintAddress}: Quote available, expected output: ${quoteResult.outAmount} tokens`);
          return true;
        }
      } catch (quoteError) {
        // Ignore quote errors
      }
    } catch (error) {
      console.warn(`Error during initial liquidity check for ${mintAddress}:`, error);
    }
    
    console.log(`Initial liquidity check failed, starting polling...`);
    
    while (Date.now() - startTime < maxWaitTimeMs) {
      try {
        // Check if liquidity exists
        const liquidity = await this.dexService.getTokenLiquidity(mintAddress);
        console.log(`${mintAddress}: Current liquidity: ${liquidity} SOL`);
        
        if (liquidity >= this.minLiquidityThreshold) {
          console.log(`✅ ${mintAddress}: Sufficient liquidity found (${liquidity} SOL)`);
          liquidityFound = true;
          break;
        }
        
        // Try a simple Jupiter quote check as an alternative way to detect tradability
        try {
          const quoteResult = await this.dexService.getQuote(
            'So11111111111111111111111111111111111111112', // SOL
            mintAddress, 
            0.01 // Small amount for faster quote
          );
          
          if (quoteResult) {
            console.log(`✅ ${mintAddress}: Quote available, token appears tradable`);
            liquidityFound = true;
            break;
          }
        } catch (quoteError) {
          // Ignore quote errors, continue checking
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff with max cap
        delay = Math.min(delay * 1.5, maxDelay);
      } catch (error) {
        console.error(`Error checking liquidity for ${mintAddress}:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, maxDelay);
      }
    }
    
    if (!liquidityFound) {
      console.log(`⚠️ ${mintAddress}: No liquidity found after ${maxWaitTimeMs/1000} seconds`);
    }
    
    return liquidityFound;
  }
} 