document.addEventListener('DOMContentLoaded', () => {
  // DO NOT Initialize the dashboard automatically, auth.js will trigger it
  // initializeDashboard();
  
  // Setup event listeners for navigation, etc.
  setupEventListeners();
  
  // Simulate initial data for demo
  // simulateData(); // Should probably only run after auth too
  console.log('script.js: DOM Ready, event listeners attached.');
});

// Initialize dashboard
function initializeDashboard() {
  // Set active navigation
  setActiveNav('dashboard');
  
  // Initialize Socket.IO connection if available
  initializeSocketConnection();
}

// Set active navigation link
function setActiveNav(navId) {
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.querySelector(`.sidebar .nav-link[data-nav="${navId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

// Setup event listeners for UI interactions
function setupEventListeners() {
  // Navigation event listeners
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const navId = link.getAttribute('data-nav');
      setActiveNav(navId);
      
      // Show/hide content sections
      showContentSection(navId);
    });
  });
  
  // Config form submission
  const configForm = document.getElementById('configForm');
  if (configForm) {
    configForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveConfiguration();
    });
  }
  
  // Refresh buttons
  document.querySelectorAll('.btn-refresh').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sectionId = btn.getAttribute('data-refresh');
      refreshSection(sectionId);
    });
  });

  // --- Wallet Key Save Button --- 
  const saveWalletBtn = document.getElementById('saveWalletKeyBtn');
  if (saveWalletBtn) {
    saveWalletBtn.addEventListener('click', saveWalletKey);
  }
  // ----------------------------- 
}

// Show specific content section
function showContentSection(sectionId) {
  // Hide all content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Show the requested section
  const sectionToShow = document.getElementById(`${sectionId}Section`);
  if (sectionToShow) {
    sectionToShow.style.display = 'block';
  }
}

// Initialize Socket.IO connection
function initializeSocketConnection() {
  // For now, we'll use polling instead of WebSockets
  updateConnectionStatus('Using polling for updates', 'info');
  
  // Setup polling for updates
  setupPolling();
}

// Setup polling as fallback when Socket.IO is not available
function setupPolling() {
  // Check authentication before starting polling
  const cognitoUser = userPool.getCurrentUser();
  if (!cognitoUser) {
    updateConnectionStatus('Not authenticated', 'warning');
    return;
  }

  // Poll for updates every 5 seconds
  const pollInterval = setInterval(() => {
    cognitoUser.getSession((err, session) => {
      if (err) {
        console.error('Error getting session:', err);
        clearInterval(pollInterval);
        updateConnectionStatus('Session expired', 'error');
        return;
      }

      if (!session.isValid()) {
        clearInterval(pollInterval);
        updateConnectionStatus('Session expired', 'error');
        return;
      }

      // Fetch data for each endpoint
      // console.log('[Polling] Attempting to fetch wallet...'); // Removed
      fetchData('wallet');
      // console.log('[Polling] Attempting to fetch tokens...'); // Removed
      fetchData('tokens');
      // console.log('[Polling] Attempting to fetch logs...'); // Removed
      fetchData('logs');
      // console.log('[Polling] Attempting to fetch positions...'); // Removed
      fetchData('positions');
      // console.log('[Polling] Attempting to fetch stats...'); // Removed
      fetchData('stats');
    });
  }, 5000);
}

// Fetch data from server using REST API
async function fetchData(endpoint) {
  console.log(`[fetchData] Starting fetch for endpoint: ${endpoint}`); // Log start
  try {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      throw new Error('No authenticated user');
    }

    const session = await new Promise((resolve, reject) => {
      cognitoUser.getSession((err, session) => {
        if (err) reject(err);
        else resolve(session);
      });
    });

    const idToken = session.getIdToken().getJwtToken();
    
    const response = await fetch(`${window.config.apiEndpoint}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle data based on endpoint
    switch (endpoint) {
      case 'wallet':
        console.log(`[fetchData] Received wallet data:`, data); // Log received data
        updateWalletInfo(data);
        break;
      case 'tokens':
        updateTokens(data);
        break;
      case 'positions':
        updatePositions(data);
        break;
      case 'logs':
        updateLogs(data);
        break;
      case 'stats':
        updateStats(data);
        break;
    }
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    addLogEntry({
      level: 'error',
      message: `Failed to fetch ${endpoint} data: ${error.message}`,
      timestamp: new Date().toISOString()
    });

    // Update connection status if it's an authentication error
    if (error.message.includes('No authenticated user') || error.message.includes('expired')) {
      updateConnectionStatus('Authentication required', 'error');
    }
  }
}

