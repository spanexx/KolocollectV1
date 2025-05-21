/**
 * This script manually tests and debugs the scheduler system
 * Run with: node debug-scheduler.js
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
 * Synchronize payout dates between communities and their mid-cycles
 */
const syncPayoutDates = async () => {
  try {
    console.log('Starting payout date synchronization...');
    
    // Fetch all communities with active mid-cycles
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
    
    // Process each community
    for (const community of communitiesWithActiveMidCycles) {
      const activeMidCycle = community.midCycle[0];
      
      console.log(`\nProcessing community: ${community.name} (${community._id})`);
      console.log(`Active mid-cycle: ${activeMidCycle._id}, Cycle #${activeMidCycle.cycleNumber}`);
      
      if (activeMidCycle.payoutDate) {
        console.log(`Mid-cycle payout date: ${new Date(activeMidCycle.payoutDate).toISOString()}`);
        console.log(`Community nextPayout: ${community.nextPayout ? new Date(community.nextPayout).toISOString() : 'Not set'}`);
        
        // Check if dates are in sync
        const datesMatch = community.nextPayout && 
          new Date(community.nextPayout).getTime() === new Date(activeMidCycle.payoutDate).getTime();
        
        if (!datesMatch) {
          console.log('⚠️ Dates are out of sync. Fixing...');
          
          // Update community's nextPayout
          community.nextPayout = activeMidCycle.payoutDate;
          await community.save();
          
          console.log(`✅ Updated community nextPayout to: ${new Date(community.nextPayout).toISOString()}`);
        } else {
          console.log('✅ Dates are already in sync');
        }
      } else {
        console.log('⚠️ Mid-cycle has no payout date set');
      }
      
      // Check mid-cycle readiness
      console.log(`Mid-cycle ready status: ${activeMidCycle.isReady ? 'Ready ✅' : 'Not ready ❌'}`);
      
      // Calculate countdown
      const now = new Date();
      const payoutDate = activeMidCycle.payoutDate ? new Date(activeMidCycle.payoutDate) : null;
      const countdown = payoutDate ? Math.max(0, payoutDate - now) : null;
      const countdownMinutes = countdown !== null ? Math.floor(countdown / 60000) : null;
      const isDue = payoutDate && payoutDate <= now;
      
      if (isDue) {
        console.log('⚠️ Payout is DUE! Should be processed by scheduler');
      } else if (countdownMinutes !== null) {
        const hours = Math.floor(countdownMinutes / 60);
        const minutes = countdownMinutes % 60;
        console.log(`Time until payout: ${hours}h ${minutes}m (${countdownMinutes} total minutes)`);
      } else {
        console.log('No payout countdown available');
      }
    }
    
    console.log('\nFinished payout date synchronization');
    
  } catch (err) {
    console.error('Error in syncPayoutDates:', err);
  } finally {
    mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

/**
 * Main function
 */
const main = async () => {
  try {
    await syncPayoutDates();
  } catch (err) {
    console.error('Error in main function:', err);
  }
};

// Run the main function
main();
