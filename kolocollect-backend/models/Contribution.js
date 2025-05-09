const mongoose = require('mongoose');
const User = require('./User');
const Community = require('./Community');
const MidCycle = require('./Midcycle');
const Member = require('./Member');
const CommunityActivityLog = require('./CommunityActivityLog');

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
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Get community with all necessary references
    const community = await Community.findById(communityId)
      .populate('members')
      .populate('midCycle')
      .session(session);
    if (!community) throw new Error('Community not found.');

    // Validate mid-cycle
    const activeMidCycle = await MidCycle.findOne({
      _id: midCycleId,
      isComplete: false
    }).session(session);
    if (!activeMidCycle) throw new Error('MidCycle not found or already complete.');

    // Validate member status
    const member = await Member.findOne({
      userId,
      _id: { $in: community.members },
      status: 'active'
    }).session(session);
    if (!member) throw new Error('Active member not found.');

    // Validate minimum contribution
    if (amount < community.settings.minContribution) {
      throw new Error(`Contribution amount must be at least €${community.settings.minContribution.toFixed(2)}.`);
    }

    // Check wallet balance
    const wallet = await mongoose.model('Wallet').findOne({ userId }).session(session);
    if (!wallet || wallet.availableBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }

    // Create and save contribution
    const newContribution = new this({
      userId,
      communityId,
      amount,
      midCycleId,
      cycleNumber: activeMidCycle.cycleNumber.length,
      status: 'completed'
    });
    const savedContribution = await newContribution.save({ session });

    // Update wallet
    await wallet.addTransaction(
      amount,
      'contribution',
      `Contribution to community ${community.name}`,
      null,
      communityId,
      { session }
    );

    // Record in community
    await community.record({
      contributorId: userId,
      recipientId: midCycleId,
      amount,
      contributionId: savedContribution._id
    }, { session });

    // Add to user's profile
    const user = await User.findById(userId).session(session);
    if (user) {
      await user.addContribution(savedContribution._id, amount, { session });
    }

    // Log activity
    const activityLog = new CommunityActivityLog({
      communityId,
      userId,
      actionType: 'contribution_created',
      details: `User contributed €${amount} to mid-cycle ${midCycleId}`,
      referenceId: savedContribution._id
    });
    await activityLog.save({ session });

    await session.commitTransaction();
    return savedContribution;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

ContributionSchema.statics.createContributionWithInstallment = async function (userId, communityId, amount, midCycleId) {
  const community = await Community.findById(communityId);
  if (!community) throw new Error('Community not found');

  // Get mid-cycle with populated data
  const midCycle = await mongoose.model('MidCycle').getMidcycle(midCycleId);
  if (!midCycle) throw new Error('Mid-cycle not found');

  const contribution = new this({
    communityId,
    userId,
    amount,
    midCycleId,
    cycleNumber: midCycle.cycleNumber,
    status: 'completed',
    date: new Date(),
    penalty: 0,
    paymentPlan: { type: 'Full', remainingAmount: 0, installments: 0 }
  });

  await contribution.save();

  // Create activity log for the contribution
  const activityLog = new CommunityActivityLog({
    communityId,
    activityType: 'contribution_created',
    userId,
    timestamp: new Date()
  });
  await activityLog.save();
  
  // Add activity log to community
  community.activityLog.push(activityLog._id);
  await community.save();

     // Check wallet balance
    const wallet = await mongoose.model('Wallet').findOne({ userId })
    if (!wallet || wallet.availableBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }

  // Update user's contribution records
  const user = await User.findById(userId);
  if (user) {
    await user.addContribution(contribution._id, amount);
  }

      // Update wallet
    await wallet.addTransaction(
      amount,
      'contribution',
      `Contribution to community ${community.name}`,
      null,
      communityId,
    );

  // Record the contribution in community
  await community.record({
    contributorId: userId,
    recipientId: midCycle.nextInLine.userId,
    amount,
    contributionId: contribution._id
  });

  return contribution;
};

module.exports = mongoose.model('Contribution', ContributionSchema);

