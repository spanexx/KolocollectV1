const { calculateTotalOwed, processBackPayment } = require('../utils/contributionUtils');
const redis = require('redis');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');
const CommunityActivityLog = require('../models/CommunityActivityLog');
const CommunityVote = require('../models/CommunityVote');
const Cycle = require('../models/Cycle');
const MidCycle = require('../models/Midcycle');
const Member = require('../models/Member');

// Helper functions for schema validation and common operations
const validateMember = async (userId, communityId) => {
  const member = await Member.findOne({
    _id: { $in: (await Community.findById(communityId)).members },
    userId
  });
  if (!member) throw new Error('Member not found in community');
  return member;
};

const validateMidCycle = async (midCycleId, communityId) => {
  const midCycle = await MidCycle.findOne({
    _id: midCycleId,
    _id: { $in: (await Community.findById(communityId)).midCycle }
  });
  if (!midCycle) throw new Error('Mid-cycle not found in community');
  return midCycle;
};

const validateCycle = async (cycleId, communityId) => {
  const cycle = await Cycle.findOne({
    _id: cycleId,
    _id: { $in: (await Community.findById(communityId)).cycles }
  });
  if (!cycle) throw new Error('Cycle not found in community');
  return cycle;
};

const validateVote = async (voteId, communityId) => {
  const vote = await CommunityVote.findOne({
    _id: voteId,
    communityId
  });
  if (!vote) throw new Error('Vote not found in community');
  return vote;
};

// Utility function to get active mid-cycle
const getActiveMidCycle = async (communityId) => {
  const community = await Community.findById(communityId).populate('midCycle');
  return community.midCycle.find(mc => !mc.isComplete);
};

// Utility function to get active cycle
const getActiveCycle = async (communityId) => {
  const community = await Community.findById(communityId).populate('cycles');
  return community.cycles.find(c => !c.isComplete);
};

// Create Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

(async () => {
  await redisClient.connect();
})();

const createErrorResponse = (res, status, errorCode, message) => 
  res.status(status).json({
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      documentation: "https://api.kolocollect.com/docs/errors/" + errorCode
    }
  });

// Function to check if a string is a valid ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const retryOperation = async (fn, maxRetries = 3) => {
  let attempts = 0;
  const retry = async () => {
      try {
          return await fn();
      } catch (err) {
          if (err.name === 'VersionError' && attempts < maxRetries) {
              attempts++;
              console.log(`Retry #${attempts} for version conflict`);
              await new Promise(resolve => setTimeout(resolve, 100 * attempts));
              return retry();
          }
          throw err;
      }
  };
  return retry();
};

