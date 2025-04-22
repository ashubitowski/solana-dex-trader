// AWS Cognito Configuration
const config = {
    region: 'us-east-2',  // Your AWS region
    userPoolId: 'us-east-2_XXXXXXXX',  // Your Cognito User Pool ID
    userPoolClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',  // Your Cognito App Client ID
    
    // API Configuration
    apiBaseUrl: window.location.origin,  // Base URL for API endpoints
    
    // Session Configuration
    sessionTimeout: 30 * 60 * 1000,  // 30 minutes in milliseconds
    
    // Rate Limiting Configuration
    rateLimitWindow: 300000,  // 5 minutes in milliseconds
    maxLoginAttempts: 5,
    
    // Password Requirements
    passwordRequirements: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
    }
};
