const mongoose = require('mongoose');
const User = require('./User');
// Avoid direct import to prevent circular dependency
// const Community = require('./Community');
const MidCycle = require('./Midcycle');
const Member = require('./Member');
const CommunityActivityLog = require('./CommunityActivityLog');
const TransactionManager = require('../utils/transactionManager');

const ContributionSchema = new mongoose.Schema({
  communityId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Community', 
    required: true, 
    index: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  cycleNumber: { type: Number, required: true },
  midCycleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MidCycle', 
    required: true,
    index: true 
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    get: v => v ? parseFloat(v.toString()) : undefined,
    validate: {
      validator: value => value >= 0,
      message: 'Contribution amount must be a positive number.',
    },
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed'],
    default: 'pending',
    index: true
  },
  date: { type: Date, default: Date.now, index: true },
  penalty: { type: Number, default: 0 },
  paymentPlan: {
    type: { 
      type: String, 
      enum: ['Full', 'Incremental', 'Shortfall'], 
      default: 'Full' 
    },
    remainingAmount: { 
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: v => v ? parseFloat(v.toString()) : 0
    },
    installments: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { getters: true }
});

// Indexes for performance
ContributionSchema.index({ communityId: 1, cycleNumber: 1, status: 1 });
ContributionSchema.index({ userId: 1, communityId: 1, date: -1 });
ContributionSchema.index({ midCycleId: 1, status: 1 });

// Static methods
ContributionSchema.statics.getUserContributions = async function(userId, communityId, cycleNumber) {
  return this.find({ userId, communityId, cycleNumber })
    .sort({ date: -1 });
};

ContributionSchema.statics.getMissedContributions = async function(userId, communityId) {
  return this.find({ userId, communityId, status: 'missed' })
    .sort({ date: -1 });
};

ContributionSchema.statics.getCycleTotal = async function(communityId, cycleNumber) {
  const result = await this.aggregate([
    { 
      $match: { 
        communityId: mongoose.Types.ObjectId(communityId), 
        cycleNumber,
        status: 'completed'
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: { $toDouble: "$amount" } } 
      } 
    }
  ]);
  return result[0]?.total || 0;
};

ContributionSchema.statics.createContribution = async function(userId, communityId, amount, midCycleId) {
  console.log(`Creating contribution: userId=${userId}, communityId=${communityId}, amount=${amount}, midCycleId=${midCycleId}`);
  
  try {
    // Use TransactionManager for ACID-compliant contribution processing
    const result = await TransactionManager.handleContribution({
      userId,
      communityId,
      amount,
      midCycleId
    });

    return result.contribution;
  } catch (error) {
    console.error('Error in createContribution:', error);
    throw error;
  }
};

ContributionSchema.statics.createContributionWithInstallment = async function (userId, communityId, amount, midCycleId) {
  // Use TransactionManager for ACID-compliant transaction handling
  return await TransactionManager.handleContribution({
    userId,
    communityId,
    amount,
    midCycleId,
    paymentPlan: { type: 'Full', remainingAmount: 0, installments: 0 },
    status: 'completed'
  });
};

module.exports = mongoose.model('Contribution', ContributionSchema);
