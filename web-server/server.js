const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies
app.use(express.json());

// Store bot state
let botState = {
  isRunning: false,
  lastUpdate: null,
  stats: {
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    profitLoss: 0
  }
};

// API endpoint to get bot state
app.get('/api/bot-state', (req, res) => {
  res.json(botState);
});

// API endpoint to update bot state
app.post('/api/bot-state', (req, res) => {
  botState = {
    ...botState,
    ...req.body,
    lastUpdate: new Date().toISOString()
  };
  res.json({ success: true });
});

// API endpoint to start bot
app.post('/api/start-bot', (req, res) => {
  botState.isRunning = true;
  res.json({ success: true });
});

// API endpoint to stop bot
app.post('/api/stop-bot', (req, res) => {
  botState.isRunning = false;
  res.json({ success: true });
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 