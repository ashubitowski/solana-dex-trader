import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

// Read the keypair file
const keypairFile = fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8');
const keypairArray = JSON.parse(keypairFile);

// Create a keypair from the array
const keypair = Keypair.fromSecretKey(new Uint8Array(keypairArray));

// Convert to base58
const privateKeyBase58 = bs58.encode(keypair.secretKey);
console.log('Private key (base58):', privateKeyBase58);
console.log('Public key:', keypair.publicKey.toString()); 