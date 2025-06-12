const mongoose = require('mongoose');
const logger = require('./logger');

// Track slow queries
mongoose.set('debug', function (collectionName, method, query, doc, options) {
  const startTime = Date.now();
  const queryInfo = {
    collection: collectionName,
    method: method,
    query: JSON.stringify(query),
    options: JSON.stringify(options),
  };
  
  return function (err, result) {
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
  };
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
