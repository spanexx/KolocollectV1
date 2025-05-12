const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  dateJoined: { type: Date, default: Date.now },
  communities: [{
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', index: true },
    isAdmin: { type: Boolean, default: false },
  }],
  contributions: [{
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    payoutDate: { type: Date },
    expectedAmount: { type: Number },
  }],
  contributionsPaid: [{
      contributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' },
      amount: { type: Number },
      option: { type: String, default: 'MidCycle Contribution'},
    }],
  penalty: { type: Number, default: 0 },
  votes: [
    {
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      topic: { type: String },
      choice: { type: String },
      date: { type: Date, default: Date.now },
    },
  ],  notifications: [
    {
      type: { type: String, enum: ['info', 'warning', 'alert', 'penalty', 'payout'], default: 'info' },
      message: { type: String },
      date: { type: Date, default: Date.now },
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      read: { type: Boolean, default: false },
    },
  ],
  activityLog: [
    {
      action: { type: String }, // e.g., "joined community", "contributed", "penalized"
      details: { type: String }, // Additional details for the action
      date: { type: Date, default: Date.now },
    },
  ],
  payouts: [
    {
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      amount: { type: Number },
      date: { type: Date },
    },
  ],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

// Enable virtuals in toJSON and toObject output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Virtual field to check if the user is next in line for a payout
userSchema.virtual('nextInLineDetails').get(async function () {
  const Community = mongoose.model('Community');
  const userId = this._id;

  // Fetch all communities where the user is a member
  const communities = await Community.find({ members: { $elemMatch: { userId } } });

  // Loop through the communities to check for next-in-line status
  for (const community of communities) {
    const activeMidCycle = community.midCycle.find((mc) => mc.isReady && !mc.isComplete && mc.nextInLine?.userId.equals(userId));
    if (activeMidCycle) {
      return {
        communityId: community._id,
        communityName: community.name,
        midCycleId: activeMidCycle._id,
        cycleNumber: activeMidCycle.cycleNumber,
        payoutAmount: activeMidCycle.payoutAmount,
        missedContributions: activeMidCycle.missedContributions.filter((id) => id.equals(userId)),
        payoutDate: activeMidCycle.payoutDate,
      };
    }
  }

  return null; // User is not next in line in any community
});

// Password hashing before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Match user password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Add community to user's profile
userSchema.methods.addCommunity = async function (communityId, isAdmin = false) {
  const communityExists = this.communities.some(community => community.id && community.id.equals(communityId));

  if (!communityExists) {
    this.communities.push({
      id: communityId,
      isAdmin: isAdmin,
    });

    // Log the action
    this.activityLog.push({
      action: 'joined community',
      details: `Joined community with ID: ${communityId}`,
    });

    // Add notification
    const message = isAdmin
      ? `You have created the community with ID: ${communityId}`
      : `You have joined the community with ID: ${communityId}`;
    this.notifications.push({
      type: 'info',
      message: message,
      communityId: communityId,
      date: new Date(),
    });

    await this.save();
  }
};

// Remove community from user's profile
userSchema.methods.removeCommunity = async function (communityId) {
  this.communities = this.communities.filter(community => !community.id.equals(communityId));

  // Log the action
  this.activityLog.push({
    action: 'left community',
    details: `Left community with ID: ${communityId}`,
  });

  // Add notification
  this.notifications.push({
    type: 'info',
    message: `You have left the community with ID: ${communityId}`,
    communityId: communityId,
    date: new Date(),
  });

  await this.save();
};

// Add contribution to a user
userSchema.methods.addContribution = async function (contributionId, amount) {
  const contribution = this.contributionsPaid.find((c) => c.contributionId.equals(contributionId));

  if (contribution) {
    contribution.amount += amount;
  } else {
    this.contributionsPaid.push({
      contributionId,
      amount,
    });
  }

  // Log the action
  this.activityLog.push({
    action: 'contributed',
    details: `Contributed ${amount} to contribution ${contributionId}`,
    date: new Date(),
  });

  // Add notification
  this.notifications.push({
    type: 'info',
    message: `You have successfully created a contribution.`,
    contributionId: contributionId,
    date: new Date(),
  });

  await this.save();
};

