/**
 * Phase 5: Community History Schema
 * 
 * Replaces embedded arrays: cycles, activityLog, and other historical data
 * Provides better querying, pagination, and analytics for community history
 * 
 * Original arrays structure preserved in Community.js comments
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const CommunityHistorySchema = new mongoose.Schema({
    // Reference to the core community
    communityId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'CommunityCore', 
        required: true, 
        index: true 
    },
    
    // Historical Cycles (completed cycles only)
    completedCycles: [{
        cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
        completedAt: { type: Date, index: true },
        totalContributions: { type: mongoose.Schema.Types.Decimal128 },
        totalPayouts: { type: mongoose.Schema.Types.Decimal128 },
        memberCount: { type: Number },
        cycleNumber: { type: Number }
    }],
    
    // Payout History (detailed payout records)
    payoutHistory: [{
        recipient: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            index: true
        },
        amount: { 
            type: mongoose.Schema.Types.Decimal128,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        date: { 
            type: Date, 
            index: true 
        },
        cycleNumber: { type: Number },
        midCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' },
        status: { 
            type: String, 
            enum: ['completed', 'failed', 'pending', 'refunded'], 
            default: 'completed',
            index: true
        },
        transactionId: { type: String }, // For tracking external payment transactions
        notes: { type: String }
    }],

    // Activity Logs (with automatic cleanup)
    activities: [{
        activityId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityActivityLog' },
        activityType: { 
            type: String,
            enum: [
                'member_joined', 'member_left', 'contribution_made', 'payout_distributed',
                'cycle_started', 'cycle_completed', 'settings_updated', 'admin_changed',
                'member_penalty', 'backup_fund_used', 'vote_created', 'vote_completed'
            ],
            index: true
        },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now, index: true },
        metadata: { type: mongoose.Schema.Types.Mixed } // Flexible field for activity details
    }],
    
    // Archived Member Data (members who left the community)
    archivedMembers: [{
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            index: true
        },
        userName: { type: String }, // Cached for historical records
        userEmail: { type: String }, // Cached for historical records
        joinDate: { type: Date },
        leaveDate: { type: Date, index: true },
        totalContributions: { 
            type: mongoose.Schema.Types.Decimal128,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        contributionCount: { type: Number, default: 0 },
        payoutsReceived: { type: Number, default: 0 },
        totalPayoutAmount: { 
            type: mongoose.Schema.Types.Decimal128,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        finalPosition: { type: Number }, // Position when they left
        reason: { 
            type: String, 
            enum: ['voluntary_leave', 'removed_by_admin', 'penalty_exceeded', 'inactivity'],
            default: 'voluntary_leave'
        },
        notes: { type: String }
    }],

    // Financial Snapshots (monthly aggregations)
    monthlySnapshots: [{
        month: { type: Number, min: 1, max: 12 },
        year: { type: Number },
        snapshot: {
            memberCount: { type: Number },
            totalContributions: { type: mongoose.Schema.Types.Decimal128 },
            totalPayouts: { type: mongoose.Schema.Types.Decimal128 },
            backupFund: { type: mongoose.Schema.Types.Decimal128 },
            cyclesCompleted: { type: Number },
            averageContribution: { type: mongoose.Schema.Types.Decimal128 },
            memberRetentionRate: { type: Number } // Percentage
        },
        createdAt: { type: Date, default: Date.now }
    }],

    // Data Retention Settings
    retentionPolicy: {
        keepActivityLogsFor: { type: Number, default: 365 }, // Days
        keepPayoutHistoryFor: { type: Number, default: 1095 }, // 3 years
        keepArchivedMembersFor: { type: Number, default: 1095 }, // 3 years
        keepSnapshotsFor: { type: Number, default: 1825 } // 5 years
    }

}, { 
    timestamps: true,
    toJSON: { getters: true },
    collection: 'communities_history'
});

// Compound Indexes for efficient historical queries
CommunityHistorySchema.index({ communityId: 1, 'activities.timestamp': -1 });
CommunityHistorySchema.index({ communityId: 1, 'payoutHistory.date': -1 });
CommunityHistorySchema.index({ communityId: 1, 'archivedMembers.leaveDate': -1 });
CommunityHistorySchema.index({ communityId: 1, 'monthlySnapshots.year': -1, 'monthlySnapshots.month': -1 });
CommunityHistorySchema.index({ 'payoutHistory.recipient': 1, 'payoutHistory.date': -1 });
CommunityHistorySchema.index({ 'activities.userId': 1, 'activities.timestamp': -1 });

// TTL Indexes for automatic data cleanup
CommunityHistorySchema.index(
    { 'activities.timestamp': 1 }, 
    { 
        expireAfterSeconds: 365 * 24 * 60 * 60, // 1 year
        partialFilterExpression: { 'activities.timestamp': { $exists: true } }
    }
);

// Methods for historical data management
CommunityHistorySchema.methods.addActivity = async function(activityType, userId, metadata = {}) {
    const activity = {
        activityType,
        userId,
        timestamp: new Date(),
        metadata
    };
    
    this.activities.push(activity);
    
    // Keep only recent activities in memory (last 100)
    if (this.activities.length > 100) {
        this.activities = this.activities.slice(-100);
    }
    
    await this.save();
    return activity;
};

CommunityHistorySchema.methods.addPayoutRecord = async function(payoutData) {
    const payoutRecord = {
        recipient: payoutData.recipient,
        amount: payoutData.amount,
        date: payoutData.date || new Date(),
        cycleNumber: payoutData.cycleNumber,
        midCycleId: payoutData.midCycleId,
        status: payoutData.status || 'completed',
        transactionId: payoutData.transactionId,
        notes: payoutData.notes
    };
    
    this.payoutHistory.push(payoutRecord);
    await this.save();
    return payoutRecord;
};

CommunityHistorySchema.methods.archiveMember = async function(memberData) {
    const archivedMember = {
        userId: memberData.userId,
        userName: memberData.userName,
        userEmail: memberData.userEmail,
        joinDate: memberData.joinDate,
        leaveDate: new Date(),
        totalContributions: memberData.totalContributions || 0,
        contributionCount: memberData.contributionCount || 0,
        payoutsReceived: memberData.payoutsReceived || 0,
        totalPayoutAmount: memberData.totalPayoutAmount || 0,
        finalPosition: memberData.finalPosition,
        reason: memberData.reason || 'voluntary_leave',
        notes: memberData.notes
    };
    
    this.archivedMembers.push(archivedMember);
    await this.save();
    return archivedMember;
};

CommunityHistorySchema.methods.createMonthlySnapshot = async function(communityCore) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    // Check if snapshot already exists for this month
    const existingSnapshot = this.monthlySnapshots.find(s => 
        s.month === month && s.year === year
    );
    
    if (existingSnapshot) {
        return existingSnapshot;
    }
    
    // Calculate aggregated metrics
    const currentPayouts = this.payoutHistory.filter(p => {
        const payoutDate = new Date(p.date);
        return payoutDate.getMonth() + 1 === month && payoutDate.getFullYear() === year;
    });
    
    const currentContributions = this.activities.filter(a => 
        a.activityType === 'contribution_made' &&
        new Date(a.timestamp).getMonth() + 1 === month &&
        new Date(a.timestamp).getFullYear() === year
    );
    
    const snapshot = {
        month,
        year,
        snapshot: {
            memberCount: communityCore.memberCount.total,
            totalContributions: communityCore.financialSummary.totalContribution,
            totalPayouts: communityCore.financialSummary.totalDistributed,
            backupFund: communityCore.financialSummary.backupFund,
            cyclesCompleted: this.completedCycles.length,
            averageContribution: currentContributions.length > 0 ? 
                communityCore.financialSummary.totalContribution / currentContributions.length : 0,
            memberRetentionRate: this.calculateRetentionRate()
        },
        createdAt: new Date()
    };
    
    this.monthlySnapshots.push(snapshot);
    await this.save();
    return snapshot;
};

CommunityHistorySchema.methods.calculateRetentionRate = function() {
    const totalMembers = this.archivedMembers.length + 1; // +1 for current active members count
    const retainedMembers = 1; // Simplified calculation
    return totalMembers > 0 ? (retainedMembers / totalMembers) * 100 : 100;
};

// Static methods for historical analytics
CommunityHistorySchema.statics.getPayoutSummary = function(communityId, startDate, endDate) {
    return this.aggregate([
        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
        { $unwind: '$payoutHistory' },
        { 
            $match: { 
                'payoutHistory.date': { 
                    $gte: startDate, 
                    $lte: endDate 
                },
                'payoutHistory.status': 'completed'
            } 
        },
        {
            $group: {
                _id: null,
                totalPayouts: { $sum: { $toDouble: '$payoutHistory.amount' } },
                payoutCount: { $sum: 1 },
                averagePayout: { $avg: { $toDouble: '$payoutHistory.amount' } }
            }
        }
    ]);
};

CommunityHistorySchema.statics.getMemberAnalytics = function(communityId) {
    return this.aggregate([
        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
        { $unwind: '$archivedMembers' },
        {
            $group: {
                _id: '$archivedMembers.reason',
                count: { $sum: 1 },
                avgContributions: { $avg: { $toDouble: '$archivedMembers.totalContributions' } },
                avgPayouts: { $avg: '$archivedMembers.payoutsReceived' }
            }
        }
    ]);
};

module.exports = mongoose.model('CommunityHistory', CommunityHistorySchema);
