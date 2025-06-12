/**
 * Community Core Model - Optimized
 * 
 * This is the optimized core Community model that contains only essential fields
 * for day-to-day operations. Historical data, analytics, and complex operations
 * have been moved to separate models for better performance.
 * 
 * Created: May 30, 2025
 * Purpose: Schema Design Optimization - Phase 2
 */

const mongoose = require('mongoose');

const CommunityCorSchema = new mongoose.Schema({
    // Basic Identity
    name: { 
        type: String, 
        required: true, 
        index: true,
        trim: true
    },
    admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    description: { 
        type: String,
        trim: true
    },
    isActive: { 
        type: Boolean, 
        default: true, 
        index: true 
    },
    
    // Financial Summary (aggregated data only)
    financialSummary: {
        totalContribution: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        totalDistributed: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        backupFund: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        }
    },

    // Essential Settings
    settings: {
        contributionFrequency: { 
            type: String, 
            enum: ['Daily', 'Weekly', 'Monthly', 'Hourly'], 
            default: 'Weekly',
            index: true
        },
        maxMembers: { 
            type: Number, 
            default: 100,
            min: 5,
            max: 1000
        },
        backupFundPercentage: { 
            type: Number, 
            default: 10,
            min: 0,
            max: 50
        },
        isPrivate: { 
            type: Boolean, 
            default: false,
            index: true
        },
        minContribution: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 30,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 30;
            }
        },
        penalty: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 10,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 10;
            }
        },
        numMissContribution: { 
            type: Number, 
            default: 3,
            min: 1,
            max: 10
        },
        firstCycleMin: { 
            type: Number, 
            default: 5,
            min: 3,
            max: 20
        }
    },

    // Current State (references only - no embedded arrays)
    currentCycle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Cycle',
        index: true
    },
    activeMidCycle: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'MidCycle',
        index: true
    },
    
    // Active members count (for quick access)
    memberCount: {
        active: { type: Number, default: 0, index: true },
        waiting: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    // Current Payout Information
    payoutDetails: {
        nextRecipient: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            index: true
        },
        cycleNumber: { 
            type: Number,
            default: 0
        },
        payoutAmount: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        midCycleStatus: { 
            type: String, 
            default: "Just Started",
            enum: ["Just Started", "Active", "Pending Payout", "Completed"]
        }
    },
    
    // Status and Control
    cycleState: { 
        type: String, 
        enum: ['Active', 'Locked', 'Completed'], 
        default: 'Active', 
        index: true 
    },
    positioningMode: { 
        type: String, 
        enum: ['Random', 'Fixed'], 
        default: 'Random' 
    },
    cycleLockEnabled: { 
        type: Boolean, 
        default: false 
    },
    lockPayout: { 
        type: Boolean, 
        default: false,
        index: true
    },
    
    // Timing
    nextPayout: { 
        type: Date, 
        index: true 
    },
    firstCycleMin: { 
        type: Number, 
        default: 5 
    }

}, { 
    timestamps: true,
    toJSON: { getters: true },
    collection: 'communities_core'
});

// Compound Indexes for optimized queries
CommunityCorSchema.index({ admin: 1, isActive: 1 });
CommunityCorSchema.index({ 'settings.isPrivate': 1, isActive: 1 });
CommunityCorSchema.index({ cycleState: 1, nextPayout: 1 });
CommunityCorSchema.index({ 'memberCount.active': 1, 'settings.maxMembers': 1 });
CommunityCorSchema.index({ 'settings.contributionFrequency': 1, nextPayout: 1 });

// Pre-save hooks for data validation and synchronization
CommunityCorSchema.pre('save', function(next) {
    // Ensure firstCycleMin minimum value
    if (this.settings.firstCycleMin < 5) {
        this.settings.firstCycleMin = 5;
    }
    this.firstCycleMin = this.settings.firstCycleMin;
    
    // Update total member count
    this.memberCount.total = this.memberCount.active + this.memberCount.waiting;
    
    next();
});

// Essential methods only (complex operations moved to services)
CommunityCorSchema.methods.canStartCycle = function() {
    return this.memberCount.active >= this.settings.firstCycleMin && 
           this.cycleState === 'Active';
};

CommunityCorSchema.methods.isEligibleForPayout = function() {
    return this.cycleState === 'Active' && 
           !this.lockPayout && 
           this.currentCycle && 
           this.payoutDetails.nextRecipient;
};

CommunityCorSchema.methods.updateMemberCount = async function(activeChange = 0, waitingChange = 0) {
    this.memberCount.active = Math.max(0, this.memberCount.active + activeChange);
    this.memberCount.waiting = Math.max(0, this.memberCount.waiting + waitingChange);
    this.memberCount.total = this.memberCount.active + this.memberCount.waiting;
    
    await this.save();
    return this.memberCount;
};

CommunityCorSchema.methods.updateFinancialSummary = async function(contributionDelta = 0, distributedDelta = 0, backupDelta = 0) {
    if (contributionDelta !== 0) {
        const currentContribution = this.financialSummary.totalContribution || 0;
        this.financialSummary.totalContribution = currentContribution + contributionDelta;
    }
    
    if (distributedDelta !== 0) {
        const currentDistributed = this.financialSummary.totalDistributed || 0;
        this.financialSummary.totalDistributed = currentDistributed + distributedDelta;
    }
    
    if (backupDelta !== 0) {
        const currentBackup = this.financialSummary.backupFund || 0;
        this.financialSummary.backupFund = currentBackup + backupDelta;
    }
    
    await this.save();
    return this.financialSummary;
};

// Static methods for efficient queries
CommunityCorSchema.statics.findActiveByAdmin = function(adminId) {
    return this.find({ admin: adminId, isActive: true })
               .select('name description memberCount cycleState nextPayout')
               .lean();
};

CommunityCorSchema.statics.findPublicCommunities = function(limit = 20, skip = 0) {
    return this.find({ 'settings.isPrivate': false, isActive: true })
               .select('name description memberCount settings.maxMembers financialSummary.totalContribution')
               .sort({ 'memberCount.active': -1 })
               .limit(limit)
               .skip(skip)
               .lean();
};

CommunityCorSchema.statics.findDueForPayout = function() {
    return this.find({
        isActive: true,
        cycleState: 'Active',
        lockPayout: false,
        nextPayout: { $lte: new Date() },
        currentCycle: { $exists: true }
    }).populate('payoutDetails.nextRecipient', 'name email');
};

module.exports = mongoose.model('CommunityCore', CommunityCorSchema);
