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
    );

    // Display countdown information
    communitiesWithActiveMidCycles.forEach(community => {
      const activeMidCycle = community.midCycle[0]; // First active mid-cycle
      
      // Calculate countdown
      const countdown = activeMidCycle && activeMidCycle.payoutDate 
        ? Math.max(0, new Date(activeMidCycle.payoutDate) - new Date()) 
        : 'N/A';
      const countdownMinutes = countdown !== 'N/A' ? Math.floor(countdown / 60000) : 'N/A';
      
      console.log(`Scheduler monitoring community: ${community.name} - Countdown: ${countdownMinutes} mins`);
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

          await retryOperation(async () => {
              // Fetch communities with upcoming payouts
              const communities = await Community.find({
                  nextPayout: { $lte: now }
              }).populate({
                  path: 'midCycle',
                  // Only populate active mid-cycles
                  match: { isComplete: false }
              });

              // Filter communities that actually have active mid-cycles
              const communitiesWithActiveMidCycles = communities.filter(
                  community => community.midCycle && community.midCycle.length > 0
              );

              for (const community of communitiesWithActiveMidCycles) {
                  console.log(`Processing payout for community: ${community.name}`);
                  try {
                      const result = await community.distributePayouts();
                      console.log(result.message);
                      await community.updatePayoutInfo();
                      await community.finalizeCycle();
                  } catch (err) {
                      console.error(`Error distributing payout for community ${community.name}:`, err);
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
