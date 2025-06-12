/**
 * This script fixes the Hellenic community's backup fund percentage configuration
 * It converts from 3 (which is being interpreted as 300%) to 0.03 (3%)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

// Connect to database
connectDB();

async function fixHellenicBackupPercentage() {
  try {
    console.log('Starting backup fund percentage fix for Hellenic community...');
    
    // Get the Community model
    const Community = mongoose.model('Community');
    
    // Find the Hellenic community
    const hellenicId = '682e22b613cf8d7b501c5eae';
    const community = await Community.findById(hellenicId);
    
    if (!community) {
      console.error('Could not find Hellenic community');
      return;
    }
    
    console.log('Found Hellenic community:');
    console.log(`Name: ${community.name}`);
    console.log(`Backup Fund: ${community.backupFund}`);
    console.log(`Current backup fund percentage: ${community.settings.backupFundPercentage}`);
    
    // Check if it's already in decimal form
    if (community.settings.backupFundPercentage > 1) {
      const oldValue = community.settings.backupFundPercentage;
      const newValue = oldValue / 100;
      
      console.log(`\nConverting backup fund percentage from ${oldValue} to ${newValue}`);
      
      // Update the value
      community.settings.backupFundPercentage = newValue;
      
      // Save the updated community
      await community.save();
      
      console.log('✅ Community settings updated successfully!');
      console.log(`New backup fund percentage: ${community.settings.backupFundPercentage}`);
    } else {
      console.log('Backup fund percentage is already in the correct format. No changes needed.');
    }
    
  } catch (error) {
    console.error('Error fixing Hellenic backup fund percentage:', error);
  } finally {
    // Disconnect from the database
    mongoose.connection.close();
  }
}

// Run the fix
fixHellenicBackupPercentage();
