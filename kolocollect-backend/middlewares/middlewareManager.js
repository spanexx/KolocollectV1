/**
 * Middleware Manager
 * Phase 4: Scalability Improvements - Middleware Optimization
 * 
 * Provides conditional middleware application based on route needs:
 * - Reduces middleware overhead for non-authenticated routes
 * - Applies appropriate middleware for different types of routes
 * - Supports middleware groups for different use cases
 */

const authMiddleware = require('./authMiddleware');

/**
 * Applies middleware conditionally based on route path
 * @param {Object} app - Express app instance
 */
const setupOptimizedMiddleware = (app) => {
  // Helper function to determine if a route should bypass authentication
  const shouldBypassAuth = (path) => {
    // List of paths that don't require authentication
    const publicPaths = [
      '/api/users/login',
      '/api/users/register',
      '/api/users/verify-email',
      '/api/users/forgot-password',
      '/api/users/reset-password',
      '/webhook',
      '/uploads/',
      '/api/communities/public',
      '/api/metrics/public',
      '/health'
    ];
    
    // Check if the path starts with any of the public paths
    return publicPaths.some(publicPath => 
      path === publicPath || 
      (publicPath.endsWith('/') && path.startsWith(publicPath))
    );
  };

  // Wrap Express's use method to conditionally apply middleware
  const originalUse = app.use;
  app.use = function(path, ...handlers) {
    // If first argument is a middleware function (not a path)
    if (typeof path === 'function') {
      const middleware = path;
      const restHandlers = handlers;
      
      // Apply the middleware to all routes except the ones that should bypass auth
      return originalUse.call(this, (req, res, next) => {
        // Skip authentication middleware for public routes
        if (middleware === authMiddleware && shouldBypassAuth(req.path)) {
          return next();
        }
        return middleware(req, res, next);
      }, ...restHandlers);
    }
    
    // Normal middleware application with path
    return originalUse.call(this, path, ...handlers);
  };

  // Create middleware groups for different use cases
  const middlewareGroups = {
    api: [
      // General API middleware
    ],
    auth: [
      authMiddleware
    ],
    admin: [
      authMiddleware,
      // Add admin middleware
      (req, res, next) => {
        if (!req.user || !req.user.isAdmin) {
          return res.status(403).json({ message: 'Admin privileges required' });
        }
        next();
      }
    ]
  };

  // Method to apply middleware groups
  app.useGroup = function(group, path, ...handlers) {
    if (!middlewareGroups[group]) {
      throw new Error(`Middleware group '${group}' does not exist`);
    }
    
    return originalUse.call(this, path, ...middlewareGroups[group], ...handlers);
  };

  return app;
};

module.exports = {
  setupOptimizedMiddleware
};
