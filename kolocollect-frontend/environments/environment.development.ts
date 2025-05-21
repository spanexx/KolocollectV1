export const environment = {
  production: false,
  apiUrl: 'http://localhost:9000/api',
  stripePublicKey: 'pk_test_your_stripe_test_key',
  version: '1.0.0',
  tokenExpirationTime: 60 * 60 * 1000, // 1 hour in milliseconds
  defaultLanguage: 'en',
  payoutCheckInterval: 5 * 60 * 1000, // 5 minutes in milliseconds
  maxRetryAttempts: 3,
  defaultPageSize: 10,
  debugMode: true,
  apiTimeoutMs: 30000, // 30 seconds timeout for API calls
};