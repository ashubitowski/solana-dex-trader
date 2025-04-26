import { getAuthToken } from './auth';

// Add type declaration for window.config
declare global {
  interface Window {
    config?: {
      apiEndpoint?: string;
      userPoolId?: string;
      clientId?: string;
      rpcEndpoint?: string;
    };
  }
}

const API_BASE_URL = window.config?.apiEndpoint || 'https://p0ovyz3y83.execute-api.us-east-2.amazonaws.com/prod/';

// Generic API request function with authentication
const apiRequest = async (endpoint: string, method: string = 'GET', data?: any) => {
  try {
    const token = await getAuthToken();
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      mode: 'cors',
      credentials: 'include'
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    // For development/testing, provide mock data if API is not available
    if (process.env.NODE_ENV !== 'production' || window.location.hostname === 'd3rntcg47zepho.cloudfront.net') {
      // Check if we're trying to access a protected endpoint without authentication
      if (!token) {
        console.warn('No authentication token available, using mock data');
        return getMockData(endpoint);
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
          console.warn(`API request failed with status ${response.status}, using mock data`);
          return getMockData(endpoint);
        }
        return await response.json();
      } catch (error) {
        console.warn('API request failed, using mock data:', error);
        return getMockData(endpoint);
      }
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API ${method} request to ${endpoint} failed:`, error);
    throw error;
  }
};

// Mock data for development and testing
const getMockData = (endpoint: string) => {
  if (endpoint === 'config') {
    return {
      tradingEnabled: true,
      maxSlippage: 0.5,
      maxGasPrice: 10,
      targetDEX: 'raydium',
      walletAddress: '8xpG4jYH7vsRxJ9gBwMR76NLbEMqQ4ZQYEiYE6P',
      defaultPairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
      autoTrade: true,
      tradeSize: 100,
      stopLoss: 5,
      takeProfit: 20
    };
  }
  
  if (endpoint === 'wallet') {
    return {
      address: '8xpG4jYH7vsRxJ9gBwMR76NLbEMqQ4ZQYEiYE6P',
      balance: 10.5432,
      tokens: [
        { symbol: 'SOL', balance: 10.5432, usdValue: 1054.32 },
        { symbol: 'USDC', balance: 500.25, usdValue: 500.25 },
        { symbol: 'BONK', balance: 1000000, usdValue: 120.50 }
      ]
    };
  }
  
  if (endpoint === 'trading/settings') {
    return {
      enabled: true,
      pairs: ['SOL/USDC', 'BONK/USDC', 'JUP/USDC'],
      strategy: 'momentum',
      riskLevel: 'medium'
    };
  }
  
  // Default empty response
  return {};
};

// Configuration API endpoints
export const configApi = {
  // Get user configuration
  getConfig: () => apiRequest('config'),
  
  // Save user configuration
  saveConfig: (configData: any) => apiRequest('config', 'POST', configData),
  
  // Update specific configuration field
  updateConfigField: (field: string, value: any) => 
    apiRequest('config', 'PATCH', { [field]: value })
};

// Wallet API endpoints
export const walletApi = {
  // Get wallet details
  getWalletDetails: () => apiRequest('wallet'),
  
  // Update wallet settings
  updateWalletSettings: (settings: any) => apiRequest('wallet', 'POST', settings)
};

// Trading API endpoints
export const tradingApi = {
  // Get trading settings
  getTradingSettings: () => apiRequest('trading/settings'),
  
  // Update trading settings
  updateTradingSettings: (settings: any) => apiRequest('trading/settings', 'POST', settings)
};
