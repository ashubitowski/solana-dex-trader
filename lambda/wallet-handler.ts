import { Handler } from 'aws-lambda';
import { WalletService } from '../src/services/wallet';

export const handler: Handler = async () => {
  try {
    const walletService = new WalletService();
    const publicKey = walletService.getPublicKey().toBase58();
    const connection = walletService.getConnection();
    const balance = await connection.getBalance(walletService.getPublicKey());
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        address: publicKey,
        balance: balance / 1e9 // SOL
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error instanceof Error ? error.message : error })
    };
  }
};