// Get all communities
exports.getAllCommunities = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch paginated communities
    const [communities, total] = await Promise.all([
      Community.find().skip(skip).limit(limit),
      Community.countDocuments()
    ]);

    // Check if communities exist
    if (!communities || communities.length === 0) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'No communities match the requested criteria');
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    // Standardized success response with pagination
    res.status(200).json({
      status: 'success',
      message: 'Communities retrieved successfully',
      data: communities,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (err) {
    console.error('Error fetching communities:', err);
    return createErrorResponse(res, 500, 'FETCH_COMMUNITIES_ERROR', 'Error fetching communities: ' + err.message);
  }
};

// Create a new community
exports.createCommunity = async (req, res) => {
  try {
    const { name, description, maxMembers, contributionFrequency, backupFundPercentage, adminId, settings } = req.body;

    if (!name || !maxMembers || !contributionFrequency || !adminId) {
      return createErrorResponse(res, 400, 'MISSING_FIELDS', 'Missing required fields');
    }

    // Fetch admin user details
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      return createErrorResponse(res, 404, 'ADMIN_NOT_FOUND', 'Admin user not found');
    }

    // Create the community first so we have the community ID
    const newCommunity = new Community({
      name,
      description,
      admin: adminId,
      settings: {
        contributionFrequency,
        maxMembers,
        backupFundPercentage,
        ...settings,
      },
      members: [] // We'll add the admin member ID after creating it
    });
    
    // Save community to get an ID
    await newCommunity.save();
    
    // Create initial member (admin) with communityId
    const adminMember = new Member({
      userId: adminId,
      name: adminUser.name,
      email: adminUser.email,
      position: 1,
      status: 'active',
      penalty: 0,
      missedContributions: [],
      communityId: newCommunity._id, // Set the communityId for the admin member
      joinedAt: new Date() // Explicitly set join date for admin
    });
    await adminMember.save();
    
    // Now add the admin member to the community
    newCommunity.members.push(adminMember._id);

    await newCommunity.syncFirstCycleMin(newCommunity.settings.firstCycleMin || 5);
    await newCommunity.updatePayoutInfo();

    // Create initial activity log
    const activityLog = new CommunityActivityLog({
      communityId: newCommunity._id,
      activityType: 'community_created',
      userId: adminId,
      timestamp: new Date()
    });
    await activityLog.save();
    newCommunity.activityLog.push(activityLog._id);

    // Update admin's user details
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin';
    }
    await adminUser.addCommunity(newCommunity._id, true);
    await adminUser.save();

    // Save final community state
    await newCommunity.save();

    // Fetch the complete community data with populated references
    const populatedCommunity = await Community.findById(newCommunity._id)
      .populate('members')
      .populate('activityLog');

    res.status(201).json({
      status: 'success',
      message: 'Community created successfully',
      data: populatedCommunity
    });
  } catch (err) {
    console.error('Error creating community:', err);
    return createErrorResponse(res, 500, 'CREATE_COMMUNITY_ERROR', 'Error creating community: ' + err.message);
  }
};

// Join a community
exports.joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { userId, name, email, contributionAmount } = req.body;

    if (!userId || !name || !email) {
      return createErrorResponse(res, 400, 'MISSING_FIELDS', 'Missing required fields: userId, name, or email.');
    }

    const community = await Community.findById(communityId).populate('members');
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found.');

    const isAlreadyMember = community.members.some((member) => 
      member.userId.toString() === userId || member.email === email
    );
    if (isAlreadyMember) {
      return createErrorResponse(res, 400, 'ALREADY_MEMBER', 'User is already a member of the community.');
    }

    const isFull = community.members.length >= community.settings.maxMembers;
    if (isFull) {
      return createErrorResponse(res, 400, 'COMMUNITY_FULL', 'Community is full.');
    }

    const currentCycle = await Cycle.findOne({ 
      _id: { $in: community.cycles },
      isComplete: false
    });
    const currentCycleNumber = currentCycle ? currentCycle.cycleNumber : 0;

    if (currentCycleNumber <= 1) {
      const activeMidCycle = await MidCycle.findOne({
        _id: { $in: community.midCycle },
        isComplete: false
      });
      const status = activeMidCycle ? 'waiting' : 'active';

      // Create new member with communityId
      const newMember = new Member({
        userId,
        name,
        email,
        position: null,
        status,
        penalty: 0,
        missedContributions: [],
        communityId: communityId,
        joinedAt: new Date() // Explicitly set join date for admin

      });
      await newMember.save();

      community.members.push(newMember._id);
    } else {
      // Ensure the communityId is set when adding new member during mid-cycle
      await community.addNewMemberMidCycle(userId, name, email, contributionAmount, communityId);
    }

    await community.save();

    const user = await User.findById(userId);
    if (user) {
      const message = currentCycleNumber === 1
        ? `You have joined the community "${community.name}".`
        : `You have joined the community "${community.name}" during a mid-cycle.`;

      await user.addCommunity(communityId);
      await user.save();
    }

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'member_joined',
      userId,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);
    await community.save();

    // Return populated community data
    const populatedCommunity = await Community.findById(community._id)
      .populate('members')
      .populate('activityLog');

    res.status(200).json({
      status: 'success',
      message: 'Successfully joined the community',
      data: populatedCommunity
    });
  } catch (err) {
    console.error('Error in joinCommunity:', err);
    return createErrorResponse(res, 500, 'JOIN_COMMUNITY_ERROR', 'Error joining community: ' + err.message);
  }
};

