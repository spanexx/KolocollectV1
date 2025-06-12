/**
 * Community Statistics Model - Optimized
 * 
 * This model stores aggregated statistics and analytics for communities.
 * Used for dashboard reporting, performance metrics, and business intelligence.
 * Includes TTL for automatic cleanup of old statistical data.
 * 
 * Created: May 30, 2025
 * Purpose: Schema Design Optimization - Phase 2
 */

const mongoose = require('mongoose');

const CommunityStatsSchema = new mongoose.Schema({
    // Reference to the core community
    communityId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'CommunityCore', 
        required: true, 
        index: true 
    },
    
    // Time period for these statistics
    period: { 
        type: String, 
        enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'], 
        required: true,
        index: true
    },
    date: { 
        type: Date, 
        required: true, 
        index: true 
    },
    
    // Member Statistics
    memberMetrics: {
        totalMembers: { type: Number, default: 0 },
        activeMembers: { type: Number, default: 0 },
        waitingMembers: { type: Number, default: 0 },
        newMembersAdded: { type: Number, default: 0 },
        membersLeft: { type: Number, default: 0 },
        memberRetentionRate: { type: Number, default: 0 }, // Percentage
        memberGrowthRate: { type: Number, default: 0 }, // Percentage
        averageMemberTenure: { type: Number, default: 0 } // Days
    },
    
    // Financial Statistics
    financialMetrics: {
        totalContributions: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        contributionsCount: { type: Number, default: 0 },
        averageContribution: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        totalPayouts: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        payoutsCount: { type: Number, default: 0 },
        averagePayout: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        backupFundBalance: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        backupFundUsed: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        netCashFlow: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        }
    },
    
    // Cycle and Payout Statistics
    cycleMetrics: {
        activeCycles: { type: Number, default: 0 },
        completedCycles: { type: Number, default: 0 },
        cycleCompletionRate: { type: Number, default: 0 }, // Percentage
        averageCycleDuration: { type: Number, default: 0 }, // Days
        payoutSuccessRate: { type: Number, default: 0 }, // Percentage
        payoutDelayAverage: { type: Number, default: 0 } // Hours
    },
    
    // Activity and Engagement Statistics
    activityMetrics: {
        totalActivities: { type: Number, default: 0 },
        memberEngagementRate: { type: Number, default: 0 }, // Percentage
        averageResponseTime: { type: Number, default: 0 }, // Hours
        votingParticipationRate: { type: Number, default: 0 }, // Percentage
        supportTickets: { type: Number, default: 0 },
        supportResolutionTime: { type: Number, default: 0 } // Hours
    },
    
    // Performance Metrics
    performanceMetrics: {
        defaulterRate: { type: Number, default: 0 }, // Percentage
        penaltiesIssued: { type: Number, default: 0 },
        totalPenaltyAmount: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        memberSatisfactionScore: { type: Number, default: 0 }, // 1-10 scale
        systemUptimePercentage: { type: Number, default: 100 }
    },
    
    // Comparative Metrics (vs previous period)
    trends: {
        memberGrowthTrend: { type: Number, default: 0 }, // Percentage change
        contributionTrend: { type: Number, default: 0 }, // Percentage change
        payoutTrend: { type: Number, default: 0 }, // Percentage change
        engagementTrend: { type: Number, default: 0 }, // Percentage change
        performanceTrend: { type: Number, default: 0 } // Overall performance change
    },
    
    // Breakdown by categories (for detailed analysis)
    breakdowns: {
        contributionsByFrequency: {
            daily: { type: Number, default: 0 },
            weekly: { type: Number, default: 0 },
            monthly: { type: Number, default: 0 }
        },
        membersByStatus: {
            active: { type: Number, default: 0 },
            waiting: { type: Number, default: 0 },
            defaulter: { type: Number, default: 0 }
        },
        activitiesByType: {
            contributions: { type: Number, default: 0 },
            payouts: { type: Number, default: 0 },
            memberships: { type: Number, default: 0 },
            administration: { type: Number, default: 0 }
        }
    }

}, { 
    timestamps: true,
    toJSON: { getters: true },
    collection: 'communities_stats'
});

