const Invitation = require('../models/Invitation');
const Community = require('../models/Community');
const User = require('../models/User');
const CommunityMembership = require('../models/CommunityMembership');
const emailService = require('./emailService');
const { generateUniqueInviteCode } = require('../utils/inviteCodeGenerator');

class InvitationService {
  /**
   * Create a new invitation
   * @param {Object} invitationData - Invitation data
   * @returns {Promise<Object>} - Created invitation
   */
  async createInvitation(invitationData) {
    const {
      communityId,
      inviterId,
      inviteType,
      inviteeEmail,
      inviteePhone,
      customMessage,
      expiresIn = 7, // days
      metadata = {}
    } = invitationData;

    // Validate community exists and inviter is admin
    const community = await Community.findById(communityId);
    if (!community) {
      throw new Error('Community not found');
    }    // Validate that the inviter has admin permissions
    if (!community) {
      throw new Error('Community not found');
    }

    // Check if user is admin or creator of the community
    const isAdmin = community.admin && community.admin.toString() === inviterId.toString();
    
    // Check user's communities array for this community with admin role
    const inviterUser = await User.findById(inviterId);
    let isAdminFromUserCommunities = false;
    if (inviterUser && inviterUser.communities) {
      const membership = inviterUser.communities.find(c => 
        c.id && c.id.toString() === communityId.toString()
      );
      isAdminFromUserCommunities = membership && membership.isAdmin === true;
    }

    if (!isAdmin && !isAdminFromUserCommunities) {
      throw new Error('Only community admins can send invitations');
    }    // Check if user is already a member
    if (inviteeEmail) {
      const existingUser = await User.findOne({ email: inviteeEmail });
      if (existingUser) {
        // Check if user is already in the community's members array or user's communities array
        const isMemberInCommunity = community.members && community.members.includes(existingUser._id);
        const isMemberInUser = existingUser.communities && existingUser.communities.some(c => 
          c.id && c.id.toString() === communityId.toString()
        );
        
        if (isMemberInCommunity || isMemberInUser) {
          throw new Error('User is already a member of this community');
        }
      }

      // Check for existing pending invitation
      const existingInvitation = await Invitation.findOne({
        communityId,
        inviteeEmail,
        status: 'pending'
      });

      if (existingInvitation) {
        throw new Error('Invitation already sent to this email address');
      }
    }

    // Generate unique invite code
    const inviteCode = await generateUniqueInviteCode(async (code) => {
      const existing = await Invitation.findOne({ inviteCode: code });
      return !existing;
    });

    // Set expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    // Create invitation
    const invitation = new Invitation({
      communityId,
      inviterId,
      inviteCode,
      inviteType,
      inviteeEmail,
      inviteePhone,
      status: 'pending',
      customMessage,
      expiresAt,
      metadata
    });

    await invitation.save();

    // Send email invitation if email is provided
    if (inviteType === 'email' && inviteeEmail) {
      await this.sendInvitationEmail(invitation._id);
    }

    // Populate invitation with related data
    await invitation.populate([
      { path: 'inviterId', select: 'name email' },
      { path: 'communityId', select: 'name description' }
    ]);

    return invitation;
  }

  /**
   * Send invitation email
   * @param {string} invitationId - Invitation ID
   * @returns {Promise<Object>} - Email sending result
   */
  async sendInvitationEmail(invitationId) {
    const invitation = await Invitation.findById(invitationId)
      .populate('inviterId', 'name email')
      .populate('communityId', 'name description');

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (!invitation.inviteeEmail) {
      throw new Error('No email address provided for invitation');
    }

    const emailData = {
      to: invitation.inviteeEmail,
      communityName: invitation.communityId.name,
      inviterName: invitation.inviterId.name,
      inviteCode: invitation.inviteCode,
      customMessage: invitation.customMessage,
      expirationDate: invitation.expiresAt
    };

    return await emailService.sendInvitationEmail(emailData);
  }

