import { DexService } from '../services/dex';
import { PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config();

export interface TokenPosition {
    tokenAddress: string;
    entryPrice: number;
    entryTimestamp: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    monitoring: boolean;
    initialInvestment: number;
}

export class PumpSnipeStrategy {
    private dexService: DexService;
    private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    // Configuration with defaults
    private readonly SOL_AMOUNT = Number(process.env.PUMP_SNIPE_AMOUNT || '0.1'); // SOL to spend per token
    private readonly MAX_WAIT_FOR_LIQUIDITY = Number(process.env.MAX_WAIT_FOR_LIQUIDITY || '300000'); // 5 minutes
    private readonly STOP_LOSS_PERCENTAGE = Number(process.env.STOP_LOSS_PERCENTAGE || '50'); // 50%
    private readonly TAKE_PROFIT_PERCENTAGE = Number(process.env.TAKE_PROFIT_PERCENTAGE || '200'); // 200%
    private readonly SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || '1000'); // 10% slippage for pump tokens
    private readonly MAX_ACTIVE_POSITIONS = 3; // Limit to 3 concurrent positions
    private readonly POSITIONS_FILE_PATH = path.join(process.cwd(), '.cache/active_positions.json');

    // Active positions
    private activeSnipes: Map<string, TokenPosition> = new Map();

    constructor(dexService: DexService) {
        this.dexService = dexService;
        this.loadPositions();
        this.resumeMonitoring();
    }
    
    // Load positions from file
    private loadPositions(): void {
        try {
            if (!fs.existsSync(path.dirname(this.POSITIONS_FILE_PATH))) {
                fs.mkdirSync(path.dirname(this.POSITIONS_FILE_PATH), { recursive: true });
            }
            
            if (fs.existsSync(this.POSITIONS_FILE_PATH)) {
                const data = JSON.parse(fs.readFileSync(this.POSITIONS_FILE_PATH, 'utf8'));
                const positions = data.positions || [];
                
                for (const position of positions) {
                    this.activeSnipes.set(position.tokenAddress, position);
                }
                
                console.log(`Loaded ${this.activeSnipes.size} active positions from storage`);
            } else {
                console.log('No active positions found in storage');
            }
        } catch (error) {
            console.error('Error loading positions:', error);
        }
    }
    
    /**
     * Scan the wallet for tokens that might be from active trades but aren't in our positions list
     */
    public async scanWalletForMissingPositions(): Promise<void> {
        try {
            console.log('Scanning wallet for tokens that might be from previous trades...');
            const walletTokens = await this.dexService.getAllWalletTokens();
            
            if (walletTokens.length === 0) {
                console.log('No tokens found in wallet');
                return;
            }
            
            let newPositionsFound = 0;
            
            for (const token of walletTokens) {
                // Skip SOL and common tokens
                if (token.address === this.SOL_MINT || this.isCommonToken(token.address)) {
                    continue;
                }
                
                // Skip tokens we're already tracking
                if (this.activeSnipes.has(token.address)) {
                    continue;
                }
                
                console.log(`Found token in wallet not in positions: ${token.address} (${token.info?.symbol || 'Unknown'}) - Balance: ${token.balance}`);
                
                // If token has market value, add it as a position
                const currentPrice = await this.dexService.getTokenPrice(token.address);
                if (currentPrice > 0) {
                    console.log(`Token ${token.address} has price: $${currentPrice.toFixed(6)}, adding to positions`);
                    
                    // Create a new position entry with default values
                    const newPosition: TokenPosition = {
                        tokenAddress: token.address,
                        entryPrice: currentPrice,
                        entryTimestamp: Date.now() - 3600000, // Assume bought 1 hour ago
                        stopLossPrice: currentPrice * 0.5, // 50% default stop loss
                        takeProfitPrice: currentPrice * 3, // 200% default take profit
                        monitoring: true,
                        initialInvestment: 0.1 // Assume default investment amount
                    };
                    
                    this.activeSnipes.set(token.address, newPosition);
                    newPositionsFound++;
                    
                    // Start monitoring this position
                    this.monitorPosition(token.address);
                }
            }
            
            if (newPositionsFound > 0) {
                console.log(`Added ${newPositionsFound} positions from wallet tokens`);
                this.savePositions();
            } else {
                console.log('No new positions found from wallet tokens');
            }
        } catch (error) {
            console.error('Error scanning wallet for positions:', error);
        }
    }
    
    /**
     * Check if a token is a common token that should not be treated as a trade position
     */
    private isCommonToken(tokenAddress: string): boolean {
        const commonTokens = [
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
        ];
        
        return commonTokens.includes(tokenAddress);
    }
    
    // Save positions to file
    private savePositions(): void {
        try {
            const positions = Array.from(this.activeSnipes.values());
            fs.writeFileSync(
                this.POSITIONS_FILE_PATH,
                JSON.stringify({
                    positions,
                    lastUpdate: new Date().toISOString()
                }, null, 2)
            );
        } catch (error) {
            console.error('Error saving positions:', error);
        }
    }
    
    // Resume monitoring for all loaded positions
    private resumeMonitoring(): void {
        for (const [tokenAddress, position] of this.activeSnipes.entries()) {
            if (position.monitoring) {
                console.log(`Resuming monitoring for ${tokenAddress}`);
                this.monitorPosition(tokenAddress);
            }
        }
    }
    
    // Get all active position addresses as a Set
    public getActivePositionAddresses(): Set<string> {
        const activeAddresses = new Set<string>();
        for (const [tokenAddress, position] of this.activeSnipes.entries()) {
            if (position.monitoring) {
                activeAddresses.add(tokenAddress);
            }
        }
        return activeAddresses;
    }
    
    // Check if a token exists in active positions
    public hasActivePosition(tokenAddress: string): boolean {
        const position = this.activeSnipes.get(tokenAddress);
        return position !== undefined && position.monitoring === true;
    }
    
    // Check if we can add more positions
    public canAddPosition(): boolean {
        const activeCount = this.getActivePositionsCount();
        const canAdd = activeCount < this.MAX_ACTIVE_POSITIONS;
        
        if (!canAdd) {
            console.log(`⚠️ Cannot add more positions. Maximum of ${this.MAX_ACTIVE_POSITIONS} active positions reached (current: ${activeCount})`);
        }
        
        return canAdd;
    }
    
    // Get count of active positions
    public getActivePositionsCount(): number {
        let count = 0;
        for (const position of this.activeSnipes.values()) {
            if (position.monitoring) {
                count++;
            }
        }
        return count;
    }
    
    // Get summary of active positions
    public getActivePositionsSummary(): any[] {
        const summary = [];
        for (const [tokenAddress, position] of this.activeSnipes.entries()) {
            if (position.monitoring) {
                summary.push({
                    tokenAddress,
                    entryPrice: position.entryPrice,
                    entryTime: new Date(position.entryTimestamp).toLocaleString(),
                    stopLossPrice: position.stopLossPrice,
                    takeProfitPrice: position.takeProfitPrice,
                    elapsedHours: ((Date.now() - position.entryTimestamp) / (1000 * 60 * 60)).toFixed(2)
                });
            }
        }
        return summary;
    }

    // Entry point for sniping a new pump token
    public async snipeToken(tokenAddress: string): Promise<boolean> {
        try {
            // Check if we already have an active position for this token
            if (this.activeSnipes.has(tokenAddress) && this.activeSnipes.get(tokenAddress)?.monitoring) {
                console.log(`⚠️ Already have an active position for ${tokenAddress}, skipping`);
                return false;
            }
            
            // Check if we have reached the maximum number of active positions
            if (!this.canAddPosition()) {
                return false;
            }
            
            console.log(`\n🚀 SNIPING TOKEN: ${tokenAddress}`);
            console.log(`Investment amount: ${this.SOL_AMOUNT} SOL`);
            console.log(`Slippage: ${this.SLIPPAGE_BPS / 100}%`);
            
            // Perform pre-trade validation
            const isValidForTrading = await this.validateTokenForTrading(tokenAddress);
            if (!isValidForTrading) {
                console.log(`❌ Token ${tokenAddress} failed pre-trade validation, skipping`);
                return false;
            }
            
            // Execute the buy
            const txHash = await this.executeBuy(tokenAddress);
            if (!txHash) {
                console.log(`⚠️ Failed to execute buy for ${tokenAddress}`);
                return false;
            }
            
            console.log(`✅ Buy transaction successful: ${txHash}`);

            // Get entry price (use decimal price for calculations)
            const entryPrice = await this.dexService.getTokenPrice(tokenAddress);
            console.log(`Entry price: $${entryPrice.toFixed(6)}`);
            
            if (entryPrice <= 0) {
                console.log(`⚠️ Could not determine entry price for ${tokenAddress}`);
                return false;
            }
            
            // Calculate stop loss and take profit levels
            const stopLossPrice = entryPrice * (1 - this.STOP_LOSS_PERCENTAGE / 100);
            const takeProfitPrice = entryPrice * (1 + this.TAKE_PROFIT_PERCENTAGE / 100);
            
            console.log(`Stop loss price: $${stopLossPrice.toFixed(6)} (${this.STOP_LOSS_PERCENTAGE}% decrease)`);
            console.log(`Take profit price: $${takeProfitPrice.toFixed(6)} (${this.TAKE_PROFIT_PERCENTAGE}% increase)`);
            
            // Track the position
            const position: TokenPosition = {
                tokenAddress,
                entryPrice,
                entryTimestamp: Date.now(),
                stopLossPrice,
                takeProfitPrice,
                monitoring: true,
                initialInvestment: this.SOL_AMOUNT
            };
            
            this.activeSnipes.set(tokenAddress, position);
            this.savePositions();
            
            // Log active positions summary
            console.log(`\n📊 ACTIVE POSITIONS: ${this.getActivePositionsCount()}/${this.MAX_ACTIVE_POSITIONS}`);
            console.table(this.getActivePositionsSummary());
            
            // Start monitoring the position in the background
            this.monitorPosition(tokenAddress);
            
            return true;
        } catch (error) {
            console.error(`Error sniping token ${tokenAddress}:`, error);
            return false;
        }
    }
    
    private async executeBuy(tokenAddress: string): Promise<string | null> {
        try {
            // Execute the trade
            return await this.dexService.executeTrade(
                this.SOL_MINT, // SOL as input
                tokenAddress,  // Target token as output
                this.SOL_AMOUNT, // Amount in SOL
                this.SLIPPAGE_BPS // Slippage in basis points
            );
        } catch (error) {
            console.error(`Error executing buy for ${tokenAddress}:`, error);
            return null;
        }
    }
    
    private async executeSell(tokenAddress: string, percentageToSell: number): Promise<string | null> {
        try {
            // Get token balance
            const tokenBalance = await this.dexService.getTokenBalance(tokenAddress);
            
            if (tokenBalance <= 0) {
                console.log(`⚠️ No token balance to sell for ${tokenAddress}`);
                return null;
            }
            
            const amountToSell = tokenBalance * (percentageToSell / 100);
            console.log(`Selling ${percentageToSell}% (${amountToSell} tokens) of ${tokenAddress}`);
            
            // Execute the trade in reverse (token to SOL)
            return await this.dexService.executeTrade(
                tokenAddress, // Token as input
                this.SOL_MINT, // SOL as output
                amountToSell, // Amount in tokens
                this.SLIPPAGE_BPS // Slippage in basis points
            );
        } catch (error) {
            console.error(`Error executing sell for ${tokenAddress}:`, error);
            return null;
        }
    }
    
    private async monitorPosition(tokenAddress: string): Promise<void> {
        // Get the position details
        const position = this.activeSnipes.get(tokenAddress);
        if (!position) return;
        
        console.log(`\n📊 MONITORING POSITION: ${tokenAddress}`);
        console.log(`Entry price: $${position.entryPrice.toFixed(6)}`);
        console.log(`Stop loss: $${position.stopLossPrice.toFixed(6)}`);
        console.log(`Take profit: $${position.takeProfitPrice.toFixed(6)}`);
        
        // Monitor in a loop until position is closed or monitoring is stopped
        while (position.monitoring) {
            try {
                // Get current price
                const currentPrice = await this.dexService.getTokenPrice(tokenAddress);
                console.log(`Current price for ${tokenAddress}: $${currentPrice.toFixed(6)}`);
                
                if (currentPrice <= 0) {
                    console.log(`⚠️ Error getting price for ${tokenAddress}, continuing monitoring`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                
                // Calculate price change percentage
                const priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                console.log(`Price change for ${tokenAddress}: ${priceChangePercent.toFixed(2)}%`);
                
                // Check stop loss
                if (currentPrice <= position.stopLossPrice) {
                    console.log(`⚠️ STOP LOSS TRIGGERED for ${tokenAddress}`);
                    const sellResult = await this.executeSell(tokenAddress, 100); // Sell all
                    if (sellResult) {
                        console.log(`✅ Stop loss sell executed: ${sellResult}`);
                    }
                    position.monitoring = false;
                    this.savePositions();
                    break;
                }
                
                // Check take profit
                if (currentPrice >= position.takeProfitPrice) {
                    console.log(`🎯 TAKE PROFIT TRIGGERED for ${tokenAddress}`);
                    
                    // Sell 80% at take profit, keep 20% for potential further gains
                    const sellResult = await this.executeSell(tokenAddress, 80);
                    if (sellResult) {
                        console.log(`✅ Take profit sell executed: ${sellResult}`);
                    }
                    
                    // Update the position - now monitoring the remaining 20% with no stop loss
                    position.entryPrice = currentPrice;
                    position.stopLossPrice = 0; // Remove stop loss on remaining position
                    this.savePositions();
                    
                    console.log(`Holding 20% of position for potential further gains`);
                }
                
                // Check if position has been open too long (24 hours)
                const hoursSinceEntry = (Date.now() - position.entryTimestamp) / (1000 * 60 * 60);
                if (hoursSinceEntry >= 24) {
                    console.log(`⏰ Position time limit reached (24 hours) for ${tokenAddress}`);
                    const sellResult = await this.executeSell(tokenAddress, 100); // Sell all
                    if (sellResult) {
                        console.log(`✅ Time limit sell executed: ${sellResult}`);
                    }
                    position.monitoring = false;
                    this.savePositions();
                    break;
                }
                
                // Wait before next check - check more frequently for pump tokens
                await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds
            } catch (error) {
                console.error(`Error monitoring position for ${tokenAddress}:`, error);
                // Continue monitoring despite errors
                await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds on error
            }
        }
        
        console.log(`📊 POSITION MONITORING ENDED for ${tokenAddress}`);
        position.monitoring = false;
        this.savePositions();
    }
    
    public stopMonitoring(tokenAddress: string): void {
        const position = this.activeSnipes.get(tokenAddress);
        if (position) {
            console.log(`Stopping monitoring for ${tokenAddress}`);
            position.monitoring = false;
            this.savePositions();
        }
    }
    
    public stopAllMonitoring(): void {
        console.log('Stopping monitoring for all positions');
        for (const position of this.activeSnipes.values()) {
            position.monitoring = false;
        }
        this.savePositions();
    }
    
    private async validateTokenForTrading(tokenAddress: string): Promise<boolean> {
        try {
            console.log(`Validating ${tokenAddress} for trading...`);
            
            // Skip validation if we already have an active position
            if (this.activeSnipes.has(tokenAddress)) {
                return false;
            }
            
            // Get token info and check basic validity
            const tokenInfo = await this.dexService.getTokenInfo(tokenAddress);
            if (!tokenInfo) {
                console.log(`❌ No token info available for ${tokenAddress}`);
                return false;
            }
            
            console.log(`Token info: ${tokenInfo.name} (${tokenInfo.symbol})`);
            
            // Check token liquidity
            const liquidity = await this.dexService.getTokenLiquidity(tokenAddress);
            console.log(`Token liquidity: ${liquidity} SOL`);
            
            if (liquidity < 1) {
                console.log(`❌ Insufficient liquidity for ${tokenAddress}`);
                return false;
            }
            
            // Try to get a quote
            try {
                const quote = await this.dexService.getQuote(
                    this.SOL_MINT,
                    tokenAddress,
                    this.SOL_AMOUNT * 1e9 // Amount in lamports
                );
                
                if (quote) {
                    console.log(`Quote available, expected output: ${quote.outAmount} tokens`);
                } else {
                    console.log(`❌ No quote available for ${tokenAddress}`);
                    return false;
                }
            } catch (error) {
                console.log(`❌ Error getting quote for ${tokenAddress}: ${error}`);
                return false;
            }
            
            console.log(`${tokenAddress} passed all pre-trade validations`);
            return true;
        } catch (error) {
            console.error(`Error validating token ${tokenAddress} for trading:`, error);
            return false;
        }
    }
} 