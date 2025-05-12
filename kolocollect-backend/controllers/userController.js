const { calculateTotalOwed } = require('../utils/contributionUtils');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Community = require('../models/Community');
const crypto = require('crypto');

const createErrorResponse = (res, status, errorCode, message, resolution) => res.status(status).json({
  error: {
    code: errorCode,
    message,
    timestamp: new Date().toISOString(),
    documentation: "https://api.kolocollect.com/docs/errors/" + errorCode
  }
});

// Register User
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  console.log('Registering user:', { name, email, password });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return createErrorResponse(res, 400, 'Email is already in use.');

    const newUser = new User({ name, email, password });
    const savedUser = await newUser.save();

    const wallet = new Wallet({
      userId: savedUser._id,
      availableBalance: 0,
      fixedBalance: 0,
      totalBalance: 0,
      transactions: [],
    });
    await wallet.save();

    res.status(201).json({
      message: 'User registered successfully.',
      user: { id: savedUser._id, name: savedUser.name, email: savedUser.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Error during registration:', err);
    createErrorResponse(res, 500, 'Failed to register user. Please try again later.');
  }
};

// Login User
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return createErrorResponse(res, 400, 'Invalid email or password.');

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return createErrorResponse(res, 400, 'Invalid email or password.');

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, { expiresIn: '7d' });
    const wallet = await Wallet.findOne({ userId: user._id });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Error during login:', err);
    createErrorResponse(res, 500, 'Failed to login. Please try again later.');
  }
};

// Fetch User Profile
exports.getUserProfile = async (req, res) => {
  const userId = req.params.userId; // Get user ID from request parameters
  try {
    const user = await User.findById(userId)
      .select('-password')
      .populate({
        path: 'communities.id',
        select: 'name description',
      })
      .populate({
        path: 'contributionsPaid.contributionId',
        select: 'name',
      });

    if (!user) return createErrorResponse(res, 404, 'User not found.');

    const wallet = await Wallet.findOne({ userId: user._id });

    const nextInLineDetails = await user.nextInLineDetails;

    res.json({
      user,
      wallet: {
        availableBalance: wallet.availableBalance,
        totalBalance: wallet.totalBalance,
      },
      nextInLineDetails,
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    createErrorResponse(res, 500, 'Failed to fetch user profile. Please try again later.');
  }
};

// Logout User
exports.logoutUser = async (req, res) => {
  // Invalidate the token on the server side if necessary
  // For example, you could maintain a blacklist of tokens or simply rely on expiration
  res.status(200).json({ message: 'User logged out successfully.' });
};

// Get upcoming payouts
exports.getUpcomingPayouts = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { userId } = req.params;

    // Find user and populate their communities
    const user = await User.findById(userId).populate('communities.id', 'name');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Get upcoming payouts from virtual
    const virtualUpcomingPayouts = await user.upcomingPayouts || [];
    
    // Get all communities the user is a part of
    const userCommIds = user.communities.map(comm => comm.id._id);
    
    // Find all communities the user is part of
    const Community = mongoose.model('Community');
    const Member = mongoose.model('Member');
    const communities = await Community.find({
      _id: { $in: userCommIds }
    }).populate({
      path: 'cycles',
      match: { isComplete: false }
    }).populate({
      path: 'midCycle',
      match: { isComplete: false }
    });

    // Calculate upcoming payouts based on member position in active cycles
    const calculatedUpcomingPayouts = [];
    
    for (const community of communities) {
      try {
        // Skip if community has no active cycles
        if (!community.cycles || community.cycles.length === 0) continue;
        
        // Get active cycle
        const activeCycle = community.cycles[0]; // The most recent active cycle
        if (!activeCycle) continue;
        
        // Find the user's member record in this community
        const member = await Member.findOne({
          communityId: community._id,
          userId: userId,
          status: 'active'
        });
        
        if (!member) continue; // Skip if not an active member
        
        // Get active midcycle
        const activeMidCycle = community.midCycle.find(mc => !mc.isComplete);
        if (!activeMidCycle) continue;
        
        // If user is next in line for current midcycle
        if (activeMidCycle.nextInLine && 
            activeMidCycle.nextInLine.userId && 
            activeMidCycle.nextInLine.userId.toString() === userId) {
          // User is getting the current payout
          calculatedUpcomingPayouts.push({
            communityId: community._id,
            communityName: community.name,
            payoutDate: activeMidCycle.payoutDate || community.nextPayout,
            expectedAmount: activeMidCycle.payoutAmount || 0,
            cycleNumber: activeCycle.cycleNumber,
            midCycleNumber: activeMidCycle.cycleNumber,
            isNextInLine: true
          });
          continue;
        }
        
        // Get all members who haven't been paid yet in this cycle
        const unpaidMembers = await Member.find({
          _id: { $in: community.members },
          userId: { $nin: activeCycle.paidMembers },
          status: 'active'
        }).sort('position');
        
        // Find user's position in the unpaid members queue
        const userPosition = unpaidMembers.findIndex(m => 
          m.userId.toString() === userId
        );
        
        if (userPosition === -1) continue; // User not in upcoming queue
        
        // Estimate future payout date based on contribution frequency
        let estimatedDate = new Date(activeMidCycle.payoutDate || community.nextPayout);
        const payoutInterval = {
          'Daily': 1,
          'Weekly': 7,
          'Monthly': 30,
          'Hourly': 1/24
        }[community.settings.contributionFrequency] || 7; // Default to weekly
        
        // Add days based on position in queue
        estimatedDate.setDate(estimatedDate.getDate() + (payoutInterval * userPosition));
        
        // Estimate amount (usually similar to current midcycle's amount)
        const estimatedAmount = activeMidCycle.payoutAmount || 
          (community.settings.minContribution * 
           community.members.filter(m => m.status === 'active').length * 
           (1 - (community.settings.backupFundPercentage / 100)));
        
        // Add to calculated payouts
        calculatedUpcomingPayouts.push({
          communityId: community._id,
          communityName: community.name,
          payoutDate: estimatedDate,
          expectedAmount: estimatedAmount,
          cycleNumber: activeCycle.cycleNumber,
          position: userPosition + 1, // Position in queue (1-indexed for display)
          isNextInLine: false
        });
      } catch (err) {
        console.error(`Error calculating payout for community ${community._id}:`, err);
      }
    }
    
    // Combine both sources of upcoming payouts, with calculated taking precedence
    // Create a map of communityIds from calculated payouts
    const calculatedCommunityIds = calculatedUpcomingPayouts.map(p => p.communityId.toString());
    
    // Add any virtual payouts that aren't already in calculated payouts
    const combinedPayouts = [...calculatedUpcomingPayouts];
    for (const payout of virtualUpcomingPayouts) {
      if (!calculatedCommunityIds.includes(payout.communityId.toString())) {
        // Find community name
        const community = communities.find(c => c._id.toString() === payout.communityId.toString());
        combinedPayouts.push({
          ...payout,
          communityName: community ? community.name : 'Unknown Community',
        });
      }
    }
    
    // Sort by date
    combinedPayouts.sort((a, b) => new Date(a.payoutDate) - new Date(b.payoutDate));

    res.status(200).json({
      message: 'Upcoming payouts retrieved successfully.',
      upcomingPayouts: combinedPayouts,
    });
  } catch (err) {
    console.error('Error fetching upcoming payouts:', err);
    createErrorResponse(res, 500, 'Error fetching upcoming payouts.');
  }
};

