/**
 * Correlation ID Middleware
 * Phase 4: Scalability Improvements - Distributed Logging
 * 
 * Provides correlation IDs for request tracing across microservices:
 * - Generates a unique ID for each request
 * - Passes the ID through the request chain
 * - Enables end-to-end request tracking
 */

const { v4: uuidv4 } = require('uuid');
const asyncLocalStorage = require('async_hooks').AsyncLocalStorage;

// Create AsyncLocalStorage for correlation ID
const correlationStorage = new asyncLocalStorage();

/**
 * Get current correlation ID
 * @returns {string} - Correlation ID or 'unknown' if not available
 */
const getCorrelationId = () => {
  const correlationId = correlationStorage.getStore();
  return correlationId || 'unknown';
};

/**
 * Middleware to assign correlation ID to each request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const correlationMiddleware = (req, res, next) => {
  // Get correlation ID from header or generate new one
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  // Store correlation ID in request
  req.correlationId = correlationId;
  
  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);
  
  // Run the request in the context of the correlation ID
  correlationStorage.run(correlationId, () => {
    next();
  });
};

/**
 * Log formatter that includes correlation ID
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {Object} - Formatted log object
 */
const formatLog = (level, message, meta = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId: getCorrelationId(),
    ...meta
  };
};

/**
 * Logger with correlation ID
 */
const logger = {
  info: (message, meta) => {
    console.log(JSON.stringify(formatLog('info', message, meta)));
  },
  warn: (message, meta) => {
    console.warn(JSON.stringify(formatLog('warn', message, meta)));
  },
  error: (message, meta) => {
    console.error(JSON.stringify(formatLog('error', message, meta)));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(JSON.stringify(formatLog('debug', message, meta)));
    }
  }
};

module.exports = {
  correlationMiddleware,
  getCorrelationId,
  logger
};