// Update wallet information
function updateWalletInfo(data) {
  console.log('[updateWalletInfo] Received data:', data); // Log entry
  // Update wallet address
  const addressElement = document.getElementById('walletAddress');
  console.log('[updateWalletInfo] Found addressElement:', addressElement);
  if (addressElement && data.address) {
    const formattedAddress = formatAddress(data.address);
    console.log(`[updateWalletInfo] Setting address to: ${formattedAddress}`);
    addressElement.textContent = formattedAddress;
    addressElement.title = data.address;
  } else {
    console.warn('[updateWalletInfo] addressElement or data.address missing');
  }
  
  // Update wallet balance
  const balanceElement = document.getElementById('walletBalance');
  console.log('[updateWalletInfo] Found balanceElement:', balanceElement);
  if (balanceElement && data.balance !== undefined) {
    const formattedBalance = formatAmount(data.balance) + ' SOL';
    console.log(`[updateWalletInfo] Setting balance to: ${formattedBalance}`);
    balanceElement.textContent = formattedBalance;
  } else {
    console.warn('[updateWalletInfo] balanceElement or data.balance undefined');
  }
  
  // Update connection details
  const rpcEndpointElement = document.getElementById('rpcEndpoint');
  if (rpcEndpointElement && data.rpcEndpoint) {
    rpcEndpointElement.textContent = data.rpcEndpoint;
  }
  
  // Update connection status
  if (data.status) {
    updateConnectionStatus(data.status.message, data.status.type);
  }
}

// Update connection status
function updateConnectionStatus(message, type) {
  const statusElement = document.getElementById('connectionStatus');
  if (statusElement) {
    statusElement.textContent = message;
    
    // Remove all status classes
    statusElement.classList.remove('text-success', 'text-danger', 'text-warning');
    
    // Add appropriate class
    switch (type) {
      case 'success':
        statusElement.classList.add('text-success');
        break;
      case 'danger':
        statusElement.classList.add('text-danger');
        break;
      default:
        statusElement.classList.add('text-warning');
    }
  }
}

// Update tokens list
function updateTokens(data) {
  const tokensContainer = document.getElementById('tokensContainer');
  if (!tokensContainer) return;
  
  // Clear current tokens
  tokensContainer.innerHTML = '';
  
  if (data.tokens && data.tokens.length > 0) {
    // Add each token to the container
    data.tokens.forEach(token => {
      const tokenElement = createTokenElement(token);
      tokensContainer.appendChild(tokenElement);
    });
  } else {
    // Show no tokens message
    tokensContainer.innerHTML = '<div class="no-data">No tokens found</div>';
  }
}

