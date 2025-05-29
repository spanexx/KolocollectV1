const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const client = require('prom-client');
const fs = require('fs');
const path = require('path');

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
router.get('/dashboard', (req, res) => {
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
            unit: '',
            status: 'healthy'
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
      }
    ]
  };

  res.status(200).json(dashboardData);
});

module.exports = router;