// Add a notification to the user
userSchema.methods.addNotification = async function (type, message, communityId = null) {
  try {
    // Prevent duplicate notifications of the same type and message
    const duplicateNotification = this.notifications.find(
      (n) => n.type === type && n.message === message && String(n.communityId) === String(communityId)
    );

    if (!duplicateNotification) {      this.notifications.push({
        type,
        message,
        communityId,
        date: new Date(),
        read: false,
      });

      // Log the action in the user's activity log
      this.activityLog.push({
        action: 'notification',
        details: `New notification: ${message}`,
      });

      await this.save();
    }
  } catch (err) {
    console.error('Error adding notification:', err);
    throw new Error('Failed to add notification.');
  }
};

// Clean up logs
userSchema.methods.cleanUpLogs = async function (days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Filter logs and notifications older than 'days'
  this.notifications = this.notifications.filter((n) => n.date > cutoffDate);
  this.activityLog = this.activityLog.filter((log) => log.date > cutoffDate);

  await this.save();
};

// Update contribution in user's profile
userSchema.methods.updateContribution = async function (contributionId, amount) {
  const contribution = this.contributionsPaid.find((c) => c.contributionId.equals(contributionId));

  if (contribution) {
    contribution.amount = amount;
  } else {
    this.contributionsPaid.push({
      contributionId,
      amount,
    });
  }

  // Log the action
  this.activityLog.push({
    action: 'updated contribution',
    details: `Updated contribution ${contributionId} to amount ${amount}`,
    date: new Date(),
  });

  // Add notification
  this.notifications.push({
    type: 'info',
    message: `Your contribution ${contributionId} has been updated to ${amount}.`,
    date: new Date(),
  });

  await this.save();
};

// Update payouts for a user
userSchema.methods.updateUserPayouts = async function (community) {
  try {
    const payoutDetails = community.payoutDetails;
    const existingPayout = this.payouts.find((p) =>
      p.communityId.equals(community._id)
    );

    if (payoutDetails && payoutDetails.nextRecipient.equals(this._id) && payoutDetails.payoutAmount > 0) {
      if (existingPayout) {
        // Update existing payout
        existingPayout.amount = payoutDetails.payoutAmount;
        existingPayout.date = community.nextPayout;
      } else {
        // Add new payout
        this.payouts.push({
          communityId: community._id,
          amount: payoutDetails.payoutAmount,
          date: community.nextPayout,
        });
      }

      await this.save();
    }
  } catch (err) {
    console.error('Error updating user payouts:', err);
    throw err;
  }
};

// Virtual field for upcoming payouts
userSchema.virtual('upcomingPayouts').get(function () {
  if (!this.contributions || !Array.isArray(this.contributions)) {
    return [];
  }

  return this.contributions
    .filter(contribution => contribution && contribution.payoutDate)
    .map(contribution => {
      if (new Date(contribution.payoutDate) > new Date()) {
        return {
          communityId: contribution.communityId,
          payoutDate: contribution.payoutDate,
          expectedAmount: contribution.expectedAmount || 0,
        };
      }
      return null;
    })
    .filter(payout => payout !== null);
});

// Handle penalty adjustments with notifications and conditional logging
userSchema.methods.handlePenalty = async function (amount, action, reason, communityId = null) {
  if (action === 'add') {
    this.penalty += amount;
    await this.addNotification('penalty', `Penalty added: ${reason} (+${amount})`, communityId);
  } else if (action === 'remove') {
    this.penalty = Math.max(0, this.penalty - amount);
    await this.addNotification('penalty', `Penalty removed: ${reason} (-${amount})`, communityId);
    
    // Only log activity when penalty is actually removed
    this.activityLog.push({
      action: 'penalty removed',
      details: `Penalty reduced by ${amount}: ${reason}`,
      date: new Date()
    });
  }

  await this.save();
  return this.penalty;
};

module.exports = mongoose.model('User', userSchema);