// Compound Indexes for efficient analytics queries
CommunityStatsSchema.index({ communityId: 1, period: 1, date: -1 });
CommunityStatsSchema.index({ period: 1, date: -1 });
CommunityStatsSchema.index({ date: -1, 'financialMetrics.totalContributions': -1 });
CommunityStatsSchema.index({ date: -1, 'memberMetrics.totalMembers': -1 });

// TTL Index for automatic cleanup of old statistics (keep for 2 years)
CommunityStatsSchema.index(
    { date: 1 }, 
    { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 } // 2 years
);

// Methods for calculating and updating statistics
CommunityStatsSchema.methods.calculateMemberMetrics = async function(communityCore, communityHistory) {
    const currentMembers = communityCore.memberCount;
    
    // Calculate member growth rate
    const previousStats = await this.constructor.findOne({
        communityId: this.communityId,
        period: this.period,
        date: { $lt: this.date }
    }).sort({ date: -1 });
    
    let memberGrowthRate = 0;
    if (previousStats && previousStats.memberMetrics.totalMembers > 0) {
        memberGrowthRate = ((currentMembers.total - previousStats.memberMetrics.totalMembers) / 
                           previousStats.memberMetrics.totalMembers) * 100;
    }
    
    // Calculate retention rate from history
    const retentionRate = communityHistory ? 
        await this._calculateRetentionRate(communityHistory) : 0;
    
    this.memberMetrics = {
        totalMembers: currentMembers.total,
        activeMembers: currentMembers.active,
        waitingMembers: currentMembers.waiting,
        newMembersAdded: this.memberMetrics.newMembersAdded || 0,
        membersLeft: this.memberMetrics.membersLeft || 0,
        memberRetentionRate: retentionRate,
        memberGrowthRate: memberGrowthRate,
        averageMemberTenure: await this._calculateAverageTenure(communityHistory)
    };
    
    return this.memberMetrics;
};

CommunityStatsSchema.methods.calculateFinancialMetrics = function(communityCore) {
    const financial = communityCore.financialSummary;
    
    this.financialMetrics = {
        totalContributions: financial.totalContribution,
        contributionsCount: this.financialMetrics.contributionsCount || 0,
        averageContribution: this.financialMetrics.contributionsCount > 0 ? 
            financial.totalContribution / this.financialMetrics.contributionsCount : 0,
        totalPayouts: financial.totalDistributed,
        payoutsCount: this.financialMetrics.payoutsCount || 0,
        averagePayout: this.financialMetrics.payoutsCount > 0 ? 
            financial.totalDistributed / this.financialMetrics.payoutsCount : 0,
        backupFundBalance: financial.backupFund,
        backupFundUsed: this.financialMetrics.backupFundUsed || 0,
        netCashFlow: financial.totalContribution - financial.totalDistributed
    };
    
    return this.financialMetrics;
};

CommunityStatsSchema.methods.calculateTrends = async function() {
    const previousStats = await this.constructor.findOne({
        communityId: this.communityId,
        period: this.period,
        date: { $lt: this.date }
    }).sort({ date: -1 });
    
    if (!previousStats) {
        // No previous data to compare
        this.trends = {
            memberGrowthTrend: 0,
            contributionTrend: 0,
            payoutTrend: 0,
            engagementTrend: 0,
            performanceTrend: 0
        };
        return this.trends;
    }
    
    // Calculate percentage changes
    this.trends = {
        memberGrowthTrend: this._calculatePercentageChange(
            previousStats.memberMetrics.totalMembers,
            this.memberMetrics.totalMembers
        ),
        contributionTrend: this._calculatePercentageChange(
            previousStats.financialMetrics.totalContributions,
            this.financialMetrics.totalContributions
        ),
        payoutTrend: this._calculatePercentageChange(
            previousStats.financialMetrics.totalPayouts,
            this.financialMetrics.totalPayouts
        ),
        engagementTrend: this._calculatePercentageChange(
            previousStats.activityMetrics.memberEngagementRate,
            this.activityMetrics.memberEngagementRate
        ),
        performanceTrend: this._calculatePercentageChange(
            previousStats.performanceMetrics.memberSatisfactionScore,
            this.performanceMetrics.memberSatisfactionScore
        )
    };
    
    return this.trends;
};

