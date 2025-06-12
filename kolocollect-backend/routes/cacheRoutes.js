/**
 * Cache API Routes
 * Phase 3: Database Optimization - Cache Management Endpoints
 * 
 * Provides API endpoints for:
 * - Cache statistics and monitoring
 * - Cache warming operations
 * - Cache invalidation
 * - Cache health checks
 */

const express = require('express');
const { getCacheService } = require('../utils/centralCacheService');

const router = express.Router();

/**
 * Get cache statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const stats = cacheService.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      message: error.message
    });
  }
});

/**
 * Cache health check
 */
router.get('/health', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const health = await cacheService.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking cache health:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * Warm cache with popular data
 */
router.post('/warm', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const { 
      communityIds = [], 
      userIds = [],
      enableCommunityWarming = true,
      enableUserWarming = true 
    } = req.body;

    // Import models for fetch functions
    const CommunityCore = require('../models/CommunityCore');
    const CommunityStats = require('../models/CommunityStats');
    const CommunityHistory = require('../models/CommunityHistory');
    const User = require('../models/User');
    const Wallet = require('../models/Wallet');

    const fetchFunctions = {
      community: {
        core: async (id) => {
          return await CommunityCore.findById(id)
            .populate('currentCycle', 'cycleNumber status startDate')
            .populate('activeMidCycle', 'status contributions')
            .lean();
        },
        stats: async (id) => {
          return await CommunityStats.findOne({ 
            communityId: id, 
            period: 'daily' 
          }).sort({ date: -1 }).lean();
        },
        members: async (id) => {
          const community = await CommunityCore.findById(id).populate('members').lean();
          return community ? community.members : [];
        }
      },
      user: {
        profile: async (id) => {
          return await User.findById(id).select('-password').lean();
        },
        communities: async (id) => {
          return await CommunityCore.find({ 
            'members': id 
          }).select('name description isActive').lean();
        }
      },
      config: async () => {
        return {
          maintenance_mode: false,
          feature_flags: {
            new_ui: true,
            advanced_analytics: true
          }
        };
      }
    };

    const result = await cacheService.warmCache({
      popularCommunityIds: communityIds,
      activeUserIds: userIds,
      fetchFunctions,
      enableCommunityWarming,
      enableUserWarming
    });

    res.json({
      success: result,
      message: result ? 'Cache warming completed successfully' : 'Cache warming failed',
      timestamp: new Date().toISOString(),
      warmedItems: {
        communities: communityIds.length,
        users: userIds.length
      }
    });

  } catch (error) {
    console.error('Error warming cache:', error);
    res.status(500).json({
      success: false,
      error: 'Cache warming failed',
      message: error.message
    });
  }
});

/**
 * Invalidate cache by pattern
 */
router.delete('/invalidate/:pattern', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const { pattern } = req.params;
    
    await cacheService.invalidatePattern(pattern);
    
    res.json({
      success: true,
      message: `Cache invalidated for pattern: ${pattern}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: 'Cache invalidation failed',
      message: error.message
    });
  }
});

/**
 * Invalidate specific user cache
 */
router.delete('/user/:userId', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const { userId } = req.params;
    const { updateType } = req.query;
    
    await cacheService.invalidateUser(userId, updateType);
    
    res.json({
      success: true,
      message: `User cache invalidated for ID: ${userId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error invalidating user cache:', error);
    res.status(500).json({
      success: false,
      error: 'User cache invalidation failed',
      message: error.message
    });
  }
});

/**
 * Invalidate specific community cache
 */
router.delete('/community/:communityId', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const { communityId } = req.params;
    const { updateType } = req.query;
    
    await cacheService.invalidateCommunity(communityId, updateType);
    
    res.json({
      success: true,
      message: `Community cache invalidated for ID: ${communityId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error invalidating community cache:', error);
    res.status(500).json({
      success: false,
      error: 'Community cache invalidation failed',
      message: error.message
    });
  }
});

/**
 * Clear all caches (use with caution)
 */
router.delete('/clear', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const { confirm } = req.body;
    
    if (confirm !== 'yes') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Please send { "confirm": "yes" } in request body to clear all caches'
      });
    }
    
    await cacheService.clearAll();
    
    res.json({
      success: true,
      message: 'All caches cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Cache clearing failed',
      message: error.message
    });
  }
});

/**
 * Get cached data for debugging
 */
router.get('/debug/:type/:id', async (req, res) => {
  try {
    const cacheService = getCacheService();
    const { type, id } = req.params;
    
    let data = null;
    
    switch (type) {
      case 'community':
        data = await cacheService.community.bulkGet(id);
        break;
      case 'user':
        data = await cacheService.user.bulkGet(id);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid type',
          message: 'Type must be "community" or "user"'
        });
    }
    
    res.json({
      success: true,
      data: data,
      cached: data !== null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cached data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cached data',
      message: error.message
    });
  }
});

module.exports = router;
