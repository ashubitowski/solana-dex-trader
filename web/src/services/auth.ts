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

// Get the current authenticated user
export const getCurrentUser = async () => {
  try {
    const user = await amplifyGetCurrentUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Get the current user's data from DynamoDB
export const getUserData = async () => {
  try {
    const data = await apiRequest('/users/me', 'GET');
    return data;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Update user data in our API
export const updateUserData = async (userData: any) => {
  try {
    const data = await apiRequest('/users/me', 'PUT', userData);
    return data;
  } catch (error) {
    console.error('Error updating user data:', error);
    throw error;
  }
};

// Check if the user is authenticated
export const isAuthenticated = async () => {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch (error) {
    return false;
  }
};

// Sign up a new user
export const signUp = async (username: string, password: string) => {
  try {
    // Sign up with Cognito
    const { userId, isSignUpComplete, nextStep } = await amplifySignUp({
      username,
      password,
      options: {
        autoSignIn: false,
        userAttributes: {
          email: username
        }
      }
    });
    
    // If sign up is complete, create a user record in our database
    if (isSignUpComplete) {
      // Create user in our database
      await apiRequest('/users', 'POST', {
        email: username,
        walletAddress: '',
        settings: {
          minimumLiquidity: 0.5,
          tradeAmount: 0.1,
          slippageTolerance: 2.5,
          maxActivePositions: 5,
          takeProfit: 50,
          stopLoss: 25,
          autoSell: true,
          autoTrade: true,
          rpcEndpoint: 'https://api.mainnet-beta.solana.com'
        }
      });
    }
    
    return { userId, isSignUpComplete, nextStep };
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign in with username and password
export const signIn = async (username: string, password: string) => {
  try {
    const { isSignedIn, nextStep } = await amplifySignIn({ username, password });
    
    if (isSignedIn) {
      // Get user data from our API
      const userData = await getUserData();
      return { isSignedIn, nextStep, userData };
    }
    
    return { isSignedIn, nextStep };
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
