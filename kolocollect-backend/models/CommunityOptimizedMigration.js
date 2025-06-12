/**
 * Phase 5: Migration-Specific Community Schema
 * 
 * This file provides the optimized Community schema specifically for migration purposes.
 * It uses the model name "CommunityOptimized" to avoid conflicts with the existing
 * Community model during the migration process.
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

const CommunitySchema = new mongoose.Schema({
    // Core identification
    name: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 200
    },
    admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    
    // Financial core (simplified from original 12 financial fields)
    totalContribution: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(val) {
            return val ? new Decimal(val.toString()) : new Decimal(0);
        }
    },
    currentBalance: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(val) {
            return val ? new Decimal(val.toString()) : new Decimal(0);
        }
    },
    contributionPerMember: { 
        type: mongoose.Schema.Types.Decimal128, 
        required: true,
        get: function(val) {
            return val ? new Decimal(val.toString()) : new Decimal(0);
        }
    },
    
    // Status and basic info
    status: { 
        type: String, 
        enum: ['pending', 'active', 'paused', 'completed', 'cancelled'], 
        default: 'pending',
        index: true
    },
    privacy: { 
        type: String, 
        enum: ['public', 'private'], 
        default: 'public' 
    },
    description: { 
        type: String, 
        maxlength: 1000 
    },
    
    // Timing
    startDate: { 
        type: Date,
        index: true
    },
    endDate: { 
        type: Date,
        index: true
    },
    
    // Current cycle reference (replaces large embedded arrays)
    currentCycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cycle',
        index: true
    },
    
    // Member count (cached for performance, synced from CommunityMembership)
    memberCount: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Payout management (simplified)
    payoutDetails: {
        nextRecipient: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            index: true
        },
        cycleNumber: { 
            type: Number, 
            default: 0,
            index: true
        },
        nextPayoutDate: { 
            type: Date,
            index: true
        }
    },
    
    // Migration metadata
    migrationVersion: {
        type: String,
        default: 'phase5-optimized'
    },
    migratedAt: {
        type: Date,
        default: Date.now
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
    toJSON: { 
        getters: true, 
        virtuals: true,
        transform: function(doc, ret) {
            // Convert Decimal128 to strings for JSON
            if (ret.totalContribution) ret.totalContribution = ret.totalContribution.toString();
            if (ret.currentBalance) ret.currentBalance = ret.currentBalance.toString();
            if (ret.contributionPerMember) ret.contributionPerMember = ret.contributionPerMember.toString();
            return ret;
        }
    },
    toObject: { getters: true, virtuals: true }
});

// Performance indexes (optimized from original 15+ indexes)
CommunitySchema.index({ admin: 1, status: 1 });
CommunitySchema.index({ status: 1, createdAt: -1 });
CommunitySchema.index({ 'payoutDetails.nextRecipient': 1, 'payoutDetails.cycleNumber': 1 });
CommunitySchema.index({ startDate: 1, endDate: 1 });

// Virtual for population-based member count (when needed)
CommunitySchema.virtual('members', {
    ref: 'CommunityMembership',
    localField: '_id',
    foreignField: 'communityId'
});

// Pre-save middleware for updatedAt
CommunitySchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.updatedAt = new Date();
    }
    next();
});

// Configure toJSON to use getters for Decimal128 fields
CommunitySchema.set('toJSON', { getters: true, virtuals: true });

// Use "CommunityOptimized" to avoid conflicts during migration
const CommunityOptimized = mongoose.model('CommunityOptimized', CommunitySchema);

module.exports = CommunityOptimized;
