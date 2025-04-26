// Import Amplify but don't actually use it for auth
import { Amplify } from 'aws-amplify';

// Initialize Amplify with minimal configuration to avoid errors
export const configureAmplify = () => {
  // Get configuration from window.config (set in config.js)
  const config = (window as any).config || {};
  
  // Configure Amplify with minimal settings
  // We're not actually using Amplify for auth, but we need to configure it
  // to avoid errors in other parts of the application
  Amplify.configure({
    API: {
      REST: {
        SolanaDexTraderAPI: {
          endpoint: config.apiEndpoint || 'https://api.example.com',
          region: 'us-east-2'
        }
      }
    }
  });
  
  console.log('Using mock authentication service instead of AWS Cognito');

};
