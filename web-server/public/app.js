// Dashboard State
const state = {
  isConnected: false,
  isTrading: false,
  wallet: {
    address: '',
    balance: 0
  },
  stats: {
    tokensDetected: 0,
    tradesExecuted: 0,
    successfulTrades: 0,
    failedTrades: 0,
    profitLoss: 0
  },
  logs: [],
  detectedTokens: [],
  activePositions: []
};

// DOM Elements - DECLARE ONLY, INITIALIZE LATER
const elements = {}; 

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('app.js: DOM Ready, waiting for authentication to initialize UI.');
  // No longer check elements here, wait until initialization
});

// Function to initialize DOM elements
function initializeDOMElements() {
  console.log('app.js: Initializing DOM elements.');
  elements.walletStatus = document.querySelector('#walletStatus');
  elements.walletAddress = document.querySelector('#walletAddress');
  elements.walletBalance = document.querySelector('#walletBalance');
  elements.connectionStatus = document.querySelector('#connectionStatus'); 
  elements.rpcEndpoint = document.querySelector('#rpcEndpoint');
  
  elements.totalTrades = document.querySelector('#totalTrades');
  elements.profitableTrades = document.querySelector('#profitableTrades');
  elements.successRate = document.querySelector('#successRate');
  elements.totalProfit = document.querySelector('#totalProfit');
  
  elements.logsContainer = document.querySelector('#logsContainer');
  elements.tokensContainer = document.querySelector('#tokensContainer');
  elements.allTokensContainer = document.querySelector('#allTokensContainer');
  elements.positionsTableBody = document.querySelector('#positionsTableBody');
  elements.activePositionsTableBody = document.querySelector('#activePositionsTableBody');
  elements.closedPositionsTableBody = document.querySelector('#closedPositionsTableBody');
  
  elements.configForm = document.querySelector('#configForm');

  elements.userProfile = document.querySelector('#userProfile');

  // Log any missing elements *after* trying to initialize
  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element)
    .map(([key]) => key);

  if (missingElements.length > 0) {
    console.warn('app.js: Missing required DOM elements after init:', missingElements);
  }
}

// Expose an initialization function to be called after authentication
window.initializeAppUI = () => {
    console.log('app.js: Initializing UI and Listeners after authentication.');
    initializeDOMElements(); // Initialize elements FIRST
    initializeUI();
    setupEventListeners();
    checkBackendConnection(); 
    
    // Start polling for data after UI is ready
    if (typeof setupPolling === 'function') {
        console.log('app.js: Calling setupPolling() from script.js');
        setupPolling(); 
    } else {
        console.error('app.js: setupPolling function not found!');
    }
};

