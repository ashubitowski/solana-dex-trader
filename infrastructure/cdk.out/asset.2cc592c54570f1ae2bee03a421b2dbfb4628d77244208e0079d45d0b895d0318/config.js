// Application Configuration
window.config = {
    // AWS Cognito Configuration
    userPoolId: 'us-east-2_2NKnlyBUD',
    userPoolClientId: '5srq6jqjh86d55jviandg5f71a',
    region: 'us-east-2',
    
    // API Configuration
    apiEndpoint: 'https://p0ovyz3y83.execute-api.us-east-2.amazonaws.com/prod',
    websiteUrl: 'https://d3rntcg47zepho.cloudfront.net',
    
    // Application Settings
    refreshInterval: 5000, // 5 seconds
    maxRetries: 3,
    timeoutDuration: 30000, // 30 seconds
    
    // Feature Flags
    enableWebSocket: false,
    enableMockData: false,
    enableDebugLogs: true
};
