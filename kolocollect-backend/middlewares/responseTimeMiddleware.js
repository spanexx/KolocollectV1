const { Histogram } = require('prom-client');
const logger = require('../utils/logger');

// Create histogram metric for response times
const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], // buckets in ms
});

// Middleware function
const responseTimeMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  // The following function will be called on response finish
  res.on('finish', () => {
    const durationInMs = getDurationInMilliseconds(start);
    
    // Get route path if matched by router
    const route = req.route ? req.route.path : req.path;
    
    // Update Prometheus metric
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(durationInMs);
    
    // Log slow responses
    if (durationInMs > 1000) {
      logger.warn({
        msg: 'Slow Response',
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: durationInMs,
      });
    }
  });
  
  next();
};

// Helper function to calculate duration in milliseconds
const getDurationInMilliseconds = (start) => {
  const NS_PER_SEC = 1e9; // convert to nanoseconds
  const NS_TO_MS = 1e6; // convert to milliseconds
  const diff = process.hrtime(start);
  
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

module.exports = responseTimeMiddleware;
