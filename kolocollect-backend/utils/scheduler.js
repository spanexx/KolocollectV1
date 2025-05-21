const cron = require('node-cron');
const Community = require('../models/Community');
const MidCycle = require('../models/Midcycle');

const retryOperation = async (operation, retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
          return await operation();
      } catch (err) {
          console.error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
          if (attempt === retries) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
      }
  }
};

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

  // First, show countdown information for all communities
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
    );    // Display countdown information
    communitiesWithActiveMidCycles.forEach(community => {
      const activeMidCycle = community.midCycle[0]; // First active mid-cycle
      
      // Calculate countdown
      const countdown = activeMidCycle && activeMidCycle.payoutDate 
        ? Math.max(0, new Date(activeMidCycle.payoutDate) - new Date()) 
        : 'N/A';
      const countdownMinutes = countdown !== 'N/A' ? Math.floor(countdown / 60000) : 'N/A';
      
      // Check if mid-cycle is ready
      const isReady = activeMidCycle && activeMidCycle.isReady;
      
      console.log(`Scheduler monitoring community: ${community.name} - Countdown: ${countdownMinutes} mins - Ready: ${isReady}`);
      
      // If close to payout time but not ready, try to update readiness
      if (countdownMinutes !== 'N/A' && countdownMinutes < 5 && !isReady) {
        checkMidCycleReadiness(community._id)
          .then(success => {
            if (success) {
              console.log(`Updated readiness for community: ${community.name}`);
            }
          })
          .catch(err => console.error(`Failed to update readiness for ${community.name}:`, err));
      }
    });

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
              // Fetch communities with upcoming payouts
              const communities = await Community.find({
                  nextPayout: { $lte: now }
              });
                
              console.log(`Found ${communities.length} communities with upcoming payouts based on nextPayout date.`);
              
              if (communities.length === 0) {
                  return; // No communities to process
              }
              
              // Get community IDs for further querying
              const communityIds = communities.map(community => community._id);
              
              // Find active and ready mid-cycles directly
              const readyMidCycles = await MidCycle.find({
                  _id: { $in: communities.flatMap(c => c.midCycle) },
                  isReady: true,
                  isComplete: false
              });
              
              console.log(`Found ${readyMidCycles.length} mid-cycles that are ready for payout.`);
              
              // If no ready mid-cycles were found, check why
              if (readyMidCycles.length === 0) {
                  const allActiveMidCycles = await MidCycle.find({
                      _id: { $in: communities.flatMap(c => c.midCycle) },
                      isComplete: false
                  });
                  
                  console.log(`Found ${allActiveMidCycles.length} active mid-cycles. Issues might be:`);
                  console.log(`- Number not ready for payout (isReady=false): ${allActiveMidCycles.filter(mc => !mc.isReady).length}`);
                  
                  // For debugging, check the first few that are not ready
                  const notReadySamples = allActiveMidCycles.filter(mc => !mc.isReady).slice(0, 3);
                  if (notReadySamples.length > 0) {
                      console.log('Sample mid-cycles not ready:', notReadySamples.map(mc => ({
                          id: mc._id,
                          cycleNumber: mc.cycleNumber,
                          payoutAmount: mc.payoutAmount,
                          payoutDate: mc.payoutDate
                      })));
                  }
                  
                  return; // No ready mid-cycles to process
              }
              
              // Process each community with ready mid-cycles
              for (const community of communities) {
                  // Check if this community has any ready mid-cycles
                  const communityHasReadyMidCycle = readyMidCycles.some(mc => 
                      community.midCycle.map(id => id.toString()).includes(mc._id.toString())
                  );
                  
                  if (communityHasReadyMidCycle) {
                      console.log(`Processing payout for community: ${community.name}`);
                      try {
                          const result = await community.distributePayouts();
                          console.log(result.message);
                          await community.updatePayoutInfo();
                          await community.finalizeCycle();
                      } catch (err) {
                          console.error(`Error distributing payout for community ${community.name}:`, err);
                      }
                  } else {
                      console.log(`Community ${community.name} has nextPayout <= now but no ready mid-cycles.`);
                  }
              }
          });
      } catch (err) {
          console.error('Error in payout scheduler:', err);
      }
  });

  console.log('Scheduler initialized.');
};


module.exports = schedulePayouts;
