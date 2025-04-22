import { Handler } from 'aws-lambda';
import { DexService } from '../src/services/dex';
import { PumpSnipeStrategy } from '../src/strategies/pump-snipe';
import { WalletService } from '../src/services/wallet';

// Lambda handler for executing a trade
export const handler: Handler = async (event) => {
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { tokenAddress } = body;

    // Initialize wallet and services
    const walletService = new WalletService();
    const dexService = new DexService(walletService.getConnection(), walletService);
    const snipeStrategy = new PumpSnipeStrategy(dexService);

    // Execute the trade (snipeToken returns true/false or throws)
    const result = await snipeStrategy.snipeToken(tokenAddress);
    return {
      statusCode: result ? 200 : 400,
      body: JSON.stringify({ success: !!result })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : error })
    };
  }
};
