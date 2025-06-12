/**
 * User Cache Service
 * Phase 3: Database Optimization - Specialized User Caching
 * 
 * Provides optimized caching for user-related data with:
 * - Profile caching with smart invalidation
 * - Session management
 * - User-community relationship caching
 * - Analytics and preference caching
 */

const { CacheManager, CacheKeys, CacheTTL } = require('./cacheManager');

class UserCacheService {
  constructor(cacheManager) {
    this.cache = cacheManager;
    this.namespace = 'user';
  }

  /**
   * Cache user profile data
   */
  async cacheProfile(userId, profileData, ttl = CacheTTL.USER_PROFILE) {
    const key = this.cache.generateKey(this.namespace, userId, 'profile');
    return await this.cache.set(key, profileData, ttl, { enableMemoryCache: true });
  }

  /**
   * Get user profile from cache
   */
  async getProfile(userId) {
    const key = this.cache.generateKey(this.namespace, userId, 'profile');
    return await this.cache.get(key, { enableMemoryCache: true });
  }

  /**
   * Cache user's communities
   */
  async cacheCommunities(userId, communitiesData, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, userId, 'communities');
    return await this.cache.set(key, communitiesData, ttl);
  }

  /**
   * Get user's communities from cache
   */
  async getCommunities(userId) {
    const key = this.cache.generateKey(this.namespace, userId, 'communities');
    return await this.cache.get(key);
  }

  /**
   * Cache user wallet data
   */
  async cacheWallet(userId, walletData, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, userId, 'wallet');
    return await this.cache.set(key, walletData, ttl);
  }

  /**
   * Get user wallet from cache
   */
  async getWallet(userId) {
    const key = this.cache.generateKey(this.namespace, userId, 'wallet');
    return await this.cache.get(key);
  }

  /**
   * Cache user preferences
   */
  async cachePreferences(userId, preferencesData, ttl = CacheTTL.LONG) {
    const key = this.cache.generateKey(this.namespace, userId, 'preferences');
    return await this.cache.set(key, preferencesData, ttl);
  }

  /**
   * Get user preferences from cache
   */
  async getPreferences(userId) {
    const key = this.cache.generateKey(this.namespace, userId, 'preferences');
    return await this.cache.get(key);
  }

  /**
   * Cache user session data
   */
  async cacheSession(sessionId, sessionData, ttl = CacheTTL.SESSION) {
    const key = CacheKeys.session(sessionId);
    return await this.cache.set(key, sessionData, ttl, { enableMemoryCache: true });
  }

  /**
   * Get user session from cache
   */
  async getSession(sessionId) {
    const key = CacheKeys.session(sessionId);
    return await this.cache.get(key, { enableMemoryCache: true });
  }

  /**
   * Cache auth token data
   */
  async cacheAuthToken(tokenId, tokenData, ttl = CacheTTL.SESSION) {
    const key = CacheKeys.authToken(tokenId);
    return await this.cache.set(key, tokenData, ttl, { enableMemoryCache: true });
  }

  /**
   * Get auth token from cache
   */
  async getAuthToken(tokenId) {
    const key = CacheKeys.authToken(tokenId);
    return await this.cache.get(key, { enableMemoryCache: true });
  }

  /**
   * Get or fetch user profile with caching
   */
  async getProfileOrFetch(userId, fetchFunction, ttl = CacheTTL.USER_PROFILE) {
    const key = this.cache.generateKey(this.namespace, userId, 'profile');
    return await this.cache.getOrSet(key, fetchFunction, ttl, { enableMemoryCache: true });
  }

  /**
   * Get or fetch user communities with caching
   */
  async getCommunitiesOrFetch(userId, fetchFunction, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, userId, 'communities');
    return await this.cache.getOrSet(key, fetchFunction, ttl);
  }

  /**
   * Get or fetch user wallet with caching
   */
  async getWalletOrFetch(userId, fetchFunction, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, userId, 'wallet');
    return await this.cache.getOrSet(key, fetchFunction, ttl);
  }

  /**
   * Invalidate all cache for a specific user
   */
  async invalidateUser(userId) {
    const patterns = ['profile', 'communities', 'wallet', 'preferences'];
    const promises = patterns.map(pattern => {
      const key = this.cache.generateKey(this.namespace, userId, pattern);
      return this.cache.delete(key);
    });
    
    await Promise.all(promises);
    
    // Also invalidate analytics
    await this.cache.invalidatePattern(`analytics:user:${userId}`);
  }

  /**
   * Invalidate specific user data type
   */
  async invalidateUserData(userId, dataType) {
    const key = this.cache.generateKey(this.namespace, userId, dataType);
    return await this.cache.delete(key);
  }

  /**
   * Invalidate user session
   */
  async invalidateSession(sessionId) {
    const key = CacheKeys.session(sessionId);
    return await this.cache.delete(key);
  }

  /**
   * Invalidate auth token
   */
  async invalidateAuthToken(tokenId) {
    const key = CacheKeys.authToken(tokenId);
    return await this.cache.delete(key);
  }

  /**
   * Bulk cache user data
   */
  async bulkCache(userId, data, options = {}) {
    const promises = [];
    
    if (data.profile) {
      promises.push(this.cacheProfile(userId, data.profile, options.profileTTL));
    }
    
    if (data.communities) {
      promises.push(this.cacheCommunities(userId, data.communities, options.communitiesTTL));
    }
    
    if (data.wallet) {
      promises.push(this.cacheWallet(userId, data.wallet, options.walletTTL));
    }
    
    if (data.preferences) {
      promises.push(this.cachePreferences(userId, data.preferences, options.preferencesTTL));
    }
    
    return await Promise.all(promises);
  }

  /**
   * Bulk fetch user data from cache
   */
  async bulkGet(userId, dataTypes = ['profile', 'communities', 'wallet']) {
    const promises = dataTypes.map(type => {
      switch (type) {
        case 'profile': return this.getProfile(userId);
        case 'communities': return this.getCommunities(userId);
        case 'wallet': return this.getWallet(userId);
        case 'preferences': return this.getPreferences(userId);
        default: return Promise.resolve(null);
      }
    });
    
    const results = await Promise.all(promises);
    const data = {};
    
    dataTypes.forEach((type, index) => {
      data[type] = results[index];
    });
    
    return data;
  }

  /**
   * Cache user search results
   */
  async cacheSearchResults(query, results, ttl = CacheTTL.SEARCH_RESULTS) {
    const key = CacheKeys.userSearch(query);
    return await this.cache.set(key, results, ttl);
  }

  /**
   * Get user search results from cache
   */
  async getSearchResults(query) {
    const key = CacheKeys.userSearch(query);
    return await this.cache.get(key);
  }

  /**
   * Cache user analytics
   */
  async cacheAnalytics(userId, period, analyticsData, ttl = CacheTTL.ANALYTICS) {
    const key = CacheKeys.userAnalytics(userId, period);
    return await this.cache.set(key, analyticsData, ttl);
  }

  /**
   * Get user analytics from cache
   */
  async getAnalytics(userId, period) {
    const key = CacheKeys.userAnalytics(userId, period);
    return await this.cache.get(key);
  }

  /**
   * Smart invalidation based on user updates
   */
  async smartInvalidation(userId, updateType, updateData) {
    switch (updateType) {
      case 'profile_updated':
        await this.invalidateUserData(userId, 'profile');
        break;
        
      case 'joined_community':
      case 'left_community':
        await this.invalidateUserData(userId, 'communities');
        break;
        
      case 'wallet_transaction':
      case 'wallet_updated':
        await this.invalidateUserData(userId, 'wallet');
        break;
        
      case 'preferences_updated':
        await this.invalidateUserData(userId, 'preferences');
        break;
        
      case 'password_changed':
      case 'email_verified':
        await this.invalidateUserData(userId, 'profile');
        // Invalidate all sessions for security
        await this.cache.invalidatePattern(`session:`);
        await this.cache.invalidatePattern(`auth:token:`);
        break;
        
      default:
        // Full invalidation for unknown update types
        await this.invalidateUser(userId);
    }
  }

  /**
   * Cache warming for active users
   */
  async warmActiveUsers(activeUserIds, fetchFunctions) {
    const warmingFunctions = [];
    
    for (const userId of activeUserIds) {
      // Warm profile data
      warmingFunctions.push({
        key: this.cache.generateKey(this.namespace, userId, 'profile'),
        fetchFunction: () => fetchFunctions.profile(userId),
        ttl: CacheTTL.USER_PROFILE,
        options: { enableMemoryCache: true }
      });
      
      // Warm communities data
      warmingFunctions.push({
        key: this.cache.generateKey(this.namespace, userId, 'communities'),
        fetchFunction: () => fetchFunctions.communities(userId),
        ttl: CacheTTL.MEDIUM
      });
    }
    
    await this.cache.warmCache(warmingFunctions);
  }

  /**
   * Rate limiting cache operations
   */
  async setRateLimit(identifier, endpoint, count, windowMs) {
    const key = CacheKeys.rateLimit(identifier, endpoint);
    const expiry = Math.ceil(windowMs / 1000);
    return await this.cache.set(key, { count, resetTime: Date.now() + windowMs }, expiry);
  }

  async getRateLimit(identifier, endpoint) {
    const key = CacheKeys.rateLimit(identifier, endpoint);
    return await this.cache.get(key);
  }

  async incrementRateLimit(identifier, endpoint) {
    const key = CacheKeys.rateLimit(identifier, endpoint);
    const current = await this.getRateLimit(identifier, endpoint);
    
    if (current) {
      current.count++;
      const ttl = Math.ceil((current.resetTime - Date.now()) / 1000);
      if (ttl > 0) {
        await this.cache.set(key, current, ttl);
      }
      return current;
    }
    
    return null;
  }

  /**
   * Get cache statistics for users
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

module.exports = { UserCacheService };