// Leave a community
exports.leaveCommunity = async (req, res) => {
  try {
    const { communityId, userId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const result = await community.leaveCommunity(userId);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error leaving community:', err);
    return createErrorResponse(res, 500, 'LEAVE_COMMUNITY_ERROR', 'Error leaving community: ' + err.message);
  }
};

// Start a new mid-cycle
exports.startMidCycle = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    // Use the schema's method to handle mid-cycle creation
    await community.startMidCycle();

    res.status(200).json({ message: 'Mid-cycle started successfully' });
  } catch (err) {
    console.error('Error starting mid-cycle:', err);
    return createErrorResponse(res, 500, 'START_MIDCYCLE_ERROR', 'Error starting mid-cycle: ' + err.message);
  }
};

//distribute payouts
exports.distributePayouts = async (req, res) => {
  try {
      const { communityId } = req.params;
      const community = await Community.findById(communityId);
      if (!community) return res.status(404).json({ message: 'Community not found' });

      const result = await community.distributePayouts();
      res.status(200).json(result);
  } catch (err) {
      console.error('Error distributing payouts:', err);
      res.status(500).json({ message: 'Error distributing payouts.', error: err.message });
  }
};
// Finalize a complete cycle
exports.finalizeCycle = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const currentCycle = community.cycles.find((cycle) => !cycle.isComplete);
    if (!currentCycle) return createErrorResponse(res, 400, 'NO_ACTIVE_CYCLE', 'No active cycle to finalize.');

    // Ensure all mid-cycles in the current cycle are complete
    const allMidCyclesComplete = community.midCycle.every(
      (midCycle) => midCycle.cycleNumber === currentCycle.cycleNumber && midCycle.isComplete
    );

    if (!allMidCyclesComplete) {
      return createErrorResponse(res, 400, 'MID_CYCLES_INCOMPLETE', 'Some mid-cycles are incomplete.');
    }

    currentCycle.isComplete = true;
    currentCycle.endDate = new Date();

    await community.save();

    res.status(200).json({ message: 'Cycle finalized successfully', community });
  } catch (err) {
    console.error('Error finalizing cycle:', err);
    return createErrorResponse(res, 500, 'FINALIZE_CYCLE_ERROR', 'Error finalizing cycle: ' + err.message);
  }
};

// Skip payout for defaulters
exports.skipPayoutForDefaulters = async (req, res) => {
  try {
    const { communityId, midCycleId } = req.params;

    // Find and validate community
    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    // Find and validate mid-cycle
    const midCycle = await MidCycle.findOne({
      _id: midCycleId,
      _id: { $in: community.midCycle }
    });
    if (!midCycle) {
      return createErrorResponse(res, 404, 'MIDCYCLE_NOT_FOUND', 'Mid-cycle not found');
    }

    // Find defaulters (members who missed contributions)
    const defaulters = await Member.find({
      _id: { $in: midCycle.missedContributions }
    });

    // Update community backup fund with defaulters' missed contributions
    const totalMissedAmount = defaulters.reduce((total, defaulter) => {
      const missedContribution = defaulter.missedContributions.find(mc => 
        mc.midCycleId.equals(midCycle._id)
      );
      return total + (missedContribution ? missedContribution.amount : 0);
    }, 0);

    community.backupFund += totalMissedAmount;

    // Mark defaulters for penalty
    for (const defaulter of defaulters) {
      defaulter.penalty += community.settings.penalty;
      await defaulter.save();

      // Create notification for defaulter
      const user = await User.findById(defaulter.userId);
      if (user) {
        await user.addNotification(
          'penalty',
          `You have been penalized €${community.settings.penalty} for missing a contribution in community "${community.name}".`,
          community._id
        );
      }
    }

    // Mark mid-cycle as complete
    midCycle.isComplete = true;
    await midCycle.save();

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'defaulters_payout_skipped',
      userId: community.admin,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);
    
    // Save community changes
    await community.save();

    res.status(200).json({
      message: 'Payout skipped for defaulters',
      defaultersCount: defaulters.length,
      totalMissedAmount,
      updatedBackupFund: community.backupFund
    });
  } catch (err) {
    console.error('Error skipping payout for defaulters:', err);
    return createErrorResponse(res, 500, 'SKIP_PAYOUT_ERROR', 'Error skipping payout for defaulters: ' + err.message);
  }
};

