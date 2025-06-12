const mongoose = require('mongoose');

const CycleSchema = new mongoose.Schema({
    cycleNumber: { type: Number, required: true },
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    midCycles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MidCycle',
    }],
    isComplete: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },    paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

// Strategic indexes for Cycle model
CycleSchema.index({ communityId: 1, isComplete: 1 }); // Community cycle queries
CycleSchema.index({ communityId: 1, cycleNumber: 1 }); // Cycle number queries
CycleSchema.index({ isComplete: 1, startDate: -1 }); // Active cycles by date
CycleSchema.index({ communityId: 1, isComplete: 1, cycleNumber: -1 }); // Latest cycle queries
CycleSchema.index({ paidMembers: 1 }); // Member payment status

module.exports = mongoose.model('Cycle', CycleSchema);