const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const client = require('prom-client');
const fs = require('fs');
const path = require('path');
const { getCacheService } = require('../utils/centralCacheService');

// Endpoint to receive frontend performance metrics
router.post('/', (req, res) => {
  const metric = req.body;
  
  // Log the metric
  logger.info({
    msg: 'Frontend performance metric received',
    metric
  });
  
  // Here you could also store metrics in a database
  // or forward them to a dedicated metrics system
  
  res.status(200).json({ success: true });
});

// Endpoint to get Prometheus metrics
router.get('/prometheus', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  client.register.metrics()
    .then(metrics => {
      res.end(metrics);
    })
    .catch(error => {
      logger.error('Error getting Prometheus metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    });
});

// Endpoint to get performance baseline data
router.get('/baseline', (req, res) => {
  const baselinePath = path.join(__dirname, '..', 'temp', 'performance-baseline.json');
  
  try {
    if (fs.existsSync(baselinePath)) {
      const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      res.status(200).json(baselineData);
    } else {
      res.status(404).json({ 
        error: 'Baseline data not found', 
        message: 'Run performance baseline tests first using: npm run baseline'
      });
    }
  } catch (error) {
    logger.error('Error reading baseline data:', error);
    res.status(500).json({ error: 'Failed to read baseline data' });
  }
});

// Endpoint to get summarized metrics (for dashboard)
router.get('/summary', (req, res) => {
  // Get current Prometheus metrics
  const promMetrics = client.register.getMetricsAsJSON();
  
  // Process metrics for dashboard
  const summary = {
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    webVitals: {
      LCP: { avg: 2500, p95: 4200 },
      FID: { avg: 80, p95: 220 },
      CLS: { avg: 0.12, p95: 0.25 },
      FCP: { avg: 1200, p95: 2100 },
    },
    navigationTimes: [
      { route: '/dashboard', avg: 350, p95: 780 },
      { route: '/communities', avg: 420, p95: 920 },
      { route: '/wallet', avg: 380, p95: 850 },
    ],
    componentRenderTimes: {
      'CommunityList': { avg: 280, p95: 520 },
      'WalletDashboard': { avg: 310, p95: 580 },
      'ContributionHistory': { avg: 340, p95: 620 },
    },
    prometheus: promMetrics
  };
  
  res.status(200).json(summary);
});

// Endpoint to get detailed performance dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Get cache statistics for the dashboard
    let cacheMetrics = [];
    try {
      const cacheService = getCacheService();
      
      // Check if cache service is initialized
      if (!cacheService.isInitialized) {
        throw new Error('Cache service not yet initialized');
      }
      
      const cacheStats = cacheService.getStats();
      const cacheHealth = await cacheService.healthCheck();
      
      console.log('DEBUG: Cache stats structure:', Object.keys(cacheStats));
      console.log('DEBUG: Cache health structure:', Object.keys(cacheHealth));
      
      // Calculate cache hit rate - use top-level stats
      const totalRequests = cacheStats.totalRequests || 0;
      const totalHits = cacheStats.hits || 0;
      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      
      // Get average response time directly
      const avgResponseTime = cacheStats.averageResponseTime || 0;
      
      cacheMetrics = [
        {
          name: 'Cache Hit Rate',
          value: Math.round(hitRate * 10) / 10,
          unit: '%',
          status: hitRate >= 80 ? 'healthy' : hitRate >= 60 ? 'warning' : 'critical'
        },
        {
          name: 'Average Response Time',
          value: Math.round(avgResponseTime),
          unit: 'ms',
          status: avgResponseTime <= 50 ? 'healthy' : avgResponseTime <= 200 ? 'warning' : 'critical'
        },
        {
          name: 'Redis Connection',
          value: cacheHealth.redis ? 1 : 0,
          unit: cacheHealth.redis ? 'connected' : 'disconnected',
          status: cacheHealth.redis ? 'healthy' : 'critical'
        },
        {
          name: 'L1 Cache Size',
          value: cacheStats.memoryCacheSize || 0,
          unit: 'items',
          status: cacheStats.memoryCacheSize < 1000 ? 'healthy' : cacheStats.memoryCacheSize < 5000 ? 'warning' : 'critical'
        }
      ];
    } catch (cacheError) {
      logger.warn('Cache metrics unavailable:', cacheError.message);
      console.log('DEBUG: Cache error details:', {
        message: cacheError.message,
        stack: cacheError.stack ? cacheError.stack.split('\n')[0] : 'No stack',
        isInitializedError: cacheError.message.includes('not yet initialized')
      });
      
      // Log cache service state for debugging
      try {
        const debugCacheService = getCacheService();
        console.log('DEBUG: Cache service state:', {
          exists: !!debugCacheService,
          isInitialized: debugCacheService ? debugCacheService.isInitialized : false
        });
      } catch (debugError) {
        console.log('DEBUG: Error getting cache service for debug:', debugError.message);
      }
      
      const errorMsg = cacheError.message.includes('not yet initialized') ? 
        'initializing' : 'unavailable';
      
      cacheMetrics = [
        {
          name: 'Cache System',
          value: 0,
          unit: errorMsg,
          status: errorMsg === 'initializing' ? 'warning' : 'critical'
        }
      ];
    }

    const dashboardData = {
      title: 'Kolocollect Performance Dashboard',
      timestamp: new Date().toISOString(),
      sections: [
        {
          title: 'System Health',
          metrics: [
            {
              name: 'Server Uptime',
              value: Math.floor(process.uptime()),
              unit: 'seconds',
              status: 'healthy'
            },
            {
              name: 'Memory Usage',
              value: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              unit: 'MB',
              status: process.memoryUsage().heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning'
            },
            {
              name: 'Response Time',
              value: 150,
              unit: 'ms',
              status: 'healthy'
            }
          ]
        },
        {
          title: 'API Performance',
          metrics: [
            {
              name: 'Average Response Time',
              value: 250,
              unit: 'ms',
              status: 'healthy'
            },
            {
              name: 'Requests per Minute',
              value: 45,
              unit: 'req/min',
              status: 'healthy'
            },
            {
              name: 'Error Rate',
              value: 2.5,
              unit: '%',
              status: 'healthy'
            }
          ]
        },
        {
          title: 'Cache Performance',
          metrics: cacheMetrics
        },
        {
          title: 'Frontend Performance',
          metrics: [
            {
              name: 'Largest Contentful Paint',
              value: 2.1,
              unit: 's',
            status: 'healthy'
          },
          {
            name: 'First Input Delay',
            value: 85,
            unit: 'ms',
            status: 'healthy'
          },
          {
            name: 'Cumulative Layout Shift',
            value: 0.08,
            unit: '',            status: 'healthy'
          }
        ]
      }
    ],
    charts: [
      {
        title: 'Response Time Trend',
        type: 'line',
        data: {
          labels: ['1h ago', '45m ago', '30m ago', '15m ago', 'now'],
          datasets: [
            {
              label: 'Response Time (ms)',
              data: [180, 220, 195, 160, 150]
            }
          ]
        }
      },
      {
        title: 'Memory Usage',
        type: 'area',
        data: {
          labels: ['1h ago', '45m ago', '30m ago', '15m ago', 'now'],
          datasets: [
            {
              label: 'Memory (MB)',
              data: [180, 195, 210, 185, 175]
            }
          ]
        }
      },
      {
        title: 'Cache Hit Rate',
        type: 'line',
        data: {
          labels: ['1h ago', '45m ago', '30m ago', '15m ago', 'now'],
          datasets: [
            {
              label: 'Hit Rate (%)',
              data: [85, 88, 92, 89, 90]
            }
          ]
        }
      }
    ]
  };

  res.status(200).json(dashboardData);
  } catch (error) {
    logger.error('Error getting dashboard data:', error);
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

module.exports = router;

// Debug endpoint to check cache service state
router.get('/debug-cache', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const isInitialized = cacheService ? cacheService.isInitialized : false;
    const stats = isInitialized ? cacheService.getStats() : null;
    const health = isInitialized ? await cacheService.healthCheck() : null;
    
    res.status(200).json({
      exists: !!cacheService,
      isInitialized,
      stats,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});
