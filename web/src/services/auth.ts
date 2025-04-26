// Mock storage for user data
const mockUsers: Record<string, { password: string, userData: any }> = {
  'test@example.com': { 
    password: 'Password123', 
    userData: {
      email: 'test@example.com',
      walletAddress: '8xpG4...YE6P',
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
    }
  }
};

// Mock token storage
let mockAuthToken: string | null = null;
let mockCurrentUser: string | null = null;

// Get the current authenticated user's JWT token
export const getAuthToken = async () => {
  try {
    // Return mock token if available
    return mockAuthToken || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Get the current user's ID from Cognito
export const getUserId = async () => {
  try {
    // Return mock user if available
    if (mockCurrentUser) {
      return mockCurrentUser;
    }
    return null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};

// Get the current authenticated user
export const getCurrentUser = async () => {
  try {
    // Return mock user if available
    if (mockCurrentUser) {
      return { username: mockCurrentUser };
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Get the current user's data from DynamoDB
export const getUserData = async () => {
  try {
    // Return mock user data if available
    if (mockCurrentUser && mockUsers[mockCurrentUser]) {
      return mockUsers[mockCurrentUser].userData;
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Update the user's data in DynamoDB
export const updateUserData = async (userData: any) => {
  try {
    // Update mock user data if available
    if (mockCurrentUser && mockUsers[mockCurrentUser]) {
      mockUsers[mockCurrentUser].userData = {
        ...mockUsers[mockCurrentUser].userData,
        ...userData
      };
      return mockUsers[mockCurrentUser].userData;
    }
    throw new Error('User not found');
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
    // Check if user already exists
    if (mockUsers[username]) {
      throw new Error('User already exists');
    }
    
    // Create new user in mock storage
    mockUsers[username] = {
      password,
      userData: {
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
      }
    };
    
    // Return success
    const userId = `mock-user-${Date.now()}`;
    const isSignUpComplete = true;
    const nextStep = { signUpStep: 'DONE' };
    
    return { userId, isSignUpComplete, nextStep };
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign in with username and password
export const signIn = async (username: string, password: string) => {
  try {
    // Check if user exists in mock storage
    const user = mockUsers[username];
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check password
    if (user.password !== password) {
      throw new Error('Incorrect password');
    }
    
    // Set mock token and current user
    mockAuthToken = `mock-token-${Date.now()}`;
    mockCurrentUser = username;
    
    // Return success
    const isSignedIn = true;
    const nextStep = { signInStep: 'DONE' };
    
    // Get user data
    const userData = user.userData;
    
    return { isSignedIn, nextStep, userData };
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Sign out the current user
export const signOut = async () => {
  try {
    // Clear mock token and current user
    mockAuthToken = null;
    mockCurrentUser = null;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Forgot password - sends verification code to email
export const forgotPassword = async (username: string) => {
  try {
    // Check if user exists in mock storage
    if (!mockUsers[username]) {
      throw new Error('User not found');
    }
    
    // Return mock result
    return { isPasswordReset: false, nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' } };
  } catch (error) {
    console.error('Error initiating password reset:', error);
    throw error;
  }
};

// Confirm forgot password - verifies code and sets new password
export const confirmForgotPassword = async (username: string, confirmationCode: string, newPassword: string) => {
  try {
    // Check if user exists in mock storage
    if (!mockUsers[username]) {
      throw new Error('User not found');
    }
    
    // Verify confirmation code (for mock, any code '123456' is valid)
    if (confirmationCode !== '123456') {
      throw new Error('Invalid confirmation code');
    }
    
    // Update password
    mockUsers[username].password = newPassword;
    
    // Return mock result
    return {};
  } catch (error) {
    console.error('Error confirming password reset:', error);
    throw error;
  }
};
