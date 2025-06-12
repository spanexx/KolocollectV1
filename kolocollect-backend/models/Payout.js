const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
  },
  cycleNumber: {
    type: Number,
    required: true,
  },
  midCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MidCycle',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    get: function(value) {
      return value ? parseFloat(value.toString()) : 0;
    }
  },
  payoutDate: {
    type: Date,
    default: Date.now,
  }
});

// Configure toJSON to use getters for Decimal128 fields
payoutSchema.set('toJSON', { getters: true });

// Strategic indexes for Payout model
payoutSchema.index({ communityId: 1, payoutDate: -1 }); // Community payout history
payoutSchema.index({ recipient: 1, payoutDate: -1 }); // User payout history
payoutSchema.index({ communityId: 1, cycleNumber: 1, midCycleId: 1 }); // Cycle tracking
payoutSchema.index({ payoutDate: -1, amount: -1 }); // Amount and date queries
payoutSchema.index({ midCycleId: 1 }); // MidCycle relationship

// Static method to create a payout
payoutSchema.statics.createPayout = async function (communityId, recipientId, amount, cycleNumber, midCycleId) {
  try {
    const payout = new this({
      communityId,
      recipient: recipientId,
      amount,
      cycleNumber,
      midCycleId,
      payoutDate: new Date() // Explicitly set date (optional)
    });
    
    await payout.save();
    return payout;
  } catch (err) {
    console.error('Error creating payout:', err);
    throw err;
  }
};

const Payout = mongoose.model('Payout', payoutSchema);

module.exports = Payout;