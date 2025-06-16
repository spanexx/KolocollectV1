const { calculateTotalOwed } = require('../utils/contributionUtils');
const { QueryOptimizer, FIELD_SELECTORS } = require('../utils/queryOptimizer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Community = require('../models/Community');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Update User Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, address, bio } = req.body;
    console.log('Updating user profile:', req.body);

    if (!name && !email && !phone && !address && !bio) {
      return res.status(400).json({
        error: {
          code: 'UPDATE_PROFILE_ERROR',
          message: 'No fields to update were provided.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/UPDATE_PROFILE_ERROR"
        }
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/USER_NOT_FOUND"
        }
      });
    }

    // Update only provided fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (bio !== undefined) user.bio = bio;

    // Add activity log entry
    user.activityLog.push({
      action: 'updated profile',
      details: 'User profile information updated',
      date: new Date()
    });

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio
      }
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({
      error: {
        code: 'UPDATE_PROFILE_ERROR',
        message: 'Failed to update user profile.',
        timestamp: new Date().toISOString(),
        documentation: "https://api.kolocollect.com/docs/errors/UPDATE_PROFILE_ERROR"
      }
    });
  }
};

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

    // Send welcome email (non-blocking)
    const userData = {
      name: savedUser.name,
      email: savedUser.email,
      id: savedUser._id
    };

    emailService.sendWelcomeEmail(userData)
      .then(result => {
        console.log(`Welcome email sent to ${savedUser.email}:`, result.messageId);
      })
      .catch(error => {
        console.error(`Failed to send welcome email to ${savedUser.email}:`, error.message);
        // Note: We don't fail the registration if email fails
      });

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
      user: { 
        id: user._id, 
        name: user.name,
         email: user.email,
          profilePicture: user.profilePicture,
           
      },
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
    // Use optimized query for user profile with communities
    const user = await QueryOptimizer.getUserWithCommunities(userId, true);

    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');

    const wallet = await Wallet.findOne({ userId: user._id });
    const nextInLineDetails = await user.nextInLineDetails;

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
        profilePicture: user.profilePicture,
        verificationDocuments: user.verificationDocuments,
        preferences: user.preferences,
        activityLog: user.activityLog,
        notifications: user.notifications,
        communities: user.communities,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      },
      wallet: wallet ? {
        availableBalance: wallet.availableBalance,
        totalBalance: wallet.totalBalance,
      } : null,
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

    // Use optimized user query
    const user = await QueryOptimizer.getUserWithCommunities(userId, false);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Get upcoming payouts from virtual
    const virtualUpcomingPayouts = await user.upcomingPayouts || [];
      // Get all communities the user is a part of using optimized query
    const userCommIds = user.communities.map(comm => comm.id._id);
    
    // Use optimized QueryOptimizer to get communities with cycles and mid-cycles
    const communities = await QueryOptimizer.getCommunities(
      { _id: { $in: userCommIds } },
      'medium',
      {}
    );

    // Calculate upcoming payouts based on member position in active cycles
    const calculatedUpcomingPayouts = [];
    
    for (const community of communities) {
      try {
        // Skip if community has no active cycles
        if (!community.cycles || community.cycles.length === 0) continue;
        
        // Get active cycle
        const activeCycle = community.cycles[0]; // The most recent active cycle
        if (!activeCycle) continue;
        
        // Use optimized member query
        const member = await QueryOptimizer.getMembers({
          communityId: community._id,
          userId: userId,
          status: 'active'
        }, {
          limit: 1,
          populate: false
        });
        
        if (!member || member.length === 0) continue; // Skip if not an active member
        
        // Get active midcycle using optimized query
        const activeMidCycle = await QueryOptimizer.getActiveMidCycle(community._id);
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
        
        // Get all members who haven't been paid yet in this cycle using optimized query
        const unpaidMembers = await QueryOptimizer.getMembers({
          _id: { $in: community.members },
          userId: { $nin: activeCycle.paidMembers },
          status: 'active'
        }, {
          sort: { position: 1 },
          populate: false
        });
        
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
    const maxLength = req.query.maxLength ? parseInt(req.query.maxLength) : 50;
    const clearAll = req.query.clearAll === 'true';

    // Find the user
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');

    // Use the user's method to clean up logs with maxLength parameter and clearAll flag
    await user.cleanUpLogs(maxLength, clearAll);

    const message = clearAll 
      ? 'Activity logs cleared successfully.' 
      : `Logs cleaned up successfully. Keeping the most recent ${maxLength} entries.`;

    res.status(200).json({
      message: message,
      activityLogCount: user.activityLog.length,
      notificationsCount: user.notifications.length
    });
    console.log('Log counts after cleanup:', user.activityLog.length, user.notifications.length);
  } catch (err) {
    console.error('Error cleaning up logs:', err);
    createErrorResponse(res, 500, 'LOG_CLEANUP_ERROR', 'Error cleaning up logs.');
  }
};

