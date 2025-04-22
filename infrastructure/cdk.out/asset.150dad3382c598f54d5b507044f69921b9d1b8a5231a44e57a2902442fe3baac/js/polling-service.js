class PollingService {
  constructor(interval = 5000) {
    this.interval = interval;
    this.timer = null;
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.subscribers.size === 1) {
      this.startPolling();
    }
    return () => this.unsubscribe(callback);
  }

  unsubscribe(callback) {
    this.subscribers.delete(callback);
    if (this.subscribers.size === 0) {
      this.stopPolling();
    }
  }

  async fetchBotState() {
    try {
      const response = await fetch('/api/bot-state');
      if (!response.ok) {
        throw new Error('Failed to fetch bot state');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching bot state:', error);
      return null;
    }
  }

  async updateBotState(newState) {
    try {
      const response = await fetch('/api/bot-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newState),
      });
      if (!response.ok) {
        throw new Error('Failed to update bot state');
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating bot state:', error);
      return null;
    }
  }

  startPolling() {
    if (this.timer) return;
    
    const poll = async () => {
      const state = await this.fetchBotState();
      if (state) {
        this.subscribers.forEach(callback => callback(state));
      }
    };

    // Initial poll
    poll();
    
    // Set up interval
    this.timer = setInterval(poll, this.interval);
  }

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Export a singleton instance
export const pollingService = new PollingService(); 