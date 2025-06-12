/**
 * Phase 5: Community Settings Schema
 * 
 * Extracted from Community.settings (originally embedded)
 * This maintains all settings functionality while optimizing queries
 */

const mongoose = require('mongoose');

const CommunitySettingsSchema = new mongoose.Schema({
    // Reference to parent community
    communityId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Community', 
        required: true,
        unique: true,  // One settings document per community
        index: true
    },
    
    // ===== CONTRIBUTION SETTINGS =====
    contributionFrequency: { 
        type: String, 
        enum: ['Daily', 'Weekly', 'Monthly', 'Hourly'], 
        default: 'Weekly' 
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
    
    // ===== COMMUNITY LIMITS =====
    maxMembers: { type: Number, default: 100 },
    firstCycleMin: { type: Number, default: 5 },
    numMissContribution: { type: Number, default: 3 },
    
    // ===== FINANCIAL SETTINGS =====
    backupFundPercentage: { type: Number, default: 10 },
    
    // ===== PRIVACY SETTINGS =====
    isPrivate: { type: Boolean, default: false },
    
    // ===== ADVANCED SETTINGS =====
    autoStartCycles: { type: Boolean, default: true },
    allowMidCycleJoining: { type: Boolean, default: true },
    requireAdminApproval: { type: Boolean, default: false },
    
    // ===== NOTIFICATION SETTINGS =====
    notifyOnContribution: { type: Boolean, default: true },
    notifyOnPayout: { type: Boolean, default: true },
    notifyOnMissedContribution: { type: Boolean, default: true },
    
    // ===== VALIDATION RULES =====
    gracePeriodHours: { type: Number, default: 24 },
    maxConsecutiveMissed: { type: Number, default: 3 },
    
}, { 
    timestamps: true,
    toJSON: { getters: true }  // Preserve Decimal128 getters
});

// ===== INDEXES FOR OPTIMIZATION =====
CommunitySettingsSchema.index({ communityId: 1 });
CommunitySettingsSchema.index({ contributionFrequency: 1 });
CommunitySettingsSchema.index({ isPrivate: 1 });

// ===== VALIDATION =====
CommunitySettingsSchema.pre('save', function(next) {
    // Ensure minimum values (preserved from original logic)
    if (this.firstCycleMin < 5) {
        this.firstCycleMin = 5;
    }
    if (this.numMissContribution < 1) {
        this.numMissContribution = 1;
    }
    if (this.backupFundPercentage < 0 || this.backupFundPercentage > 50) {
        this.backupFundPercentage = 10; // Default fallback
    }
    next();
});

// ===== METHODS =====
CommunitySettingsSchema.methods.getMinContribution = function() {
    return this.minContribution || 30;
};

CommunitySettingsSchema.methods.getPenalty = function() {
    return this.penalty || 10;
};

CommunitySettingsSchema.methods.isContributionTime = function() {
    // Logic for determining if it's time for contributions
    // Based on contributionFrequency
    const now = new Date();
    const frequency = this.contributionFrequency;
    
    // Implementation depends on frequency
    // This is a simplified version
    return true; // Placeholder
};

// Configure toJSON to use getters for Decimal128 fields
CommunitySettingsSchema.set('toJSON', { getters: true });

const CommunitySettings = mongoose.model('CommunitySettings', CommunitySettingsSchema);

module.exports = CommunitySettings;
