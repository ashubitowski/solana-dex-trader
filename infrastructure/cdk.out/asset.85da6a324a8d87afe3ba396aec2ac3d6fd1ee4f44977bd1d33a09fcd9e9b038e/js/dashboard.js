import { pollingService } from './polling-service.js';

class Dashboard {
  constructor() {
    this.initializeElements();
    this.initializeEventListeners();
    this.initializePolling();
  }

  initializeElements() {
    this.startButton = document.getElementById('startBot');
    this.stopButton = document.getElementById('stopBot');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statsContainer = document.getElementById('statsContainer');
    this.tradeHistory = document.getElementById('tradeHistory');
    this.errorLog = document.getElementById('errorLog');
  }

  initializeEventListeners() {
    this.startButton.addEventListener('click', () => this.startBot());
    this.stopButton.addEventListener('click', () => this.stopBot());
  }

  initializePolling() {
    this.unsubscribe = pollingService.subscribe((state) => {
      this.updateUI(state);
    });
  }

  async startBot() {
    try {
      const response = await fetch('/api/start-bot', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to start bot');
      }
      this.updateStatus('running');
    } catch (error) {
      console.error('Error starting bot:', error);
      this.logError('Failed to start bot');
    }
  }

  async stopBot() {
    try {
      const response = await fetch('/api/stop-bot', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to stop bot');
      }
      this.updateStatus('stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
      this.logError('Failed to stop bot');
    }
  }

  updateStatus(status) {
    this.statusIndicator.textContent = status;
    this.statusIndicator.className = `status-indicator ${status}`;
    this.startButton.disabled = status === 'running';
    this.stopButton.disabled = status === 'stopped';
  }

  updateStats(stats) {
    this.statsContainer.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Total Trades:</span>
        <span class="stat-value">${stats.totalTrades}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Successful Trades:</span>
        <span class="stat-value">${stats.successfulTrades}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Failed Trades:</span>
        <span class="stat-value">${stats.failedTrades}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Profit/Loss:</span>
        <span class="stat-value">${stats.profitLoss} SOL</span>
      </div>
    `;
  }

  updateTradeHistory(trades) {
    this.tradeHistory.innerHTML = trades.map(trade => `
      <div class="trade-item">
        <span class="trade-time">${new Date(trade.timestamp).toLocaleString()}</span>
        <span class="trade-type ${trade.type}">${trade.type}</span>
        <span class="trade-amount">${trade.amount} SOL</span>
        <span class="trade-status ${trade.status}">${trade.status}</span>
      </div>
    `).join('');
  }

  logError(message) {
    const errorItem = document.createElement('div');
    errorItem.className = 'error-item';
    errorItem.textContent = `${new Date().toLocaleString()} - ${message}`;
    this.errorLog.appendChild(errorItem);
    this.errorLog.scrollTop = this.errorLog.scrollHeight;
  }

  updateUI(state) {
    this.updateStatus(state.isRunning ? 'running' : 'stopped');
    this.updateStats(state.stats);
    if (state.trades) {
      this.updateTradeHistory(state.trades);
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
}); 