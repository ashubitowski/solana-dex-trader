import { Handler } from 'aws-lambda';
import { DexService } from '../src/services/dex';
import { PumpSnipeStrategy } from '../src/strategies/pump-snipe';
import { WalletService } from '../src/services/wallet';

export const handler: Handler = async () => {
  try {
    const walletService = new WalletService();
    const dexService = new DexService(walletService.getConnection(), walletService);
    const snipeStrategy = new PumpSnipeStrategy(dexService);
    const summary = snipeStrategy.getActivePositionsSummary();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, positions: summary })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : error })
    };
  }
};
