/**
 * This script adjusts the payout date for a mid-cycle to facilitate testing
 * Run with: node set-payout-time.js <minutes>
 * 
 * Example: node set-payout-time.js 2 
 * (Sets payout date to 2 minutes from now)
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
 * Set payout date for all active mid-cycles
 */
const setPayoutDate = async (minutesFromNow) => {
  try {
    console.log(`Setting payout date to ${minutesFromNow} minutes from now...`);
    
    // Calculate new payout date
    const now = new Date();
    const newPayoutDate = new Date(now.getTime() + (minutesFromNow * 60000));
    
    console.log(`New payout date will be: ${newPayoutDate.toISOString()}`);
    
    // Find all communities with active mid-cycles
    const communities = await Community.find()
      .populate({
        path: 'midCycle',
        match: { isComplete: false }
      });
    
    const communitiesWithActiveMidCycles = communities.filter(
      community => community.midCycle && community.midCycle.length > 0
    );
    
    console.log(`Found ${communitiesWithActiveMidCycles.length} communities with active mid-cycles`);
    
    // Update each mid-cycle
    for (const community of communitiesWithActiveMidCycles) {
      const activeMidCycle = community.midCycle[0];
      
      console.log(`\nCommunity: ${community.name} (${community._id})`);
      console.log(`Mid-cycle ID: ${activeMidCycle._id}`);
      console.log(`Previous payout date: ${activeMidCycle.payoutDate ? new Date(activeMidCycle.payoutDate).toISOString() : 'Not set'}`);
      
      // Update the mid-cycle in the database
      const result = await MidCycle.updateOne(
        { _id: activeMidCycle._id },
        { $set: { payoutDate: newPayoutDate } }
      );
      
      console.log(`Mid-cycle update result: ${result.modifiedCount > 0 ? 'Success ✅' : 'Failed ❌'}`);
      
      // Also update community's nextPayout
      community.nextPayout = newPayoutDate;
      await community.save();
      console.log(`Community nextPayout updated`);
      
      // Check if mid-cycle is already ready
      console.log(`Mid-cycle ready status: ${activeMidCycle.isReady ? 'Ready ✅' : 'Not ready ❌'}`);
      
      // If not ready, try to make it ready for testing
      if (!activeMidCycle.isReady) {
        console.log('Attempting to set mid-cycle to ready state for testing...');
        
        try {
          await MidCycle.updateOne(
            { _id: activeMidCycle._id },
            { $set: { isReady: true } }
          );
          console.log('Mid-cycle set to ready state ✅');
        } catch (err) {
          console.error('Error setting mid-cycle to ready state:', err);
        }
      }
    }
    
    console.log('\nPayout dates updated successfully. Please restart your server if it\'s running.');
    console.log('The scheduler should process these payouts at the specified time.');
    console.log('\nTo monitor payouts, run: node monitor-payouts.js');
    
  } catch (err) {
    console.error('Error setting payout date:', err);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Main function
const main = async () => {
  try {
    // Get minutes from command line or default to 2
    const minutesFromNow = process.argv[2] ? parseInt(process.argv[2]) : 2;
    
    if (isNaN(minutesFromNow)) {
      console.error('Invalid minutes value. Please provide a number.');
      process.exit(1);
    }
    
    await setPayoutDate(minutesFromNow);
  } catch (err) {
    console.error('Error in main function:', err);
  }
};

// Run the main function
main();
