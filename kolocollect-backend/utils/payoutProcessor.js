/**
 * Payout Processor
 * Phase 4: Scalability Improvements - Distributed Job Processing
 * 
 * Handles payout job processing with:
 * - Isolated payout processing logic
 * - Error handling and retry mechanisms
 * - Transaction safety
 */

const mongoose = require('mongoose');
const logger = require('./logger');

// Import models
const Community = require('../models/Community');
const MidCycle = require('../models/Midcycle');
const User = require('../models/User');

/**
 * Check and update mid-cycle readiness if needed
 * @param {string} communityId - Community ID
 * @returns {Promise<boolean>} - Whether the mid-cycle is ready
 */
async function checkMidCycleReadiness(communityId) {
  try {
    const community = await Community.findById(communityId)
      .populate({
        path: 'midCycle',
        match: { isComplete: false }
      });
      
    if (!community) {
      logger.warn(`Community ${communityId} not found`);
      return false;
    }
    
    // Call validateMidCycleAndContributions to check readiness of the mid-cycle
    try {
      logger.info(`Validating mid-cycle for community ${community.name} (${community._id})`);
      const validationResult = await community.validateMidCycleAndContributions();
      logger.info(`Validation result: ${validationResult.message}`);
      
      // If not ready after validation, handle unready mid-cycle
      if (!validationResult.isReady) {
        logger.info(`Mid-cycle not ready after validation for community ${community.name}`);
        if (typeof community.handleUnreadyMidCycle === 'function') {
          logger.info(`Calling handleUnreadyMidCycle for community ${community.name}`);
          const result = await community.handleUnreadyMidCycle();
          return result;
        }
      } else {
        logger.info(`Mid-cycle is ready for community ${community.name}`);
        return true;
      }
    } catch (validationErr) {
      logger.error({ msg: `Error validating mid-cycle`, error: validationErr.message });
    }
    
    return false;
  } catch (err) {
    logger.error({ msg: `Error checking mid-cycle readiness for community ${communityId}`, error: err.message });
    return false;
  }
}

/**
 * Get the active mid-cycle for a community
 * @param {Object} community - The community document
 * @returns {Promise<Object>} The active mid-cycle document
 */
async function getActiveMidCycle(community) {
  if (!community.midCycle || community.midCycle.length === 0) {
    return null;
  }
  
  // Get the most recent mid-cycle (last in the array)
  const midCycleId = community.midCycle[community.midCycle.length - 1];
  
  // Fetch complete mid-cycle data directly from the database
  try {
    const midCycle = await MidCycle.findOne({
      _id: midCycleId,
      isComplete: false
    });
    
    if (midCycle) {
      logger.info(`Fetched active mid-cycle for community ${community.name}: ID=${midCycle._id}, Ready=${midCycle.isReady}, PayoutDate=${midCycle.payoutDate}`);
    } else {
      logger.info(`No active mid-cycle found for community ${community.name}`);
    }
    
    return midCycle;
  } catch (err) {
    logger.error({ msg: `Error fetching active mid-cycle for community ${community.name}`, error: err.message });
    return null;
  }
}

/**
 * Synchronize community.nextPayout with midCycle.payoutDate
 * @param {Object} community - The community document
 * @param {Object} activeMidCycle - The active mid-cycle document
 */
async function syncPayoutDates(community, activeMidCycle) {
  try {
    if (activeMidCycle && activeMidCycle.payoutDate) {
      // Ensure community.nextPayout matches midCycle.payoutDate
      if (!community.nextPayout || 
          new Date(community.nextPayout).getTime() !== new Date(activeMidCycle.payoutDate).getTime()) {
        logger.info(`Synchronizing payout dates for community ${community.name}:`);
        logger.info(`- Previous nextPayout: ${community.nextPayout ? new Date(community.nextPayout).toISOString() : 'Not set'}`);
        logger.info(`- Setting to: ${new Date(activeMidCycle.payoutDate).toISOString()}`);
        
        community.nextPayout = activeMidCycle.payoutDate;
        await community.save();
      }
    }
  } catch (err) {
    logger.error({ msg: `Error synchronizing payout dates for community ${community.name}`, error: err.message });
  }
}

/**
 * Notify admins about payout failures
 * @param {Object} community - The community with failed payout
 */
async function notifyPayoutFailure(community) {
  try {
    const admin = await User.findById(community.admin);
    
    if (admin && admin.addNotification) {
      const midCycle = await getActiveMidCycle(community);
      const nextInLine = midCycle && midCycle.nextInLine ? 
        await User.findById(midCycle.nextInLine.userId) : null;
      const message = `Payout failed for community "${community.name}". ` +
        `Next in line: ${nextInLine ? nextInLine.name : 'Unknown'}. ` +
        `Scheduled date: ${midCycle && midCycle.payoutDate ? 
          new Date(midCycle.payoutDate).toISOString() : 'Not set'}. ` +
        `Please check the mid-cycle readiness and contribution status.`;
      
      await admin.addNotification('alert', message, community._id);
      logger.info(`Notification sent to admin ${admin.name} about payout failure for ${community.name}`);
    }
  } catch (err) {
    logger.error({ msg: 'Error sending notification about payout failure', error: err.message });
  }
}

