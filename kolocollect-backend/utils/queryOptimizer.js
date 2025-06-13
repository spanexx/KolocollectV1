/**
 * Query Optimization Utilities
 * 
 * This module provides optimized query patterns to reduce database load
 * and improve performance by implementing selective field projection
 * and optimized population strategies.
 */

const mongoose = require('mongoose');

/**
 * Optimized field selectors for different use cases
 */
const FIELD_SELECTORS = {
  // Minimal user fields for population
  userBasic: 'name email',
  userMedium: 'name email role dateJoined',
  userFull: 'name email role dateJoined phone address bio',

  // Community fields for different contexts
  communityBasic: 'name description admin settings.minContribution settings.maxMembers',
  communityMedium: 'name description admin members settings totalContribution totalDistributed',
  communityList: 'name description admin settings.minContribution settings.maxMembers createdAt',
  // Member fields
  memberBasic: 'name email userId position status joinedAt',
  memberMedium: 'name email userId position status penalty missedContributions joinedAt',
  memberFull: 'name email userId position status penalty missedContributions contributionPaid paymentPlan joinedAt',

  // MidCycle fields
  midCycleBasic: 'cycleNumber isComplete nextInLine payoutDate',
  midCycleMedium: 'cycleNumber isComplete nextInLine payoutDate contributions distributionAmount',
  
  // Contribution fields
  contributionBasic: 'amount date status',
  contributionMedium: 'amount date status userId communityId cycleNumber',

  // Cycle fields
  cycleBasic: 'cycleNumber isComplete startDate endDate',
  cycleMedium: 'cycleNumber isComplete startDate endDate paidMembers',

  // Payout fields
  payoutBasic: 'amount date recipientId',
  payoutMedium: 'amount date recipientId communityId cycleId status'
};

/**
 * Optimized population configurations
 */
const POPULATION_CONFIGS = {
  // Community populations
  communityBasic: [
    { path: 'admin', select: FIELD_SELECTORS.userBasic }
  ],
  communityWithMembers: [
    { path: 'admin', select: FIELD_SELECTORS.userBasic },
    { path: 'members', select: FIELD_SELECTORS.memberBasic }
  ],

  communityMedium: [
    { path: 'admin', select: FIELD_SELECTORS.userBasic },
    { 
      path: 'cycles', 
      match: { isComplete: false },
      select: FIELD_SELECTORS.cycleMedium
    },
    { 
      path: 'midCycle', 
      match: { isComplete: false },
      select: FIELD_SELECTORS.midCycleMedium
    }
  ],
  communityHistory: [
    { path: 'admin', select: FIELD_SELECTORS.userBasic },
    { path: 'members', select: FIELD_SELECTORS.memberMedium },
    { 
      path: 'cycles', 
      select: FIELD_SELECTORS.cycleMedium,
      options: { sort: { cycleNumber: -1 }, limit: 10 } // Latest 10 cycles only
    },
    { 
      path: 'midCycle', 
      select: FIELD_SELECTORS.midCycleMedium,
      match: { isComplete: false }, // Only active mid-cycles
      populate: [
        { path: 'nextInLine.userId', select: FIELD_SELECTORS.userBasic },
        { path: 'nextInLine.memberReference', select: FIELD_SELECTORS.memberBasic },
        { path: 'contributions.user', select: FIELD_SELECTORS.userBasic },
        { path: 'contributions.contributions', select: FIELD_SELECTORS.contributionBasic }
      ]
    }
  ],

  // User populations
  userWithCommunities: [
    { 
      path: 'communities.id', 
      select: FIELD_SELECTORS.communityBasic 
    }
  ],

  // Member populations
  memberWithUser: [
    { path: 'userId', select: FIELD_SELECTORS.userBasic },
    { path: 'communityId', select: FIELD_SELECTORS.communityBasic }
  ],

  // Contribution populations
  contributionWithDetails: [
    { path: 'userId', select: FIELD_SELECTORS.userBasic },
    { path: 'communityId', select: FIELD_SELECTORS.communityBasic },
    { path: 'midCycleId', select: FIELD_SELECTORS.midCycleBasic }
  ]
};

/**
 * Query builder class for optimized database queries
 */
class QueryOptimizer {
  /**
   * Get communities with optimized population
   * @param {Object} filter - MongoDB filter object
   * @param {string} populationType - Type of population to apply
   * @param {Object} options - Additional query options
   * @returns {Promise} Mongoose query
   */
  static getCommunities(filter = {}, populationType = 'basic', options = {}) {
    const Community = mongoose.model('Community');
    let query = Community.find(filter);

    // Apply field selection based on type
    switch (populationType) {
      case 'list':
        query = query.select(FIELD_SELECTORS.communityList);
        break;
      case 'medium':
        query = query.select(FIELD_SELECTORS.communityMedium);
        break;
      case 'basic':
      default:
        query = query.select(FIELD_SELECTORS.communityBasic);
        break;
    }

    // Apply population
    const populationConfig = POPULATION_CONFIGS[`community${populationType.charAt(0).toUpperCase() + populationType.slice(1)}`];
    if (populationConfig) {
      populationConfig.forEach(config => {
        query = query.populate(config);
      });
    }

    // Apply additional options
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);
    if (options.sort) query = query.sort(options.sort);

