import { fetchAuthSession, signIn as amplifySignIn, signOut as amplifySignOut, getCurrentUser as amplifyGetCurrentUser } from 'aws-amplify/auth';

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

// Check if the user is authenticated
export const isAuthenticated = async () => {
  try {
    const user = await amplifyGetCurrentUser();
    return !!user;
  } catch (error) {
    return false;
  }
};

// Sign in with username and password
export const signIn = async (username: string, password: string) => {
  try {
    const user = await amplifySignIn({ username, password });
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