// Initialize UI
function initializeUI() {
  try {
    updateWalletUI();
    updateStatsUI();
  } catch (error) {
    console.error('Error initializing UI:', error);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  try {
    // Configuration form
    if (elements.configForm) {
      elements.configForm.addEventListener('submit', saveConfig);
    }
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

// Fetch wallet balance
async function fetchWalletBalance() {
  try {
    // In production, this would connect to your backend
    // For now, just set a mock balance
    state.wallet.balance = 2.5;
    return state.wallet.balance;
  } catch (error) {
    console.error('Error fetching balance:', error);
    addLog(`Failed to fetch wallet balance: ${error.message}`, 'error');
    return 0;
  }
}

// Configuration
function saveConfig(e) {
  e.preventDefault();
  
  const formData = new FormData(elements.configForm);
  const config = Object.fromEntries(formData.entries());
  
  // In production, this would send config to your backend
  console.log('Saving configuration:', config);
  addLog('Configuration saved', 'success');
}

// Update UI Functions
function updateWalletUI() {
  if (state.isConnected) {
    elements.walletStatus.textContent = 'Connected';
    elements.walletStatus.className = 'badge bg-success';
    elements.walletAddress.textContent = formatAddress(state.wallet.address);
    elements.walletBalance.textContent = `${state.wallet.balance.toFixed(4)} SOL`;
  } else {
    elements.walletStatus.textContent = 'Not Connected';
    elements.walletStatus.className = 'badge bg-danger';
    elements.walletAddress.textContent = 'Not Available';
    elements.walletBalance.textContent = '0 SOL';
  }
}

function updateStatsUI() {
  elements.totalTrades.textContent = state.stats.tradesExecuted;
  elements.profitableTrades.textContent = state.stats.successfulTrades;
  
  const successRate = state.stats.tradesExecuted > 0 
    ? ((state.stats.successfulTrades / state.stats.tradesExecuted) * 100).toFixed(1) 
    : '0.0';
  elements.successRate.textContent = `${successRate}%`;
  
  const plClass = state.stats.profitLoss >= 0 ? 'text-success' : 'text-danger';
  elements.totalProfit.textContent = `${state.stats.profitLoss >= 0 ? '+' : ''}${state.stats.profitLoss.toFixed(4)} SOL`;
  elements.totalProfit.className = plClass;
}

// Utility Functions
function formatAddress(address) {
  if (!address) return 'Not Available';
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// Logging
function addLog(message, level = 'info') {
  const log = {
    timestamp: Date.now(),
    message,
    level
  };
  
  state.logs.unshift(log);
  if (state.logs.length > 100) state.logs.pop();
  
  renderLogs();
}

function renderLogs() {
  elements.logsContainer.innerHTML = '';
  
  state.logs.forEach(log => {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${log.level}`;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTimestamp(log.timestamp);
    
    const message = document.createElement('span');
    message.className = 'message';
    message.textContent = log.message;
    
    logEntry.appendChild(timestamp);
    logEntry.appendChild(message);
    elements.logsContainer.appendChild(logEntry);
  });
}

// Token Display
function renderTokens() {
  elements.tokensContainer.innerHTML = '';
  
  state.detectedTokens.forEach(token => {
    const tokenCard = document.createElement('div');
    tokenCard.className = 'token-card';
    tokenCard.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="token-name">${token.symbol}</div>
          <div class="token-details">${token.name}</div>
          <div class="token-address">${formatAddress(token.address)}</div>
        </div>
        <div class="text-end">
          <div class="token-price">${token.price.toFixed(6)} SOL</div>
          <div class="token-change ${token.priceChange >= 0 ? 'positive' : 'negative'}">
            ${token.priceChange >= 0 ? '+' : ''}${token.priceChange.toFixed(2)}%
          </div>
          <button class="btn btn-sm btn-primary mt-2" onclick="buyToken('${token.address}')">Buy</button>
        </div>
      </div>
    `;
    elements.tokensContainer.appendChild(tokenCard);
  });
}

// Position Display
function renderPositions() {
  elements.positionsTableBody.innerHTML = '';
  
  state.activePositions.forEach(position => {
    const positionRow = document.createElement('tr');
    
    const profitLossClass = position.profitLoss >= 0 ? 'text-success' : 'text-danger';
    const profitLossText = `${position.profitLoss >= 0 ? '+' : ''}${position.profitLoss.toFixed(2)}%`;
    
    positionRow.innerHTML = `
      <td>${position.symbol}</td>
      <td>${formatAddress(position.address)}</td>
      <td>${position.amount.toFixed(0)}</td>
      <td>${position.entryPrice.toFixed(6)} SOL</td>
      <td>${position.currentPrice.toFixed(6)} SOL</td>
      <td class="${profitLossClass}">${profitLossText}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="sellToken('${position.address}')">Sell</button>
      </td>
    `;
    
    elements.positionsTableBody.appendChild(positionRow);
  });
}

// Backend Connection
async function checkBackendConnection() {
  try {
    // In production, this would check your backend API
    // For demo, just set as connected
    elements.connectionStatus.textContent = 'Connected';
    elements.connectionStatus.className = 'badge bg-success';
    addLog('Connected to backend service', 'info');
  } catch (error) {
    elements.connectionStatus.textContent = 'Disconnected';
    elements.connectionStatus.className = 'badge bg-danger';
    addLog('Failed to connect to backend service', 'error');
  }
}

// Token Actions
function buyToken(address) {
  if (!state.isConnected) {
    addLog('Please connect your wallet first', 'warning');
    return;
  }
  
  // In production, this would call your backend API
  addLog(`Initiating purchase of token ${formatAddress(address)}`, 'info');
  
  // Mock a successful purchase
  setTimeout(() => {
    addLog(`Successfully purchased token ${formatAddress(address)}`, 'success');
    state.stats.tradesExecuted++;
    state.stats.successfulTrades++;
    updateStatsUI();
    
    // Add to positions
    const token = state.detectedTokens.find(t => t.address === address);
    if (token) {
      const position = {
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        amount: Math.floor(Math.random() * 10000) + 1000,
        entryPrice: token.price,
        currentPrice: token.price,
        profitLoss: 0
      };
      state.activePositions.push(position);
      renderPositions();
    }
  }, 2000);
}

function sellToken(address) {
  if (!state.isConnected) {
    addLog('Please connect your wallet first', 'warning');
    return;
  }
  
  // In production, this would call your backend API
  addLog(`Initiating sale of token ${formatAddress(address)}`, 'info');
  
  // Mock a successful sale
  setTimeout(() => {
    addLog(`Successfully sold token ${formatAddress(address)}`, 'success');
    state.stats.tradesExecuted++;
    state.stats.successfulTrades++;
    
    // Calculate profit/loss
    const position = state.activePositions.find(p => p.address === address);
    if (position) {
      const profit = position.amount * (position.currentPrice - position.entryPrice);
      state.stats.profitLoss += profit;
      
      // Remove from positions
      state.activePositions = state.activePositions.filter(p => p.address !== address);
      renderPositions();
      updateStatsUI();
    }
  }, 2000);
}

// Mock data for development
function mockData() {
  // Add some mock tokens
  state.detectedTokens = [
    {
      symbol: 'PUMP',
      name: 'Pump Token',
      address: '7PumpNfGMLaEYBhdLNLU9A9So5Bkz2quQ6iLf8CuSfQ',
      price: 0.000423,
      priceChange: 152.8
    },
    {
      symbol: 'MOON',
      name: 'Moon Shot',
      address: '8MoonSzWXSqRMUVViYwM8hCUcVWxhY35Kg1Ns2QMbx',
      price: 0.000107,
      priceChange: 87.5
    },
    {
      symbol: 'DEFI',
      name: 'Defi Protocol',
      address: '9DefiZxR2GzghrtU6aKunVb78wzxSPgU7H55q2KEyr',
      price: 0.000891,
      priceChange: -12.3
    }
  ];
  
  // Add some mock positions
  state.activePositions = [
    {
      symbol: 'SOL20',
      name: 'Solana 2020',
      address: 'Sol20xNcg2uVViYwM8hCUcVWxhY35Kg1Ns2QMbx',
      amount: 25000,
      entryPrice: 0.000051,
      currentPrice: 0.000079,
      profitLoss: 54.9
    }
  ];
  
  // Add mock logs
  addLog('System initialized', 'info');
  addLog('Connected to Solana mainnet', 'info');
  addLog('Monitoring for new token launches', 'info');
  
  // Set mock stats
  state.stats.tokensDetected = 27;
  state.stats.tradesExecuted = 3;
  state.stats.successfulTrades = 2;
  state.stats.failedTrades = 1;
  state.stats.profitLoss = 0.0825;
  
  // Render UI
  renderTokens();
  renderPositions();
  updateStatsUI();
}

function updateMockData() {
  // Update token prices
  state.detectedTokens.forEach(token => {
    const change = (Math.random() * 10) - 5; // -5% to +5%
    token.price *= (1 + (change / 100));
    token.priceChange += change;
  });
  
  // Update positions
  state.activePositions.forEach(position => {
    const change = (Math.random() * 6) - 2; // -2% to +4%
    position.currentPrice *= (1 + (change / 100));
    position.profitLoss = ((position.currentPrice / position.entryPrice) - 1) * 100;
  });
  
  // Add a random log
  const logMessages = [
    'Scanning for new tokens',
    'New token detected: RANDOM',
    'Checking liquidity for token MOON',
    'Price update received for active positions',
    'Network latency: 125ms'
  ];
  const randomMessage = logMessages[Math.floor(Math.random() * logMessages.length)];
  addLog(randomMessage, 'info');
  
  // Maybe add a new token
  if (Math.random() > 0.8) {
    const symbols = ['GEM', 'LAMBO', 'ASTRO', 'DOGE', 'PEPE', 'MEME'];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    state.detectedTokens.push({
      symbol: randomSymbol,
      name: `${randomSymbol} Token`,
      address: `${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
      price: Math.random() * 0.001,
      priceChange: Math.random() * 200
    });
    
    state.stats.tokensDetected++;
    addLog(`New token detected: ${randomSymbol}`, 'success');
  }
  
  // Render UI updates
  renderTokens();
  renderPositions();
  updateStatsUI();
} 