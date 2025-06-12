/**
 * Optimized Community Core Schema
 * Phase 5: Schema Design Optimization
 * 
 * This schema contains only the core community data needed for most operations.
 * Historical and bulk data has been moved to separate collections.
 */

const mongoose = require('mongoose');

const CommunityOptimizedSchema = new mongoose.Schema({
    // Core Information
    name: { type: String, required: true, index: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String },
    
    // Financial Data (using Decimal128 for precision)
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
    },
    
    // Current State (active data only)
    nextPayout: { type: Date, index: true },
    lockPayout: { type: Boolean, default: false },
    positioningMode: { type: String, enum: ['Random', 'Fixed'], default: 'Random' },
    cycleLockEnabled: { type: Boolean, default: false },
    cycleState: { type: String, enum: ['Active', 'Locked', 'Completed'], default: 'Active' },
    
    // Current Payout Details (simplified)
    currentPayout: {
        nextRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cycleNumber: { type: Number },
        payoutAmount: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        midCycleStatus: { type: String, default: "Just Started" }
    },
    
    // Reference to current active MidCycle (single reference instead of array)
    activeMidCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle', index: true },
    
    // Reference to current active Cycle (single reference instead of array)
    activeCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', index: true },
    
    // Member count for quick access (denormalized for performance)
    memberCount: { type: Number, default: 0, index: true },
    activeMemberCount: { type: Number, default: 0 },
    
    // Settings moved to separate schema
    settingsId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunitySettings' },
    
    // Status flags
    isActive: { type: Boolean, default: true, index: true },
    isPrivate: { type: Boolean, default: false, index: true }
    
}, { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Indexes for optimized queries
CommunityOptimizedSchema.index({ admin: 1, isActive: 1 });
CommunityOptimizedSchema.index({ memberCount: -1, isActive: 1 });
CommunityOptimizedSchema.index({ nextPayout: 1, isActive: 1 });
CommunityOptimizedSchema.index({ 'currentPayout.cycleNumber': 1 });
CommunityOptimizedSchema.index({ activeMidCycle: 1, activeCycle: 1 });

// Virtual for getting members (with pagination)
CommunityOptimizedSchema.virtual('members', {
    ref: 'CommunityMembership',
    localField: '_id',
    foreignField: 'communityId'
});

// Virtual for getting historical cycles
CommunityOptimizedSchema.virtual('cycleHistory', {
    ref: 'Cycle',
    localField: '_id',
    foreignField: 'communityId'
});

// Virtual for getting historical midcycles
CommunityOptimizedSchema.virtual('midCycleHistory', {
    ref: 'MidCycle',
    localField: '_id',
    foreignField: 'communityId'
});

// Virtual for getting activity logs
CommunityOptimizedSchema.virtual('activityLogs', {
    ref: 'CommunityActivityLog',
    localField: '_id',
    foreignField: 'communityId'
});

// Virtual for getting votes
CommunityOptimizedSchema.virtual('communityVotes', {
    ref: 'CommunityVote',
    localField: '_id',
    foreignField: 'communityId'
});

module.exports = mongoose.model('CommunityOptimized', CommunityOptimizedSchema);
