import { apiRequest } from './api';

// Users API endpoints
export const usersApi = {
  // Get user data
  getUserData: (userId: string) => apiRequest(`users/${userId}`),
  
  // Create new user
  createUser: (userData: any) => apiRequest('users', 'POST', userData),
  
  // Update user data
  updateUser: (userId: string, userData: any) => apiRequest(`users/${userId}`, 'PUT', userData),
  
  // Update user wallet
  updateWallet: (userId: string, walletData: any) => apiRequest(`users/${userId}/wallet`, 'PUT', walletData),
  
  // Get all users (admin only)
  getAllUsers: () => apiRequest('users'),
};
