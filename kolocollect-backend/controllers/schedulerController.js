const Community = require('../models/Community');
const MidCycle = require('../models/Midcycle');
const Member = require('../models/Member');
const mongoose = require('mongoose');

/**
 * Controller to get scheduler monitoring information
 */
const schedulerController = {
  /**
   * Get payout status for all communities
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} JSON response with community payout information
   */
  getPayoutStatus: async (req, res) => {
    try {
      // Fetch all communities with their active mid-cycles
      const allCommunities = await Community.find()
        .populate({
          path: 'midCycle',
          match: { isComplete: false }
        })
        .populate('admin', 'name email'); // Include admin info for notifications
      
      const now = new Date();
      
      // Process communities for status information
      const communitiesWithPayoutInfo = await Promise.all(
        allCommunities.map(async (community) => {
          const activeMidCycle = community.midCycle && community.midCycle.length > 0 ? 
            community.midCycle[0] : null;
          
          if (!activeMidCycle) {
            return {
              id: community._id,
              name: community.name,
              hasActiveMidCycle: false,
              status: 'No active mid-cycle',
              admin: community.admin
            };
          }
          
          // Get payment recipient info if available
          let nextInLineInfo = null;
          if (activeMidCycle.nextInLine && activeMidCycle.nextInLine.userId) {
            const member = await Member.findOne({
              communityId: community._id,
              userId: activeMidCycle.nextInLine.userId
            }).populate('userId', 'name email');
            
            if (member) {
              nextInLineInfo = {
                id: member.userId._id,
                name: member.userId.name,
                email: member.userId.email
              };
            }
          }
          
          // Calculate countdown
          const payoutDate = activeMidCycle.payoutDate ? new Date(activeMidCycle.payoutDate) : null;
          const countdown = payoutDate ? Math.max(0, payoutDate - now) : null;
          const countdownMinutes = countdown !== null ? Math.floor(countdown / 60000) : null;
          
          // Check if the payout date matches between community and mid-cycle
          const datesMatch = community.nextPayout && activeMidCycle.payoutDate ? 
            new Date(community.nextPayout).getTime() === new Date(activeMidCycle.payoutDate).getTime() : 
            false;
          
          // Get contribution status for this mid-cycle
          const contributionData = {
            totalMembers: 0,
            contributedMembers: 0,
            missingContributions: []
          };
          
          // Get all active members for this community
          const activeMembers = await Member.find({
            communityId: community._id,
            status: 'active'
          }).populate('userId', 'name email');
          
          contributionData.totalMembers = activeMembers.length;
          
          // Check which members have contributed in this mid-cycle
          if (activeMidCycle.contributions) {
            contributionData.contributedMembers = activeMidCycle.contributions.filter(c => 
              c.contributions && c.contributions.length > 0
            ).length;
            
            // Identify members who haven't contributed
            for (const member of activeMembers) {
              const hasContributed = activeMidCycle.contributions.some(c => 
                c.user.toString() === member.userId._id.toString() && 
                c.contributions && 
                c.contributions.length > 0
              );
              
              if (!hasContributed) {
                contributionData.missingContributions.push({
                  id: member.userId._id,
                  name: member.userId.name,
                  email: member.userId.email
                });
              }
            }
          }
          
          // Determine status
          let status = 'On schedule';
          if (payoutDate && payoutDate <= now && !activeMidCycle.isReady) {
            status = 'Due but not ready';
          } else if (payoutDate && payoutDate <= now && activeMidCycle.isReady) {
            status = 'Due and ready for payout';
          } else if (countdownMinutes !== null && countdownMinutes < 60 && !activeMidCycle.isReady) {
            status = 'Approaching deadline (not ready)';
          } else if (!activeMidCycle.isReady) {
            status = 'Not ready';
          }
          
          return {
            id: community._id,
            name: community.name,
            hasActiveMidCycle: true,
            midCycleId: activeMidCycle._id,
            cycleNumber: activeMidCycle.cycleNumber,
            status,
            isReady: activeMidCycle.isReady,
            payoutDate: activeMidCycle.payoutDate,
            payoutAmount: activeMidCycle.payoutAmount,
            nextInLine: nextInLineInfo,
            countdown: {
              milliseconds: countdown,
              minutes: countdownMinutes,
              humanReadable: countdownMinutes !== null ? 
                `${Math.floor(countdownMinutes / 60)}h ${countdownMinutes % 60}m` : 
                'Not set'
            },
            contributionStats: contributionData,
            syncIssues: {
              datesOutOfSync: !datesMatch
            },
            admin: community.admin
          };
        })
      );
      
      // Get summary statistics
      const stats = {
        totalCommunities: communitiesWithPayoutInfo.length,
        withActiveMidCycles: communitiesWithPayoutInfo.filter(c => c.hasActiveMidCycle).length,
        duePayouts: communitiesWithPayoutInfo.filter(c => 
          c.hasActiveMidCycle && 
          c.payoutDate && 
          new Date(c.payoutDate) <= now
        ).length,
        readyPayouts: communitiesWithPayoutInfo.filter(c => 
          c.hasActiveMidCycle && 
          c.isReady
        ).length,
        dueButNotReady: communitiesWithPayoutInfo.filter(c => 
          c.hasActiveMidCycle && 
          c.payoutDate && 
          new Date(c.payoutDate) <= now && 
          !c.isReady
        ).length,
        syncIssues: communitiesWithPayoutInfo.filter(c => 
          c.hasActiveMidCycle && 
          c.syncIssues && 
          c.syncIssues.datesOutOfSync
        ).length
      };
      
      return res.status(200).json({
        communities: communitiesWithPayoutInfo,
        stats
      });
    } catch (err) {
      console.error('Error fetching payout status:', err);
      return res.status(500).json({ 
        error: 'Error fetching payout status',
        details: err.message
      });
    }
  },
  
  /**
   * Manually trigger a payout check for a specific community
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} JSON response with payout attempt result
   */
  triggerManualPayoutCheck: async (req, res) => {
    try {
      const { communityId } = req.params;
      
      // Find the community with its active mid-cycle
      const community = await Community.findById(communityId)
        .populate({
          path: 'midCycle',
          match: { isComplete: false }
        });
      
      if (!community) {
        return res.status(404).json({ error: 'Community not found' });
      }
      
      const activeMidCycle = community.midCycle && community.midCycle.length > 0 ? 
        community.midCycle[0] : null;
      
      if (!activeMidCycle) {
        return res.status(400).json({ error: 'No active mid-cycle found for this community' });
      }
      
      // Sync payout dates if needed
      if (activeMidCycle.payoutDate) {
        community.nextPayout = activeMidCycle.payoutDate;
        await community.save();
      }
      
      // Validate mid-cycle and check readiness
      const validationResult = await community.validateMidCycleAndContributions();
      
      let result = {
        communityName: community.name,
        midCycleId: activeMidCycle._id,
        isReady: validationResult.isReady,
        message: validationResult.message
      };
      
      // If not ready, try to handle unready mid-cycle
      if (!validationResult.isReady && typeof community.handleUnreadyMidCycle === 'function') {
        const handled = await community.handleUnreadyMidCycle();
        result.unreadyHandled = handled;
        
        if (handled) {
          // Re-check readiness
          const revalidation = await community.validateMidCycleAndContributions();
          result.isReadyAfterHandling = revalidation.isReady;
          result.message = revalidation.isReady ? 
            'Mid-cycle successfully prepared for payout.' : 
            'Mid-cycle could not be fully prepared despite handling.';
        }
      }
      
      // If ready (initially or after handling), attempt to distribute
      if (result.isReady || result.isReadyAfterHandling) {
        try {
          const payoutResult = await community.distributePayouts();
          result.payoutAttempted = true;
          result.payoutResult = payoutResult;
          result.message = payoutResult.message;
          
          // Update payout info after distribution
          await community.updatePayoutInfo();
        } catch (payoutError) {
          result.payoutAttempted = true;
          result.payoutSuccessful = false;
          result.payoutError = payoutError.message;
        }
      }
      
      return res.status(200).json(result);
    } catch (err) {
      console.error('Error triggering manual payout check:', err);
      return res.status(500).json({ 
        error: 'Error triggering manual payout check',
        details: err.message 
      });
    }
  },
  
  /**
   * Fix synchronization issues between community nextPayout and midCycle payoutDate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} JSON response with sync results
   */
  syncAllPayoutDates: async (req, res) => {
    try {
      // Find all communities with active mid-cycles
      const allCommunities = await Community.find()
        .populate({
          path: 'midCycle',
          match: { isComplete: false }
        });
      
      const results = [];
      
      for (const community of allCommunities) {
        const activeMidCycle = community.midCycle && community.midCycle.length > 0 ? 
          community.midCycle[0] : null;
        
        if (activeMidCycle && activeMidCycle.payoutDate) {
          const oldDate = community.nextPayout ? 
            new Date(community.nextPayout).toISOString() : 'Not set';
          
          // Update community's nextPayout to match mid-cycle
          community.nextPayout = activeMidCycle.payoutDate;
          await community.save();
          
          results.push({
            communityId: community._id,
            name: community.name,
            midCycleId: activeMidCycle._id,
            oldPayoutDate: oldDate,
            newPayoutDate: new Date(activeMidCycle.payoutDate).toISOString(),
            synced: true
          });
        } else {
          results.push({
            communityId: community._id,
            name: community.name,
            message: 'No active mid-cycle with payout date',
            synced: false
          });
        }
      }
      
      return res.status(200).json({
        message: `Synchronized payout dates for ${results.filter(r => r.synced).length} communities`,
        results
      });
    } catch (err) {
      console.error('Error synchronizing payout dates:', err);
      return res.status(500).json({ 
        error: 'Error synchronizing payout dates',
        details: err.message 
      });
    }
  }
};

module.exports = schedulerController;
