/**
 * This script updates the payout date of a mid-cycle to the current time,
 * which will trigger the scheduler to distribute funds on its next run
 * Run with: node update-payout-date.js <communityId>
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
 * Update the payout date of a mid-cycle to the current time
 */
const updatePayoutDate = async (communityId) => {
  try {
    if (!communityId) {
      console.error('Please provide a community ID as a command-line argument');
      console.log('Usage: node update-payout-date.js <communityId>');
      process.exit(1);
    }

    console.log(`Updating payout date for community ID: ${communityId}`);
    
    // Find the community
    const community = await Community.findById(communityId);
    if (!community) {
      console.error(`Community with ID ${communityId} not found`);
      process.exit(1);
    }
    
    console.log(`Found community: ${community.name}`);
    
    // Find the active mid-cycle (last in the array)
    if (!community.midCycle || community.midCycle.length === 0) {
      console.error('No mid-cycles found for this community');
      process.exit(1);
    }
    
    const midCycleId = community.midCycle[community.midCycle.length - 1];
    const activeMidCycle = await MidCycle.findOne({
      _id: midCycleId,
      isComplete: false
    });
    
    if (!activeMidCycle) {
      console.error('No active mid-cycle found');
      process.exit(1);
    }
    
    console.log(`Found active mid-cycle: ${activeMidCycle._id}, Cycle #${activeMidCycle.cycleNumber}`);
    console.log(`Current payout date: ${activeMidCycle.payoutDate ? new Date(activeMidCycle.payoutDate).toISOString() : 'Not set'}`);
    console.log(`Ready status: ${activeMidCycle.isReady ? 'Ready ✅' : 'Not Ready ❌'}`);
    
    // Set payout date to current time minus 1 minute (to ensure it's in the past)
    const newDate = new Date();
    newDate.setMinutes(newDate.getMinutes() - 1);
    
    console.log(`Setting payout date to: ${newDate.toISOString()}`);
    
    // Update the payout date
    activeMidCycle.payoutDate = newDate;
    await activeMidCycle.save();
    
    // Also update the community's nextPayout for consistency
    community.nextPayout = newDate;
    await community.save();
    
    console.log('✅ Payout date updated successfully!');
    console.log('The scheduler will process this payout on its next run (within 1 minute)');
    console.log('\nTo watch the scheduler logs, run:');
    console.log('node debug-scheduler.js');
    
  } catch (err) {
    console.error('Error updating payout date:', err);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Get communityId from command-line argument
const communityId = process.argv[2];
updatePayoutDate(communityId);
