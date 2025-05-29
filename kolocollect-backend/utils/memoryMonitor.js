const { Gauge } = require('prom-client');
const logger = require('./logger');

// Create memory gauges
const memoryUsage = new Gauge({
  name: 'node_process_memory_usage_bytes',
  help: 'Memory usage of the Node.js process',
  labelNames: ['type'],
});

// Initialize memory monitoring
function initMemoryMonitoring(interval = 60000) {
  // Update memory metrics initially
  updateMemoryMetrics();
  
  // Update metrics at regular intervals
  setInterval(updateMemoryMetrics, interval);
  
  // Log memory usage on significant changes
  let lastRssValue = process.memoryUsage().rss;
  
  setInterval(() => {
    const currentRss = process.memoryUsage().rss;
    const percentChange = Math.abs((currentRss - lastRssValue) / lastRssValue * 100);
    
    // Log if memory usage changes by more than 10%
    if (percentChange > 10) {
      logger.info({
        msg: 'Significant memory usage change',
        previousMB: Math.round(lastRssValue / 1024 / 1024 * 100) / 100,
        currentMB: Math.round(currentRss / 1024 / 1024 * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
      });
      
      lastRssValue = currentRss;
    }
  }, interval);
}

// Update memory metrics
function updateMemoryMetrics() {
  const memUsage = process.memoryUsage();
  
  // Set metrics for different memory types
  memoryUsage.labels('rss').set(memUsage.rss);
  memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
  memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
  memoryUsage.labels('external').set(memUsage.external);
  
  // Log memory usage periodically
  logger.debug({
    msg: 'Memory usage',
    rss: `${Math.round(memUsage.rss / 1024 / 1024 * 100) / 100} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
  });
}

module.exports = { initMemoryMonitoring };
