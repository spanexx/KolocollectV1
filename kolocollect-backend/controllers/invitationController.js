const invitationService = require('../services/invitationService');
const { logger } = require('../middlewares/correlationMiddleware');

class InvitationController {
  /**
   * Create a new invitation
   * POST /api/invitations
   * POST /api/communities/:id/invitations
   */
  async createInvitation(req, res) {
    try {
      const {
        inviteType,
        inviteeEmail,
        inviteePhone,
        customMessage,
        expiresIn
      } = req.body;

      const communityId = req.params.id || req.body.communityId;
      const inviterId = req.user.id;

      const invitationData = {
        communityId,
        inviterId,
        inviteType,
        inviteeEmail,
        inviteePhone,
        customMessage,
        expiresIn,
        metadata: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          source: req.body.source || 'web'
        }
      };

      const invitation = await invitationService.createInvitation(invitationData);

      logger.info('Invitation created successfully', {
        invitationId: invitation._id,
        communityId,
        inviterId,
        inviteType
      });

      res.status(201).json({
        success: true,
        message: 'Invitation created successfully',
        data: {
          invitationId: invitation._id,
          inviteCode: invitation.inviteCode,
          inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/invite/${invitation.inviteCode}`,
          expiresAt: invitation.expiresAt,
          status: invitation.status
        }
      });
    } catch (error) {
      logger.error('Error creating invitation', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        communityId: req.params.id
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('admin') || error.message.includes('member') ? 403 :
                        error.message.includes('already') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to create invitation',
        message: error.message
      });
    }
  }

  /**
   * Get invitations for a community
   * GET /api/communities/:id/invitations
   */
  async getCommunityInvitations(req, res) {
    try {
      const communityId = req.params.id;
      const { status, inviterId, page = 1, limit = 10 } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (inviterId) filters.inviterId = inviterId;

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100) // Cap at 100
      };

      const result = await invitationService.getCommunityInvitations(
        communityId,
        filters,
        pagination
      );

      // Get invitation statistics
      const stats = await invitationService.getInvitationStats(communityId);

      res.json({
        success: true,
        data: {
          invitations: result.invitations,
          pagination: result.pagination,
          statistics: stats
        }
      });
    } catch (error) {
      logger.error('Error fetching community invitations', {
        error: error.message,
        communityId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch invitations',
        message: error.message
      });
    }
  }

  /**
   * Get invitation by code (public endpoint)
   * GET /api/invitations/:inviteCode
   */
  async getInvitationByCode(req, res) {
    try {
      const { inviteCode } = req.params;

      const invitation = await invitationService.getInvitationByCode(inviteCode);

      res.json({
        success: true,
        data: {
          invitation: {
            id: invitation._id,
            community: {
              id: invitation.communityId._id,
              name: invitation.communityId.name,
              description: invitation.communityId.description,
              memberCount: invitation.communityId.memberCount,
              maxMembers: invitation.communityId.maxMembers
            },
            inviter: {
              name: invitation.inviterId.name
            },
            customMessage: invitation.customMessage,
            expiresAt: invitation.expiresAt,
            status: invitation.status
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching invitation by code', {
        error: error.message,
        inviteCode: req.params.inviteCode
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('expired') ? 410 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to fetch invitation',
        message: error.message
      });
    }
  }

  /**
   * Accept invitation (public endpoint)
   * POST /api/invitations/:inviteCode/accept
   */
  async acceptInvitation(req, res) {
    try {
      const { inviteCode } = req.params;
      const { userId } = req.body;

      // If no userId provided, user needs to register/login first
      if (!userId && !req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please login or register to accept this invitation',
          requiresAuth: true
        });
      }

      const acceptingUserId = userId || req.user?.id;
      const result = await invitationService.acceptInvitation(inviteCode, acceptingUserId);

      logger.info('Invitation accepted successfully', {
        inviteCode,
        userId: acceptingUserId,
        communityId: result.community.id
      });

      res.json({
        success: true,
        message: 'Invitation accepted successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error accepting invitation', {
        error: error.message,
        inviteCode: req.params.inviteCode,
        userId: req.body.userId || req.user?.id
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('cannot be accepted') || error.message.includes('expired') ? 410 :
                        error.message.includes('already a member') ? 409 :
                        error.message.includes('maximum') ? 409 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to accept invitation',
        message: error.message
      });
    }
  }

  /**
   * Update invitation status (cancel, reject)
   * PUT /api/invitations/:inviteCode
   */
  async updateInvitationStatus(req, res) {
    try {
      const { inviteCode } = req.params;
      const { status, reason } = req.body;
      const userId = req.user.id;

      let result;
      if (status === 'cancelled') {
        result = await invitationService.cancelInvitation(req.invitation._id, userId);
      } else {
        // For future implementation of rejection functionality
        throw new Error('Status update not implemented');
      }

      logger.info('Invitation status updated', {
        inviteCode,
        status,
        userId,
        reason
      });

      res.json({
        success: true,
        message: `Invitation ${status} successfully`,
        data: result
      });
    } catch (error) {
      logger.error('Error updating invitation status', {
        error: error.message,
        inviteCode: req.params.inviteCode,
        status: req.body.status,
        userId: req.user?.id
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 :
                        error.message.includes('Only') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to update invitation',
        message: error.message
      });
    }
  }

  /**
   * Resend invitation
   * POST /api/invitations/:invitationId/resend
   */
  async resendInvitation(req, res) {
    try {
      const { invitationId } = req.params;
      const userId = req.user.id;

      const result = await invitationService.resendInvitation(invitationId, userId);

      logger.info('Invitation resent successfully', {
        invitationId,
        userId
      });

      res.json({
        success: true,
        message: 'Invitation resent successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error resending invitation', {
        error: error.message,
        invitationId: req.params.invitationId,
        userId: req.user?.id
      });

      const statusCode = error.message.includes('not found') ? 404 :
                        error.message.includes('Unauthorized') ? 403 :
                        error.message.includes('Only') ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        error: 'Failed to resend invitation',
        message: error.message
      });
    }
  }

  /**
   * Get invitation statistics for a community
   * GET /api/communities/:id/invitations/stats
   */
  async getInvitationStats(req, res) {
    try {
      const communityId = req.params.id;
      const stats = await invitationService.getInvitationStats(communityId);

      res.json({
        success: true,
        data: {
          statistics: stats
        }
      });
    } catch (error) {
      logger.error('Error fetching invitation statistics', {
        error: error.message,
        communityId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  }

  /**
   * Delete/cleanup expired invitations (admin only)
   * DELETE /api/invitations/cleanup
   */
  async cleanupExpiredInvitations(req, res) {
    try {
      // This should be restricted to admin users or scheduled tasks
      const cleanedCount = await invitationService.cleanupExpiredInvitations();

      logger.info('Expired invitations cleaned up', {
        count: cleanedCount,
        userId: req.user?.id
      });

      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired invitations`,
        data: {
          cleanedCount
        }
      });
    } catch (error) {
      logger.error('Error cleaning up expired invitations', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired invitations',
        message: error.message
      });
    }
  }
}

module.exports = new InvitationController();