// Reactivate a member
exports.reactivateMember = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { contributionAmount } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const result = await community.reactivateMember(userId, contributionAmount);

    // Notify the reactivated member
    const user = await User.findById(userId);
    if (user) {
      await user.addNotification('info', `Your membership has been reactivated in the community "${community.name}".`);
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('Error reactivating member:', err);
    return createErrorResponse(res, 500, 'REACTIVATE_MEMBER_ERROR', 'Error reactivating member: ' + err.message);
  }
};

// Update community settings
exports.updateSettings = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { settings } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    console.log( settings)

    Object.assign(community.settings, settings);

    await community.save();

    res.status(200).json({ message: 'Settings updated successfully', community });
  } catch (err) {
    console.error('Error updating settings:', err);
    return createErrorResponse(res, 500, 'UPDATE_SETTINGS_ERROR', 'Error updating settings: ' + err.message);
  }
};

// Calculate total owed
exports.calculateTotalOwed = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const totalOwed = await calculateTotalOwed(communityId, userId);

    res.status(200).json({ totalOwed });
  } catch (err) {
    console.error('Error calculating total owed:', err);
    return createErrorResponse(res, 500, 'CALCULATE_TOTAL_OWED_ERROR', 'Error calculating total owed: ' + err.message);
  }
};

// Process back payment
exports.processBackPayment = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { paymentAmount } = req.body;

    await processBackPayment(communityId, userId, paymentAmount);

    res.status(200).json({ message: 'Back payment processed successfully.' });
  } catch (err) {
    console.error('Error processing back payment:', err);
    return createErrorResponse(res, 500, 'PROCESS_BACK_PAYMENT_ERROR', 'Error processing back payment: ' + err.message);
  }
};

// Apply resolved votes
exports.applyResolvedVotes = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    await community.applyResolvedVotes();

    res.status(200).json({ message: 'Resolved votes applied successfully.' });
  } catch (err) {
    console.error('Error applying resolved votes:', err);
    return createErrorResponse(res, 500, 'APPLY_RESOLVED_VOTES_ERROR', 'Error applying resolved votes: ' + err.message);
  }
};

// Get mid-cycle contributions
exports.getMidCycleContributions = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Validate that the community exists
    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    // Extract contributions from all mid-cycles
    const midCycleContributions = community.midCycle.map(midCycle => ({
      cycleNumber: midCycle.cycleNumber,
      isComplete: midCycle.isComplete,
      nextInLine: midCycle.nextInLine,
      contributions: midCycle.contributors.map(contributions => ({
        contributorId: contributions.user,
        contributions: contributions.contributions,
      })),
      payoutDate: midCycle.payoutDate,
    }));

    // Check if there are any mid-cycle contributions
    if (!midCycleContributions.length) {
      return createErrorResponse(res, 404, 'NO_MIDCYCLE_CONTRIBUTIONS', 'No mid-cycle contributions found for this community.');
    }

    res.status(200).json({ midCycleContributions });
  } catch (err) {
    console.error('Error fetching mid-cycle contributions:', err);
    return createErrorResponse(res, 500, 'GET_MIDCYCLE_CONTRIBUTIONS_ERROR', 'Server error while fetching mid-cycle contributions: ' + err.message);
  }
};

// Get community by ID
exports.getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate('members')
      .populate('midCycle')
      .populate('cycles')
      .populate('votes')
      .populate('activityLog');
      
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }
    res.status(200).json({ community });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// Get contributions by mid-cycle
