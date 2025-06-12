/**
 * Community Cache Service
 * Phase 3: Database Optimization - Specialized Community Caching
 * 
 * Provides optimized caching for community-related data with:
 * - Intelligent cache invalidation
 * - Selective data caching (core, stats, history)
 * - Cache warming strategies
 * - Performance monitoring
 */

const { CacheManager, CacheKeys, CacheTTL } = require('./cacheManager');

class CommunityCacheService {
  constructor(cacheManager) {
    this.cache = cacheManager;
    this.namespace = 'community';
  }

  /**
   * Cache community core data (frequently accessed)
   */
  async cacheCore(communityId, coreData, ttl = CacheTTL.COMMUNITY_DATA) {
    const key = this.cache.generateKey(this.namespace, communityId, 'core');
    return await this.cache.set(key, coreData, ttl, { enableMemoryCache: true });
  }

  /**
   * Get community core data from cache
   */
  async getCore(communityId) {
    const key = this.cache.generateKey(this.namespace, communityId, 'core');
    return await this.cache.get(key, { enableMemoryCache: true });
  }

  /**
   * Cache community statistics (moderate frequency)
   */
  async cacheStats(communityId, statsData, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, communityId, 'stats');
    return await this.cache.set(key, statsData, ttl);
  }

  /**
   * Get community statistics from cache
   */
  async getStats(communityId) {
    const key = this.cache.generateKey(this.namespace, communityId, 'stats');
    return await this.cache.get(key);
  }

  /**
   * Cache community history data (less frequent access)
   */
  async cacheHistory(communityId, historyData, ttl = CacheTTL.LONG) {
    const key = this.cache.generateKey(this.namespace, communityId, 'history');
    return await this.cache.set(key, historyData, ttl);
  }

  /**
   * Get community history from cache
   */
  async getHistory(communityId) {
    const key = this.cache.generateKey(this.namespace, communityId, 'history');
    return await this.cache.get(key);
  }

  /**
   * Cache community members list
   */
  async cacheMembers(communityId, membersData, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, communityId, 'members');
    return await this.cache.set(key, membersData, ttl);
  }

  /**
   * Get community members from cache
   */
  async getMembers(communityId) {
    const key = this.cache.generateKey(this.namespace, communityId, 'members');
    return await this.cache.get(key);
  }

  /**
   * Cache community cycles
   */
  async cacheCycles(communityId, cyclesData, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, communityId, 'cycles');
    return await this.cache.set(key, cyclesData, ttl);
  }

  /**
   * Get community cycles from cache
   */
  async getCycles(communityId) {
    const key = this.cache.generateKey(this.namespace, communityId, 'cycles');
    return await this.cache.get(key);
  }

  /**
   * Get or fetch community core data with caching
   */
  async getCoreOrFetch(communityId, fetchFunction, ttl = CacheTTL.COMMUNITY_DATA) {
    const key = this.cache.generateKey(this.namespace, communityId, 'core');
    return await this.cache.getOrSet(key, fetchFunction, ttl, { enableMemoryCache: true });
  }

  /**
   * Get or fetch community stats with caching
   */
  async getStatsOrFetch(communityId, fetchFunction, ttl = CacheTTL.MEDIUM) {
    const key = this.cache.generateKey(this.namespace, communityId, 'stats');
    return await this.cache.getOrSet(key, fetchFunction, ttl);
  }

  /**
   * Get or fetch community history with caching
   */
  async getHistoryOrFetch(communityId, fetchFunction, ttl = CacheTTL.LONG) {
    const key = this.cache.generateKey(this.namespace, communityId, 'history');
    return await this.cache.getOrSet(key, fetchFunction, ttl);
  }

  /**
   * Invalidate all cache for a specific community
   */
  async invalidateCommunity(communityId) {
    const patterns = ['core', 'stats', 'history', 'members', 'cycles'];
    const promises = patterns.map(pattern => {
      const key = this.cache.generateKey(this.namespace, communityId, pattern);
      return this.cache.delete(key);
    });
    
    await Promise.all(promises);
    
    // Also invalidate any list caches that might contain this community
    await this.cache.invalidatePattern('communities:list');
    await this.cache.invalidatePattern(`analytics:community:${communityId}`);
  }

  /**
   * Invalidate specific community data type
   */
  async invalidateCommunityData(communityId, dataType) {
    const key = this.cache.generateKey(this.namespace, communityId, dataType);
    return await this.cache.delete(key);
  }

  /**
   * Bulk cache community data
   */
  async bulkCache(communityId, data, options = {}) {
    const promises = [];
    
    if (data.core) {
      promises.push(this.cacheCore(communityId, data.core, options.coreTTL));
    }
    
    if (data.stats) {
      promises.push(this.cacheStats(communityId, data.stats, options.statsTTL));
    }
    
    if (data.history) {
      promises.push(this.cacheHistory(communityId, data.history, options.historyTTL));
    }
    
    if (data.members) {
      promises.push(this.cacheMembers(communityId, data.members, options.membersTTL));
    }
    
    if (data.cycles) {
      promises.push(this.cacheCycles(communityId, data.cycles, options.cyclesTTL));
    }
    
    return await Promise.all(promises);
  }

  /**
   * Bulk fetch community data from cache
   */
  async bulkGet(communityId, dataTypes = ['core', 'stats', 'members', 'cycles']) {
    const promises = dataTypes.map(type => {
      switch (type) {
        case 'core': return this.getCore(communityId);
        case 'stats': return this.getStats(communityId);
        case 'history': return this.getHistory(communityId);
        case 'members': return this.getMembers(communityId);
        case 'cycles': return this.getCycles(communityId);
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
   * Cache community list with filters
   */
  async cacheList(filters, communities, ttl = CacheTTL.MEDIUM) {
    const key = CacheKeys.communityList(filters);
    return await this.cache.set(key, communities, ttl);
  }

  /**
   * Get community list from cache
   */
  async getList(filters) {
    const key = CacheKeys.communityList(filters);
    return await this.cache.get(key);
  }

  /**
   * Get or fetch community list with caching
   */
  async getListOrFetch(filters, fetchFunction, ttl = CacheTTL.MEDIUM) {
    const key = CacheKeys.communityList(filters);
    return await this.cache.getOrSet(key, fetchFunction, ttl);
  }

  /**
   * Cache warming for popular communities
   */
  async warmPopularCommunities(popularCommunityIds, fetchFunctions) {
    const warmingFunctions = [];
    
    for (const communityId of popularCommunityIds) {
      // Warm core data
      warmingFunctions.push({
        key: this.cache.generateKey(this.namespace, communityId, 'core'),
        fetchFunction: () => fetchFunctions.core(communityId),
        ttl: CacheTTL.COMMUNITY_DATA,
        options: { enableMemoryCache: true }
      });
      
      // Warm stats data
      warmingFunctions.push({
        key: this.cache.generateKey(this.namespace, communityId, 'stats'),
        fetchFunction: () => fetchFunctions.stats(communityId),
        ttl: CacheTTL.MEDIUM
      });
      
      // Warm members data
      warmingFunctions.push({
        key: this.cache.generateKey(this.namespace, communityId, 'members'),
        fetchFunction: () => fetchFunctions.members(communityId),
        ttl: CacheTTL.MEDIUM
      });
    }
    
    await this.cache.warmCache(warmingFunctions);
  }

  /**
   * Smart invalidation based on community updates
   */
  async smartInvalidation(communityId, updateType, updateData) {
    switch (updateType) {
      case 'member_added':
      case 'member_removed':
        await this.invalidateCommunityData(communityId, 'members');
        await this.invalidateCommunityData(communityId, 'stats');
        break;
        
      case 'cycle_completed':
      case 'cycle_started':
        await this.invalidateCommunityData(communityId, 'cycles');
        await this.invalidateCommunityData(communityId, 'stats');
        await this.invalidateCommunityData(communityId, 'history');
        break;
        
      case 'contribution_made':
        await this.invalidateCommunityData(communityId, 'stats');
        break;
        
      case 'core_data_updated':
        await this.invalidateCommunityData(communityId, 'core');
        await this.cache.invalidatePattern('communities:list');
        break;
        
      case 'settings_updated':
        await this.invalidateCommunityData(communityId, 'core');
        break;
        
      default:
        // Full invalidation for unknown update types
        await this.invalidateCommunity(communityId);
    }
  }

  /**
   * Get cache statistics for communities
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

module.exports = { CommunityCacheService };
