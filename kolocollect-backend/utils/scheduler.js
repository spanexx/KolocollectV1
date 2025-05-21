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
   * Helper function to get the active mid-cycle for a community
   * @param {Object} community - The community document
   * @returns {Promise<Object>} The active mid-cycle document
   */
  const getActiveMidCycle = async (community) => {
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
        console.log(`Fetched active mid-cycle for community ${community.name}: ID=${midCycle._id}, Ready=${midCycle.isReady}, PayoutDate=${midCycle.payoutDate}`);
      } else {
        console.log(`No active mid-cycle found for community ${community.name}`);
      }
      
      return midCycle;
    } catch (err) {
      console.error(`Error fetching active mid-cycle for community ${community.name}:`, err);
      return null;
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
    const allCommunities = await Community.find();
    
    // Filter communities that have active mid-cycles
    const communitiesWithActiveMidCycles = allCommunities.filter(
      community => community.midCycle && community.midCycle.length > 0
    );
    
    // Display countdown information and sync payout dates
    for (const community of communitiesWithActiveMidCycles) {
      // Get the most recent mid-cycle using getActiveMidCycle helper
      const activeMidCycle = await getActiveMidCycle(community);
      
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
      console.log(`Scheduler checking for payouts at ${now.toISOString()}`);      await retryOperation(async () => {
        // Fetch all communities first
        const allCommunities = await Community.find();
        console.log(`Checking ${allCommunities.length} communities for due payouts`);
        
        // Find communities with active mid-cycles that are due for payout
        const communities = [];
        
        // Process each community to check for active mid-cycles
        for (const community of allCommunities) {
          // Get the active mid-cycle directly from the database using the helper function
          const activeMidCycle = await getActiveMidCycle(community);
          
          if (activeMidCycle) {
            const payoutDate = activeMidCycle.payoutDate ? new Date(activeMidCycle.payoutDate) : null;
            const isDue = payoutDate && payoutDate <= now;
            
            console.log(`Community ${community.name}: Mid-cycle ready=${activeMidCycle.isReady}, due=${isDue}, payout date=${payoutDate}`);
            
            if (isDue) {
              console.log(`Found community with due payout: ${community.name} (Mid-cycle ID: ${activeMidCycle._id})`);
              // Store both the community and its active mid-cycle
              communities.push({
                community: community,
                activeMidCycle: activeMidCycle
              });
            }
          }
        }
          
        console.log(`Found ${communities.length} communities with due payouts out of ${allCommunities.length} total communities.`);        if (communities.length === 0) {
          return; // No communities to process
        }
        
        // First check and prepare mid-cycles that aren't ready
        for (const entry of communities) {
          const { community, activeMidCycle } = entry;
          
          // Synchronize community.nextPayout with midCycle.payoutDate
          await syncPayoutDates(community, activeMidCycle);
          
          if (!activeMidCycle.isReady) {
            console.log(`Community ${community.name} has a mid-cycle that's not ready but due for payout. Preparing it...`);
            const prepared = await checkMidCycleReadiness(community._id);
            console.log(`Mid-cycle preparation for ${community.name}: ${prepared ? 'Success' : 'Failed'}`);
          }
        }
        
        // Find active and ready mid-cycles directly now that we've prepared them
        const readyEntries = [];
        
        for (const entry of communities) {
          const { community } = entry;
          
          // Refresh mid-cycle status from the database
          const refreshedMidCycle = await getActiveMidCycle(community);
          
          if (refreshedMidCycle && refreshedMidCycle.isReady && 
              !refreshedMidCycle.isComplete && 
              new Date(refreshedMidCycle.payoutDate) <= now) {
            readyEntries.push({
              community: community,
              activeMidCycle: refreshedMidCycle
            });
          }
        }        console.log(`Found ${readyEntries.length} communities with mid-cycles that are ready for payout.`);
        
        // If no ready mid-cycles were found, check why
        if (readyEntries.length === 0) {
          console.log(`No ready mid-cycles found among ${communities.length} communities with due payouts. Issues might be:`);
          
          for (const entry of communities) {
            const { community } = entry;
            const midCycle = await getActiveMidCycle(community);
            
            if (midCycle && !midCycle.isReady) {
              console.log(`- Community ${community.name}: Mid-cycle ID ${midCycle._id} not ready (isReady=false)`);
              console.log('  Details:', {
                id: midCycle._id,
                cycleNumber: midCycle.cycleNumber,
                payoutAmount: midCycle.payoutAmount,
                payoutDate: midCycle.payoutDate ? new Date(midCycle.payoutDate).toISOString() : 'Not set',
                contributionCount: midCycle.contributions ? midCycle.contributions.length : 0,
                contributionsToNextInLine: midCycle.contributionsToNextInLine ? 
                  (midCycle.contributionsToNextInLine instanceof Map ? 
                    Array.from(midCycle.contributionsToNextInLine.entries()).length : 
                    Object.keys(midCycle.contributionsToNextInLine).length) : 0
              });
                // Check missing contributions
              try {
                const memberContributions = await MidCycle.aggregate([
                  { $match: { _id: mongoose.Types.ObjectId(midCycle._id) } },
                  { $unwind: "$contributions" },
                  { $project: { user: "$contributions.user", count: { $size: "$contributions.contributions" } } }
                ]);
                
                console.log(`  Contribution records in mid-cycle: ${memberContributions.length}`);
                console.log('  Member contribution status:', memberContributions.map(mc => ({
                  userId: mc.user,
                  contributionCount: mc.count
                })));
              } catch (err) {
                console.error(`  Error checking contribution details: ${err.message}`);
              }
            }
          }
          
          return; // No ready mid-cycles to process
        }
        
        // Process each community with ready mid-cycles
        for (const entry of readyEntries) {
          const { community } = entry;
          
          // Refresh from database to get the latest object
          const communityDoc = await Community.findById(community._id);
          
          // Get the active mid-cycle for this community
          const midCycle = await getActiveMidCycle(communityDoc);
          
          // Check if this mid-cycle is ready for payout
          const isReadyForPayout = midCycle && 
                                   midCycle.isReady && 
                                   !midCycle.isComplete && 
                                   new Date(midCycle.payoutDate) <= now;
          
          if (isReadyForPayout) {
            console.log(`Processing payout for community: ${communityDoc.name} (Mid-cycle ID: ${midCycle._id})`);
            try {
              console.log(`Calling distributePayouts() for community ${communityDoc.name}`);
              const result = await communityDoc.distributePayouts();
              console.log(`Payout result for ${communityDoc.name}: ${result.message}`);
              await communityDoc.updatePayoutInfo();
            } catch (err) {
              console.error(`Error distributing payout for community ${communityDoc.name}:`, err);
            }          } else {
            // Try one more time to get the mid-cycle ready
            console.log(`Community ${communityDoc.name} has due payout but mid-cycle not ready. Making final attempt to prepare it...`);
            const prepared = await checkMidCycleReadiness(communityDoc._id);
            
            if (prepared) {
              try {
                // Get the refreshed mid-cycle to confirm readiness
                const refreshedMidCycle = await getActiveMidCycle(communityDoc);
                
                if (refreshedMidCycle && refreshedMidCycle.isReady) {
                  console.log(`Mid-cycle for ${communityDoc.name} is now ready. Processing payout...`);
                  console.log(`Calling distributePayouts() for community ${communityDoc.name}`);
                  const result = await communityDoc.distributePayouts();
                  console.log(`Payout result for ${communityDoc.name}: ${result.message}`);
                  await communityDoc.updatePayoutInfo();
                } else {
                  console.log(`Preparation appeared successful, but mid-cycle still not ready for ${communityDoc.name}`);
                  await notifyPayoutFailure(communityDoc);
                }
              } catch (finalErr) {
                console.error(`Error in final attempt to distribute payout for community ${communityDoc.name}:`, finalErr);
              }
            } else {
              console.log(`Final attempt to prepare mid-cycle for ${communityDoc.name} failed. Skipping payout.`);
              
              // For critical communities, notify admin about payout failure
              try {
                await notifyPayoutFailure(communityDoc);
              } catch (notifyErr) {
                console.error(`Error notifying about payout failure for ${communityDoc.name}:`, notifyErr);
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
        const midCycle = await getActiveMidCycle(community);
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
