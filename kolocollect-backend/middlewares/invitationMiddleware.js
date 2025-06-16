const { body, param, query, validationResult } = require('express-validator');
const { validateInviteCode: validateInviteCodeFormat } = require('../utils/inviteCodeGenerator');
const User = require('../models/User');
const Community = require('../models/Community');
const CommunityMembership = require('../models/CommunityMembership');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

/**
 * Validation rules for creating invitations
 */
const validateInvitationCreation = [
  body('inviteType')
    .isIn(['email', 'phone', 'link'])
    .withMessage('Invite type must be one of: email, phone, link'),
  
  body('inviteeEmail')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .custom((value, { req }) => {
      if (req.body.inviteType === 'email' && !value) {
        throw new Error('Email is required for email invitations');
      }
      return true;
    }),
  
  body('inviteePhone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
    .custom((value, { req }) => {
      if (req.body.inviteType === 'phone' && !value) {
        throw new Error('Phone number is required for phone invitations');
      }
      return true;
    }),
  
  body('customMessage')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Custom message must not exceed 500 characters')
    .trim()
    .escape(),
  
  body('expiresIn')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Expiration must be between 1 and 30 days'),
  
  handleValidationErrors
];

/**
 * Validation rules for invitation code parameters
 */
const validateInviteCode = [
  param('inviteCode')
    .custom((value) => {
      if (!validateInviteCodeFormat(value)) {
        throw new Error('Invalid invitation code format');
      }
      return true;
    })
    .withMessage('Invalid invitation code'),
  
  handleValidationErrors
];

/**
 * Validation rules for community ID parameters
 */
const validateCommunityId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid community ID format'),
  
  handleValidationErrors
];

/**
 * Validation rules for invitation listing queries
 */
const validateInvitationQuery = [
  query('status')
    .optional()
    .isIn(['pending', 'accepted', 'expired', 'rejected', 'cancelled'])
    .withMessage('Invalid status filter'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('inviterId')
    .optional()
    .isMongoId()
    .withMessage('Invalid inviter ID format'),
  
  handleValidationErrors
];

/**
 * Validation rules for accepting invitations
 */
const validateInvitationAcceptance = [
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID format'),
  
  handleValidationErrors
];

/**
 * Validation rules for updating invitation status
 */
const validateInvitationUpdate = [
  body('status')
    .isIn(['cancelled', 'rejected'])
    .withMessage('Status can only be updated to cancelled or rejected'),
  
  body('reason')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Reason must not exceed 200 characters')
    .trim()
    .escape(),
  
  handleValidationErrors
];

/**
 * Sanitize invitation data
 */
const sanitizeInvitationData = (req, res, next) => {
  if (req.body.customMessage) {
    req.body.customMessage = req.body.customMessage.trim();
  }
  
  if (req.body.inviteeEmail) {
    req.body.inviteeEmail = req.body.inviteeEmail.toLowerCase().trim();
  }
  
  if (req.body.inviteePhone) {
    req.body.inviteePhone = req.body.inviteePhone.replace(/\D/g, ''); // Remove non-digits
  }
  
  next();
};

/**
 * Validate user permissions for invitation operations
 */
const validateInvitationPermissions = async (req, res, next) => {
  try {
    const { id: communityId } = req.params;
    const userId = req.user.id;

    // Find the community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is admin or creator of the community
    // Method 1: Check if user is the community creator (using admin field as creator)
    const isAdmin = community.admin && community.admin.toString() === userId.toString();
    
    // Method 2: Check user's communities array for this community with admin role
    const user = await User.findById(userId);
    let isAdminFromUserCommunities = false;
    if (user && user.communities) {
      const membership = user.communities.find(c => 
        c.id && c.id.toString() === communityId.toString()
      );
      isAdminFromUserCommunities = membership && membership.isAdmin === true;
    }

    if (isAdmin || isAdminFromUserCommunities) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage invitations for this community'
      });
    }
  } catch (error) {
    console.error('Error in validateInvitationPermissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate invitation ownership for modification operations
 */
const validateInvitationOwnership = async (req, res, next) => {
  try {
    const Invitation = require('../models/Invitation');
    const CommunityMembership = require('../models/CommunityMembership');
    const invitationId = req.params.invitationId || req.params.id;
    const userId = req.user.id;

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    // Check if user is the inviter or community admin
    const isInviter = invitation.inviterId.toString() === userId;
    const membership = await CommunityMembership.findOne({
      communityId: invitation.communityId,
      userId,
      role: { $in: ['admin', 'creator'] }
    });

    if (!isInviter && !membership) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You can only modify invitations you created or as a community admin'
      });
    }

    req.invitation = invitation;
    next();
  } catch (error) {
    console.error('Ownership validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Ownership validation failed',
      message: 'An error occurred while validating invitation ownership'
    });
  }
};

module.exports = {
  validateInvitationCreation,
  validateInviteCode,
  validateCommunityId,
  validateInvitationQuery,
  validateInvitationAcceptance,
  validateInvitationUpdate,
  sanitizeInvitationData,
  validateInvitationPermissions,
  validateInvitationOwnership,
  handleValidationErrors
};
