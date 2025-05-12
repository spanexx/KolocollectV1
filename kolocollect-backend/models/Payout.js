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
  },
  amount: {
    type: Number,
    required: true,
  },
  payoutDate: {
    type: Date,
    default: Date.now,
  }
});

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