import { DexService } from '../services/dex';
import { PublicKey } from '@solana/web3.js';
import { config } from 'dotenv';

config();

export class PumpSnipeStrategy {
    private dexService: DexService;
    private readonly SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    // Configuration with defaults
    private readonly SOL_AMOUNT = Number(process.env.PUMP_SNIPE_AMOUNT || '0.1'); // SOL to spend per token
    private readonly MAX_WAIT_FOR_LIQUIDITY = Number(process.env.MAX_WAIT_FOR_LIQUIDITY || '300000'); // 5 minutes
    private readonly STOP_LOSS_PERCENTAGE = Number(process.env.STOP_LOSS_PERCENTAGE || '50'); // 50%
    private readonly TAKE_PROFIT_PERCENTAGE = Number(process.env.TAKE_PROFIT_PERCENTAGE || '200'); // 200%
    private readonly SLIPPAGE_BPS = Number(process.env.SLIPPAGE_BPS || '1000'); // 10% slippage for pump tokens

    // Active positions
    private activeSnipes: Map<string, {
        entryPrice: number;
        entryTimestamp: number;
        stopLossPrice: number;
        takeProfitPrice: number;
        monitoring: boolean;
    }> = new Map();

    constructor(dexService: DexService) {
        this.dexService = dexService;
    }

    // Entry point for sniping a new pump token
    public async snipeToken(tokenAddress: string): Promise<boolean> {
        try {
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
            this.activeSnipes.set(tokenAddress, {
                entryPrice,
                entryTimestamp: Date.now(),
                stopLossPrice,
                takeProfitPrice,
                monitoring: true
            });
            
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
                console.log(`Current price: $${currentPrice.toFixed(6)}`);
                
                if (currentPrice <= 0) {
                    console.log(`⚠️ Error getting price for ${tokenAddress}, continuing monitoring`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                
                // Calculate price change percentage
                const priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                console.log(`Price change: ${priceChangePercent.toFixed(2)}%`);
                
                // Check stop loss
                if (currentPrice <= position.stopLossPrice) {
                    console.log(`⚠️ STOP LOSS TRIGGERED for ${tokenAddress}`);
                    await this.executeSell(tokenAddress, 100); // Sell all
                    position.monitoring = false;
                    break;
                }
                
                // Check take profit
                if (currentPrice >= position.takeProfitPrice) {
                    console.log(`🎯 TAKE PROFIT TRIGGERED for ${tokenAddress}`);
                    
                    // Sell 80% at take profit, keep 20% for potential further gains
                    await this.executeSell(tokenAddress, 80);
                    
                    // Update the position - now monitoring the remaining 20% with no stop loss
                    position.entryPrice = currentPrice;
                    position.stopLossPrice = 0; // Remove stop loss on remaining position
                    
                    console.log(`Holding 20% of position for potential further gains`);
                }
                
                // Check if position has been open too long (24 hours)
                const hoursSinceEntry = (Date.now() - position.entryTimestamp) / (1000 * 60 * 60);
                if (hoursSinceEntry >= 24) {
                    console.log(`⏰ Position time limit reached (24 hours) for ${tokenAddress}`);
                    await this.executeSell(tokenAddress, 100); // Sell all
                    position.monitoring = false;
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
        this.activeSnipes.delete(tokenAddress);
    }
    
    // Utility method to stop monitoring a specific position
    public stopMonitoring(tokenAddress: string): void {
        const position = this.activeSnipes.get(tokenAddress);
        if (position) {
            position.monitoring = false;
            console.log(`Stopped monitoring position for ${tokenAddress}`);
        }
    }
    
    // Utility method to stop all monitoring
    public stopAllMonitoring(): void {
        for (const [tokenAddress, position] of this.activeSnipes.entries()) {
            position.monitoring = false;
            console.log(`Stopped monitoring position for ${tokenAddress}`);
        }
    }

    // Validate a token before attempting to trade
    private async validateTokenForTrading(tokenAddress: string): Promise<boolean> {
        try {
            console.log(`Validating ${tokenAddress} for trading...`);
            
            // 1. Check token exists and is tradeable
            const tokenInfo = await this.dexService.getTokenInfo(tokenAddress);
            if (!tokenInfo) {
                console.log(`Token info not available for ${tokenAddress}`);
                return false;
            }
            
            console.log(`Token info: ${tokenInfo.name} (${tokenInfo.symbol})`);
            
            // 2. Check liquidity
            const liquidity = await this.dexService.getTokenLiquidity(tokenAddress);
            console.log(`Token liquidity: ${liquidity} SOL`);
            
            if (liquidity < 5) {
                console.log(`Insufficient liquidity (${liquidity} SOL) for ${tokenAddress}`);
                return false;
            }
            
            // 3. Try to get quote - if this fails, we won't be able to trade
            try {
                const quote = await this.dexService.getQuote(
                    this.SOL_MINT,
                    tokenAddress,
                    this.SOL_AMOUNT * 1e9 // in lamports
                );
                
                if (!quote) {
                    console.log(`No quote available for ${tokenAddress}`);
                    return false;
                }
                
                console.log(`Quote available, expected output: ${quote.outAmount} tokens`);
            } catch (quoteError) {
                console.log(`Error getting quote for ${tokenAddress}:`, quoteError);
                return false;
            }
            
            console.log(`${tokenAddress} passed all pre-trade validations`);
            return true;
        } catch (error) {
            console.error(`Error validating token for trading: ${tokenAddress}`, error);
            return false;
        }
    }
} 