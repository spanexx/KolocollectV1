const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const httpLogger = pinoHttp({
  logger,
  customLogLevel: function (res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: function (res) {
    if (res.statusCode === 404) {
      return 'Resource not found';
    }
    return `Request completed in ${res.responseTime}ms`;
  },
  customErrorMessage: function (error, res) {
    return `Request failed with error: ${error.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'responseTimeMs',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-length': req.headers['content-length'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = httpLogger;