// Create token element
function createTokenElement(token) {
  const tokenDiv = document.createElement('div');
  tokenDiv.className = 'token-card fadeIn';
  tokenDiv.setAttribute('data-address', token.address);
  
  // Token info
  const tokenInfo = document.createElement('div');
  tokenInfo.className = 'token-info';
  
  // Token symbol
  const tokenSymbol = document.createElement('div');
  tokenSymbol.className = 'token-symbol';
  tokenSymbol.textContent = token.symbol || 'Unknown';
  
  // Token address
  const tokenAddress = document.createElement('div');
  tokenAddress.className = 'token-address';
  tokenAddress.textContent = formatAddress(token.address);
  tokenAddress.title = token.address;
  
  // Token liquidity
  const tokenLiquidity = document.createElement('div');
  tokenLiquidity.className = 'token-liquidity';
  tokenLiquidity.textContent = `Liquidity: ${formatAmount(token.liquidity || 0)} SOL`;
  
  // Add to token info
  tokenInfo.appendChild(tokenSymbol);
  tokenInfo.appendChild(tokenAddress);
  tokenInfo.appendChild(tokenLiquidity);
  
  // Token actions
  const tokenActions = document.createElement('div');
  tokenActions.className = 'token-actions';
  
  // Buy button
  const buyButton = document.createElement('button');
  buyButton.className = 'btn btn-sm btn-success';
  buyButton.innerHTML = '<i class="bi bi-cart-plus"></i>';
  buyButton.title = 'Buy token';
  buyButton.onclick = () => initiateTradeAction(token.address, 'buy');
  
  // View button
  const viewButton = document.createElement('button');
  viewButton.className = 'btn btn-sm btn-info';
  viewButton.innerHTML = '<i class="bi bi-binoculars"></i>';
  viewButton.title = 'View details';
  viewButton.onclick = () => viewTokenDetails(token.address);
  
  // Add buttons to actions
  tokenActions.appendChild(buyButton);
  tokenActions.appendChild(viewButton);
  
  // Add all to token div
  tokenDiv.appendChild(tokenInfo);
  tokenDiv.appendChild(tokenActions);
  
  return tokenDiv;
}

// Update logs list
function updateLogs(data) {
  const logsContainer = document.getElementById('logsContainer');
  if (!logsContainer) return;
  
  // Clear current logs
  logsContainer.innerHTML = '';
  
  if (data.logs && data.logs.length > 0) {
    // Add each log to the container
    data.logs.forEach(log => {
      addLogEntry(log, false);
    });
  } else {
    // Show no logs message
    logsContainer.innerHTML = '<div class="no-data">No logs available</div>';
  }
}

// Add a single log entry
function addLogEntry(log, prepend = true) {
  const logsContainer = document.getElementById('logsContainer');
  if (!logsContainer) return;
  
  // Create log entry element
  const logElement = document.createElement('div');
  logElement.className = 'log-entry fadeIn';
  
  // Format timestamp
  const timestamp = log.timestamp ? new Date(log.timestamp) : new Date();
  const timeElement = document.createElement('span');
  timeElement.className = 'log-time';
  timeElement.textContent = timestamp.toLocaleTimeString();
  
  // Format message with appropriate level
  const messageElement = document.createElement('span');
  messageElement.className = `log-level-${log.level || 'info'}`;
  messageElement.textContent = log.message;
  
  // Add to log entry
  logElement.appendChild(timeElement);
  logElement.appendChild(messageElement);
  
  // Add to container
  if (prepend) {
    logsContainer.insertBefore(logElement, logsContainer.firstChild);
  } else {
    logsContainer.appendChild(logElement);
  }
  
  // Limit the number of logs to prevent performance issues
  const maxLogs = 100;
  while (logsContainer.children.length > maxLogs) {
    logsContainer.removeChild(logsContainer.lastChild);
  }
}

// Update positions
function updatePositions(data) {
  const positionsTableBody = document.getElementById('positionsTableBody');
  if (!positionsTableBody) return;
  
  // Clear current positions
  positionsTableBody.innerHTML = '';
  
  if (data.positions && data.positions.length > 0) {
    // Add each position to the table
    data.positions.forEach(position => {
      const row = createPositionRow(position);
      positionsTableBody.appendChild(row);
    });
  } else {
    // Show no positions message
    const noDataRow = document.createElement('tr');
    const noDataCell = document.createElement('td');
    noDataCell.colSpan = 7;
    noDataCell.className = 'text-center';
    noDataCell.textContent = 'No active positions';
    noDataRow.appendChild(noDataCell);
    positionsTableBody.appendChild(noDataRow);
  }
}

