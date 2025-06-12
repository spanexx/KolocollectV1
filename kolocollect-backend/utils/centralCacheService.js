/**
 * Central Cache Service
 * Phase 3: Database Optimization - Main Cache Coordination
 * 
 * Provides centralized cache management with:
 * - Unified cache interface
 * - Cross-service cache invalidation
 * - Performance monitoring
 * - Cache warming coordination
 * - Configuration management
 */

const { CacheManager, CacheKeys, CacheTTL } = require('./cacheManager');
const { CommunityCacheService } = require('./communityCacheService');
const { UserCacheService } = require('./userCacheService');

class CentralCacheService {
  constructor(options = {}) {
    this.cacheManager = new CacheManager(options);
    
    // Initialize specialized cache services
    this.community = new CommunityCacheService(this.cacheManager);
    this.user = new UserCacheService(this.cacheManager);
    
    this.isInitialized = false;
    this.warmingInProgress = false;
    
    // Configuration cache
    this.configCache = new Map();
    this.configCacheExpiry = new Map();
  }

  /**
   * Initialize all cache services
   */
  async initialize() {
    try {
      console.log('Initializing Central Cache Service...');
      
      // Connect to Redis
      const connected = await this.cacheManager.connect();
      if (!connected) {
        console.warn('Redis connection failed - cache will operate in memory-only mode');
      }
      
      this.isInitialized = true;
      console.log('Central Cache Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      console.log('Shutting down Central Cache Service...');
      await this.cacheManager.disconnect();
      this.isInitialized = false;
      console.log('Central Cache Service shut down successfully');
    } catch (error) {
      console.error('Error during cache service shutdown:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { status: 'unhealthy', reason: 'not_initialized' };
      }

      // Test Redis connection
      const testKey = 'health_check_' + Date.now();
      const testValue = 'ok';
      
      await this.cacheManager.set(testKey, testValue, 10); // 10 second TTL
      const retrieved = await this.cacheManager.get(testKey);
      await this.cacheManager.delete(testKey);
      
      if (retrieved === testValue) {
        return { 
          status: 'healthy', 
          redis: this.cacheManager.isConnected,
          stats: this.getStats()
        };
      } else {
        return { status: 'unhealthy', reason: 'redis_test_failed' };
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        reason: 'health_check_error',
        error: error.message 
      };
    }
  }

  /**
   * Global cache warming
   */
  async warmCache(options = {}) {
    if (this.warmingInProgress) {
      console.log('Cache warming already in progress...');
      return false;
    }

    try {
      this.warmingInProgress = true;
      console.log('Starting global cache warming...');

      const {
        popularCommunityIds = [],
        activeUserIds = [],
        fetchFunctions = {},
        enableCommunityWarming = true,
        enableUserWarming = true
      } = options;

      const promises = [];

      // Warm community caches
      if (enableCommunityWarming && popularCommunityIds.length > 0 && fetchFunctions.community) {
        promises.push(
          this.community.warmPopularCommunities(popularCommunityIds, fetchFunctions.community)
        );
      }

      // Warm user caches
      if (enableUserWarming && activeUserIds.length > 0 && fetchFunctions.user) {
        promises.push(
          this.user.warmActiveUsers(activeUserIds, fetchFunctions.user)
        );
      }

      // Warm configuration
      if (fetchFunctions.config) {
        promises.push(this.warmConfiguration(fetchFunctions.config));
      }

      await Promise.all(promises);
      console.log('Global cache warming completed successfully');
      return true;

    } catch (error) {
      console.error('Cache warming failed:', error);
      return false;
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * Configuration caching
   */
  async cacheConfig(key, value, ttl = CacheTTL.CONFIG) {
    // Cache in Redis
    const redisKey = CacheKeys.config(key);
    await this.cacheManager.set(redisKey, value, ttl);
    
    // Cache locally for faster access
    this.configCache.set(key, value);
    this.configCacheExpiry.set(key, Date.now() + (ttl * 1000));
    
    return true;
  }

  async getConfig(key, defaultValue = null) {
    // Check local cache first
    if (this.configCache.has(key)) {
      const expiry = this.configCacheExpiry.get(key);
      if (Date.now() < expiry) {
        return this.configCache.get(key);
      } else {
        // Expired, remove from local cache
        this.configCache.delete(key);
        this.configCacheExpiry.delete(key);
      }
    }

    // Check Redis cache
    const redisKey = CacheKeys.config(key);
    const value = await this.cacheManager.get(redisKey);
    
    if (value !== null) {
      // Update local cache
      this.configCache.set(key, value);
      this.configCacheExpiry.set(key, Date.now() + (CacheTTL.CONFIG * 1000));
      return value;
    }

    return defaultValue;
  }

  async warmConfiguration(fetchFunction) {
    try {
      const configs = await fetchFunction();
      const promises = Object.entries(configs).map(([key, value]) =>
        this.cacheConfig(key, value)
      );
      await Promise.all(promises);
      console.log('Configuration cache warmed successfully');
    } catch (error) {
      console.error('Failed to warm configuration cache:', error);
    }
  }

  /**
   * Feature flag caching
   */
  async cacheFeatureFlag(flag, value, ttl = CacheTTL.CONFIG) {
    const key = CacheKeys.featureFlag(flag);
    return await this.cacheManager.set(key, value, ttl);
  }

  async getFeatureFlag(flag, defaultValue = false) {
    const key = CacheKeys.featureFlag(flag);
    const value = await this.cacheManager.get(key);
    return value !== null ? value : defaultValue;
  }

  /**
   * Search result caching
   */
  async cacheSearchResults(type, query, results, ttl = CacheTTL.SEARCH_RESULTS) {
    const key = type === 'community' 
      ? CacheKeys.communitySearch(query)
      : CacheKeys.userSearch(query);
    return await this.cacheManager.set(key, results, ttl);
  }

  async getSearchResults(type, query) {
    const key = type === 'community' 
      ? CacheKeys.communitySearch(query)
      : CacheKeys.userSearch(query);
    return await this.cacheManager.get(key);
  }

  /**
   * Analytics caching
   */
  async cacheAnalytics(type, id, period, data, ttl = CacheTTL.ANALYTICS) {
    let key;
    switch (type) {
      case 'community':
        key = CacheKeys.communityAnalytics(id, period);
        break;
      case 'user':
        key = CacheKeys.userAnalytics(id, period);
        break;
      case 'global':
        key = CacheKeys.globalStats(period);
        break;
      default:
        throw new Error(`Unknown analytics type: ${type}`);
    }
    
    return await this.cacheManager.set(key, data, ttl);
  }

  async getAnalytics(type, id, period) {
    let key;
    switch (type) {
      case 'community':
        key = CacheKeys.communityAnalytics(id, period);
        break;
      case 'user':
        key = CacheKeys.userAnalytics(id, period);
        break;
      case 'global':
        key = CacheKeys.globalStats(period);
        break;
      default:
        throw new Error(`Unknown analytics type: ${type}`);
    }
    
    return await this.cacheManager.get(key);
  }

  /**
   * Cross-service invalidation
   */
  async invalidateUser(userId, updateType = null, updateData = null) {
    // Invalidate user-specific caches
    await this.user.smartInvalidation(userId, updateType, updateData);
    
    // Invalidate related community caches if user left/joined communities
    if (updateType === 'joined_community' || updateType === 'left_community') {
      if (updateData && updateData.communityId) {
        await this.community.smartInvalidation(
          updateData.communityId, 
          'member_' + (updateType === 'joined_community' ? 'added' : 'removed'),
          { userId }
        );
      }
    }
  }

  async invalidateCommunity(communityId, updateType = null, updateData = null) {
    // Invalidate community-specific caches
    await this.community.smartInvalidation(communityId, updateType, updateData);
    
    // Invalidate related user caches if members were affected
    if (updateType === 'member_added' || updateType === 'member_removed') {
      if (updateData && updateData.userId) {
        const userUpdateType = updateType === 'member_added' ? 'joined_community' : 'left_community';
        await this.user.smartInvalidation(
          updateData.userId,
          userUpdateType,
          { communityId }
        );
      }
    }
  }

  /**
   * Bulk invalidation
   */
  async invalidateMultipleUsers(userIds, updateType = null) {
    const promises = userIds.map(userId => 
      this.user.smartInvalidation(userId, updateType)
    );
    await Promise.all(promises);
  }

  async invalidateMultipleCommunities(communityIds, updateType = null) {
    const promises = communityIds.map(communityId => 
      this.community.smartInvalidation(communityId, updateType)
    );
    await Promise.all(promises);
  }

  /**
   * Pattern-based invalidation
   */
  async invalidatePattern(pattern) {
    return await this.cacheManager.invalidatePattern(pattern);
  }

  /**
   * Clear all caches
   */
  async clearAll() {
    await this.cacheManager.clear();
    this.configCache.clear();
    this.configCacheExpiry.clear();
    console.log('All caches cleared');
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats() {
    const baseStats = this.cacheManager.getStats();
    
    return {
      ...baseStats,
      configCacheSize: this.configCache.size,
      warmingInProgress: this.warmingInProgress,
      isInitialized: this.isInitialized,
      services: {
        community: 'active',
        user: 'active',
        central: 'active'
      }
    };
  }

  /**
   * Cache monitoring middleware
   */
  createMonitoringMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Add cache utilities to request object
      req.cache = {
        community: this.community,
        user: this.user,
        central: this,
        
        // Convenience methods
        invalidateUser: (userId, updateType, updateData) => 
          this.invalidateUser(userId, updateType, updateData),
        invalidateCommunity: (communityId, updateType, updateData) => 
          this.invalidateCommunity(communityId, updateType, updateData)
      };
      
      // Track cache usage
      res.on('finish', () => {
        const duration = Date.now() - start;
        const cacheUsed = req.cacheHit ? 'HIT' : 'MISS';
        console.log(`${req.method} ${req.path} - Cache: ${cacheUsed} - Duration: ${duration}ms`);
      });
      
      next();
    };
  }

  /**
   * Express middleware for cache headers
   */
  createCacheHeadersMiddleware() {
    return (req, res, next) => {
      // Set cache-related headers
      res.setHeader('X-Cache-Service', 'KoloCollect-Cache-v1');
      res.setHeader('X-Cache-Status', this.isInitialized ? 'active' : 'inactive');
      
      next();
    };
  }
}

// Singleton instance
let cacheServiceInstance = null;

/**
 * Get or create cache service instance
 */
function getCacheService(options = {}) {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CentralCacheService(options);
  }
  return cacheServiceInstance;
}

/**
 * Initialize cache service (call once at app startup)
 */
async function initializeCacheService(options = {}) {
  // Always get the singleton instance
  const cacheService = getCacheService(options);
  
  // Only initialize if not already initialized
  if (!cacheService.isInitialized) {
    await cacheService.initialize();
  }
  
  return cacheService;
}

module.exports = {
  CentralCacheService,
  getCacheService,
  initializeCacheService,
  CacheKeys,
  CacheTTL
};
