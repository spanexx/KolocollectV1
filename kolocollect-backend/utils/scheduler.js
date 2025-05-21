const cron = require('node-cron');
const Community = require('../models/Community');
const MidCycle = require('../models/Midcycle');
const mongoose = require('mongoose');

/**
 * Utility function to retry failed operations with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {Number} retries - Maximum number of retry attempts
 * @param {Number} delay - Initial delay in milliseconds
 * @returns {Promise} Result of the operation
 */
const retryOperation = async (operation, retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      console.error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff
      delay *= 2;
    }
  }
};

/**
 * Main function to schedule and process community payouts
 */
const schedulePayouts = async () => {
  // Helper function to check and update mid-cycle readiness if needed
  const checkMidCycleReadiness = async (communityId) => {
    try {
      const community = await Community.findById(communityId)
        .populate({
          path: 'midCycle',
          match: { isComplete: false }
        });
        
      if (!community) {
        console.log(`Community ${communityId} not found`);
        return false;
      }
      
      // Call validateMidCycleAndContributions to check readiness of the mid-cycle
      try {
        console.log(`Validating mid-cycle for community ${community.name} (${community._id})`);
        const validationResult = await community.validateMidCycleAndContributions();
        console.log(`Validation result: ${validationResult.message}`);
        
        // If not ready after validation, handle unready mid-cycle
        if (!validationResult.isReady) {
          console.log(`Mid-cycle not ready after validation for community ${community.name}`);
          if (typeof community.handleUnreadyMidCycle === 'function') {
            console.log(`Calling handleUnreadyMidCycle for community ${community.name}`);
            const result = await community.handleUnreadyMidCycle();
            return result;
          }
        } else {
          console.log(`Mid-cycle is ready for community ${community.name}`);
          return true;
        }
      } catch (validationErr) {
        console.error(`Error validating mid-cycle: ${validationErr.message}`);
      }
      
      return false;
    } catch (err) {
      console.error(`Error checking mid-cycle readiness for community ${communityId}:`, err);
      return false;
    }
  };

  /**
   * Helper function to synchronize community.nextPayout with midCycle.payoutDate
   * @param {Object} community - The community document
   * @param {Object} activeMidCycle - The active mid-cycle document
   */
  const syncPayoutDates = async (community, activeMidCycle) => {
    try {
      if (activeMidCycle && activeMidCycle.payoutDate) {
        // Ensure community.nextPayout matches midCycle.payoutDate
        if (!community.nextPayout || 
            new Date(community.nextPayout).getTime() !== new Date(activeMidCycle.payoutDate).getTime()) {
          console.log(`Synchronizing payout dates for community ${community.name}:`);
          console.log(`- Previous nextPayout: ${community.nextPayout ? new Date(community.nextPayout).toISOString() : 'Not set'}`);
          console.log(`- Setting to: ${new Date(activeMidCycle.payoutDate).toISOString()}`);
          
          community.nextPayout = activeMidCycle.payoutDate;
          await community.save();
        }
      }
    } catch (err) {
      console.error(`Error synchronizing payout dates for community ${community.name}:`, err);
    }
  };

  // First, show countdown information for all communities and sync payout dates
  try {
    // Fetch all communities with their active mid-cycles
    const allCommunities = await Community.find()
      .populate({
        path: 'midCycle',
        match: { isComplete: false }
      });
    
    // Filter communities that have active mid-cycles
    const communitiesWithActiveMidCycles = allCommunities.filter(
      community => community.midCycle && community.midCycle.length > 0
    );
    
    // Display countdown information and sync payout dates
    for (const community of communitiesWithActiveMidCycles) {
      const activeMidCycle = community.midCycle[0]; // First active mid-cycle
      
      // Synchronize community.nextPayout with midCycle.payoutDate
      await syncPayoutDates(community, activeMidCycle);
      
      // Calculate countdown
      const now = new Date();
      const payoutDate = activeMidCycle && activeMidCycle.payoutDate 
        ? new Date(activeMidCycle.payoutDate) 
        : null;
      
      const countdown = payoutDate 
        ? Math.max(0, payoutDate - now) 
        : 'N/A';
      const countdownMinutes = countdown !== 'N/A' ? Math.floor(countdown / 60000) : 'N/A';
      
      // Check if mid-cycle is ready
      const isReady = activeMidCycle && activeMidCycle.isReady;
      
      // Check if payout is due
      const isDue = payoutDate && payoutDate <= now;
      
      console.log(`Scheduler monitoring community: ${community.name} - Countdown: ${countdownMinutes} mins - Ready: ${isReady} - Due: ${isDue || false} - Next payout: ${payoutDate ? payoutDate.toISOString() : 'Not set'}`);
      
      // If close to payout time but not ready, try to update readiness
      if (countdownMinutes !== 'N/A' && countdownMinutes < 10 && !isReady) {
        console.log(`Community ${community.name} is approaching payout time (${countdownMinutes} mins) but not ready yet. Attempting to prepare.`);
        checkMidCycleReadiness(community._id)
          .then(success => {
            if (success) {
              console.log(`Successfully updated readiness for community: ${community.name}`);
            } else {
              console.log(`Failed to update readiness for community: ${community.name}`);
            }
          })
          .catch(err => console.error(`Failed to update readiness for ${community.name}:`, err));
      }
    }
    
    if (communitiesWithActiveMidCycles.length === 0) {
      console.log('No communities with active mid-cycles found for monitoring.');
    }
  } catch (err) {
    console.error('Error displaying community countdown information:', err);
  }
  
  // Start the actual scheduler
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      console.log(`Scheduler checking for payouts at ${now.toISOString()}`);

      await retryOperation(async () => {
        // Fetch all communities with active mid-cycles first
        const allCommunities = await Community.find()
          .populate({
            path: 'midCycle',
            match: { isComplete: false }
          });
          
        // Filter to only include communities with active mid-cycles that have payoutDate <= now
        const communities = allCommunities.filter(community => {
          if (!community.midCycle || community.midCycle.length === 0) return false;
          
          const activeMidCycle = community.midCycle[0];
          const isDue = activeMidCycle && activeMidCycle.payoutDate && 
                        new Date(activeMidCycle.payoutDate) <= now;
          
          return isDue;
        });
          
        console.log(`Found ${communities.length} communities with due payouts out of ${allCommunities.length} total communities with active mid-cycles.`);
        
        if (communities.length === 0) {
          return; // No communities to process
        }
        
        // First check and prepare mid-cycles that aren't ready
        for (const community of communities) {
          const activeMidCycle = community.midCycle[0];
          
          // Synchronize community.nextPayout with midCycle.payoutDate
          await syncPayoutDates(community, activeMidCycle);
          
          if (!activeMidCycle.isReady) {
            console.log(`Community ${community.name} has a mid-cycle that's not ready but due for payout. Preparing it...`);
            const prepared = await checkMidCycleReadiness(community._id);
            console.log(`Mid-cycle preparation for ${community.name}: ${prepared ? 'Success' : 'Failed'}`);
          }
        }
        
        // Get community IDs for further querying after preparation
        const communityIds = communities.map(community => community._id);
        
        // Find active and ready mid-cycles directly now that we've prepared them
        const readyMidCycles = await MidCycle.find({
          _id: { $in: communities.flatMap(c => c.midCycle.map(mc => mc._id)) },
          isReady: true,
          isComplete: false,
          payoutDate: { $lte: now }
        });
        
        console.log(`Found ${readyMidCycles.length} mid-cycles that are ready for payout.`);
        
        // If no ready mid-cycles were found, check why
        if (readyMidCycles.length === 0) {
          const allActiveMidCycles = await MidCycle.find({
            _id: { $in: communities.flatMap(c => c.midCycle.map(mc => mc._id)) },
            isComplete: false,
            payoutDate: { $lte: now }
          });
          
          console.log(`Found ${allActiveMidCycles.length} active mid-cycles due for payout. Issues might be:`);
          console.log(`- Number not ready for payout (isReady=false): ${allActiveMidCycles.filter(mc => !mc.isReady).length}`);
          
          // For debugging, check the first few that are not ready
          const notReadySamples = allActiveMidCycles.filter(mc => !mc.isReady).slice(0, 3);
          if (notReadySamples.length > 0) {
            console.log('Sample mid-cycles not ready:', notReadySamples.map(mc => ({
              id: mc._id,
              cycleNumber: mc.cycleNumber,
              payoutAmount: mc.payoutAmount,
              payoutDate: mc.payoutDate ? new Date(mc.payoutDate).toISOString() : 'Not set',
              contributionCount: mc.contributions ? mc.contributions.length : 0,
              contributionsToNextInLine: mc.contributionsToNextInLine ? 
                (mc.contributionsToNextInLine instanceof Map ? 
                  Array.from(mc.contributionsToNextInLine.entries()).length : 
                  Object.keys(mc.contributionsToNextInLine).length) : 0
            })));
            
            // Check the communities for these unready mid-cycles to get more context
            for (const unreadyMidCycle of notReadySamples) {
              const community = communities.find(c => 
                c.midCycle && c.midCycle.some(mc => mc._id.toString() === unreadyMidCycle._id.toString())
              );
              
              if (community) {
                console.log(`Unready mid-cycle ${unreadyMidCycle._id} belongs to community ${community.name} (${community._id})`);
                
                // Check missing contributions
                try {
                  const memberContributions = await MidCycle.aggregate([
                    { $match: { _id: mongoose.Types.ObjectId(unreadyMidCycle._id) } },
                    { $unwind: "$contributions" },
                    { $project: { user: "$contributions.user", count: { $size: "$contributions.contributions" } } }
                  ]);
                  
                  console.log(`Contribution records in mid-cycle: ${memberContributions.length}`);
                  console.log('Member contribution status:', memberContributions.map(mc => ({
                    userId: mc.user,
                    contributionCount: mc.count
                  })));
                } catch (err) {
                  console.error(`Error checking contribution details: ${err.message}`);
                }
              }
            }
          }
          
          return; // No ready mid-cycles to process
        }
        
        // Process each community with ready mid-cycles
        for (const community of communities) {
          // Check if this community has any ready mid-cycles
          const communityReadyMidCycles = readyMidCycles.filter(mc => 
            community.midCycle.some(midCycle => midCycle._id.toString() === mc._id.toString())
          );
          
          if (communityReadyMidCycles.length > 0) {
            console.log(`Processing payout for community: ${community.name} (${communityReadyMidCycles.length} ready mid-cycles)`);
            try {
              const result = await community.distributePayouts();
              console.log(`Payout result for ${community.name}: ${result.message}`);
              await community.updatePayoutInfo();
            } catch (err) {
              console.error(`Error distributing payout for community ${community.name}:`, err);
            }
          } else {
            // Try one more time to get the mid-cycle ready
            console.log(`Community ${community.name} has due payout but no ready mid-cycles. Making final attempt to prepare it...`);
            const prepared = await checkMidCycleReadiness(community._id);
            
            if (prepared) {
              try {
                console.log(`Mid-cycle for ${community.name} is now ready. Processing payout...`);
                const result = await community.distributePayouts();
                console.log(`Payout result for ${community.name}: ${result.message}`);
                await community.updatePayoutInfo();
              } catch (finalErr) {
                console.error(`Error in final attempt to distribute payout for community ${community.name}:`, finalErr);
              }
            } else {
              console.log(`Final attempt to prepare mid-cycle for ${community.name} failed. Skipping payout.`);
              
              // For critical communities, notify admin about payout failure
              try {
                await notifyPayoutFailure(community);
              } catch (notifyErr) {
                console.error(`Error notifying about payout failure for ${community.name}:`, notifyErr);
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Error in payout scheduler:', err);
    }
  });

  /**
   * Helper function to notify admins about payout failures
   * @param {Object} community - The community with failed payout
   */
  const notifyPayoutFailure = async (community) => {
    try {
      const User = mongoose.model('User');
      const admin = await User.findById(community.admin);
      
      if (admin && admin.addNotification) {
        const midCycle = community.midCycle[0];
        const nextInLine = midCycle && midCycle.nextInLine ? 
          await User.findById(midCycle.nextInLine.userId) : null;
          const message = `Payout failed for community "${community.name}". ` +
          `Next in line: ${nextInLine ? nextInLine.name : 'Unknown'}. ` +
          `Scheduled date: ${midCycle && midCycle.payoutDate ? 
            new Date(midCycle.payoutDate).toISOString() : 'Not set'}. ` +
          `Please check the mid-cycle readiness and contribution status.`;
        
        await admin.addNotification('alert', message, community._id);
        console.log(`Notification sent to admin ${admin.name} about payout failure for ${community.name}`);
      }
    } catch (err) {
      console.error('Error sending notification about payout failure:', err);
    }
  };
  console.log('Scheduler initialized.');
};

module.exports = schedulePayouts;

module.exports = schedulePayouts;
