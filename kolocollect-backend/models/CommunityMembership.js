/**
 * Phase 5: Community Membership Schema
 * 
 * Replaces Community.members array with individual documents
 * Enables pagination and better query performance
 */

const mongoose = require('mongoose');

const CommunityMembershipSchema = new mongoose.Schema({
    // ===== CORE RELATIONSHIP =====
    communityId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Community', 
        required: true,
        index: true
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    
    // ===== MEMBERSHIP STATUS =====
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'pending', 'suspended', 'left'], 
        default: 'active',
        index: true
    },
    
    // ===== TIMING =====
    joinedAt: { type: Date, default: Date.now, index: true },
    leaveDate: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
    
    // ===== POSITION AND ORDERING =====
    position: { type: Number, index: true },
    isNextInLine: { type: Boolean, default: false, index: true },
    cyclePosition: { type: Number }, // Position in current cycle
    
    // ===== CONTRIBUTION TRACKING =====
    totalContributions: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    contributionCount: { type: Number, default: 0 },
    missedContributions: { type: Number, default: 0 },
    consecutiveMissed: { type: Number, default: 0 },
    
    // ===== PAYOUT TRACKING =====
    payoutsReceived: { type: Number, default: 0 },
    totalPayoutAmount: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    lastPayoutDate: { type: Date },
    
    // ===== PENALTIES AND DEBTS =====
    currentPenalty: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    totalPenaltiesPaid: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    
    // ===== ADMIN SETTINGS =====
    isAdmin: { type: Boolean, default: false },
    permissions: [{
        type: String,
        enum: ['manage_members', 'manage_settings', 'manage_payouts', 'view_reports']
    }],
    
    // ===== NOTIFICATIONS =====
    notificationPreferences: {
        contributions: { type: Boolean, default: true },
        payouts: { type: Boolean, default: true },
        penalties: { type: Boolean, default: true },
        announcements: { type: Boolean, default: true }
    },
    
    // ===== PERFORMANCE METRICS =====
    participationScore: { type: Number, default: 100 }, // 0-100 based on activity
    reliabilityScore: { type: Number, default: 100 }, // 0-100 based on missed contributions
    
}, { 
    timestamps: true,
    toJSON: { getters: true }
});

// ===== COMPOUND INDEXES FOR OPTIMIZATION =====
CommunityMembershipSchema.index({ communityId: 1, status: 1 });
CommunityMembershipSchema.index({ communityId: 1, position: 1 });
CommunityMembershipSchema.index({ communityId: 1, isNextInLine: 1 });
CommunityMembershipSchema.index({ communityId: 1, joinedAt: 1 });
CommunityMembershipSchema.index({ userId: 1, status: 1 });
CommunityMembershipSchema.index({ userId: 1, communityId: 1 }, { unique: true }); // One membership per user per community

// ===== STATIC METHODS =====
CommunityMembershipSchema.statics.getActiveMembers = function(communityId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'position' } = options;
    const skip = (page - 1) * limit;
    
    return this.find({ 
        communityId, 
        status: 'active' 
    })
    .populate('userId', 'name email avatarUrl')
    .sort({ [sortBy]: 1 })
    .skip(skip)
    .limit(limit);
};

CommunityMembershipSchema.statics.getMemberCount = function(communityId, status = 'active') {
    return this.countDocuments({ communityId, status });
};

CommunityMembershipSchema.statics.getNextInLine = function(communityId) {
    return this.findOne({ 
        communityId, 
        status: 'active',
        isNextInLine: true 
    }).populate('userId');
};

CommunityMembershipSchema.statics.getMembersByPosition = function(communityId, startPosition, endPosition) {
    return this.find({
        communityId,
        status: 'active',
        position: { $gte: startPosition, $lte: endPosition }
    })
    .populate('userId')
    .sort({ position: 1 });
};

// ===== INSTANCE METHODS =====
CommunityMembershipSchema.methods.updateContributionStats = function(amount) {
    this.totalContributions += amount;
    this.contributionCount += 1;
    this.consecutiveMissed = 0; // Reset consecutive missed on successful contribution
    this.lastActivityAt = new Date();
    
    // Update participation score
    this.updateParticipationScore();
    
    return this.save();
};

CommunityMembershipSchema.methods.recordMissedContribution = function() {
    this.missedContributions += 1;
    this.consecutiveMissed += 1;
    
    // Update reliability score
    this.updateReliabilityScore();
    
    return this.save();
};

CommunityMembershipSchema.methods.updateParticipationScore = function() {
    // Calculate participation score based on activity
    const totalPossible = this.contributionCount + this.missedContributions;
    if (totalPossible > 0) {
        this.participationScore = Math.round((this.contributionCount / totalPossible) * 100);
    }
};

CommunityMembershipSchema.methods.updateReliabilityScore = function() {
    // Calculate reliability score based on consecutive missed contributions
    const maxMissed = 5; // Maximum consecutive missed before score = 0
    this.reliabilityScore = Math.max(0, 100 - (this.consecutiveMissed / maxMissed) * 100);
};

CommunityMembershipSchema.methods.recordPayout = function(amount) {
    this.payoutsReceived += 1;
    this.totalPayoutAmount += amount;
    this.lastPayoutDate = new Date();
    this.lastActivityAt = new Date();
    
    return this.save();
};

CommunityMembershipSchema.methods.addPenalty = function(amount) {
    this.currentPenalty += amount;
    return this.save();
};

CommunityMembershipSchema.methods.payPenalty = function(amount) {
    const paidAmount = Math.min(amount, this.currentPenalty);
    this.currentPenalty -= paidAmount;
    this.totalPenaltiesPaid += paidAmount;
    
    if (paidAmount > 0) {
        this.lastActivityAt = new Date();
    }
    
    return this.save();
};

// ===== HOOKS =====
CommunityMembershipSchema.pre('save', function(next) {
    // Ensure scores are within valid range
    this.participationScore = Math.max(0, Math.min(100, this.participationScore));
    this.reliabilityScore = Math.max(0, Math.min(100, this.reliabilityScore));
    
    next();
});

// Configure toJSON to use getters for Decimal128 fields
CommunityMembershipSchema.set('toJSON', { getters: true });

const CommunityMembership = mongoose.model('CommunityMembership', CommunityMembershipSchema);

module.exports = CommunityMembership;
