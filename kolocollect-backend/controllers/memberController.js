const Member = require('../models/Member');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const { QueryOptimizer } = require('../utils/queryOptimizer');

// Get all members
exports.getAllMembers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Use optimized query
    const members = await QueryOptimizer.getMembers({}, {
      populate: true,
      limit,
      skip,
      sort: { joinedAt: -1 }
    });
      
    const total = await Member.countDocuments();
    
    return res.status(200).json({
      status: 'success',
      data: members,
      pagination: {
        totalItems: total,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving members',
      error: error.message
    });
  }
};

// Get members by community ID
exports.getMembersByCommunityId = async (req, res) => {
  try {
    const { communityId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid community ID format'
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Use optimized query
    const members = await QueryOptimizer.getMembers(
      { communityId }, 
      {
        populate: true,
        limit,
        skip,
        sort: { position: 1 }
      }
    );
      
    const total = await Member.countDocuments({ communityId });
    
    return res.status(200).json({
      status: 'success',
      data: members,
      pagination: {
        totalItems: total,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving members by community ID',
      error: error.message
    });
  }
};

// Get member by ID
exports.getMemberById = async (req, res) => {
  try {
    const { memberId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid member ID format'
      });
    }
    
    const member = await Member.findById(memberId)
      .populate('userId', 'name email')
      .populate('communityId', 'name');
    
    if (!member) {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: member
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving member',
      error: error.message
    });
  }
};

// Update member status
exports.updateMemberStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errors.array()
      });
    }
    
    const { memberId } = req.params;
    const { status } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid member ID format'
      });
    }
    
    const allowedStatuses = ['active', 'inactive', 'waiting'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid status value'
      });
    }
    
    const member = await Member.findByIdAndUpdate(
      memberId,
      { status },
      { new: true, runValidators: true }
    ).populate('userId', 'name email');
    
    if (!member) {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      message: 'Member status updated successfully',
      data: member
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error updating member status',
      error: error.message
    });
  }
};

// Get active member count by community ID
exports.getActiveMemberCount = async (req, res) => {
  try {
    const { communityId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid community ID format'
      });
    }
    
    const count = await Member.countDocuments({
      communityId,
      status: 'active'
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        communityId,
        activeMembers: count
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving active member count',
      error: error.message
    });
  }
};

// Get active member counts for multiple communities in one batch request
exports.getBatchActiveMemberCounts = async (req, res) => {
  try {
    const { communityIds } = req.body;
    
    if (!communityIds || !Array.isArray(communityIds) || communityIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an array of community IDs'
      });
    }
    
    // Validate all community IDs
    for (const communityId of communityIds) {
      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid community ID format: ${communityId}`
        });
      }
    }
    
    // Get counts for all communities in one aggregation query
    const results = await Member.aggregate([
      {
        $match: {
          communityId: { $in: communityIds.map(id => new mongoose.Types.ObjectId(id)) },
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$communityId',
          activeMembers: { $sum: 1 }
        }
      }
    ]);
    
    // Convert results to a map for easier access
    const countsMap = {};
    results.forEach(result => {
      countsMap[result._id.toString()] = result.activeMembers;
    });
    
    // Ensure all requested communities are included in the response, even if they have 0 members
    const responseCounts = communityIds.map(communityId => ({
      communityId,
      activeMembers: countsMap[communityId] || 0
    }));
    
    return res.status(200).json({
      status: 'success',
      data: responseCounts
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving batch active member counts',
      error: error.message
    });
  }
};
