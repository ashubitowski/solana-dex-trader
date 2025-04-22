import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoints
app.get('/api/wallet', (req, res) => {
  // Simulate wallet data
  res.json({
    address: '8xpGJ4JxSN1xQYF2NSxdMoMpyGfcNPKPkrB7xgv8YE6P',
    balance: 10.5432,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    status: { message: 'Connected', type: 'success' }
  });
});

app.get('/api/tokens', (req, res) => {
  // Simulate tokens data
  res.json({
    tokens: [
      {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        symbol: 'SAMO',
        name: 'Samoyedcoin',
        liquidity: 24356.78
      },
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        symbol: 'BONK',
        name: 'Bonk',
        liquidity: 52890.45
      }
    ]
  });
});

app.get('/api/logs', (req, res) => {
  // Simulate logs data
  res.json({
    logs: [
      {
        level: 'info',
        message: 'Bot started successfully',
        timestamp: new Date().toISOString()
      },
      {
        level: 'success',
        message: 'Connected to Solana mainnet',
        timestamp: new Date().toISOString()
      }
    ]
  });
});

app.get('/api/positions', (req, res) => {
  // Simulate positions data
  res.json({
    positions: [
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        symbol: 'BONK',
        entryPrice: 0.0000025,
        currentPrice: 0.0000032,
        quantity: 200000,
        entryTime: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  });
});

app.get('/api/stats', (req, res) => {
  // Simulate stats data
  res.json({
    totalTrades: 15,
    profitableTrades: 9,
    totalProfit: 2.456
  });
});

app.post('/api/config', (req, res) => {
  // Simulate config save
  console.log('Saving config:', req.body);
  res.json({ success: true });
});

app.post('/api/trade', (req, res) => {
  // Simulate trade execution
  console.log('Executing trade:', req.body);
  res.json({ success: true });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Handle client subscription
  socket.on('subscribe', (data) => {
    console.log('Client subscribed to:', data.topics);
  });
  
  // Simulate real-time updates
  const updateInterval = setInterval(() => {
    // Simulate random updates
    const randomUpdate = Math.floor(Math.random() * 4);
    switch (randomUpdate) {
      case 0:
        socket.emit('wallet_update', {
          balance: (10 + Math.random()).toFixed(4)
        });
        break;
      case 1:
        socket.emit('tokens_update', {
          tokens: [{
            address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            symbol: 'SAMO',
            liquidity: (20000 + Math.random() * 10000).toFixed(2)
          }]
        });
        break;
      case 2:
        socket.emit('log_update', {
          level: 'info',
          message: 'New token detected',
          timestamp: new Date().toISOString()
        });
        break;
      case 3:
        socket.emit('positions_update', {
          positions: [{
            address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
            symbol: 'BONK',
            currentPrice: (0.000003 + Math.random() * 0.000001).toFixed(8)
          }]
        });
        break;
    }
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    clearInterval(updateInterval);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard available at http://localhost:${PORT}`);
}); 