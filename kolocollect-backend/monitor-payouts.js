/**
 * This script monitors payouts and logs detailed information
 * Run with: node monitor-payouts.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const MidCycle = require('./models/Midcycle');
const Payout = require('./models/Payout');
const connectDB = require('./config/db');

dotenv.config();

// Connect to database
connectDB();

// Original distributePayouts method
const originalDistributePayouts = Community.prototype.distributePayouts;

// Override the distributePayouts method to add logging
Community.prototype.distributePayouts = async function() {
  console.log(`\n🔥 DISTRIBUTION TRIGGERED for community ${this.name} (${this._id})`);
  console.log(`Time of call: ${new Date().toISOString()}`);
  
  try {
    const result = await originalDistributePayouts.call(this);
    console.log(`✅ DISTRIBUTION SUCCEEDED: ${result.message}`);
    return result;
  } catch (err) {
    console.error(`❌ DISTRIBUTION FAILED: ${err.message}`);
    throw err;
  }
};

/**
 * Monitor payouts and check if they are processed
 */
const monitorPayouts = async () => {
  try {
    console.log('Starting payout monitor...');
    
    // Setup the monitoring interval
    const checkInterval = setInterval(async () => {
      try {
        // Get current time
        const now = new Date();
        
        // Find all communities with active mid-cycles
        const communities = await Community.find()
          .populate({
            path: 'midCycle',
            match: { isComplete: false }
          });
        
        const activeCommunities = communities.filter(
          community => community.midCycle && community.midCycle.length > 0
        );
        
        console.log(`\n[${now.toISOString()}] Checking ${activeCommunities.length} communities with active mid-cycles`);
        
        // Check each community
        for (const community of activeCommunities) {
          const activeMidCycle = community.midCycle[0];
          
          if (activeMidCycle) {
            const payoutDate = activeMidCycle.payoutDate ? new Date(activeMidCycle.payoutDate) : null;
            
            if (payoutDate) {
              const timeUntilPayout = payoutDate - now;
              const minutesUntilPayout = Math.floor(timeUntilPayout / 60000);
              
              console.log(`Community: ${community.name}`);
              console.log(`  Mid-cycle ID: ${activeMidCycle._id}`);
              console.log(`  Ready: ${activeMidCycle.isReady ? 'Yes ✅' : 'No ❌'}`);
              console.log(`  Payout date: ${payoutDate.toISOString()}`);
              
              if (timeUntilPayout <= 0) {
                console.log(`  STATUS: 🚨 PAYOUT IS DUE! Should be processed by scheduler`);
                
                // Check if this payout has already been processed
                const recentPayout = await Payout.findOne({
                  communityId: community._id,
                  midCycleId: activeMidCycle._id
                }).sort('-createdAt');
                
                if (recentPayout) {
                  console.log(`  Recent payout found: ${recentPayout._id}`);
                  console.log(`  Payout created at: ${recentPayout.createdAt}`);
                  console.log(`  Payout amount: ${recentPayout.amount}`);
                } else {
                  console.log(`  No recent payout found. The scheduler should process this soon.`);
                }
              } else {
                console.log(`  STATUS: Time until payout: ${minutesUntilPayout} minutes`);
              }
            } else {
              console.log(`Community: ${community.name} - No payout date set`);
            }
          }
        }
        
        console.log('\nMonitoring continues... Press Ctrl+C to exit\n');
        
      } catch (err) {
        console.error('Error in monitoring interval:', err);
      }
    }, 30000); // Check every 30 seconds
    
    // Handle script termination
    process.on('SIGINT', () => {
      clearInterval(checkInterval);
      console.log('\nMonitoring stopped');
      mongoose.connection.close();
      process.exit(0);
    });
    
  } catch (err) {
    console.error('Error in monitorPayouts:', err);
  }
};

// Run the monitor
monitorPayouts();
