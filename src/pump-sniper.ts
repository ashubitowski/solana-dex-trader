// Immediately silence WebSocket errors before anything else loads
// Intercept all console.error calls
const originalConsoleError = console.error;
// @ts-ignore - We know what we're doing with this override
console.error = function() {
  const args = Array.from(arguments);
  const message = args.join(' ').toLowerCase();
  // Skip any WebSocket related errors
  if (message.includes('ws error') || 
      message.includes('websocket') || 
      message.includes('unexpected server') ||
      message.includes('404')) {
    return; // Completely silence
  }
  originalConsoleError.apply(console, args);
};

// Also intercept console.log for ws errors that might come through there
const originalConsoleLog = console.log;
// @ts-ignore - We know what we're doing with this override
console.log = function() {
  const args = Array.from(arguments);
  const message = args.join(' ').toLowerCase();
  if (message.includes('ws error')) {
    return; // Completely silence
  }
  originalConsoleLog.apply(console, args);
};

import { Connection } from '@solana/web3.js';
import { DexService } from './services/dex';
import { WalletService } from './services/wallet';
import { PumpTokenDiscovery } from './services/pump-token-discovery';
import { PumpSnipeStrategy } from './strategies/pump-snipe';
import * as dotenv from 'dotenv';

dotenv.config();

// Handle graceful shutdown
let isShuttingDown = false;
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down pump token sniper...');
  isShuttingDown = true;
  // Allow 5 seconds for cleanup
  setTimeout(() => {
    console.log('Forced exit');
    process.exit(0);
  }, 5000);
});

async function main() {
  try {
    console.log('\n🚀 STARTING PUMP TOKEN SNIPER');
    console.log('==============================');
    console.log('This bot will monitor the Solana blockchain for new tokens');
    console.log('and automatically snipe them when liquidity is detected.');
    console.log('Press Ctrl+C to stop the bot.');
    console.log('==============================\n');
    
    // Initialize connection to Solana
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    console.log(`Connecting to Solana RPC: ${rpcUrl}`);
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Initialize wallet
    const walletService = new WalletService();
    const walletPublicKey = walletService.getPublicKey().toBase58();
    console.log(`Using wallet: ${walletPublicKey}`);
    
    // Check wallet balance
    const balance = await connection.getBalance(walletService.getPublicKey());
    console.log(`Wallet balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.2 * 1e9) {
      console.log('⚠️ WARNING: Low wallet balance! Add more SOL to continue operation.');
    }
    
    // Initialize services
    const dexService = new DexService(connection, walletService);
    const pumpDiscovery = new PumpTokenDiscovery(connection, dexService);
    const snipeStrategy = new PumpSnipeStrategy(dexService);
    
    // Keep track of tokens we've attempted to snipe
    const attemptedTokens = new Set<string>();
    
    // Show current positions
    const activePositions = snipeStrategy.getActivePositionsCount();
    console.log(`\n📊 ACTIVE POSITIONS: ${activePositions}/3`);
    if (activePositions > 0) {
      console.log('\nCurrent positions:');
      console.table(snipeStrategy.getActivePositionsSummary());
    }
    
    // Scan wallet for any tokens that might be missing from our positions list
    console.log('\n🔍 Scanning wallet for tokens from previous trades...');
    await snipeStrategy.scanWalletForMissingPositions();
    
    // Start monitoring for new tokens
    console.log('\n📡 Starting token monitoring...');
    
    // Set up the callback that will be triggered for each new token
    const snipeCallback = async (tokenAddress: string) => {
      if (isShuttingDown) return;
      
      // Skip if we've already tried to snipe this token
      if (attemptedTokens.has(tokenAddress)) {
        console.log(`Already attempted to snipe ${tokenAddress}, skipping`);
        return;
      }
      
      // Skip if we've already reached max positions
      if (!snipeStrategy.canAddPosition()) {
        console.log(`Maximum number of positions reached (3), skipping ${tokenAddress}`);
        return;
      }
      
      // Add to attempted tokens list
      attemptedTokens.add(tokenAddress);
      
      try {
        console.log(`\n🔍 New token detected: ${tokenAddress}`);
        
        // Wait for liquidity to appear
        console.log('Waiting for liquidity to be added...');
        const hasLiquidity = await pumpDiscovery.waitForLiquidity(tokenAddress);
        
        if (!hasLiquidity) {
          console.log(`❌ No liquidity added for ${tokenAddress} within timeout window`);
          return;
        }
        
        // Get basic token info if available
        try {
          const tokenInfo = await dexService.getTokenInfo(tokenAddress);
          if (tokenInfo) {
            console.log(`Token Name: ${tokenInfo.name}`);
            console.log(`Token Symbol: ${tokenInfo.symbol}`);
          }
        } catch (error) {
          console.log('Could not retrieve token info');
        }
        
        // Execute the snipe
        console.log(`🚀 Liquidity detected! Executing snipe for ${tokenAddress}`);
        await snipeStrategy.snipeToken(tokenAddress);
        
      } catch (error) {
        console.error(`Error processing token ${tokenAddress}:`, error);
      }
    };
    
    // Start monitoring in the background
    pumpDiscovery.startMonitoring(snipeCallback).catch(error => {
      console.error('Token monitoring crashed:', error);
      process.exit(1);
    });
    
    // Keep the script running
    process.on('exit', () => {
      console.log('Pump token sniper stopped');
      snipeStrategy.stopAllMonitoring();
      pumpDiscovery.stopMonitoring();
    });
    
    // Print status message
    console.log('\n🟢 Pump token sniper is running!');
    console.log('Waiting for new tokens to be created...');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Start the main process
main().catch(console.error); 