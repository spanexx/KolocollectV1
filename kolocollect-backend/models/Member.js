const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    position: { type: Number },
    contributionPaid: [{
        amount: { type: Number, default: 0 },
        count: { type: Number, default: 0 }

    }],
    status: { type: String, default: 'active' },
    penalty: { type: Number, default: 0 },
    missedContributions: [{
        cycleNumber: { type: Number, required: true },
        midCycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }],
        amount: { type: Number },
        reason: { type: String },
        nextInLineMissed: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
    }],
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    joinedAt: { type: Date, default: Date.now },
    leaveDate: { type: Date },
    paymentPlan: {
        type: { type: String, enum: ['Full', 'Incremental', 'Shortfall'], default: 'Full' },
        totalPreviousContribution: { type: Number, default: 0 },
        remainingAmount: { type: Number, default: 0 },
        previousContribution: { type: Number, default: 0 },
        installments: { type: Number, default: 0 },
    },
});

module.exports = mongoose.model('Member', MemberSchema);