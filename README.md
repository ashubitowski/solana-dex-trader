# Solana DEX Trader - Pump Token Sniper

A specialized trading bot for the Solana blockchain that monitors for newly created tokens (like those on pump.fun) and automatically trades them based on configurable strategies.

## Features

- Real-time token monitoring for newly created tokens
- Automatic liquidity detection
- Configurable trade parameters (amount, slippage, etc.)
- Automatic take-profit and stop-loss functionality
- Persistent caching to avoid duplicate processing

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd solana-dex-trader

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

Configure the bot by editing the `.env` file:

```
# Your Solana wallet private key
SOLANA_PRIVATE_KEY=your_private_key_here

# RPC URL for Solana (use a reliable provider)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Optional API keys for enhanced functionality
HELIUS_API_KEY=your_helius_api_key
BIRDEYE_API_KEY=your_birdeye_api_key

# Trade parameters
PUMP_SNIPE_AMOUNT=0.1        # SOL amount per trade
STOP_LOSS_PERCENTAGE=50      # 50% stop loss
TAKE_PROFIT_PERCENTAGE=200   # 200% take profit
SLIPPAGE_BPS=1000            # 10% slippage
```

## Usage

```bash
# Run the pump token sniper
npm run pump-sniper
```

## Disclaimer

This software is for educational purposes only. Trading cryptocurrencies involves significant risk. Use at your own risk.

## License

ISC 