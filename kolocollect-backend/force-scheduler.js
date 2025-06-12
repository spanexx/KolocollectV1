/**
 * This script manually tests and debugs the scheduler system
 * Run with: node force-scheduler.js
 * 
 * This version can force a payout to happen regardless of the scheduled date
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const MidCycle = require('./models/Midcycle');
const connectDB = require('./config/db');

dotenv.config();

// Connect to database
connectDB();

/**
 * Force distribute payouts for a specific community
 */
const forceDistributePayouts = async (communityId) => {
  try {
    console.log(`Force distributing payouts for community ID: ${communityId}`);
    
    // Find the community
    const community = await Community.findById(communityId);
    if (!community) {
      console.error(`Community with ID ${communityId} not found`);
      return;
    }
    
    console.log(`Found community: ${community.name}`);
    
    // Find the active mid-cycle
    const activeMidCycle = await MidCycle.findOne({
      _id: { $in: community.midCycle },
      isComplete: false
    });
    
    if (!activeMidCycle) {
      console.error('No active mid-cycle found');
      return;
    }
    
    console.log(`Found active mid-cycle: ${activeMidCycle._id}, Cycle #${activeMidCycle.cycleNumber}`);
    console.log(`Mid-cycle ready status: ${activeMidCycle.isReady ? 'Ready' : 'Not Ready'}`);
    
    if (!activeMidCycle.isReady) {
      console.log('Mid-cycle is not ready for payout. Attempting to make it ready...');
      
      // Call validateMidCycleAndContributions to check readiness of the mid-cycle
      try {
        console.log(`Validating mid-cycle for community ${community.name} (${community._id})`);
        const validationResult = await community.validateMidCycleAndContributions();
        console.log(`Validation result: ${validationResult.message}`);
        
        // Re-fetch the mid-cycle after validation
        const refreshedMidCycle = await MidCycle.findOne({
          _id: activeMidCycle._id
        });
        
        if (!refreshedMidCycle.isReady) {
          console.error('Mid-cycle is still not ready after validation.');
          return;
        }
      } catch (validationErr) {
        console.error(`Error validating mid-cycle: ${validationErr.message}`);
        return;
      }
    }
    
    // Now attempt to distribute payouts
    console.log('Calling distributePayouts()...');
    try {
      const result = await community.distributePayouts();
      console.log(`Payout result: ${result.message}`);
      
      // Update payout info
      await community.updatePayoutInfo();
      console.log('Payout info updated');
    } catch (err) {
      console.error(`Error distributing payouts: ${err.message}`);
    }
  } catch (err) {
    console.error('Error in forceDistributePayouts:', err);
  }
};

/**
 * Main function
 */
const main = async () => {
  try {
    // Display all communities with active mid-cycles
    const allCommunities = await Community.find()
      .populate({
        path: 'midCycle',
        match: { isComplete: false }
      });
    
    console.log(`Found ${allCommunities.length} total communities`);
    
    // Filter communities that have active mid-cycles
    const communitiesWithActiveMidCycles = allCommunities.filter(
      community => community.midCycle && community.midCycle.length > 0
    );
    
    console.log(`Found ${communitiesWithActiveMidCycles.length} communities with active mid-cycles`);
    
    // List active mid-cycles
    for (const community of communitiesWithActiveMidCycles) {
      const activeMidCycle = community.midCycle[0];
      console.log(`\nCommunity: ${community.name} (${community._id})`);
      console.log(`Mid-cycle ID: ${activeMidCycle._id}`);
      console.log(`Ready status: ${activeMidCycle.isReady ? 'Ready ✅' : 'Not ready ❌'}`);
      
      // Check for command line argument to force payout for a specific community
      if (process.argv.length > 2 && process.argv[2] === community._id.toString()) {
        console.log(`\n🚀 FORCING PAYOUT for selected community: ${community.name}`);
        await forceDistributePayouts(community._id);
      }
    }
    
    // If no specific community ID was provided but there are communities with active mid-cycles
    if (process.argv.length <= 2 && communitiesWithActiveMidCycles.length > 0) {
      console.log('\nTo force distribute payouts for a specific community, run:');
      console.log('node force-scheduler.js <community-id>');
      console.log('\nAvailable community IDs:');
      for (const community of communitiesWithActiveMidCycles) {
        console.log(`${community._id} - ${community.name}`);
      }
    }
    
  } catch (err) {
    console.error('Error in main function:', err);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the main function
main();