exports.getContributionsByMidCycle = async (req, res) => {
  try {
    const { midCycleId } = req.params;

    if (!midCycleId) {
      return createErrorResponse(res, 400, 'MID_CYCLE_ID_REQUIRED', 'Mid-cycle ID is required.');
    }

    // Fetch contributions associated with the midCycleId
    const contributions = await Contribution.find({ midCycleId });

    if (!contributions || contributions.length === 0) {
      return createErrorResponse(res, 404, 'NO_CONTRIBUTIONS_FOUND', 'No contributions found for this mid-cycle.');
    }

    res.status(200).json({ message: 'Contributions fetched successfully.', contributions });
  } catch (err) {
    console.error('Error fetching contributions by mid-cycle:', err);
    return createErrorResponse(res, 500, 'FETCH_CONTRIBUTIONS_ERROR', 'Failed to fetch contributions: ' + err.message);
  }
};

// Get payout info
exports.getPayoutInfo = async (req, res) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId);

    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found.');

    res.status(200).json({
      nextPayout: community.nextPayout,
      payoutDetails: community.payoutDetails,
    });
  } catch (err) {
    console.error('Error fetching payout info:', err);
    return createErrorResponse(res, 500, 'GET_PAYOUT_INFO_ERROR', 'Error fetching payout info: ' + err.message);
  }
};

// Delete a community
exports.deleteCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Find the community by ID
    const community = await Community.findById(communityId);
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    }

    // Check if the requestor is the admin of the community
    const { userId } = req.body; // Assuming userId is sent in the request body
    if (!community.admin.equals(userId)) {
      return createErrorResponse(res, 403, 'UNAUTHORIZED', 'You are not authorized to delete this community.');
    }

    // Remove the community reference from all member profiles
    for (const member of community.members) {
      const user = await User.findById(member.userId);
      if (user) {
        user.communities = user.communities.filter((id) => !id.equals(communityId));
        await user.save();
      }
    }

    // Handle linked wallets (optional: freeze or notify users)
    for (const member of community.members) {
      const wallet = await Wallet.findOne({ userId: member.userId });
      if (wallet) {
        console.log(`Wallet handled for user: ${member.userId}`);
      }
    }

    // Delete the community
    await Community.findByIdAndDelete(communityId);

    res.status(200).json({ message: 'Community deleted successfully.' });
  } catch (err) {
    console.error('Error deleting community:', err);
    return createErrorResponse(res, 500, 'DELETE_COMMUNITY_ERROR', 'Error deleting community: ' + err.message);
  }
};

// Search for communities
exports.searchCommunity = async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const communities = await Community.searchCommunity(keyword);
    res.status(200).json({
      status: 'success',
      message: 'Communities found successfully',
      data: communities
    });
  } catch (err) {
    return createErrorResponse(res, 500, 'SEARCH_ERROR', 'Failed to search communities: ' + err.message);
  }
};

// Filter communities
exports.filterCommunity = async (req, res) => {
  try {
    // Get filter parameters from query (for GET requests)
    const { 
      status, 
      backupFundMin, 
      minContribution, 
      contributionFrequency, 
      sortBy, 
      order,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Add filter conditions based on query parameters
    if (status === 'active') {
      query.cycleState = 'Active';
    }
    
    if (backupFundMin) {
      query.backupFund = { $gte: parseFloat(backupFundMin) };
    }
    
    if (minContribution) {
      query['settings.minContribution'] = { $gte: parseFloat(minContribution) };
    }
    
    if (contributionFrequency) {
      query['settings.contributionFrequency'] = contributionFrequency;
    }

    // Create sort options
    const sortOptions = {};
    if (sortBy) {
      // Handle different sort fields
      const validSortFields = {
        'memberCount': { $size: '$members' },
        'minContribution': 'settings.minContribution',
        'backupFund': 'backupFund',
        'createdAt': 'createdAt'
      };
      
      const sortField = validSortFields[sortBy] || 'createdAt';
      sortOptions[sortField] = order === 'desc' ? -1 : 1;
    } else {
      // Default sort by creation date, newest first
      sortOptions.createdAt = -1;
    }

    // Count total documents for pagination
    const total = await Community.countDocuments(query);
    
    // Execute query with pagination and sorting
    let communitiesQuery = Community.find(query);
    
    // Apply sorting
    if (Object.keys(sortOptions).length > 0) {
      communitiesQuery = communitiesQuery.sort(sortOptions);
    }
    
    // Apply pagination
    communitiesQuery = communitiesQuery
      .skip(skip)
      .limit(parseInt(limit));
    
    // Execute query
    const communities = await communitiesQuery;

    // Return response with pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      message: 'Communities filtered successfully',
      data: communities,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Error filtering communities:', err);
    return createErrorResponse(res, 500, 'FILTER_ERROR', 'Failed to filter communities: ' + err.message);
  }
};

// Pay penalty and missed contributions
exports.payPenaltyAndMissedContribution = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { amount } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const result = await community.payPenaltyAndMissedContribution(userId, amount);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error paying penalty and missed contributions:', err);
    return createErrorResponse(res, 500, 'PENALTY_PAYMENT_ERROR', 'Error paying penalty and missed contributions: ' + err.message);
  }
};