// Private helper methods
CommunityStatsSchema.methods._calculateRetentionRate = async function(communityHistory) {
    if (!communityHistory) return 0;
    
    const totalMembersEver = communityHistory.archivedMembers.length + this.memberMetrics.totalMembers;
    return totalMembersEver > 0 ? (this.memberMetrics.totalMembers / totalMembersEver) * 100 : 100;
};

CommunityStatsSchema.methods._calculateAverageTenure = async function(communityHistory) {
    if (!communityHistory || communityHistory.archivedMembers.length === 0) return 0;
    
    const totalTenure = communityHistory.archivedMembers.reduce((sum, member) => {
        const tenure = new Date(member.leaveDate) - new Date(member.joinDate);
        return sum + (tenure / (1000 * 60 * 60 * 24)); // Convert to days
    }, 0);
    
    return communityHistory.archivedMembers.length > 0 ? 
        totalTenure / communityHistory.archivedMembers.length : 0;
};

CommunityStatsSchema.methods._calculatePercentageChange = function(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
};

// Static methods for analytics and reporting
CommunityStatsSchema.statics.generateDashboardData = function(communityId, period = 'daily', limit = 30) {
    return this.find({ 
        communityId: new mongoose.Types.ObjectId(communityId), 
        period 
    })
    .sort({ date: -1 })
    .limit(limit)
    .select('date memberMetrics financialMetrics cycleMetrics trends')
    .lean();
};

CommunityStatsSchema.statics.getTopPerformingCommunities = function(metric = 'memberMetrics.totalMembers', limit = 10) {
    return this.aggregate([
        { $match: { period: 'monthly' } },
        { $sort: { date: -1 } },
        { $group: { _id: '$communityId', latestStats: { $first: '$$ROOT' } } },
        { $sort: { [`latestStats.${metric}`]: -1 } },
        { $limit: limit },
        {
            $lookup: {
                from: 'communities_core',
                localField: '_id',
                foreignField: '_id',
                as: 'community'
            }
        },
        { $unwind: '$community' },
        {
            $project: {
                communityName: '$community.name',
                stats: '$latestStats',
                metric: `$latestStats.${metric}`
            }
        }
    ]);
};

CommunityStatsSchema.statics.getAggregatedMetrics = function(period = 'monthly', startDate, endDate) {
    const matchStage = { period };
    if (startDate && endDate) {
        matchStage.date = { $gte: startDate, $lte: endDate };
    }
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalCommunities: { $addToSet: '$communityId' },
                avgMembers: { $avg: '$memberMetrics.totalMembers' },
                totalContributions: { $sum: { $toDouble: '$financialMetrics.totalContributions' } },
                totalPayouts: { $sum: { $toDouble: '$financialMetrics.totalPayouts' } },
                avgEngagement: { $avg: '$activityMetrics.memberEngagementRate' },
                avgSatisfaction: { $avg: '$performanceMetrics.memberSatisfactionScore' }
            }
        },
        {
            $project: {
                totalCommunities: { $size: '$totalCommunities' },
                avgMembers: 1,
                totalContributions: 1,
                totalPayouts: 1,
                avgEngagement: 1,
                avgSatisfaction: 1
            }
        }
    ]);
};

module.exports = mongoose.model('CommunityStats', CommunityStatsSchema);