/**
 * Process a payout job
 * @param {Object} job - Bull job object
 * @returns {Promise<Object>} - Processing result
 */
async function processPayoutJob(job) {
  const { communityId } = job.data;
  const jobId = job.id;
  
  logger.info({
    msg: `Processing payout job ${jobId} for community ${communityId}`,
    jobId,
    communityId
  });
  
  try {
    // 1. Find the community
    const community = await Community.findById(communityId);
    
    if (!community) {
      logger.error({
        msg: `Community ${communityId} not found for payout job ${jobId}`,
        jobId,
        communityId
      });
      return { success: false, message: 'Community not found' };
    }
    
    // 2. Get active mid-cycle
    const midCycle = await getActiveMidCycle(community);
    
    if (!midCycle) {
      logger.error({
        msg: `No active mid-cycle found for community ${community.name} (${communityId})`,
        jobId,
        communityId
      });
      return { success: false, message: 'No active mid-cycle found' };
    }
    
    // 3. Synchronize payout dates
    await syncPayoutDates(community, midCycle);
    
    // 4. Check if mid-cycle is ready
    const now = new Date();
    const payoutDate = midCycle.payoutDate ? new Date(midCycle.payoutDate) : null;
    const isPayoutDue = payoutDate && payoutDate <= now;
    
    if (!isPayoutDue) {
      logger.info({
        msg: `Payout not yet due for community ${community.name} (${communityId})`,
        jobId,
        communityId,
        payoutDate: payoutDate ? payoutDate.toISOString() : 'Not set',
        now: now.toISOString()
      });
      return { success: true, message: 'Payout not yet due' };
    }
    
    // 5. If mid-cycle is not ready, try to prepare it
    if (!midCycle.isReady) {
      logger.info({
        msg: `Mid-cycle not ready for community ${community.name} (${communityId}). Attempting to prepare.`,
        jobId,
        communityId
      });
      
      const prepared = await checkMidCycleReadiness(communityId);
      
      if (!prepared) {
        logger.warn({
          msg: `Failed to prepare mid-cycle for community ${community.name} (${communityId})`,
          jobId,
          communityId
        });
        
        // Notify admin about payout failure
        await notifyPayoutFailure(community);
        
        return { success: false, message: 'Failed to prepare mid-cycle' };
      }
    }
    
    // 6. Refresh community and mid-cycle
    const refreshedCommunity = await Community.findById(communityId);
    const refreshedMidCycle = await getActiveMidCycle(refreshedCommunity);
    
    // 7. Check if mid-cycle is now ready
    if (!refreshedMidCycle || !refreshedMidCycle.isReady) {
      logger.warn({
        msg: `Mid-cycle still not ready after preparation for community ${refreshedCommunity.name} (${communityId})`,
        jobId,
        communityId
      });
      
      // Notify admin about payout failure
      await notifyPayoutFailure(refreshedCommunity);
      
      return { success: false, message: 'Mid-cycle still not ready after preparation' };
    }
    
    // 8. Process the payout
    logger.info({
      msg: `Processing payout for community ${refreshedCommunity.name} (${communityId})`,
      jobId,
      communityId
    });
    
    try {
      const result = await refreshedCommunity.distributePayouts();
      logger.info({
        msg: `Payout result for ${refreshedCommunity.name} (${communityId}): ${result.message}`,
        jobId,
        communityId,
        result
      });
      
      await refreshedCommunity.updatePayoutInfo();
      
      return {
        success: true,
        message: `Payout processed successfully: ${result.message}`,
        details: result
      };
    } catch (payoutErr) {
      logger.error({
        msg: `Error distributing payout for community ${refreshedCommunity.name} (${communityId})`,
        jobId,
        communityId,
        error: payoutErr.message
      });
      
      // Notify admin about payout failure
      await notifyPayoutFailure(refreshedCommunity);
      
      return { success: false, message: `Error distributing payout: ${payoutErr.message}` };
    }
  } catch (err) {
    logger.error({
      msg: `Error processing payout job ${jobId} for community ${communityId}`,
      jobId,
      communityId,
      error: err.message
    });
    
    return { success: false, message: `Error processing payout: ${err.message}` };
  }
}

module.exports = {
  processPayoutJob,
  checkMidCycleReadiness,
  getActiveMidCycle,
  syncPayoutDates,
  notifyPayoutFailure
};
