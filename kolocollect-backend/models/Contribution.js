const mongoose = require('mongoose');
// const User = require('./User');
// Avoid direct import to prevent circular dependency
// const Community = require('./Community');
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
  authId: {
    type: String,
    sparse: true, // Allows null values and ensures uniqueness for non-null values
    index: true,  // Index for faster queries
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
ContributionSchema.index({ authId: 1 });

// Static methods
ContributionSchema.statics.getUserContributions = async function(userId, communityId, cycleNumber) {
  return this.find({ 
    $or: [
      { userId, communityId, cycleNumber },
      { authId: userId, communityId, cycleNumber }
    ]
  }).sort({ date: -1 });
};

ContributionSchema.statics.getMissedContributions = async function(userId, communityId) {
  return this.find({ 
    $or: [
      { userId, communityId, status: 'missed' },
      { authId: userId, communityId, status: 'missed' }
    ]
  }).sort({ date: -1 });
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
  const session = await mongoose.startSession();
  try {
    session.startTransaction();    
    // Get community with all necessary references
    const Community = mongoose.model('Community');
    const community = await Community.findById(communityId)
      .populate('members')
      .populate('midCycle')
      .session(session);
    
    if (!community) throw new Error('Community not found.');
    
    // Validate mid-cycle    
    const MidCycle = mongoose.model('MidCycle');
    const activeMidCycle = await MidCycle.findOne({
      _id: midCycleId,
      isComplete: false
    }).session(session);
    
    if (!activeMidCycle) throw new Error('MidCycle not found or already complete.');
      // Validate member status
    const Member = mongoose.model('Member');
    
    // Try to find member by userId, checking both authId and MongoDB _id
    let member = await Member.findOne({
      $or: [
        { userId: userId, communityId: communityId },
        { authId: userId, communityId: communityId }
      ]
    }).session(session);
    
    console.log('Member lookup result:', member ? `Found ${member.name} with status ${member.status}` : 'Not found');
    
    if (!member) throw new Error('Member not found in this community.');
    
    // Any status is acceptable for new members joining mid-cycle
    console.log(`Member status: ${member.status}`);

    // Validate minimum contribution
    if (amount < community.settings.minContribution) {
      throw new Error(`Contribution amount must be at least €${community.settings.minContribution.toFixed(2)}.`);
    }
    
    // Check wallet balance
    // Try to find the wallet by both authId and userId
    let wallet = await mongoose.model('Wallet').findOne({ authId: userId }).session(session);
    if (!wallet) {
      wallet = await mongoose.model('Wallet').findOne({ userId }).session(session);
    }
    
    if (!wallet || wallet.availableBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }
    
    // Find user to get authId if needed
    let user = await mongoose.model('User').findOne({ authId: userId }).session(session);
    if (!user) {
      user = await mongoose.model('User').findById(userId).session(session);
    }
    
    if (!user) throw new Error('User not found.');

    // Create and save contribution
    const newContribution = new this({
      userId: user._id,
      authId: user.authId,
      communityId,
      amount,
      midCycleId,
      cycleNumber: activeMidCycle.cycleNumber,
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
    );    // Record in community
    await community.record({
      contributorId: userId,
      recipientId: activeMidCycle.nextInLine.userId,
      amount,
      contributionId: savedContribution._id
    }, { session });    
      // Add to user's profile - we already have the user object from earlier
    if (user) {
      await user.addContribution(savedContribution._id, amount, { session });
    }    
      // Log activity
    const activityLog = new mongoose.model('CommunityActivityLog')({
      communityId,      userId,
      activityType: 'contribution_created',
      timestamp: new Date()
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
  // Use mongoose.model directly to avoid circular dependency issues
  const Community = mongoose.model('Community');
  const community = await Community.findById(communityId);
  if (!community) throw new Error('Community not found');
  
  // Get mid-cycle with populated data
  const MidCycle = mongoose.model('MidCycle');
  // Use getMidcycle static method if it exists, otherwise use findById
  let midCycle;
  try {
    midCycle = MidCycle.getMidcycle ? 
      await MidCycle.getMidcycle(midCycleId) : 
      await MidCycle.findById(midCycleId).populate('nextInLine');
      
    if (!midCycle) throw new Error('Mid-cycle not found');
    
    // Log midCycle data to debug
    console.log('MidCycle data:', {
      id: midCycle._id,
      cycleNumber: midCycle.cycleNumber,
      hasNextInLine: !!midCycle.nextInLine,
      nextInLineData: midCycle.nextInLine ? {
        id: midCycle.nextInLine._id,
        userId: midCycle.nextInLine.userId
      } : null
    });
  } catch (error) {
    console.error('Error fetching mid-cycle:', error);
    throw new Error(`Mid-cycle lookup failed: ${error.message}`);
  }
  
  // Find user to get authId if needed
  const User = mongoose.model('User');
  let user = await User.findOne({ authId: userId });
  if (!user) {
    user = await User.findById(userId);
  }
  
  if (!user) throw new Error('User not found.');

  const contribution = new this({
    communityId,
    userId: user._id,
    authId: user.authId,
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
  const activityLog = new mongoose.model('CommunityActivityLog')({
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
  // Try to find the wallet by both authId and userId
  let wallet = await mongoose.model('Wallet').findOne({ authId: userId });
  if (!wallet) {
    wallet = await mongoose.model('Wallet').findOne({ userId });
  }
  
  console.log(`User Wallet for ${userId}: `, wallet ? 
    `Found (availableBalance: ${wallet.availableBalance})` : 
    'Not found');
  
  if (!wallet) {
    throw new Error(`Wallet not found for user ${userId}`);  }
  
  if (wallet.availableBalance < amount) {
    throw new Error(`Insufficient wallet balance. Required: ${amount}, Available: ${wallet.availableBalance}`);
  }
  // Add the contribution to the user's records (we already have the user object)
  await user.addContribution(contribution._id, amount);

  // Update wallet
  await wallet.addTransaction(
    amount,
    'contribution',
    `Contribution to community ${community.name}`,
    null,
    communityId
  );

  // Ensure midCycle has the nextInLine property populated
  if (!midCycle.nextInLine || !midCycle.nextInLine.userId) {
    console.log('MidCycle data:', {
      id: midCycle._id,
      cycleNumber: midCycle.cycleNumber,
      nextInLine: midCycle.nextInLine
    });
    
    // Try to get a fully populated midCycle
    const populatedMidCycle = await MidCycle.findById(midCycleId).populate('nextInLine');
    
    if (!populatedMidCycle || !populatedMidCycle.nextInLine || !populatedMidCycle.nextInLine.userId) {
      throw new Error('Cannot determine next-in-line recipient for contribution');
    }
    
    // Use the populated midCycle
    console.log('Using populated midCycle with nextInLine:', populatedMidCycle.nextInLine);
    
    // Record the contribution in community with populated data
    const recordData = {
      contributorId: userId,
      recipientId: populatedMidCycle.nextInLine.userId,
      amount,
      contributionId: contribution._id
    };
    
    console.log('Recording contribution with data:', recordData);
    await community.record(recordData);
  } else {
    // Record the contribution in community with existing data
    const recordData = {
      contributorId: userId,
      recipientId: midCycle.nextInLine.userId,
      amount,
      contributionId: contribution._id
    };
    
    console.log('Recording contribution with data:', recordData);
    await community.record(recordData);
  }

  return contribution;
};

module.exports = mongoose.model('Contribution', ContributionSchema);
