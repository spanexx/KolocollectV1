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
    endDate: { type: Date },
    paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

module.exports = mongoose.model('Cycle', CycleSchema);