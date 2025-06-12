/**
 * Phase 5: Community Owing Schema
 * 
 * Replaces the embedded owingMembers array in Community schema
 * Provides better querying and pagination for owing member data
 * 
 * Original owingMembers array structure preserved in Community.js comments
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const CommunityOwingSchema = new mongoose.Schema({
    // Reference to the community
    communityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
        required: true,
        index: true
    },

    // Reference to the user who owes money
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Amount owed (using Decimal128 for precision)
    amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        default: 0,
        get: function(value) {
            if (value) {
                return new Decimal(value.toString());
            }
            return new Decimal(0);
        }
    },

    // Reason for owing (penalty, missed contribution, etc.)
    reason: {
        type: String,
        required: true,
        enum: ['penalty', 'missed_contribution', 'late_payment', 'adjustment', 'other'],
        index: true
    },

    // Cycle number when the debt was incurred
    cycleNumber: {
        type: Number,
        required: true,
        index: true
    },

    // Due date for payment
    dueDate: {
        type: Date,
        required: true,
        index: true
    },

    // Payment status
    status: {
        type: String,
        enum: ['pending', 'paid', 'waived', 'carried_forward'],
        default: 'pending',
        index: true
    },

    // Payment details when settled
    paymentDetails: {
        paidAt: Date,        paidAmount: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        },
        paymentMethod: {
            type: String,
            enum: ['wallet', 'bank_transfer', 'cash', 'adjustment']
        },
        transactionId: String,
        notes: String
    },

    // Additional metadata
    metadata: {
        originalContributionId: mongoose.Schema.Types.ObjectId,        penaltyRate: {
            type: mongoose.Schema.Types.Decimal128,
            default: 0,
            get: function(value) {
                if (value) {
                    return new Decimal(value.toString());
                }
                return new Decimal(0);
            }
        },
        gracePeriodDays: {
            type: Number,
            default: 0
        },
        autoCalculated: {
            type: Boolean,
            default: false
        }
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Compound indexes for common queries
CommunityOwingSchema.index({ communityId: 1, status: 1 });
CommunityOwingSchema.index({ communityId: 1, userId: 1 });
CommunityOwingSchema.index({ communityId: 1, cycleNumber: 1 });
CommunityOwingSchema.index({ communityId: 1, dueDate: 1, status: 1 });
CommunityOwingSchema.index({ userId: 1, status: 1 });

// Ensure unique owing entry per user per cycle per reason
CommunityOwingSchema.index(
    { communityId: 1, userId: 1, cycleNumber: 1, reason: 1 },
    { unique: true }
);

// Virtual for days overdue
CommunityOwingSchema.virtual('daysOverdue').get(function() {
    if (this.status === 'pending' && this.dueDate < new Date()) {
        return Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
    }
    return 0;
});

// Virtual for remaining amount
CommunityOwingSchema.virtual('remainingAmount').get(function() {
    if (this.paymentDetails && this.paymentDetails.paidAmount) {
        const paid = new Decimal(this.paymentDetails.paidAmount.toString());
        const total = new Decimal(this.amount.toString());
        return total.minus(paid);
    }
    return this.amount;
});

// Static methods for common queries

/**
 * Get all pending owing amounts for a community
 */
CommunityOwingSchema.statics.getPendingOwings = function(communityId, options = {}) {
    const { page = 1, limit = 50, sortBy = 'dueDate' } = options;
    
    return this.find({
        communityId: communityId,
        status: 'pending'
    })
    .populate('userId', 'name email profilePicture')
    .sort({ [sortBy]: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

/**
 * Get owing summary for a community
 */
CommunityOwingSchema.statics.getOwingSummary = function(communityId) {
    return this.aggregate([
        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);
};

/**
 * Get owing amounts for a specific user
 */
CommunityOwingSchema.statics.getUserOwings = function(communityId, userId, status = null) {
    const query = {
        communityId: communityId,
        userId: userId
    };
    
    if (status) {
        query.status = status;
    }
    
    return this.find(query).sort({ createdAt: -1 });
};

/**
 * Get overdue owings
 */
CommunityOwingSchema.statics.getOverdueOwings = function(communityId) {
    return this.find({
        communityId: communityId,
        status: 'pending',
        dueDate: { $lt: new Date() }
    })
    .populate('userId', 'name email profilePicture')
    .sort({ dueDate: 1 });
};

/**
 * Mark owing as paid
 */
CommunityOwingSchema.methods.markAsPaid = function(paymentData) {
    this.status = 'paid';
    this.paymentDetails = {
        paidAt: new Date(),
        paidAmount: paymentData.amount || this.amount,
        paymentMethod: paymentData.method || 'wallet',
        transactionId: paymentData.transactionId,
        notes: paymentData.notes
    };
    this.updatedAt = new Date();
    
    return this.save();
};

/**
 * Calculate penalty amount based on overdue days
 */
CommunityOwingSchema.methods.calculatePenalty = function(penaltyRate, maxPenalty = null) {
    const daysOverdue = this.daysOverdue;
    if (daysOverdue <= 0) return new Decimal(0);
    
    const rate = new Decimal(penaltyRate.toString());
    const baseAmount = new Decimal(this.amount.toString());
    const penalty = baseAmount.mul(rate).mul(daysOverdue).div(100);
    
    if (maxPenalty) {
        const maxPenaltyDecimal = new Decimal(maxPenalty.toString());
        return Decimal.min(penalty, maxPenaltyDecimal);
    }
    
    return penalty;
};

/**
 * Instance methods for backward compatibility
 */
CommunityOwingSchema.methods.toOriginalFormat = function() {
    return {
        userId: this.userId,
        amount: this.amount,
        reason: this.reason,
        cycleNumber: this.cycleNumber,
        dueDate: this.dueDate,
        status: this.status,
        createdAt: this.createdAt,
        paymentDetails: this.paymentDetails,
        metadata: this.metadata
    };
};

// Pre-save middleware
CommunityOwingSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Post-save middleware for logging
CommunityOwingSchema.post('save', function(doc) {
    // Could add activity logging here
    console.log(`Owing record ${doc._id} updated for user ${doc.userId}`);
});

const CommunityOwing = mongoose.model('CommunityOwing', CommunityOwingSchema);

module.exports = CommunityOwing;
