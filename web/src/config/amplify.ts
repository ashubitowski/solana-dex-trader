import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { fetchAuthSession } from 'aws-amplify/auth';

// Initialize Amplify with configuration from window.config
export const configureAmplify = () => {
  try {
    // Get configuration from window.config (set in config.js)
    const config = (window as any).config || {};
    console.log('Loaded window.config:', config);
    
    // Check if config is empty and use fallback values if needed
    if (!config.userPoolId || !config.clientId) {
      console.warn('Config missing Cognito credentials, using fallback values');
      // Hardcoded fallback values - same as in deploy.sh
      config.userPoolId = config.userPoolId || 'us-east-2_2NKnlyBUD';
      config.clientId = config.clientId || '5srq6jqjh86d55jviandg5f71a';
      config.apiEndpoint = config.apiEndpoint || 'https://p0ovyz3y83.execute-api.us-east-2.amazonaws.com/prod/';
    }
    
    // Log the final config we're using
    console.log('Using Amplify config:', {
      userPoolId: config.userPoolId,
      clientId: config.clientId,
      apiEndpoint: config.apiEndpoint
    });

    // Configure Amplify with Cognito settings
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.userPoolId,
          userPoolClientId: config.clientId, // Match the property name from deploy.sh
          loginWith: {
            username: true
          }
        }
      },
      API: {
        REST: {
          SolanaDexTraderAPI: {
            endpoint: config.apiEndpoint,
            region: 'us-east-2'
          }
        }
      }
    });

    // Configure token provider for API requests
    cognitoUserPoolsTokenProvider.setKeyValueStorage({
      async getItem(key: string) {
        try {
          const session = await fetchAuthSession();
          if (key.includes('idToken')) {
            return session.tokens?.idToken?.toString() || null;
          }
          return null;
        } catch (e) {
          console.error('Error getting auth token:', e);
          return null;
        }
      },
      async setItem() { /* Not needed for this implementation */ },
      async removeItem() { /* Not needed for this implementation */ },
      async clear() { /* Not needed for this implementation */ }
    });
  } catch (error) {
    console.error('Error configuring Amplify:', error);
    // Still create a basic configuration to prevent further errors
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: 'us-east-2_2NKnlyBUD',
          userPoolClientId: '5srq6jqjh86d55jviandg5f71a',
          loginWith: {
            username: true
          }
        }
      }
    });
  }
};
