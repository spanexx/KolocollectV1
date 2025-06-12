const mongoose = require('mongoose');

const MidCycleSchema = new mongoose.Schema({
    cycleNumber: { type: Number, required: true },
    contributions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        contributions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' }]
    }],    midCycleJoiners: [{
        joiners: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Define as an array of ObjectIds
        isComplete: { type: Boolean, default: false },
        secondInstallmentPaid: { type: Boolean, default: false },
        backPaymentDistributed: { type: Boolean, default: false },
        distributionDate: { type: Date },
        distributionAmount: { 
            type: mongoose.Schema.Types.Decimal128,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        }
    }],nextInLine: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        memberReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
        userName: { type: String },
        position: { type: Number }
    },
    defaulters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isComplete: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },    payoutAmount: { 
        type: mongoose.Schema.Types.Decimal128,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    payoutDate: { type: Date },
    contributionsToNextInLine: {
        type: Map,
        of: mongoose.Schema.Types.Decimal128,
        default: {}
    },
});

// Configure toJSON to use getters for Decimal128 fields
MidCycleSchema.set('toJSON', { getters: true });

// Strategic indexes for MidCycle model
MidCycleSchema.index({ cycleNumber: 1, isComplete: 1 }); // Cycle and completion status
MidCycleSchema.index({ isReady: 1, isComplete: 1, payoutDate: 1 }); // Payout readiness queries
MidCycleSchema.index({ 'nextInLine.userId': 1, isComplete: 1 }); // Next in line queries
MidCycleSchema.index({ cycleNumber: 1, 'nextInLine.userId': 1 }); // User-cycle relationship
MidCycleSchema.index({ payoutDate: 1, isReady: 1 }); // Scheduled payout queries
MidCycleSchema.index({ 'midCycleJoiners.joiners': 1 }); // Joiner queries

/**
 * Get a mid-cycle with populated data
 * @param {ObjectId} midCycleId - The ID of the mid-cycle to retrieve
 * @returns {Promise<Object>} The populated mid-cycle document
 */
MidCycleSchema.statics.getMidcycle = async function(midCycleId) {
    try {
        const midCycle = await this.findById(midCycleId)
            .populate({
                path: 'contributions.user',
                select: 'name email'
            })
            .populate('contributions.contributions')
            .populate({
                path: 'midCycleJoiners.joiners',
                select: 'name email'
            })
            .populate({
                path: 'midCycleJoiners.paidMembers',
                select: 'name email'
            })
            .populate({
                path: 'nextInLine.userId',
                select: 'name email'
            })
            .populate({
                path: 'nextInLine.memberReference',
                select: 'name email position'
            })
            .populate({
                path: 'defaulters',
                select: 'name email'
            });

        if (!midCycle) {
            throw new Error('Mid-cycle not found');
        }

        return midCycle;
    } catch (err) {
        console.error('Error getting mid-cycle:', err);
        throw err;
    }
};

module.exports = mongoose.model('MidCycle', MidCycleSchema);