# Solana DEX Trader - Pump Token Sniper

A specialized trading bot for the Solana blockchain that monitors for newly created tokens (like those on pump.fun) and automatically trades them based on configurable strategies.

## Features

- Real-time token monitoring for newly created tokens
- Automatic liquidity detection
- Token age filtering (focus on tokens within a specific age range)
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

# RPC URL - Alchemy recommended for better performance
SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# Optional API keys for enhanced functionality
HELIUS_API_KEY=your_helius_api_key
BIRDEYE_API_KEY=your_birdeye_api_key
ALCHEMY_API_KEY=your_alchemy_api_key

# Trade parameters
PUMP_SNIPE_AMOUNT=0.02        # SOL amount per trade
STOP_LOSS_PERCENTAGE=50      # 50% stop loss
TAKE_PROFIT_PERCENTAGE=200   # 200% take profit
SLIPPAGE_BPS=1000            # 10% slippage

# Token filtering parameters
MIN_LIQUIDITY_THRESHOLD=5    # Minimum liquidity in SOL
MIN_TOKEN_AGE_HOURS=24       # Only consider tokens at least 24 hours old
MAX_TOKEN_AGE_HOURS=72       # Only consider tokens up to 72 hours old
```

### Setting Up Alchemy (Recommended)

For optimal performance and to avoid rate limiting issues, set up an Alchemy account:

1. Go to [alchemy.com](https://www.alchemy.com/) and create an account
2. Create a new app with the following settings:
   - Chain: Solana
   - Network: Mainnet
   - Name: Solana DEX Trader (or your preferred name)
3. Copy your API key and add it to your `.env` file:
   ```
   SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
   ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY
   ```

Using Alchemy provides several benefits:
- Higher rate limits
- Faster response times
- More reliable connections
- Better token age determination

## Usage

```bash
# Run the pump token sniper
npm run pump-sniper
```

## Disclaimer

This software is for educational purposes only. Trading cryptocurrencies involves significant risk. Use at your own risk.

## License

ISC 