// Skip contribution and mark mid-cycle as ready
exports.skipContributionAndMarkReady = async (req, res) => {
  try {
    const { communityId, midCycleId } = req.params;
    const { userId } = req.body;

    // Find and validate community
    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    // Find and validate mid-cycle
    const midCycle = await MidCycle.findOne({
      _id: midCycleId,
      _id: { $in: community.midCycle }
    });
    if (!midCycle) {
      return createErrorResponse(res, 404, 'MIDCYCLE_NOT_FOUND', 'Mid-cycle not found');
    }

    // Find and validate member
    const member = await Member.findOne({
      _id: { $in: community.members },
      userId
    });
    if (!member) {
      return createErrorResponse(res, 404, 'MEMBER_NOT_FOUND', 'Member not found');
    }

    // Add member to missed contributions
    if (!midCycle.missedContributions) {
      midCycle.missedContributions = [];
    }
    if (!midCycle.missedContributions.includes(member._id)) {
      midCycle.missedContributions.push(member._id);
    }

    // Update member's missed contributions record
    member.missedContributions.push({
      midCycleId: midCycle._id,
      amount: community.settings.minContribution
    });
    await member.save();

    // Mark mid-cycle as ready
    midCycle.isReady = true;
    await midCycle.save();

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'contribution_skipped',
      userId,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);
    await community.save();

    res.status(200).json({
      message: 'Contribution skipped and mid-cycle marked as ready',
      midCycle: await MidCycle.findById(midCycle._id)
    });
  } catch (err) {
    console.error('Error skipping contribution and marking mid-cycle as ready:', err);
    return createErrorResponse(
      res, 
      500, 
      'SKIP_CONTRIBUTION_ERROR', 
      'Error skipping contribution and marking mid-cycle as ready: ' + err.message
    );
  }
};

// Update member information
exports.memberUpdate = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { remainder } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const result = community.memberUpdate(userId, remainder);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error updating member:', err);
    return createErrorResponse(res, 500, 'MEMBER_UPDATE_ERROR', 'Error updating member: ' + err.message);
  }
};

// Pay second installment
exports.paySecondInstallment = async (req, res) => {
  try {
    const { communityId, userId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const result = await community.paySecondInstallment(userId);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error in paySecondInstallment:', err);
    return createErrorResponse(res, 500, 'SECOND_INSTALLMENT_ERROR', 'Error paying second installment: ' + err.message);
  }
};

// Back payment distribute
exports.backPaymentDistribute = async (req, res) => {
  try {
    const { midCycleJoinersId } = req.params;
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found.');
    }

    const result = await community.backPaymentDistribute(midCycleJoinersId);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error in backPaymentDistribute controller:', err);
    return createErrorResponse(res, 500, 'BACK_PAYMENT_DISTRIBUTE_ERROR', 'Internal server error: ' + err.message);
  }
};

