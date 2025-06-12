const express = require('express');
const router = express.Router();
const { getCacheService, initializeCacheService } = require('../utils/centralCacheService');

// Test endpoint for cache debugging
router.get('/debug', async (req, res) => {
  try {
    console.log('DEBUG: Starting cache debug endpoint');
    
    // Get cache service instance
    const cacheService = getCacheService();
    console.log('DEBUG: Cache service obtained');
    
    // Check initialization status
    const isInitialized = cacheService.isInitialized;
    console.log('DEBUG: isInitialized =', isInitialized);
    
    if (!isInitialized) {
      console.log('DEBUG: Attempting to initialize cache service');
      await initializeCacheService();
      console.log('DEBUG: initialization completed, new status =', cacheService.isInitialized);
    }
    
    // Get stats and health
    const stats = cacheService.getStats();
    const health = await cacheService.healthCheck();
    
    res.json({
      success: true,
      isInitialized: cacheService.isInitialized,
      stats,
      health
    });
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
