export const environment = {
  production: true,
  apiUrl: 'http://localhost:9000/api',
  stripePublicKey: 'pk_live_your_stripe_live_key',
  version: '1.0.0',
  tokenExpirationTime: 60 * 60 * 1000, // 1 hour in milliseconds
  defaultLanguage: 'en',
  payoutCheckInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
  maxRetryAttempts: 3,
  defaultPageSize: 10,
  debugMode: false,
  apiTimeoutMs: 30000, // 30 seconds timeout for API calls
};
