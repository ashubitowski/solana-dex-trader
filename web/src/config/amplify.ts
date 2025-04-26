import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { fetchAuthSession } from 'aws-amplify/auth';

// Initialize Amplify with configuration from window.config
export const configureAmplify = () => {
  // Get configuration from window.config (set in config.js)
  const config = (window as any).config || {};
  console.log('Loaded window.config:', config);

  // Configure Amplify with Cognito settings
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
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

};
