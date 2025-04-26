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
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
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
