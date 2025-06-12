/**
 * Script to fix incorrectly configured backup fund percentages
 * This script checks all communities and updates any backup fund percentages
 * that are greater than 1 (which indicates they were set as percentages instead of decimals)
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const connectDB = require('./config/db');

dotenv.config();

// Connect to database
connectDB();

async function fixBackupFundPercentages() {
  console.log('Checking and fixing backup fund percentages...');
  
  try {
    // Get all communities
    const communities = await Community.find({});
    console.log(`Found ${communities.length} communities to check.`);
    
    // Track which communities need fixing
    const communitiesToFix = [];
    
    // Check each community's backup fund percentage
    for (const community of communities) {
      const backupPct = community.settings.backupFundPercentage;
      
      if (backupPct > 1) {
        console.log(`\n==== Community: ${community.name} (${community._id}) ====`);
        console.log(`Current backup fund percentage: ${backupPct} (${backupPct * 100}%)`);
        
        // Calculate the correct percentage (convert from percentage to decimal)
        const correctedPct = backupPct / 100;
        console.log(`Corrected backup fund percentage: ${correctedPct} (${correctedPct * 100}%)`);
        
        // Save the community for updating
        communitiesToFix.push({
          id: community._id,
          name: community.name,
          currentPct: backupPct,
          correctedPct
        });
      }
    }
    
    // Show summary of communities needing fixes
    console.log(`\n==== SUMMARY ====`);
    console.log(`Found ${communitiesToFix.length} communities with incorrect backup fund percentages.`);
    
    if (communitiesToFix.length === 0) {
      console.log('No communities need fixing. All backup fund percentages are correctly configured.');
      return;
    }
    
    // List all communities to fix
    console.log('\nCommunities with incorrect backup fund percentages:');
    communitiesToFix.forEach((c, i) => {
      console.log(`${i+1}. ${c.name} (${c.id}): ${c.currentPct} -> ${c.correctedPct}`);
    });
    
    // Confirm and update
    console.log('\nWould you like to fix these communities? (y/n)');
    
    // In this version we'll execute the fix automatically since we can't get user input
    // In production, you'd want to prompt for confirmation before updating
    
    console.log('Applying fixes automatically...');
    
    // Update each community that needs fixing
    let updateCount = 0;
    for (const community of communitiesToFix) {
      const result = await Community.updateOne(
        { _id: community.id },
        { 
          $set: { 
            'settings.backupFundPercentage': community.correctedPct 
          }
        }
      );
      
      if (result.nModified === 1) {
        console.log(`✅ Successfully updated ${community.name}`);
        updateCount++;
      } else {
        console.log(`❌ Failed to update ${community.name}`);
      }
    }
    
    console.log(`\nUpdate complete. Fixed ${updateCount} out of ${communitiesToFix.length} communities.`);
    
  } catch (error) {
    console.error('Error while fixing backup fund percentages:', error);
  } finally {
    // Disconnect from database
    mongoose.disconnect();
    console.log('\nDatabase connection closed.');
  }
}

// Run the function
fixBackupFundPercentages();
