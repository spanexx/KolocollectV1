const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    position: { type: Number },    contributionPaid: [{
        amount: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        count: { type: Number, default: 0 }

    }],
    status: { type: String, default: 'active' },
    penalty: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    missedContributions: [{
        cycleNumber: { type: Number, required: true },
        midCycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }],
        amount: { 
            type: mongoose.Schema.Types.Decimal128,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        reason: { type: String },
        nextInLineMissed: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
    }],
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    joinedAt: { type: Date, default: Date.now },
    leaveDate: { type: Date },    paymentPlan: {
        type: { type: String, enum: ['Full', 'Incremental', 'Shortfall'], default: 'Full' },
        totalPreviousContribution: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        remainingAmount: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        previousContribution: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        installments: { type: Number, default: 0 },
    },
});

// Configure toJSON to use getters for Decimal128 fields
MemberSchema.set('toJSON', { getters: true });

// Strategic indexes for Member model
MemberSchema.index({ communityId: 1, status: 1 }); // Community member queries
MemberSchema.index({ userId: 1, communityId: 1 }); // User-community relationship
MemberSchema.index({ communityId: 1, position: 1 }); // Position-based queries
MemberSchema.index({ status: 1, joinedAt: 1 }); // Status and time-based queries
MemberSchema.index({ communityId: 1, 'paymentPlan.remainingAmount': 1 }); // Payment plan queries
MemberSchema.index({ communityId: 1, penalty: 1 }); // Penalty tracking

module.exports = mongoose.model('Member', MemberSchema);