  /**
   * Get invitations for a community
   * @param {string} communityId - Community ID
   * @param {Object} filters - Filters for invitations
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Paginated invitations
   */
  async getCommunityInvitations(communityId, filters = {}, pagination = {}) {
    const { status, inviterId } = filters;
    const { page = 1, limit = 10 } = pagination;

    const query = { communityId };
    
    if (status) {
      query.status = status;
    }
    
    if (inviterId) {
      query.inviterId = inviterId;
    }

    const skip = (page - 1) * limit;

    const [invitations, totalCount] = await Promise.all([
      Invitation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('inviterId', 'name email')
        .populate('acceptedBy', 'name email'),
      Invitation.countDocuments(query)
    ]);

    return {
      invitations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit
      }
    };
  }

  /**
   * Get invitation by code
   * @param {string} inviteCode - Invitation code
   * @returns {Promise<Object>} - Invitation data
   */
  async getInvitationByCode(inviteCode) {
    const invitation = await Invitation.findOne({ inviteCode })
      .populate('communityId', 'name description memberCount maxMembers')
      .populate('inviterId', 'name email');

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Check if invitation is expired
    if (invitation.isExpired) {
      invitation.status = 'expired';
      await invitation.save();
      throw new Error('Invitation has expired');
    }

    return invitation;
  }

  /**
   * Accept invitation
   * @param {string} inviteCode - Invitation code
   * @param {string} userId - User ID accepting the invitation
   * @returns {Promise<Object>} - Result of acceptance
   */  async acceptInvitation(inviteCode, userId) {
    const invitation = await Invitation.findOne({ inviteCode })
      .populate('communityId');

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (!invitation.canBeAccepted()) {
      throw new Error('Invitation cannot be accepted (expired or already used)');
    }

    const community = invitation.communityId;
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    const isMemberInCommunity = community.members && community.members.includes(userId);
    const isMemberInUser = user.communities && user.communities.some(c => 
      c.id && c.id.toString() === community._id.toString()
    );
    
    if (isMemberInCommunity || isMemberInUser) {
      throw new Error('User is already a member of this community');
    }

    // Check community member limits  
    if (community.settings && community.settings.maxMembers && community.members && community.members.length >= community.settings.maxMembers) {
      throw new Error('Community has reached its maximum member limit');
    }

    // Add user to community's members array
    await Community.findByIdAndUpdate(
      community._id,
      { 
        $addToSet: { members: userId }
      }
    );

    // Add community to user's communities array
    await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          communities: {
            id: community._id,
            isAdmin: false
          }
        }
      }
    );

    // Update invitation status
    await invitation.accept(userId);

    return {
      success: true,
      community: {
        id: community._id,
        name: community.name,
        description: community.description
      },
      membership: {
        userId,
        role: 'member',
        joinedAt: new Date()
      }
    };
  }

  /**
   * Cancel invitation
   * @param {string} invitationId - Invitation ID
   * @param {string} requesterId - User ID requesting cancellation
   * @returns {Promise<Object>} - Cancellation result
   */  async cancelInvitation(invitationId, requesterId) {
    const invitation = await Invitation.findById(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Check if requester is the inviter or community admin
    const community = await Community.findById(invitation.communityId);
    const requesterUser = await User.findById(requesterId);
    
    const isAdmin = community.admin && community.admin.toString() === requesterId.toString();
    const isAdminFromUserCommunities = requesterUser.communities && requesterUser.communities.some(c => 
      c.id && c.id.toString() === invitation.communityId.toString() && c.isAdmin === true
    );
    const isInviter = invitation.inviterId.toString() === requesterId;

    if (!isAdmin && !isAdminFromUserCommunities && !isInviter) {
      throw new Error('Unauthorized to cancel this invitation');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Only pending invitations can be cancelled');
    }

    invitation.status = 'cancelled';
    await invitation.save();

    return { success: true, message: 'Invitation cancelled successfully' };
  }

  /**
   * Resend invitation
   * @param {string} invitationId - Invitation ID
   * @param {string} requesterId - User ID requesting resend
   * @returns {Promise<Object>} - Resend result
   */
  async resendInvitation(invitationId, requesterId) {
    const invitation = await Invitation.findById(invitationId);

    if (!invitation) {
      throw new Error('Invitation not found');
    }    // Check if requester is the inviter or community admin
    const community = await Community.findById(invitation.communityId);
    const requesterUser = await User.findById(requesterId);
    
    const isAdmin = community.admin && community.admin.toString() === requesterId.toString();
    const isAdminFromUserCommunities = requesterUser.communities && requesterUser.communities.some(c => 
      c.id && c.id.toString() === invitation.communityId.toString() && c.isAdmin === true
    );
    const isInviter = invitation.inviterId.toString() === requesterId;

    if (!isAdmin && !isAdminFromUserCommunities && !isInviter) {
      throw new Error('Unauthorized to resend this invitation');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Only pending invitations can be resent');
    }

    // Extend expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    invitation.expiresAt = expiresAt;
    await invitation.save();

    // Send email if email invitation
    if (invitation.inviteType === 'email' && invitation.inviteeEmail) {
      await this.sendInvitationEmail(invitation._id);
    }

    return { success: true, message: 'Invitation resent successfully' };
  }

  /**
   * Get invitation statistics for a community
   * @param {string} communityId - Community ID
   * @returns {Promise<Object>} - Invitation statistics
   */
  async getInvitationStats(communityId) {
    const stats = await Invitation.aggregate([
      { $match: { communityId: communityId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      pending: 0,
      accepted: 0,
      expired: 0,
      cancelled: 0,
      rejected: 0
    };

    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });

    return result;
  }

  /**
   * Clean up expired invitations
   * @returns {Promise<number>} - Number of cleaned up invitations
   */
  async cleanupExpiredInvitations() {
    const expiredInvitations = await Invitation.find({
      status: 'pending',
      expiresAt: { $lt: new Date() }
    });

    const updateResult = await Invitation.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      { status: 'expired' }
    );

    console.log(`Cleaned up ${updateResult.modifiedCount} expired invitations`);
    return updateResult.modifiedCount;
  }
}

module.exports = new InvitationService();
