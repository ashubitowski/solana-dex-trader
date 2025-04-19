#!/usr/bin/env node

/**
 * This utility script extracts a Solana private key from a keypair file
 * and converts it to the base58 format needed for the .env file.
 * 
 * Usage: node scripts/extract-key.js [path_to_keypair_file]
 * If no path is provided, it will try to use the default Solana config location.
 */

const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');

// Get keypair path from command line or use default
const args = process.argv.slice(2);
const keypairPath = args[0] || path.join(process.env.HOME, '.config/solana/id.json');

try {
  console.log(`Reading keypair from: ${keypairPath}`);
  
  // Read the keypair file
  const keypairFile = fs.readFileSync(keypairPath, 'utf-8');
  const keypairArray = JSON.parse(keypairFile);
  
  // Convert to base58
  const privateKeyBase58 = bs58.encode(Buffer.from(keypairArray));
  
  console.log('\n===== PRIVATE KEY EXTRACTED SUCCESSFULLY =====');
  console.log('Add this to your .env file as SOLANA_PRIVATE_KEY:');
  console.log('\nSOLANA_PRIVATE_KEY=', privateKeyBase58);
  console.log('\n==============================================');
  
  // Generate a sample .env file content
  const envContent = `
# Solana Connection
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PRIVATE_KEY=${privateKeyBase58}

# Trading Parameters
MAX_POSITIONS=3
BUY_AMOUNT_SOL=0.1
TAKE_PROFIT_PERCENT=50
STOP_LOSS_PERCENT=20
MIN_LIQUIDITY_THRESHOLD=5

# Token Discovery Settings
MIN_TOKEN_AGE_HOURS=24
MAX_TOKEN_AGE_HOURS=72

# API Keys (Optional)
BIRDEYE_API_KEY=
`;

  // Ask if user wants to generate .env file
  console.log('\nWould you like to generate an .env file with these values? (y/n)');
  process.stdin.once('data', (data) => {
    const answer = data.toString().trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      fs.writeFileSync('.env', envContent.trim());
      console.log('Created .env file successfully!');
    }
    process.exit(0);
  });
  
} catch (error) {
  console.error('Error extracting private key:', error.message);
  process.exit(1);
} 