const mongoose = require('mongoose');

const MidCycleSchema = new mongoose.Schema({
    cycleNumber: { type: Number, required: true },
    contributions: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        contributions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' }]
    }],
    midCycleJoiners: [{
        joiners: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Define as an array of ObjectIds
        isComplete: { type: Boolean, default: false },

    }],
    nextInLine: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    defaulters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isComplete: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },
    payoutAmount: { type: Number },
    payoutDate: { type: Date },
    contributionsToNextInLine: {
        type: Map,
        of: Number,
        default: {}
    },
});

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