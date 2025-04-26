import { 
  fetchAuthSession, 
  signIn as amplifySignIn, 
  signOut as amplifySignOut, 
  getCurrentUser as amplifyGetCurrentUser, 
  signUp as amplifySignUp,
  resetPassword,
  confirmResetPassword
} from 'aws-amplify/auth';
import { apiRequest } from './api';

// Get the current authenticated user's JWT token
export const getAuthToken = async () => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Get the current user's ID from Cognito
export const getUserId = async () => {
  try {
    const user = await amplifyGetCurrentUser();
    return user.userId || user.username;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};

// Get the current user's data from DynamoDB
export const getUserData = async () => {
  try {
    const userId = await getUserId();
    if (!userId) return null;
    
    const userData = await apiRequest(`/users/${userId}`, 'GET');
    return userData;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Update the user's data in DynamoDB
export const updateUserData = async (data: any) => {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const response = await apiRequest(`/users/${userId}`, 'PUT', data);
    return response;
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
};

// Check if the user is authenticated
export const isAuthenticated = async () => {
  try {
    const user = await amplifyGetCurrentUser();
    return !!user;
  } catch (error) {
    return false;
  }
};

// Sign up with username and password
export const signUp = async (username: string, password: string) => {
  try {
    // In Amplify v6, we need to provide the username and password directly
    const result = await amplifySignUp({
      username,
      password,
      options: {
        // Set user attributes if needed
        userAttributes: {
          email: username
        }
      }
    });
    return result;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign in with username and password
export const signIn = async (username: string, password: string) => {
  try {
    const user = await amplifySignIn({ username, password });
    
    // After successful sign-in, check if user exists in our database
    // If not, create a new user record
    try {
      const userData = await getUserData();
      if (!userData) {
        // User doesn't exist in our database, create a new record
        const userId = await getUserId();
        if (userId) {
          await apiRequest('/users', 'POST', {
            userId,
            email: username,
            createdAt: new Date().toISOString(),
            walletAddress: '',
            settings: {
              autoSell: true,
              autoTrade: false,
              minimumLiquidity: 0.5,
              tradeAmount: 0.1,
              slippageTolerance: 2.5,
              maxActivePositions: 5,
              takeProfit: 50,
              stopLoss: 25,
              rpcEndpoint: 'https://api.mainnet-beta.solana.com'
            }
          });
        }
      }
    } catch (error) {
      console.warn('Error checking/creating user record:', error);
      // Continue anyway, as the user is authenticated with Cognito
    }
    
    return user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Sign out the current user
export const signOut = async () => {
  try {
    await amplifySignOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Forgot password - sends verification code to email
export const forgotPassword = async (username: string) => {
  try {
    const result = await resetPassword({ username });
    return result;
  } catch (error) {
    console.error('Error initiating password reset:', error);
    throw error;
  }
};

// Confirm forgot password - verifies code and sets new password
export const confirmForgotPassword = async (username: string, confirmationCode: string, newPassword: string) => {
  try {
    const result = await confirmResetPassword({
      username,
      confirmationCode,
      newPassword
    });
    return result;
  } catch (error) {
    console.error('Error confirming password reset:', error);
    throw error;
  }
};
