/**
 * This script connects the Solana DEX Trader bot to the web UI
 * It captures console output and passes it to the web server
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('node-fetch');

// Load server if run directly
let server;
if (require.main === module) {
  server = require('./server');
} else {
  // If imported, assume server is running separately
  server = { updateBotState: () => {}, addLog: () => {} };
}

class BotConnector {
  constructor(options = {}) {
    this.options = {
      botCommand: 'npm',
      botArgs: ['run', 'pump-sniper'],
      serverUrl: 'http://localhost:3000',
      pollInterval: 5000, // How often to poll the bot for status updates
      ...options
    };
    
    this.botProcess = null;
    this.isRunning = false;
    this.lastUpdate = Date.now();
    
    // Create log directory if needed
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Create log file for bot output
    this.logStream = fs.createWriteStream(
      path.join(logDir, `bot-${new Date().toISOString().replace(/:/g, '-')}.log`),
      { flags: 'a' }
    );
  }
  
  /**
   * Start the bot process
   */
  start() {
    if (this.isRunning) {
      server.addLog('Bot is already running', 'warning');
      return;
    }
    
    server.addLog('Starting bot...', 'info');
    
    // Spawn the bot process
    this.botProcess = spawn(this.options.botCommand, this.options.botArgs, {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, FORCE_COLOR: '1' } // Preserve colors in logs
    });
    
    this.isRunning = true;
    server.updateBotState({ isRunning: true });
    
    // Process stdout (regular logs)
    this.botProcess.stdout.on('data', (data) => {
      const output = data.toString();
      this.processOutput(output);
      this.logStream.write(output);
    });
    
    // Process stderr (error logs)
    this.botProcess.stderr.on('data', (data) => {
      const output = data.toString();
      this.processOutput(output, 'error');
      this.logStream.write(`[ERROR] ${output}`);
    });
    
    // Handle bot process exit
    this.botProcess.on('close', (code) => {
      this.isRunning = false;
      this.botProcess = null;
      server.updateBotState({ isRunning: false });
      
      if (code !== 0) {
        server.addLog(`Bot process exited with code ${code}`, 'error');
      } else {
        server.addLog('Bot process exited normally', 'info');
      }
      
      this.logStream.end();
    });
    
    // Start status polling
    this.startPolling();
  }
  
  /**
   * Stop the bot process
   */
  stop() {
    if (!this.isRunning) {
      server.addLog('Bot is not running', 'warning');
      return;
    }
    
    server.addLog('Stopping bot...', 'info');
    
    // On Windows use taskkill, on Unix use SIGINT
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', this.botProcess.pid, '/f', '/t']);
    } else {
      this.botProcess.kill('SIGINT'); 
    }
    
    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
  
  /**
   * Process bot output and extract useful information
   */
  processOutput(output, type = 'info') {
    // Log to web UI
    server.addLog(output.trim(), type);
    
    // Extract wallet information
    const walletAddressMatch = output.match(/Using wallet: ([A-Za-z0-9]{32,})/);
    if (walletAddressMatch) {
      server.updateBotState({ walletAddress: walletAddressMatch[1] });
    }
    
    // Extract wallet balance
    const walletBalanceMatch = output.match(/Wallet balance: ([0-9.]+) SOL/);
    if (walletBalanceMatch) {
      server.updateBotState({ walletBalance: parseFloat(walletBalanceMatch[1]) });
    }
    
    // Extract active positions
    const activePositionsMatch = output.match(/ACTIVE POSITIONS: ([0-9]+)\/([0-9]+)/);
    if (activePositionsMatch) {
      server.updateBotState({ 
        activePositionsCount: parseInt(activePositionsMatch[1]),
        maxPositions: parseInt(activePositionsMatch[2])
      });
    }
    
    // Extract new tokens
    const newTokenMatch = output.match(/New token detected: ([A-Za-z0-9]{32,}) \(([A-Za-z0-9]+) - ([^)]+)\)/);
    if (newTokenMatch) {
      const token = {
        address: newTokenMatch[1],
        symbol: newTokenMatch[2],
        name: newTokenMatch[3],
        timestamp: new Date().toISOString(),
      };
      
      // Add to detected tokens list
      server.updateBotState((prevState) => {
        const updatedTokens = [...(prevState.detectedTokens || [])];
        updatedTokens.unshift(token); // Add to beginning
        return { detectedTokens: updatedTokens.slice(0, 100) }; // Keep only last 100
      });
    }
    
    // Extract token age
    const tokenAgeMatch = output.match(/Token age check passed \(([0-9.]+) hours\)/);
    if (tokenAgeMatch && newTokenMatch) {
      // Update the last detected token with age info
      server.updateBotState((prevState) => {
        const updatedTokens = [...(prevState.detectedTokens || [])];
        if (updatedTokens.length > 0) {
          updatedTokens[0].ageHours = parseFloat(tokenAgeMatch[1]);
        }
        return { detectedTokens: updatedTokens };
      });
    }
    
    // Extract liquidity information
    const liquidityMatch = output.match(/Sufficient liquidity found \(([0-9.]+) SOL\)/);
    if (liquidityMatch && newTokenMatch) {
      // Update the last detected token with liquidity info
      server.updateBotState((prevState) => {
        const updatedTokens = [...(prevState.detectedTokens || [])];
        if (updatedTokens.length > 0) {
          updatedTokens[0].liquiditySol = parseFloat(liquidityMatch[1]);
        }
        return { detectedTokens: updatedTokens };
      });
    }
  }
  
  /**
   * Start polling for bot status and metrics
   */
  startPolling() {
    this.pollInterval = setInterval(() => {
      // Additional polling logic if needed
      // For now we rely on log parsing
    }, this.options.pollInterval);
  }
}

// Create default connector instance
const connector = new BotConnector();

// Export the connector
module.exports = connector;

// If this script is run directly, start the bot
if (require.main === module) {
  // Start after a short delay to allow server to initialize
  setTimeout(() => {
    connector.start();
  }, 1000);
} 