// Clean up logs for a user
exports.cleanUpLogs = async (req, res) => {
  try {
    const { userId } = req.params;

    // Assuming you have a Log model to handle logs
    const result = await Log.deleteMany({ userId });

    res.status(200).json({
      message: 'Logs cleaned up successfully.',
      result,
    });
  } catch (err) {
    console.error('Error cleaning up logs:', err);
    createErrorResponse(res, 500, 'Error cleaning up logs.');
  }
};

// Get user communities
exports.getUserCommunities = async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId).populate('communities.id', 'name description');
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    // Filter out communities where the populated community object is null (i.e., community was deleted)
    const validCommunities = user.communities.filter(community => community.id !== null);

    res.status(200).json({
      communities: validCommunities,
    });
  } catch (err) {
    console.error('Error fetching user communities:', err);
    createErrorResponse(res, 500, 'Error fetching user communities.');
  }
}

// Get user notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('notifications')
      .sort({ 'notifications.date': -1 }); // Sort by latest first

    if (!user) return createErrorResponse(res, 404, 'User not found.');

    res.status(200).json({
      message: 'Notifications retrieved successfully.',
      notifications: user.notifications,
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    createErrorResponse(res, 500, 'Failed to fetch notifications.');
  }
};

// Request password reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'No user found with this email address.');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Save hashed token to user
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // In a real app, send this token via email
    // For development, we'll return it in the response
    res.status(200).json({ 
      message: 'Password reset email has been sent.',
      resetToken // In production, this should be sent via email instead
    });
  } catch (err) {
    console.error('Error requesting password reset:', err);
    createErrorResponse(res, 500, 'RESET_REQUEST_ERROR', 'Error processing reset request.');
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return createErrorResponse(res, 400, 'INVALID_TOKEN', 'Invalid or expired reset token.');
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Error resetting password:', err);
    createErrorResponse(res, 500, 'RESET_PASSWORD_ERROR', 'Error resetting password.');
  }
};

// Update password (when user is logged in)
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return createErrorResponse(res, 400, 'INVALID_PASSWORD', 'Current password is incorrect.');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Error updating password:', err);
    createErrorResponse(res, 500, 'UPDATE_PASSWORD_ERROR', 'Error updating password.');
  }
};
