const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middlewares/authMiddleware');
const {
  validateInvitationCreation,
  validateInviteCode,
  validateInvitationQuery,
  validateInvitationAcceptance,
  validateInvitationUpdate,
  sanitizeInvitationData,
  validateInvitationOwnership
} = require('../middlewares/invitationMiddleware');
const {
  invitationCreationLimiter,
  invitationAcceptanceLimiter,
  invitationListingLimiter,
  invitationResendLimiter,
  generalInvitationLimiter
} = require('../middlewares/rateLimitMiddleware');

/**
 * Core invitation routes
 */

// Create invitation (general endpoint)
router.post('/',
  generalInvitationLimiter,
  invitationCreationLimiter,
  authMiddleware,
  sanitizeInvitationData,
  validateInvitationCreation,
  invitationController.createInvitation
);

// Get invitation by code (public endpoint - no auth required)
router.get('/:inviteCode',
  generalInvitationLimiter,
  validateInviteCode,
  invitationController.getInvitationByCode
);

// Accept invitation (public endpoint - auth optional)
router.post('/:inviteCode/accept',
  generalInvitationLimiter,
  invitationAcceptanceLimiter,
  validateInviteCode,
  validateInvitationAcceptance,
  // Optional auth middleware - allows both authenticated and unauthenticated users
  (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      // If token provided, validate it
      authMiddleware(req, res, next);
    } else {
      // If no token, continue without authentication
      next();
    }
  },
  invitationController.acceptInvitation
);

// Update invitation status (cancel, reject)
router.put('/:inviteCode',
  generalInvitationLimiter,
  authMiddleware,
  validateInviteCode,
  validateInvitationUpdate,
  validateInvitationOwnership,
  invitationController.updateInvitationStatus
);

// Resend invitation
router.post('/:invitationId/resend',
  generalInvitationLimiter,
  invitationResendLimiter,
  authMiddleware,
  validateInvitationOwnership,
  invitationController.resendInvitation
);

// Cleanup expired invitations (admin/system endpoint)
router.delete('/cleanup',
  authMiddleware,
  // TODO: Add admin role check middleware
  invitationController.cleanupExpiredInvitations
);

module.exports = router;
