import { Amplify } from 'aws-amplify';

// Initialize Amplify with configuration from window.config
export const configureAmplify = () => {
  // Get configuration from window.config (set in config.js)
  const config = window.config || {};
  
  // Configure Amplify with Cognito settings
  Amplify.configure({
    Auth: {
      region: 'us-east-2', // AWS region
      userPoolId: config.userPoolId,
      userPoolWebClientId: config.clientId,
      mandatorySignIn: true,
      authenticationFlowType: 'USER_SRP_AUTH'
    },
    API: {
      endpoints: [
        {
          name: 'SolanaDexTraderAPI',
          endpoint: config.apiEndpoint,
          custom_header: async () => {
            try {
              const session = await Amplify.Auth.currentSession();
              return {
                Authorization: `Bearer ${session.getIdToken().getJwtToken()}`
              };
            } catch (e) {
              console.error('Error getting auth token:', e);
              return {};
            }
          }
        }
      ]
    }
  });
};