// Get user communities
exports.getUserCommunities = async (req, res) => {
  const userId = req.params.userId;
  try {
    // Use optimized query for user with communities
    const user = await QueryOptimizer.getUserWithCommunities(userId, true);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    // Filter out communities where the populated community object is null (i.e., community was deleted)
    const validCommunities = user.communities.filter(community => community.id !== null);

    res.status(200).json({
      communities: validCommunities,
    });
  } catch (err) {
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

// In-memory cache for search results
const searchCache = {};
const searchTimeouts = {};
const CLIENT_RATE_LIMIT = {};
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const RATE_LIMIT_MAX = 3; // Max 3 requests per window

// Search users by name or email
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const clientIp = req.ip || 'unknown';
    
    // Basic rate limiting by IP
    const now = Date.now();
    if (!CLIENT_RATE_LIMIT[clientIp]) {
      CLIENT_RATE_LIMIT[clientIp] = {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW
      };
    } else if (now < CLIENT_RATE_LIMIT[clientIp].resetAt) {
      CLIENT_RATE_LIMIT[clientIp].count++;
      if (CLIENT_RATE_LIMIT[clientIp].count > RATE_LIMIT_MAX) {
        console.log(`Rate limit exceeded for ${clientIp} on query: ${query}`);
        return createErrorResponse(res, 429, 'TOO_MANY_REQUESTS', 'Too many search requests. Please wait a moment before trying again.');
      }
    } else {
      // Reset rate limit counter
      CLIENT_RATE_LIMIT[clientIp] = {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW
      };
    }
    
    if (!query) {
      return createErrorResponse(res, 400, 'SEARCH_QUERY_REQUIRED', 'Search query is required');
    }
    
    // Normalize query for consistency in caching
    const normalizedQuery = query.trim().toLowerCase();
    
    // Check cache first
    if (searchCache[normalizedQuery]) {
      console.log(`Returning cached results for query: ${normalizedQuery}`);
      return res.status(200).json(searchCache[normalizedQuery]);
    }
    
    // Create a case-insensitive regex for search
    const searchRegex = new RegExp(normalizedQuery, 'i');
      // Use optimized user search with selective fields
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    })
    .select(FIELD_SELECTORS.userBasic) // Use optimized field selector
    .limit(20); // Limit the number of results
    
    // Transform the result to match the frontend interface
    const results = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email
    }));
    
    // Cache results for 5 minutes
    searchCache[normalizedQuery] = results;
    
    // Clear cache after timeout
    if (searchTimeouts[normalizedQuery]) {
      clearTimeout(searchTimeouts[normalizedQuery]);
    }
    
    searchTimeouts[normalizedQuery] = setTimeout(() => {
      delete searchCache[normalizedQuery];
      delete searchTimeouts[normalizedQuery];
    }, 5 * 60 * 1000); // 5 minutes cache timeout
    
    res.status(200).json(results);
  } catch (err) {
    console.error('Error searching users:', err);
    createErrorResponse(res, 500, 'SEARCH_ERROR', 'Failed to search users: ' + err.message);
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
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(userId);

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

// Mark a single notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');
    
    const notification = user.notifications.id(notificationId);
    if (!notification) return createErrorResponse(res, 404, 'Notification not found.');
    
    notification.read = true;
    await user.save();
    
    res.status(200).json({
      message: 'Notification marked as read.',
      notificationId
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    createErrorResponse(res, 500, 'Failed to mark notification as read.');
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');
    
    // Mark all notifications as read
    user.notifications.forEach(notification => {
      notification.read = true;
    });
    
    await user.save();
    
    res.status(200).json({
      message: 'All notifications marked as read.'
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    createErrorResponse(res, 500, 'Failed to mark notifications as read.');
  }
};

// Update User Profile Picture
exports.updateProfilePicture = async (req, res) => {
  try {
    const { userId } = req.params;    const { fileId, url } = req.body;

    console.log('Updating profile picture:', { userId, fileId, url });
    
    if (!fileId || !url) {
      return createErrorResponse(res, 400, 'MISSING_FIELDS', 'File ID and URL are required.');
    }
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    user.profilePicture = {
      fileId,
      url,
      lastUpdated: new Date()
    };
    
    await user.save();
    
    // Add activity log entry
    user.activityLog.push({
      action: 'updated profile picture',
      details: 'Profile picture updated',
      date: new Date()
    });
    
    res.status(200).json({
      message: 'Profile picture updated successfully.',
      profilePicture: user.profilePicture
    });
  } catch (err) {
    console.error('Error updating profile picture:', err);
    createErrorResponse(res, 500, 'PROFILE_PICTURE_ERROR', 'Failed to update profile picture.');
  }
};

// Get User Verification Documents
exports.getVerificationDocuments = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('verificationDocuments');
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    res.status(200).json({
      verificationDocuments: user.verificationDocuments || []
    });
  } catch (err) {
    console.error('Error getting verification documents:', err);
    createErrorResponse(res, 500, 'DOCUMENT_ERROR', 'Failed to get verification documents.');
  }
};

// Delete Verification Document
exports.deleteVerificationDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    // Find the document by fileId
    const documentIndex = user.verificationDocuments.findIndex(
      doc => doc.fileId === documentId
    );
    
    if (documentIndex === -1) {
      return createErrorResponse(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    }
    
    // Remove the document
    user.verificationDocuments.splice(documentIndex, 1);
    await user.save();
    
    // Add activity log entry
    user.activityLog.push({
      action: 'deleted verification document',
      details: `Verification document deleted: ${documentId}`,
      date: new Date()
    });
    
    res.status(200).json({
      message: 'Verification document deleted successfully.'
    });
  } catch (err) {
    console.error('Error deleting verification document:', err);
    createErrorResponse(res, 500, 'DOCUMENT_DELETE_ERROR', 'Failed to delete verification document.');
  }
};

