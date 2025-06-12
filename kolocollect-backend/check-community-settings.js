/**
 * Script to check the community settings for the Hellenic community
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const connectDB = require('./config/db');

dotenv.config();

// Connect to database
connectDB();

async function checkCommunitySettings() {
  try {
    console.log('Connecting to database and checking Hellenic community settings...');
    
    // Find the Hellenic community by ID
    const community = await Community.findById('682e22b613cf8d7b501c5eae');
    
    if (!community) {
      console.log('Hellenic community not found in the database.');
      return;
    }
    
    console.log('\n===== HELLENIC COMMUNITY SETTINGS =====');
    console.log(`Name: ${community.name}`);
    console.log(`ID: ${community._id}`);
    console.log(`Backup Fund: ${community.backupFund}`);
    console.log('\nSettings:');
    console.log(JSON.stringify(community.settings, null, 2));
    
    // Check backupFundPercentage specifically
    console.log('\nBackup Fund Percentage:');
    console.log(`- Raw value: ${community.settings.backupFundPercentage}`);
    console.log(`- As percentage: ${community.settings.backupFundPercentage * 100}%`);
    
    // If it's incorrect, suggest how to fix it
    if (community.settings.backupFundPercentage > 1) {
      console.log('\n⚠️ WARNING: Backup fund percentage appears to be incorrectly configured!');
      console.log('It should be a decimal between 0 and 1 (e.g., 0.1 for 10%).');
      console.log('Current value suggests it might be set as a percentage directly.');
    }
    
  } catch (error) {
    console.error('Error checking community settings:', error);
  } finally {
    // Disconnect from database
    mongoose.connection.close();
  }
}

// Run the check
checkCommunitySettings();