// Search mid-cycle joiners
exports.searchMidcycleJoiners = async (req, res) => {
  try {
    const { midCycleJoinersId } = req.params;
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found.');
    }

    const result = community.searchMidcycleJoiners(midCycleJoinersId);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error in searchMidcycleJoiners controller:', err);
    return createErrorResponse(res, 500, 'SEARCH_MIDCYCLE_JOINERS_ERROR', 'Internal server error: ' + err.message);
  }
};

// Create a new vote
exports.createVote = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { topic, options } = req.body;

    if (!topic || !options || !Array.isArray(options) || options.length === 0) {
      return createErrorResponse(res, 400, 'INVALID_VOTE_DATA', 'Invalid vote data. Topic and options are required.');
    }

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    // Create new vote document
    const vote = new CommunityVote({
      communityId,
      topic,
      options,
      votes: [],
      numVotes: 0,
      resolved: false,
      resolution: null,
      applied: false
    });
    await vote.save();

    // Add vote reference to community
    community.votes.push(vote._id);

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'vote_created',
      userId: community.admin,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);

    await community.save();

    res.status(200).json({
      message: 'Vote created successfully',
      vote: await CommunityVote.findById(vote._id)
    });
  } catch (err) {
    console.error('Error creating vote:', err);
    return createErrorResponse(res, 500, 'CREATE_VOTE_ERROR', 'Error creating vote: ' + err.message);
  }
};

// Cast a vote
exports.castVote = async (req, res) => {
  try {
    const { communityId, voteId } = req.params;
    const { userId, choice } = req.body;

    if (!userId || !choice) {
      return createErrorResponse(res, 400, 'INVALID_VOTE_DATA', 'Invalid vote data. User ID and choice are required.');
    }

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const vote = await CommunityVote.findById(voteId);
    if (!vote) return createErrorResponse(res, 404, 'VOTE_NOT_FOUND', 'Vote not found');

    if (vote.resolved) {
      return createErrorResponse(res, 400, 'VOTE_RESOLVED', 'This vote has already been resolved');
    }

    // Check if user is a member of the community
    const isMember = community.members.some(member => member.userId.equals(userId));
    if (!isMember) {
      return createErrorResponse(res, 403, 'NOT_MEMBER', 'Only community members can vote');
    }

    // Update or add the vote
    const existingVoteIndex = vote.votes.findIndex(v => v.userId.equals(userId));
    if (existingVoteIndex !== -1) {
      vote.votes[existingVoteIndex].choice = choice;
    } else {
      vote.votes.push({ userId, choice });
    }
    vote.numVotes = vote.votes.length;
    await vote.save();

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'vote_cast',
      userId,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);
    await community.save();

    res.status(200).json({
      message: 'Vote cast successfully',
      vote: await CommunityVote.findById(voteId)
    });
  } catch (err) {
    console.error('Error casting vote:', err);
    return createErrorResponse(res, 500, 'CAST_VOTE_ERROR', 'Error casting vote: ' + err.message);
  }
};

// Resolve a vote
exports.resolveVote = async (req, res) => {
  try {
    const { communityId, voteId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const vote = await CommunityVote.findById(voteId);
    if (!vote) return createErrorResponse(res, 404, 'VOTE_NOT_FOUND', 'Vote not found');

    const voteCounts = vote.votes.reduce((acc, v) => {
      acc[v.choice] = (acc[v.choice] || 0) + 1;
      return acc;
    }, {});

    const resolution = Object.keys(voteCounts).reduce((a, b) => 
      (voteCounts[a] > voteCounts[b] ? a : b)
    );

    vote.resolved = true;
    vote.resolution = resolution;
    await vote.save();

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'vote_resolved',
      userId: community.admin,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);
    await community.save();

    res.status(200).json({
      message: 'Vote resolved successfully',
      vote: await CommunityVote.findById(voteId)
    });
  } catch (err) {
    console.error('Error resolving vote:', err);
    return createErrorResponse(res, 500, 'RESOLVE_VOTE_ERROR', 'Error resolving vote: ' + err.message);
  }
};

