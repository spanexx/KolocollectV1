/**
 * Cache Warming Script
 * Phase 3: Database Optimization - Automated Cache Warming
 * 
 * Script to warm caches with popular/frequently accessed data
 * Can be run as a scheduled job or on-demand
 */

const mongoose = require('mongoose');
const { getCacheService } = require('../utils/centralCacheService');

// Import models
const CommunityCore = require('../models/CommunityCore');
const CommunityStats = require('../models/CommunityStats');
const User = require('../models/User');

class CacheWarmer {
  constructor() {
    this.cacheService = getCacheService();
  }

  /**
   * Get popular communities based on member count and activity
   */
  async getPopularCommunities(limit = 20) {
    try {
      const communities = await CommunityCore.aggregate([
        { $match: { isActive: true } },
        { 
          $addFields: { 
            memberCount: { $size: "$members" },
            hasActiveCycle: { $ne: ["$currentCycle", null] }
          }
        },
        {
          $sort: { 
            hasActiveCycle: -1,
            memberCount: -1,
            createdAt: -1
          }
        },
        { $limit: limit },
        { $project: { _id: 1 } }
      ]);

      return communities.map(c => c._id.toString());
    } catch (error) {
      console.error('Error getting popular communities:', error);
      return [];
    }
  }

  /**
   * Get active users based on recent login and community participation
   */
  async getActiveUsers(limit = 50) {
    try {
      const users = await User.aggregate([
        { $match: { isActive: true } },
        {
          $addFields: {
            recentActivity: {
              $gte: ["$lastLogin", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
            }
          }
        },
        {
          $sort: {
            recentActivity: -1,
            lastLogin: -1,
            createdAt: -1
          }
        },
        { $limit: limit },
        { $project: { _id: 1 } }
      ]);

      return users.map(u => u._id.toString());
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  /**
   * Create fetch functions for cache warming
   */
  createFetchFunctions() {
    return {
      community: {
        core: async (id) => {
          return await CommunityCore.findById(id)
            .populate('currentCycle', 'cycleNumber status startDate')
            .populate('activeMidCycle', 'status contributions')
            .populate('payoutDetails.nextRecipient', 'name email')
            .lean();
        },
        stats: async (id) => {
          return await CommunityStats.findOne({ 
            communityId: id, 
            period: 'daily' 
          }).sort({ date: -1 }).lean();
        },
        members: async (id) => {
          const community = await CommunityCore.findById(id)
            .populate('members', 'name email isActive')
            .lean();
          return community ? community.members : [];
        }
      },
      user: {
        profile: async (id) => {
          return await User.findById(id)
            .select('-password -__v')
            .lean();
        },
        communities: async (id) => {
          return await CommunityCore.find({ 
            'members': id,
            isActive: true
          }).select('name description isActive memberCount')
          .lean();
        }
      },
      config: async () => {
        return {
          maintenance_mode: false,
          cache_enabled: true,
          feature_flags: {
            new_ui: true,
            advanced_analytics: true,
            smart_notifications: true
          },
          system_settings: {
            max_communities_per_user: 10,
            default_cycle_duration: 30,
            min_contribution_amount: 1000
          }
        };
      }
    };
  }

  /**
   * Warm popular community caches
   */
  async warmCommunities(communityIds = null, options = {}) {
    try {
      const {
        maxConcurrent = 5,
        enableMemoryCache = true
      } = options;

      const ids = communityIds || await this.getPopularCommunities();
      console.log(`Warming cache for ${ids.length} communities...`);

      const fetchFunctions = this.createFetchFunctions();
      
      // Process in batches to avoid overwhelming the database
      const batches = [];
      for (let i = 0; i < ids.length; i += maxConcurrent) {
        batches.push(ids.slice(i, i + maxConcurrent));
      }

      let warmed = 0;
      for (const batch of batches) {
        const promises = batch.map(async (communityId) => {
          try {
            // Warm core data
            await this.cacheService.community.cacheCore(
              communityId,
              await fetchFunctions.community.core(communityId)
            );

            // Warm stats data
            const stats = await fetchFunctions.community.stats(communityId);
            if (stats) {
              await this.cacheService.community.cacheStats(communityId, stats);
            }

            // Warm members data
            const members = await fetchFunctions.community.members(communityId);
            if (members && members.length > 0) {
              await this.cacheService.community.cacheMembers(communityId, members);
            }

            warmed++;
            console.log(`Warmed cache for community ${communityId} (${warmed}/${ids.length})`);
          } catch (error) {
            console.error(`Failed to warm cache for community ${communityId}:`, error);
          }
        });

        await Promise.all(promises);
        
        // Small delay between batches to be gentle on the database
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Successfully warmed cache for ${warmed} communities`);
      return warmed;
    } catch (error) {
      console.error('Error warming community caches:', error);
      return 0;
    }
  }

  /**
   * Warm popular user caches
   */
  async warmUsers(userIds = null, options = {}) {
    try {
      const {
        maxConcurrent = 10,
        enableMemoryCache = true
      } = options;

      const ids = userIds || await this.getActiveUsers();
      console.log(`Warming cache for ${ids.length} users...`);

      const fetchFunctions = this.createFetchFunctions();
      
      // Process in batches
      const batches = [];
      for (let i = 0; i < ids.length; i += maxConcurrent) {
        batches.push(ids.slice(i, i + maxConcurrent));
      }

      let warmed = 0;
      for (const batch of batches) {
        const promises = batch.map(async (userId) => {
          try {
            // Warm profile data
            const profile = await fetchFunctions.user.profile(userId);
            if (profile) {
              await this.cacheService.user.cacheProfile(userId, profile);
            }

            // Warm communities data
            const communities = await fetchFunctions.user.communities(userId);
            if (communities && communities.length > 0) {
              await this.cacheService.user.cacheCommunities(userId, communities);
            }

            warmed++;
            console.log(`Warmed cache for user ${userId} (${warmed}/${ids.length})`);
          } catch (error) {
            console.error(`Failed to warm cache for user ${userId}:`, error);
          }
        });

        await Promise.all(promises);
        
        // Small delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`Successfully warmed cache for ${warmed} users`);
      return warmed;
    } catch (error) {
      console.error('Error warming user caches:', error);
      return 0;
    }
  }

  /**
   * Warm configuration cache
   */
  async warmConfiguration() {
    try {
      console.log('Warming configuration cache...');
      const fetchFunctions = this.createFetchFunctions();
      const config = await fetchFunctions.config();
      
      // Cache individual config items
      for (const [key, value] of Object.entries(config)) {
        await this.cacheService.cacheConfig(key, value);
      }

      console.log('Configuration cache warmed successfully');
      return true;
    } catch (error) {
      console.error('Error warming configuration cache:', error);
      return false;
    }
  }

  /**
   * Full cache warming routine
   */
  async warmAll(options = {}) {
    const startTime = Date.now();
    console.log('Starting full cache warming routine...');

    const {
      communityLimit = 20,
      userLimit = 50,
      enableCommunities = true,
      enableUsers = true,
      enableConfig = true
    } = options;

    const results = {
      communities: 0,
      users: 0,
      config: false,
      duration: 0,
      success: true
    };

    try {
      // Warm communities
      if (enableCommunities) {
        results.communities = await this.warmCommunities(null, { maxConcurrent: 3 });
      }

      // Warm users
      if (enableUsers) {
        results.users = await this.warmUsers(null, { maxConcurrent: 5 });
      }

      // Warm configuration
      if (enableConfig) {
        results.config = await this.warmConfiguration();
      }

      results.duration = Date.now() - startTime;
      
      console.log('Cache warming completed successfully');
      console.log(`Results: ${results.communities} communities, ${results.users} users, config: ${results.config}`);
      console.log(`Duration: ${results.duration}ms`);

      return results;
    } catch (error) {
      console.error('Cache warming failed:', error);
      results.success = false;
      results.duration = Date.now() - startTime;
      return results;
    }
  }

  /**
   * Get cache warming statistics
   */
  async getWarmingStats() {
    const stats = this.cacheService.getStats();
    
    return {
      cacheStats: stats,
      recommendations: {
        shouldWarmCommunities: stats.memoryHits < stats.totalRequests * 0.3,
        shouldWarmUsers: stats.redisHits < stats.totalRequests * 0.5,
        optimalWarmingFrequency: stats.hitRate < 70 ? 'hourly' : 'daily'
      }
    };
  }
}

// CLI interface
if (require.main === module) {
  const connectDB = require('../config/db');
  
  async function runCacheWarming() {
    try {
      await connectDB();
      console.log('Connected to database');
      
      const warmer = new CacheWarmer();
      
      // Parse command line arguments
      const args = process.argv.slice(2);
      const command = args[0] || 'all';
      
      switch (command) {
        case 'communities':
          await warmer.warmCommunities();
          break;
        case 'users':
          await warmer.warmUsers();
          break;
        case 'config':
          await warmer.warmConfiguration();
          break;
        case 'stats':
          const stats = await warmer.getWarmingStats();
          console.log('Cache Warming Statistics:', JSON.stringify(stats, null, 2));
          break;
        case 'all':
        default:
          await warmer.warmAll();
          break;
      }
      
      console.log('Cache warming script completed');
      process.exit(0);
    } catch (error) {
      console.error('Cache warming script failed:', error);
      process.exit(1);
    }
  }
  
  runCacheWarming();
}

module.exports = { CacheWarmer };
