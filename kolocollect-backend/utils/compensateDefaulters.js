/**
 * Compensates for defaulters by withdrawing from the backup fund to ensure
 * the next-in-line member receives their full payout amount
 * 
 * @param {Object} community - The community object with settings and backup fund info
 * @param {Array} defaulters - Array of user IDs who defaulted on their contributions
 * @param {Array} contributionsToNextInLine - Array of contributions made to the next in line
 * @param {Object} midCycle - The current mid-cycle object with payout information
 * @returns {Object} - Updated midCycle object and community object
 */
const compensateDefaulters = async (community, defaulters, contributionsToNextInLine, midCycle) => {
  try {
    // Log the compensation process start
    console.log(`Starting defaulter compensation for community: ${community._id}`);
    console.log(`Defaulters: ${defaulters.length}, Contributions: ${contributionsToNextInLine.length}`);

    // Calculate how many members didn't pay
    // This could also be calculated from defaulters.length if defaulters is already accurate
    const totalCommunityMembers = community.members.length;
    const contributedMembers = contributionsToNextInLine.length;
    const nonContributedMembers = totalCommunityMembers - contributedMembers;    
    
    // Initialize midCycle.defaulters if it doesn't exist
    if (!midCycle.defaulters) {
      midCycle.defaulters = [];
    }
    
    // Add current defaulters to midCycle.defaulters array
    for (const defaulterId of defaulters) {
      if (!midCycle.defaulters.includes(defaulterId)) {
        midCycle.defaulters.push(defaulterId);
      }
    }
      // Ensure defaulters array is updated with all defaulters' user IDs
    // This assumes defaulters is already populated, but we're making sure it's complete
    let actualDefaultersCount = defaulters.length;
    if (defaulters.length !== nonContributedMembers) {
      console.log('Warning: Defaulter count mismatch. Updating defaulters array...');
      // Use the actual count of non-contributing members for calculations
      actualDefaultersCount = nonContributedMembers;
      
      // Log the discrepancy between what was provided and what was calculated
      console.log(`Defaulters array has ${defaulters.length} entries, but ${nonContributedMembers} members didn't contribute`);
      
      // If there are fewer defaulters in the array than non-contributing members,
      // we need to add placeholder entries to the midCycle.defaulters array
      if (defaulters.length < nonContributedMembers) {
        const missingCount = nonContributedMembers - defaulters.length;
        for (let i = 0; i < missingCount; i++) {
          // Add placeholder entries with a generated ID to track the mismatch
          const placeholderId = `unknown_defaulter_${i + 1}`;
          midCycle.defaulters.push(placeholderId);
        }
        console.log(`Added ${missingCount} placeholder entries to defaulters list`);
      }
    }

    // Calculate deficit amount based on actual number of non-contributing members
    const deficitAmount = community.settings.minContribution * actualDefaultersCount;
    console.log(`Deficit amount: ${deficitAmount}`);

    // Check available backup fund
    const backupFundAvailable = community.backupFund || 0;
    console.log(`Backup fund available: ${backupFundAvailable}`);

    // Determine withdrawal amount
    let withdrawalAmount = 0;
    if (backupFundAvailable >= deficitAmount) {
      withdrawalAmount = deficitAmount;
      console.log(`Backup fund is sufficient. Withdrawing: ${withdrawalAmount}`);
    } else {
      withdrawalAmount = backupFundAvailable;
      console.log(`Backup fund is insufficient. Withdrawing all available: ${withdrawalAmount}`);
    }    // Only proceed if there's something to withdraw
    if (withdrawalAmount > 0) {
        console.log(`Withdrawing ${withdrawalAmount} from backup fund...`);
        const backup = withdrawalAmount * community.settings.backupFundPercentage;
        console.log(`BackUp: ${backup}`);
        withdrawalAmount -= backup;
        console.log(`Final withdrawal amount after backup: ${withdrawalAmount}`);
      // Update backup fund in the community object
      community.backupFund -= withdrawalAmount;

      // Update payout amount in the midCycle object
      midCycle.payoutAmount += withdrawalAmount;

      console.log(`Updated backup fund: ${community.backupFund}`);
      console.log(`Updated payout amount: ${midCycle.payoutAmount}`);      // Create a compensation record for auditing
      const compensationRecord = {
        date: new Date(),
        amount: withdrawalAmount,
        defaultersCount: defaulters.length,
        communityId: community._id,
        cycleId: midCycle._id
      };

      // This will be used by the caller to update the midCycle in the database
      if (!midCycle.compensations) {
        midCycle.compensations = [];
      }
      midCycle.compensations.push(compensationRecord);
        // Check if we need to update the defaulters array based on actual count
      if (actualDefaultersCount !== defaulters.length) {
        console.log('Updating midCycle defaulters array to match actual defaulters count');
        // We're using the existing defaulters array, but if there's a mismatch, 
        // we should log it and potentially handle it more fully in a future update
        console.log(`Note: midCycle defaulters array has ${midCycle.defaulters.length} entries, but ${actualDefaultersCount} members didn't contribute`);
      }
      
      // Update the midCycle directly in the database
      try {
        await midCycle.constructor.updateOne(
          { _id: midCycle._id },
          { 
            $set: { 
              payoutAmount: midCycle.payoutAmount,
              defaulters: midCycle.defaulters
            },
            $push: { compensations: compensationRecord }
          }
        );
        console.log('MidCycle updated successfully in database');
      } catch (dbError) {
        console.error('Failed to update midCycle in database:', dbError);
        // Continue with the function since we're still returning the updated objects
      }
    } else {
      console.log('No compensation needed or possible.');
    }

    // Return updated objects
    return {
      community,
      midCycle
    };
  } catch (error) {
    console.error('Error in compensateDefaulters:', error);
    throw error;
  }
};

module.exports = compensateDefaulters;
