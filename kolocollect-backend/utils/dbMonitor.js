const mongoose = require('mongoose');
const logger = require('./logger');

// Safely stringify objects, avoiding circular references
const safeStringify = (obj) => {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  try {
    return JSON.stringify(obj, (key, value) => {
      // Skip circular references and complex objects
      if (typeof value === 'object' && value !== null) {
        // Check for circular references and complex MongoDB objects
        if (value.constructor && (
          value.constructor.name === 'MongoClient' ||
          value.constructor.name === 'ServerSessionPool' ||
          value.constructor.name === 'Topology' ||
          value.constructor.name === 'Server' ||
          value.constructor.name === 'Connection'
        )) {
          return '[MongoDB Object Removed]';
        }
        
        // Skip certain problematic keys
        if (['client', 'sessionPool', 's', 'topology', 'server'].includes(key)) {
          return '[Complex Object Removed]';
        }
        
        // Handle potential circular references by checking depth
        if (typeof value === 'object' && Object.keys(value).length > 50) {
          return '[Large Object Truncated]';
        }
      }
      return value;
    });
  } catch (error) {
    return `[Error stringifying: ${error.message}]`;
  }
};

// Track slow queries with better error handling
mongoose.set('debug', function (collectionName, method, query, doc, options) {
  try {
    const startTime = Date.now();
    
    const queryInfo = {
      collection: collectionName,
      method: method,
      query: safeStringify(query),
      options: safeStringify(options),
    };
    
    return function (err, result) {
      try {
        const duration = Date.now() - startTime;
        
        // Log queries that take longer than 100ms
        if (duration > 100) {
          logger.warn({
            msg: 'Slow MongoDB Query',
            duration,
            ...queryInfo,
          });
        }
        
        // For very slow queries, log as error
        if (duration > 1000) {
          logger.error({
            msg: 'Very Slow MongoDB Query',
            duration,
            ...queryInfo,
          });
        }
      } catch (logError) {
        logger.error({
          msg: 'Error in MongoDB debug callback',
          error: logError.message
        });
      }
    };
  } catch (debugError) {
    logger.error({
      msg: 'Error setting up MongoDB debug',
      error: debugError.message
    });
    return function() {}; // Return empty function to prevent further errors
  }
});

// Add MongoDB connection monitoring
function monitorMongoConnection() {
  mongoose.connection.on('error', (err) => {
    logger.error({ msg: 'MongoDB connection error', error: err.message });
  });
  
  mongoose.connection.on('disconnected', () => {
    logger.warn({ msg: 'MongoDB disconnected' });
  });
  
  mongoose.connection.on('reconnected', () => {
    logger.info({ msg: 'MongoDB reconnected' });
  });
}

module.exports = { monitorMongoConnection };