    return query;
  }

  /**
   * Get community by ID with minimal required data
   * @param {string} communityId - Community ID
   * @param {string} populationType - Type of population
   * @returns {Promise} Mongoose query
   */
  static getCommunityById(communityId, populationType = 'basic') {
    const Community = mongoose.model('Community');
    let query = Community.findById(communityId);

    // Apply optimized field selection and population
    const populationConfig = POPULATION_CONFIGS[`community${populationType.charAt(0).toUpperCase() + populationType.slice(1)}`];
    if (populationConfig) {
      populationConfig.forEach(config => {
        query = query.populate(config);
      });
    }

    return query;
  }

  /**
   * Get active mid-cycle with minimal data
   * @param {string} communityId - Community ID
   * @returns {Promise} Mongoose query
   */
  static getActiveMidCycle(communityId) {
    const MidCycle = mongoose.model('MidCycle');
    const Community = mongoose.model('Community');
    
    return Community.findById(communityId, 'midCycle')
      .then(community => {
        if (!community) return null;
        
        return MidCycle.findOne({
          _id: { $in: community.midCycle },
          isComplete: false
        })
        .select(FIELD_SELECTORS.midCycleMedium)
        .populate([
          { path: 'nextInLine.userId', select: FIELD_SELECTORS.userBasic },
          { path: 'nextInLine.memberReference', select: FIELD_SELECTORS.memberBasic }
        ]);
      });
  }

  /**
   * Get user with optimized community data
   * @param {string} userId - User ID
   * @param {boolean} includeCommunityDetails - Whether to include detailed community info
   * @returns {Promise} Mongoose query
   */
  static getUserWithCommunities(userId, includeCommunityDetails = false) {
    const User = mongoose.model('User');
    let query = User.findById(userId);

    if (includeCommunityDetails) {
      query = query.populate(POPULATION_CONFIGS.userWithCommunities);
    } else {
      query = query.select('name email communities');
    }

    return query;
  }

  /**
   * Get members with optimized data
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise} Mongoose query
   */
  static getMembers(filter = {}, options = {}) {
    const Member = mongoose.model('Member');
    let query = Member.find(filter);

    // Select appropriate fields based on requirements
    if (options.detailed) {
      query = query.select(FIELD_SELECTORS.memberFull);
    } else {
      query = query.select(FIELD_SELECTORS.memberBasic);
    }

    // Apply population if needed
    if (options.populate) {
      query = query.populate(POPULATION_CONFIGS.memberWithUser);
    }

    // Apply pagination
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);
    if (options.sort) query = query.sort(options.sort);

    return query;
  }

  /**
   * Get contributions with optimized population
   * @param {Object} filter - Filter criteria  
   * @param {Object} options - Query options
   * @returns {Promise} Mongoose query
   */
  static getContributions(filter = {}, options = {}) {
    const Contribution = mongoose.model('Contribution');
    let query = Contribution.find(filter);

    // Select fields based on detail level
    if (options.detailed) {
      query = query.select(FIELD_SELECTORS.contributionMedium);
    } else {
      query = query.select(FIELD_SELECTORS.contributionBasic);
    }

    // Apply population if needed
    if (options.populate) {
      query = query.populate(POPULATION_CONFIGS.contributionWithDetails);
    }

    // Apply sorting and pagination
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);

    return query;
  }

  /**
   * Aggregation pipeline for community statistics
   * @param {string} communityId - Community ID
   * @returns {Promise} Aggregation pipeline result
   */
  static async getCommunityStats(communityId) {
    const Community = mongoose.model('Community');
    const Member = mongoose.model('Member');
    const Contribution = mongoose.model('Contribution');

    // Use aggregation for efficient statistics
    const [memberStats, contributionStats] = await Promise.all([
      Member.aggregate([
        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPenalty: { $sum: '$penalty' }
          }
        }
      ]),
      
      Contribution.aggregate([
        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
        {
          $group: {
            _id: null,
            totalContributions: { $sum: '$amount' },
            contributionCount: { $sum: 1 },
            avgContribution: { $avg: '$amount' }
          }
        }
      ])
    ]);

    return {
      memberStats,
      contributionStats: contributionStats[0] || {}
    };
  }

  /**
   * Batch query for multiple communities
   * @param {Array} communityIds - Array of community IDs
   * @param {string} populationType - Population type
   * @returns {Promise} Array of communities
   */
  static async getCommunitiesBatch(communityIds, populationType = 'basic') {
    const Community = mongoose.model('Community');
    
    const filter = { _id: { $in: communityIds } };
    return this.getCommunities(filter, populationType);
  }
}

module.exports = {
  QueryOptimizer,
  FIELD_SELECTORS,
  POPULATION_CONFIGS
};