// Handle wallet operations for defaulters
exports.handleWalletForDefaulters = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { action } = req.body; // 'freeze' or 'deduct'

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    const result = await community.handleWalletForDefaulters(userId, action);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error handling wallet for defaulters:', err);
    return createErrorResponse(res, 500, 'WALLET_DEFAULTERS_ERROR', 'Error handling wallet for defaulters: ' + err.message);
  }
};

// Start a new cycle
exports.startNewCycle = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');

    // Ensure the current cycle is complete
    const activeCycle = await Cycle.findOne({ 
      _id: { $in: community.cycles }, 
      isComplete: false 
    });
    if (activeCycle) {
      throw new Error('Cannot start a new cycle until the current cycle is complete.');
    }

    // Determine the new cycle number
    const newCycleNumber = (community.cycles.length > 0) ? 
      (await Cycle.findById(community.cycles[community.cycles.length - 1])).cycleNumber + 1 : 1;

    // Resolve all unresolved votes
    const unresolvedVotes = await CommunityVote.find({
      _id: { $in: community.votes },
      resolved: false
    });

    // Handle unresolved votes
    for (const vote of unresolvedVotes) {
      await community.resolveVote(vote._id);
    }

    // Apply resolved votes
    await community.applyResolvedVotes();

    // Create a new cycle
    const newCycle = new Cycle({
      cycleNumber: newCycleNumber,
      midCycles: [],
      isComplete: false,
      startDate: new Date(),
      paidMembers: []
    });
    await newCycle.save();

    // Add the cycle to the community
    community.cycles.push(newCycle._id);

    // Clear activity log for new cycle
    community.activityLog = [];

    // Update member positions based on positioning mode
    const members = await Member.find({ _id: { $in: community.members } });
    if (community.positioningMode === 'Random') {
      const positions = Array.from({ length: members.length }, (_, i) => i + 1);
      members.forEach(member => {
        const randomIndex = Math.floor(Math.random() * positions.length);
        member.position = positions.splice(randomIndex, 1)[0];
      });
    } else {
      members.sort((a, b) => a.userId.toString().localeCompare(b.userId.toString()));
      members.forEach((member, index) => {
        member.position = index + 1;
      });
    }

    // Save updated members
    await Promise.all(members.map(member => member.save()));

    // Start the first mid-cycle
    await community.startMidCycle();
    
    // Update payout info
    await community.updatePayoutInfo();

    // Create activity log
    const activityLog = new CommunityActivityLog({
      communityId: community._id,
      activityType: 'start_new_cycle',
      userId: community.admin,
      timestamp: new Date()
    });
    await activityLog.save();
    community.activityLog.push(activityLog._id);

    // Save all changes
    await community.save();

    // Return populated result
    const populatedCommunity = await Community.findById(community._id)
      .populate('members')
      .populate('cycles')
      .populate('midCycle')
      .populate('votes')
      .populate('activityLog');

    res.status(200).json({
      message: 'New cycle started successfully',
      community: populatedCommunity
    });
  } catch (err) {
    console.error('Error starting new cycle:', err);
    return createErrorResponse(res, 500, 'START_NEW_CYCLE_ERROR', 'Error starting new cycle: ' + err.message);
  }
};

// Get midcycle by ID
exports.getMidcycleById = async (req, res) => {
  try {
    const { communityId, midcycleId } = req.params;
    
    // Find the community
    const community = await Community.findById(communityId);
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    }
    
    console.log(`Fetching midcycle ${midcycleId} for community ${communityId}`);
    
    // Find the midcycle in the community, using correct field name "contributions.user" instead of "contributors.user"
    const midcycle = await MidCycle.findOne({
      _id: midcycleId,
      _id: { $in: community.midCycle }
    }).populate('contributions.user');
    
    if (!midcycle) {
      return createErrorResponse(res, 404, 'MIDCYCLE_NOT_FOUND', 'Mid-cycle not found');
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Mid-cycle retrieved successfully',
      data: midcycle
    });
  } catch (err) {
    console.error('Error fetching mid-cycle:', err);
    return createErrorResponse(res, 500, 'GET_MIDCYCLE_ERROR', 'Error retrieving mid-cycle: ' + err.message);
  }
};
