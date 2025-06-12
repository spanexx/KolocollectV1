const promBundle = require('express-prom-bundle');

// Create metrics middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { project_name: 'kolocollect' },
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000,
    },
  },
});

module.exports = metricsMiddleware;