// Create position table row
function createPositionRow(position) {
  const row = document.createElement('tr');
  
  // Token symbol
  const symbolCell = document.createElement('td');
  symbolCell.textContent = position.symbol || 'Unknown';
  
  // Entry price
  const entryCell = document.createElement('td');
  entryCell.textContent = formatAmount(position.entryPrice) + ' SOL';
  
  // Current price
  const currentCell = document.createElement('td');
  currentCell.textContent = formatAmount(position.currentPrice) + ' SOL';
  
  // Quantity
  const quantityCell = document.createElement('td');
  quantityCell.textContent = formatAmount(position.quantity);
  
  // PnL value and percentage
  const pnlCell = document.createElement('td');
  const pnlValue = position.currentPrice * position.quantity - position.entryPrice * position.quantity;
  const pnlPercent = ((position.currentPrice / position.entryPrice - 1) * 100).toFixed(2);
  
  pnlCell.textContent = `${formatAmount(pnlValue)} SOL (${pnlPercent}%)`;
  pnlCell.className = pnlValue >= 0 ? 'profit-positive' : 'profit-negative';
  
  // Time held
  const timeCell = document.createElement('td');
  timeCell.textContent = formatTimeHeld(position.entryTime);
  
  // Actions
  const actionsCell = document.createElement('td');
  
  // Sell button
  const sellButton = document.createElement('button');
  sellButton.className = 'btn btn-sm btn-danger me-1';
  sellButton.innerHTML = '<i class="bi bi-cash"></i>';
  sellButton.title = 'Sell token';
  sellButton.onclick = () => initiateTradeAction(position.address, 'sell');
  
  // Details button
  const detailsButton = document.createElement('button');
  detailsButton.className = 'btn btn-sm btn-info';
  detailsButton.innerHTML = '<i class="bi bi-info-circle"></i>';
  detailsButton.title = 'View details';
  detailsButton.onclick = () => viewPositionDetails(position.address);
  
  actionsCell.appendChild(sellButton);
  actionsCell.appendChild(detailsButton);
  
  // Add all cells to row
  row.appendChild(symbolCell);
  row.appendChild(entryCell);
  row.appendChild(currentCell);
  row.appendChild(quantityCell);
  row.appendChild(pnlCell);
  row.appendChild(timeCell);
  row.appendChild(actionsCell);
  
  return row;
}

// Update trading stats
function updateStats(data) {
  // Update total trades
  const totalTradesElement = document.getElementById('totalTrades');
  if (totalTradesElement && data.totalTrades !== undefined) {
    totalTradesElement.textContent = data.totalTrades;
  }
  
  // Update profitable trades
  const profitableTradesElement = document.getElementById('profitableTrades');
  if (profitableTradesElement && data.profitableTrades !== undefined) {
    profitableTradesElement.textContent = data.profitableTrades;
  }
  
  // Update success rate
  const successRateElement = document.getElementById('successRate');
  if (successRateElement && data.totalTrades > 0) {
    const successRate = (data.profitableTrades / data.totalTrades * 100).toFixed(1);
    successRateElement.textContent = `${successRate}%`;
  }
  
  // Update total profit
  const totalProfitElement = document.getElementById('totalProfit');
  if (totalProfitElement && data.totalProfit !== undefined) {
    const profitText = formatAmount(data.totalProfit) + ' SOL';
    totalProfitElement.textContent = profitText;
    totalProfitElement.className = data.totalProfit >= 0 ? 'text-success' : 'text-danger';
  }
}