// Admin: Verify a Document
exports.verifyDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    
    // Check if requesting user is admin
    if (req.user.role !== 'admin') {
      return createErrorResponse(res, 403, 'UNAUTHORIZED', 'Only administrators can verify documents.');
    }
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    // Find the document
    const document = user.verificationDocuments.find(doc => doc.fileId === documentId);
    if (!document) {
      return createErrorResponse(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    }
    
    // Update document status
    document.status = 'verified';
    document.verifiedDate = new Date();
    await user.save();
    
    // Add notification to user
    await user.addNotification(
      'info',
      `Your ${document.documentType} document has been verified.`,
      null
    );
    
    res.status(200).json({
      message: 'Document verified successfully.',
      document
    });
  } catch (err) {
    console.error('Error verifying document:', err);
    createErrorResponse(res, 500, 'DOCUMENT_VERIFY_ERROR', 'Failed to verify document.');
  }
};

// Admin: Reject a Document
exports.rejectDocument = async (req, res) => {
  try {
    const { userId, documentId } = req.params;
    const { rejectionReason } = req.body;
    
    // Check if requesting user is admin
    if (req.user.role !== 'admin') {
      return createErrorResponse(res, 403, 'UNAUTHORIZED', 'Only administrators can reject documents.');
    }
    
    if (!rejectionReason) {
      return createErrorResponse(res, 400, 'MISSING_REASON', 'Rejection reason is required.');
    }
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    // Find the document
    const document = user.verificationDocuments.find(doc => doc.fileId === documentId);
    if (!document) {
      return createErrorResponse(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
    }
    
    // Update document status
    document.status = 'rejected';
    document.rejectionReason = rejectionReason;
    await user.save();
    
    // Add notification to user
    await user.addNotification(
      'warning',
      `Your ${document.documentType} document was rejected: ${rejectionReason}`,
      null
    );
    
    res.status(200).json({
      message: 'Document rejected successfully.',
      document
    });
  } catch (err) {
    console.error('Error rejecting document:', err);
    createErrorResponse(res, 500, 'DOCUMENT_REJECT_ERROR', 'Failed to reject document.');
  }
};

// Get User Activity Log
exports.getUserActivityLog = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    // Return the activity log in reverse chronological order (newest first)
    const activityLog = user.activityLog || [];
    const sortedActivityLog = [...activityLog].sort((a, b) => 
      new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp)
    );
    
    return res.status(200).json(sortedActivityLog);
  } catch (error) {
    console.error('Error retrieving user activity log:', error);
    return createErrorResponse(res, 500, 'Failed to retrieve activity log.');
  }
};

// Add a verification document
exports.addVerificationDocument = async (req, res) => {
  try {
    const { userId } = req.params;
    const { fileId, url, documentType, documentDescription } = req.body;
    
    if (!fileId || !url || !documentType) {
      return createErrorResponse(res, 400, 'MISSING_FIELDS', 'File ID, URL, and document type are required.');
    }
    
    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'USER_NOT_FOUND', 'User not found.');
    
    // Initialize verificationDocuments array if it doesn't exist
    if (!user.verificationDocuments) {
      user.verificationDocuments = [];
    }
    
    // Add the new document
    const newDocument = {
      fileId,
      url,
      documentType,
      documentDescription,
      status: 'pending',
      uploadDate: new Date()
    };
    
    user.verificationDocuments.push(newDocument);
    
    // Add activity log entry
    user.activityLog.push({
      action: 'uploaded verification document',
      details: `Verification document uploaded: ${documentType}`,
      date: new Date()
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'Verification document added successfully.',
      document: newDocument
    });
  } catch (err) {
    console.error('Error adding verification document:', err);
    createErrorResponse(res, 500, 'DOCUMENT_ADD_ERROR', 'Failed to add verification document.');
  }
};
