/**
 * Phase 5: Community Activity & History Schema
 * 
 * Replaces embedded arrays: cycles, activityLog, and other historical data
 * Provides better querying, pagination, and analytics for community history
 * 
 * Original arrays structure preserved in Community.js comments
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const CommunityActivitySchema = new mongoose.Schema({
    // Reference to the community
    communityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
        required: true,
        index: true
    },

    // Type of historical entry
    entryType: {
        type: String,
        required: true,
        enum: [
            'cycle_completed',
            'cycle_started', 
            'activity_log',
            'payout_distributed',
            'member_joined',
            'member_left',
            'settings_updated',
            'penalty_applied',
            'backup_fund_used',
            'contribution_made',
            'contribution_missed',
            'system_event'
        ],
        index: true
    },

    // Activity type (for backward compatibility with activityLog)
    activityType: {
        type: String,
        index: true
    },

    // User who triggered the activity (if applicable)
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    // Timestamp of the event
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },

    // Cycle-specific data (when entryType is cycle_*)
    cycleData: {
        cycleNumber: {
            type: Number,
            index: true
        },
        startDate: Date,
        endDate: Date,
        status: {
            type: String,
            enum: ['active', 'completed', 'cancelled']
        },        totalContributions: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        },        backupFundContribution: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        },
        participantCount: Number,        completionRate: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        },
        payoutRecipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        payoutAmount: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        }    },

    // Financial data for money-related events
    financialData: {
        amount: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        },
        currency: {
            type: String,
            default: 'NGN'
        },
        transactionType: {
            type: String,
            enum: ['contribution', 'payout', 'penalty', 'refund', 'backup_fund', 'adjustment']
        },
        transactionId: String,
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet'
        }
    },

    // Member-related data
    memberData: {
        action: {
            type: String,
            enum: ['joined', 'left', 'promoted', 'demoted', 'suspended', 'reinstated']
        },
        fromRole: String,
        toRole: String,
        reason: String
    },

    // Settings change data
    settingsData: {
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },

    // Generic details object (for backward compatibility)
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // System metadata
    metadata: {
        source: {
            type: String,
            enum: ['user_action', 'system_automatic', 'admin_override', 'migration'],
            default: 'user_action'
        },
        ipAddress: String,
        userAgent: String,
        apiVersion: String,
        requestId: String
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false }, // History entries should not be updated
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Compound indexes for common queries
CommunityActivitySchema.index({ communityId: 1, timestamp: -1 });
CommunityActivitySchema.index({ communityId: 1, entryType: 1, timestamp: -1 });
CommunityActivitySchema.index({ communityId: 1, 'cycleData.cycleNumber': 1 });
CommunityActivitySchema.index({ communityId: 1, userId: 1, timestamp: -1 });
CommunityActivitySchema.index({ userId: 1, timestamp: -1 });

// Text index for searching details
CommunityActivitySchema.index({
    'details': 'text',
    'memberData.reason': 'text',
    'settingsData.field': 'text'
});

// Virtual for backward compatibility with activityLog format
CommunityActivitySchema.virtual('activityLogFormat').get(function() {
    return {
        activityType: this.activityType || this.entryType,
        userId: this.userId,
        timestamp: this.timestamp,
        details: this.details
    };
});

// Virtual for cycle format (backward compatibility)
CommunityActivitySchema.virtual('cycleFormat').get(function() {
    if (this.entryType === 'cycle_completed' && this.cycleData) {
        return {
            cycleNumber: this.cycleData.cycleNumber,
            startDate: this.cycleData.startDate,
            endDate: this.cycleData.endDate,
            status: this.cycleData.status,
            totalContributions: this.cycleData.totalContributions,
            backupFundContribution: this.cycleData.backupFundContribution,
            completedAt: this.timestamp,
            participantCount: this.cycleData.participantCount,
            completionRate: this.cycleData.completionRate
        };
    }
    return null;
});

// Static methods for common queries

/**
 * Get activity log for a community (backward compatibility)
 */
CommunityActivitySchema.statics.getActivityLog = function(communityId, options = {}) {
    const { page = 1, limit = 50, activityType = null } = options;
    
    const query = {
        communityId: communityId,
        entryType: 'activity_log'
    };
    
    if (activityType) {
        query.activityType = activityType;
    }
    
    return this.find(query)
        .populate('userId', 'name email profilePicture')
        .sort({ timestamp: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

/**
 * Get cycle history for a community
 */
CommunityActivitySchema.statics.getCycleHistory = function(communityId, options = {}) {
    const { page = 1, limit = 20, status = null } = options;
    
    const query = {
        communityId: communityId,
        entryType: 'cycle_completed'
    };
    
    if (status) {
        query['cycleData.status'] = status;
    }
    
    return this.find(query)
        .sort({ 'cycleData.cycleNumber': -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

/**
 * Add activity log entry (backward compatibility)
 */
CommunityActivitySchema.statics.addActivityLog = function(communityId, activityType, userId, details = {}) {
    return this.create({
        communityId: communityId,
        entryType: 'activity_log',
        activityType: activityType,
        userId: userId,
        details: details,
        timestamp: new Date()
    });
};

/**
 * Add cycle completion entry
 */
CommunityActivitySchema.statics.addCycleCompletion = function(communityId, cycleData) {
    return this.create({
        communityId: communityId,
        entryType: 'cycle_completed',
        timestamp: cycleData.endDate || new Date(),
        cycleData: cycleData
    });
};

// Instance methods

/**
 * Convert to original activityLog format
 */
CommunityActivitySchema.methods.toActivityLogFormat = function() {
    return {
        activityType: this.activityType || this.entryType,
        userId: this.userId,
        timestamp: this.timestamp,
        details: this.details || {}
    };
};

/**
 * Convert to original cycle format
 */
CommunityActivitySchema.methods.toCycleFormat = function() {
    if (this.entryType === 'cycle_completed' && this.cycleData) {
        return {
            cycleNumber: this.cycleData.cycleNumber,
            startDate: this.cycleData.startDate,
            endDate: this.cycleData.endDate,
            status: this.cycleData.status,
            totalContributions: this.cycleData.totalContributions,
            backupFundContribution: this.cycleData.backupFundContribution,
            participantCount: this.cycleData.participantCount,
            completionRate: this.cycleData.completionRate,
            payoutRecipient: this.cycleData.payoutRecipient,
            payoutAmount: this.cycleData.payoutAmount,
            completedAt: this.timestamp
        };
    }
    return null;
};

// Pre-save middleware
CommunityActivitySchema.pre('save', function(next) {
    // History entries should be immutable once created
    if (!this.isNew) {
        return next(new Error('History entries cannot be modified'));
    }
    next();
});

const CommunityActivity = mongoose.model('CommunityActivity', CommunityActivitySchema);

module.exports = CommunityActivity;
