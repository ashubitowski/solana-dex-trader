// Add this to the top of your config.js file
declare global {
  interface Window {
    config: {
      userPoolId: string;
      clientId: string;
      apiEndpoint: string;
      websiteUrl: string;
      rpcEndpoint?: string;
    };
  }
}