// Save configuration
function saveConfiguration() {
  const minLiquidity = document.getElementById('minLiquidity').value;
  const tradeAmount = document.getElementById('tradeAmount').value;
  const slippageTolerance = document.getElementById('slippageTolerance').value;
  const takeProfit = document.getElementById('takeProfit').value;
  const stopLoss = document.getElementById('stopLoss').value;
  const maxActiveTokens = document.getElementById('maxActiveTokens').value;
  const autoSell = document.getElementById('autoSell').checked;
  const autoTrade = document.getElementById('autoTrade').checked;
  
  const config = {
    minLiquidity,
    tradeAmount,
    slippageTolerance,
    takeProfit,
    stopLoss,
    maxActiveTokens,
    autoSell,
    autoTrade
  };
  
  // Save config via API
  fetch('/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }
      return response.json();
    })
    .then(data => {
      // Show success message
      addLogEntry({
        level: 'success',
        message: 'Configuration saved successfully',
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      console.error('Error saving config:', error);
      addLogEntry({
        level: 'error',
        message: `Failed to save configuration: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    });
}

// Initiate trade action (buy/sell)
function initiateTradeAction(tokenAddress, action) {
  fetch('/api/trade', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tokenAddress,
      action
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to ${action} token`);
      }
      return response.json();
    })
    .then(data => {
      addLogEntry({
        level: 'success',
        message: `${action.toUpperCase()} order for ${formatAddress(tokenAddress)} submitted successfully`,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      console.error(`Error ${action} token:`, error);
      addLogEntry({
        level: 'error',
        message: `Failed to ${action} token: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    });
}

// View token details
function viewTokenDetails(tokenAddress) {
  // Implement token details view
  console.log('View token details:', tokenAddress);
  
  // For demo, just log to UI
  addLogEntry({
    level: 'info',
    message: `Viewing token details for ${formatAddress(tokenAddress)}`,
    timestamp: new Date().toISOString()
  });
}

// View position details
function viewPositionDetails(tokenAddress) {
  // Implement position details view
  console.log('View position details:', tokenAddress);
  
  // For demo, just log to UI
  addLogEntry({
    level: 'info',
    message: `Viewing position details for ${formatAddress(tokenAddress)}`,
    timestamp: new Date().toISOString()
  });
}

// Refresh specific section
function refreshSection(sectionId) {
  console.log('Refreshing section:', sectionId);
  
  // Show loading state
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add('loading');
  }
  
  // Fetch latest data
  fetchData(sectionId);
  
  // Remove loading state after timeout
  setTimeout(() => {
    if (section) {
      section.classList.remove('loading');
    }
  }, 1000);
}

// Utility: Format address to be more readable
function formatAddress(address) {
  if (!address) return 'Unknown';
  if (address.length <= 12) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Utility: Format amount to be more readable
function formatAmount(amount) {
  if (amount === undefined || amount === null) return '0';
  return parseFloat(amount).toFixed(4);
}

// Utility: Format time held
function formatTimeHeld(entryTimeStr) {
  if (!entryTimeStr) return 'Unknown';
  
  const entryTime = new Date(entryTimeStr);
  const now = new Date();
  const diffMs = now - entryTime;
  
  // Convert to appropriate unit
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d`;
}

// Simulate data for development and testing
function simulateData() {
  // Check if we're in production
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }
  
  console.log('Simulating data for development...');
  
  // Sample wallet data
  const walletData = {
    address: '8xpGJ4JxSN1xQYF2NSxdMoMpyGfcNPKPkrB7xgv8YE6P',
    balance: 10.5432,
    rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    status: { message: 'Connected', type: 'success' }
  };
  
  // Sample tokens data
  const tokensData = {
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
      },
      {
        address: '9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM',
        symbol: 'MEME',
        name: 'Memecoin',
        liquidity: 1234.56
      }
    ]
  };
  
  // Sample logs data
  const logsData = {
    logs: [
      {
        level: 'info',
        message: 'Bot started successfully',
        timestamp: new Date(Date.now() - 300000).toISOString()
      },
      {
        level: 'info',
        message: 'Connected to Solana mainnet',
        timestamp: new Date(Date.now() - 290000).toISOString()
      },
      {
        level: 'info',
        message: 'Monitoring for new tokens...',
        timestamp: new Date(Date.now() - 280000).toISOString()
      },
      {
        level: 'success',
        message: 'Found new token: BONK',
        timestamp: new Date(Date.now() - 240000).toISOString()
      },
      {
        level: 'info',
        message: 'Checking liquidity for BONK...',
        timestamp: new Date(Date.now() - 230000).toISOString()
      },
      {
        level: 'success',
        message: 'Liquidity confirmed for BONK: 52890.45 SOL',
        timestamp: new Date(Date.now() - 220000).toISOString()
      },
      {
        level: 'warn',
        message: 'API rate limit approaching',
        timestamp: new Date(Date.now() - 180000).toISOString()
      },
      {
        level: 'success',
        message: 'Buy order executed for BONK: 0.5 SOL',
        timestamp: new Date(Date.now() - 120000).toISOString()
      },
      {
        level: 'error',
        message: 'Failed to fetch price from Jupiter API',
        timestamp: new Date(Date.now() - 60000).toISOString()
      }
    ]
  };
  
  // Sample positions data
  const positionsData = {
    positions: [
      {
        address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        symbol: 'BONK',
        entryPrice: 0.0000025,
        currentPrice: 0.0000032,
        quantity: 200000,
        entryTime: new Date(Date.now() - 3600000).toISOString()
      },
      {
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        symbol: 'SAMO',
        entryPrice: 0.015,
        currentPrice: 0.014,
        quantity: 100,
        entryTime: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  };
  
  // Sample stats data
  const statsData = {
    totalTrades: 15,
    profitableTrades: 9,
    totalProfit: 2.456
  };
  
  // Update UI with sample data
  setTimeout(() => updateWalletInfo(walletData), 500);
  setTimeout(() => updateTokens(tokensData), 800);
  setTimeout(() => updateLogs(logsData), 1100);
  setTimeout(() => updatePositions(positionsData), 1400);
  setTimeout(() => updateStats(statsData), 1700);
}

// Update user profile
function updateUserProfile(data) {
  const userProfile = document.getElementById('userProfile');
  if (!userProfile) return;
  
  if (data) {
    userProfile.innerHTML = `
      <div class="profile-info">
        <h4>${data.name}</h4>
        <p>${data.email}</p>
        <p>Member since: ${new Date(data.createdAt).toLocaleDateString()}</p>
      </div>
    `;
  } else {
    userProfile.innerHTML = '<div class="profile-info">No profile data available</div>';
  }
}

// --- Function to Save Wallet Key --- 
async function saveWalletKey() {
    const secretKeyInput = document.getElementById('secretKeyInput');
    const statusElement = document.getElementById('walletConfigStatus');
    
    if (!secretKeyInput || !statusElement) {
        console.error('Required elements for saving wallet key not found');
        return;
    }

    const secretKeyString = secretKeyInput.value.trim();
    statusElement.textContent = 'Saving...';
    statusElement.className = 'mt-2 text-info';

    // Basic validation for Base58
    if (!secretKeyString) {
        statusElement.textContent = 'Error: Secret key cannot be empty.';
        statusElement.className = 'mt-2 text-danger';
        return;
    }
    // Basic length check (Solana keys are typically 86-88 chars Base58 encoded)
    // More robust validation happens on the backend with bs58.decode()
    if (secretKeyString.length < 80 || secretKeyString.length > 90) { 
        console.warn('Potential invalid key length, but sending to backend for validation.');
        // Allowing backend to validate fully
    }
    
    try {
        // Get user session for auth token
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) {
            throw new Error('No authenticated user');
        }
        const session = await new Promise((resolve, reject) => {
            cognitoUser.getSession((err, session) => {
                if (err) reject(err);
                else resolve(session);
            });
        });
        const idToken = session.getIdToken().getJwtToken();

        // Call the backend endpoint
        const response = await fetch(`${window.config.apiEndpoint}config/wallet`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            // Send Base58 key string directly
            body: JSON.stringify({ secretKeyBase58: secretKeyString })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || `HTTP error! status: ${response.status}`);
        }

        statusElement.textContent = 'Wallet key saved successfully!';
        statusElement.className = 'mt-2 text-success';
        secretKeyInput.value = ''; // Clear input on success
        
        // Fetch wallet info again to update display
        fetchData('wallet'); 

    } catch (error) {
        console.error('Error saving wallet key:', error);
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.className = 'mt-2 text-danger';
    }
}
// --------------------------------- 