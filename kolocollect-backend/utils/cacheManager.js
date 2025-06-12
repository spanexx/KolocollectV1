/**
 * Redis Cache Manager
 * Phase 3: Database Optimization - Caching Layer Implementation
 * 
 * Provides comprehensive caching utilities with:
 * - Multi-level caching (L1: Memory, L2: Redis)
 * - Cache invalidation strategies
 * - Performance monitoring
 * - Distributed caching for scalability
 */

const redis = require('redis');
const { performance } = require('perf_hooks');

class CacheManager {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
    this.enableMetrics = options.enableMetrics !== false;
    this.maxMemoryCacheSize = options.maxMemoryCacheSize || 1000;
    
    // L1 Cache (Memory) - for frequently accessed small data
    this.memoryCache = new Map();
    this.memoryCacheAccess = new Map(); // Track access frequency
    
    // Performance metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      memoryHits: 0,
      redisHits: 0
    };
    
    this.redisClient = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      this.redisClient = redis.createClient({
        url: this.redisUrl,
        socket: {
          connectTimeout: 10000,
          lazyConnect: true
        }
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.redisClient.on('ready', () => {
        console.log('Redis Client Ready');
      });

      await this.redisClient.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.redisClient && this.isConnected) {
      await this.redisClient.quit();
      this.isConnected = false;
    }
  }

  /**
   * Generate cache key with namespace
   */
  generateKey(namespace, identifier, suffix = '') {
    const key = `kolocollect:${namespace}:${identifier}`;
    return suffix ? `${key}:${suffix}` : key;
  }

  /**
   * Get from cache (L1 -> L2 fallback)
   */
  async get(key, options = {}) {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      // L1 Cache check (Memory)
      if (this.memoryCache.has(key)) {
        const cachedData = this.memoryCache.get(key);
        if (this._isValidMemoryCache(cachedData)) {
          this.metrics.hits++;
          this.metrics.memoryHits++;
          this._updateAccessFrequency(key);
          this._updateMetrics(startTime);
          return cachedData.data;
        } else {
          // Expired, remove from memory cache
          this.memoryCache.delete(key);
          this.memoryCacheAccess.delete(key);
        }
      }

      // L2 Cache check (Redis)
      if (!this.isConnected) {
        this.metrics.misses++;
        this._updateMetrics(startTime);
        return null;
      }

      const cachedValue = await this.redisClient.get(key);
      
      if (cachedValue) {
        const parsedValue = JSON.parse(cachedValue);
        this.metrics.hits++;
        this.metrics.redisHits++;
        
        // Store in L1 cache if it's small enough and frequently accessed
        if (options.enableMemoryCache !== false && this._shouldCacheInMemory(key, parsedValue)) {
          this._setMemoryCache(key, parsedValue, options.memoryTTL || 300); // 5 min default for memory
        }
        
        this._updateMetrics(startTime);
        return parsedValue;
      }

      this.metrics.misses++;
      this._updateMetrics(startTime);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.errors++;
      this._updateMetrics(startTime);
      return null;
    }
  }

  /**
   * Set cache with multi-level support
   */
  async set(key, value, ttl = null, options = {}) {
    const startTime = performance.now();
    const finalTTL = ttl || this.defaultTTL;

    try {
      // Set in Redis (L2)
      if (this.isConnected) {
        const serializedValue = JSON.stringify(value);
        await this.redisClient.setEx(key, finalTTL, serializedValue);
      }

      // Set in Memory Cache (L1) if appropriate
      if (options.enableMemoryCache !== false && this._shouldCacheInMemory(key, value)) {
        const memoryTTL = Math.min(finalTTL, options.memoryTTL || 300);
        this._setMemoryCache(key, value, memoryTTL);
      }

      this._updateMetrics(startTime);
      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      this.metrics.errors++;
      this._updateMetrics(startTime);
      return false;
    }
  }

  /**
   * Delete from all cache levels
   */
  async delete(key) {
    try {
      // Remove from memory cache
      this.memoryCache.delete(key);
      this.memoryCacheAccess.delete(key);

      // Remove from Redis
      if (this.isConnected) {
        await this.redisClient.del(key);
      }

      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern) {
    try {
      // Clear matching keys from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
          this.memoryCacheAccess.delete(key);
        }
      }

      // Clear matching keys from Redis
      if (this.isConnected) {
        const keys = await this.redisClient.keys(`*${pattern}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }

      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet(key, fetchFunction, ttl = null, options = {}) {
    try {
      // Try to get from cache first
      let value = await this.get(key, options);
      
      if (value !== null) {
        return value;
      }

      // Cache miss - fetch data
      value = await fetchFunction();
      
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl, options);
      }

      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // Return result from fetch function even if caching fails
      try {
        return await fetchFunction();
      } catch (fetchError) {
        throw fetchError;
      }
    }
  }

  /**
   * Bulk operations
   */
  async mget(keys) {
    if (!this.isConnected) return keys.map(() => null);
    
    try {
      const values = await this.redisClient.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs, ttl = null) {
    if (!this.isConnected) return false;
    
    try {
      const pipeline = this.redisClient.multi();
      const finalTTL = ttl || this.defaultTTL;

      for (const [key, value] of keyValuePairs) {
        pipeline.setEx(key, finalTTL, JSON.stringify(value));
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  async warmCache(warmingFunctions) {
    console.log('Starting cache warming...');
    
    for (const { key, fetchFunction, ttl, options } of warmingFunctions) {
      try {
        const data = await fetchFunction();
        if (data) {
          await this.set(key, data, ttl, options);
          console.log(`Warmed cache for key: ${key}`);
        }
      } catch (error) {
        console.error(`Failed to warm cache for key ${key}:`, error);
      }
    }
    
    console.log('Cache warming completed');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      hitRate: `${hitRate}%`,
      memoryCacheSize: this.memoryCache.size,
      isRedisConnected: this.isConnected,
      memoryHitRate: this.metrics.totalRequests > 0 
        ? (this.metrics.memoryHits / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      redisHitRate: this.metrics.totalRequests > 0 
        ? (this.metrics.redisHits / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Clear all caches
   */
  async clear() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.memoryCacheAccess.clear();

      // Clear Redis cache
      if (this.isConnected) {
        await this.redisClient.flushAll();
      }

      // Reset metrics
      this.metrics = {
        hits: 0,
        misses: 0,
        errors: 0,
        totalRequests: 0,
        averageResponseTime: 0,
        memoryHits: 0,
        redisHits: 0
      };

      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  _isValidMemoryCache(cachedData) {
    return cachedData && Date.now() < cachedData.expiry;
  }

  _setMemoryCache(key, data, ttl) {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      this._evictLRU();
    }

    this.memoryCache.set(key, {
      data,
      expiry: Date.now() + (ttl * 1000),
      created: Date.now()
    });
    this.memoryCacheAccess.set(key, { count: 1, lastAccess: Date.now() });
  }

  _shouldCacheInMemory(key, value) {
    // Cache small, frequently accessed data in memory
    const serializedSize = JSON.stringify(value).length;
    const isSmall = serializedSize < 10240; // 10KB limit
    const isFrequent = this.memoryCacheAccess.has(key) && 
                      this.memoryCacheAccess.get(key).count > 2;
    
    return isSmall && (isFrequent || this.memoryCache.size < this.maxMemoryCacheSize * 0.5);
  }

  _updateAccessFrequency(key) {
    if (this.memoryCacheAccess.has(key)) {
      const access = this.memoryCacheAccess.get(key);
      access.count++;
      access.lastAccess = Date.now();
    }
  }

  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, access] of this.memoryCacheAccess.entries()) {
      if (access.lastAccess < oldestTime) {
        oldestTime = access.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.memoryCacheAccess.delete(oldestKey);
    }
  }

  _updateMetrics(startTime) {
    const duration = performance.now() - startTime;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + duration) / 
      this.metrics.totalRequests;
  }
}

// Cache key generators for different data types
const CacheKeys = {
  // Community cache keys
  community: (id) => `community:${id}`,
  communityCore: (id) => `community:core:${id}`,
  communityStats: (id) => `community:stats:${id}`,
  communityHistory: (id) => `community:history:${id}`,
  communityMembers: (id) => `community:members:${id}`,
  communityCycles: (id) => `community:cycles:${id}`,
  
  // User cache keys
  user: (id) => `user:${id}`,
  userProfile: (id) => `user:profile:${id}`,
  userCommunities: (id) => `user:communities:${id}`,
  userWallet: (id) => `user:wallet:${id}`,
  
  // Search and listing cache keys
  communityList: (filters) => `communities:list:${Buffer.from(JSON.stringify(filters)).toString('base64')}`,
  userSearch: (query) => `search:users:${query}`,
  communitySearch: (query) => `search:communities:${query}`,
  
  // Analytics cache keys
  communityAnalytics: (id, period) => `analytics:community:${id}:${period}`,
  userAnalytics: (id, period) => `analytics:user:${id}:${period}`,
  globalStats: (period) => `analytics:global:${period}`,
  
  // Session and auth cache keys
  session: (sessionId) => `session:${sessionId}`,
  authToken: (tokenId) => `auth:token:${tokenId}`,
  
  // Rate limiting cache keys
  rateLimit: (identifier, endpoint) => `ratelimit:${endpoint}:${identifier}`,
  
  // Feature flags and configuration
  config: (key) => `config:${key}`,
  featureFlag: (flag) => `feature:${flag}`
};

// Cache TTL constants (in seconds)
const CacheTTL = {
  SHORT: 300,        // 5 minutes
  MEDIUM: 1800,      // 30 minutes  
  LONG: 3600,        // 1 hour
  VERY_LONG: 86400,  // 24 hours
  WEEK: 604800,      // 1 week
  
  // Specific TTLs
  USER_PROFILE: 1800,
  COMMUNITY_DATA: 3600,
  SEARCH_RESULTS: 900,
  ANALYTICS: 3600,
  CONFIG: 86400,
  SESSION: 3600
};

module.exports = {
  CacheManager,
  CacheKeys,
  CacheTTL
};
