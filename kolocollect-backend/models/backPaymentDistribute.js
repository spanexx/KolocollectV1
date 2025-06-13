const mongoose = require('mongoose');

/**
 * Distributes back payments to eligible members from mid-cycle joiners
 * @param {ObjectId} midCycleJoinersId - ID of the mid-cycle joiner
 * @returns {Promise<Object>} Result of back payment distribution
 */
module.exports = async function backPaymentDistribute(midCycleJoinersId) {
  try {
    console.log(`Starting back payment distribution for midCycleJoinersId: ${midCycleJoinersId}`);
    
    // Step 1: Find the mid-cycle joiner using the updated searchMidcycleJoiners method
    const midCycleJoiner = await this.searchMidcycleJoiners(midCycleJoinersId);
    
    console.log(`Found mid-cycle joiner:`, midCycleJoiner);
    
    // Step 2: Get the Member document for this joiner
    const Member = mongoose.model('Member');
    const member = await Member.findOne({ 
      userId: midCycleJoiner.joiners, 
      communityId: this._id
    });
    
    if (!member) {
      throw new Error('Member not found in this community.');
    }
    
    console.log(`Found member:`, {
      memberId: member._id,
      name: member.name,
      email: member.email,
      remainingAmount: member.paymentPlan?.remainingAmount,
      installments: member.paymentPlan?.installments
    });
      // Step 3: Check if the member's payment plan is complete
    if (!member.paymentPlan) {
      throw new Error('Member does not have a payment plan.');
    }
    
    if (member.paymentPlan.remainingAmount !== 0) {
      throw new Error('Member has not completed their payment plan. Second installment must be paid first.');
    }
    
    
    // Also verify the midCycleJoiner entry has secondInstallmentPaid marked as true
    // This helps ensure we don't try to distribute payments that haven't been properly recorded
    if (midCycleJoiner.secondInstallmentPaid !== true) {
      console.log('Second installment payment not properly recorded in midCycleJoiner entry. Marking it now.');
      // Instead of failing, let's just mark it as paid since we've already verified the payment plan
      midCycleJoiner.secondInstallmentPaid = true;
      
      // Find and update the midcycle directly
      try {
        const MidCycle = mongoose.model('MidCycle');
        const midCycle = await MidCycle.findOne({ 
          'midCycleJoiners._id': midCycleJoinersId 
        });
        
        if (midCycle) {
          const joinerIndex = midCycle.midCycleJoiners.findIndex(j => 
            j._id.toString() === midCycleJoinersId.toString()
          );
          
          if (joinerIndex >= 0) {
            midCycle.midCycleJoiners[joinerIndex].secondInstallmentPaid = true;
            await midCycle.save();
            console.log('Updated midCycleJoiner record with secondInstallmentPaid = true');
          }
        }
      } catch (err) {
        console.warn('Failed to update midCycleJoiner.secondInstallmentPaid flag:', err.message);
      }
    }
    
    // Step 4: Calculate net contribution after accounting for backup fund
    const backupFundPercentage = this.settings.backupFundPercentage || 0;
    const backupFund = (backupFundPercentage / 100) * member.paymentPlan.previousContribution;
    
    // Update the backup fund amount in the community
    this.backupFund += backupFund;
      // Step 5: Process the paid members from the mid-cycle joiner entry
    // Ensure paidMembers is an array of ObjectIds
    if (!midCycleJoiner.paidMembers || !Array.isArray(midCycleJoiner.paidMembers)) {
      console.error(`Invalid paidMembers structure:`, midCycleJoiner.paidMembers);
      throw new Error('No valid paid members array found in the mid-cycle joiner record.');
    }
    
    // Safely convert all members to ObjectIds, handling any invalid IDs gracefully
    let paidMembers;
    try {
      paidMembers = midCycleJoiner.paidMembers
        .filter(id => id) // Remove any null/undefined values
        .map(id => {
          try {
            return typeof id === 'object' ? id : new mongoose.Types.ObjectId(id.toString());
          } catch (err) {
            console.warn(`Invalid ObjectId format for member: ${id}`);
            return null;
          }
        })
        .filter(id => id !== null); // Remove any invalid conversions
    } catch (e) {
      console.error('Error processing paidMembers array:', e);
      throw new Error('Failed to process the list of paid members. Data format issue.');
    }
      
    if (paidMembers.length === 0) {
      console.error('Empty paidMembers array after processing', { 
        originalArray: midCycleJoiner.paidMembers 
      });
      throw new Error('No valid paid members found for this mid-cycle joiner.');
    }
    
    console.log(`Found ${paidMembers.length} paid members to distribute payments to`);
    
    // Step 6: Calculate distribution amount
    const previousContribution = member.paymentPlan.previousContribution || 0;
    const distributableAmount = previousContribution - backupFund;
    const amountPerPerson = distributableAmount / paidMembers.length;
    
    if (amountPerPerson <= 0) {
      throw new Error('No positive amount available for distribution after backup fund deduction.');
    }
    
    console.log(`Distribution details:`, {
      previousContribution,
      backupFundPercentage: `${backupFundPercentage}%`,
      backupFund,
      distributableAmount,
      amountPerPerson,
      totalRecipients: paidMembers.length
    });
    
    // Step 7: Process payments to eligible members' wallets
    const Wallet = mongoose.model('Wallet');
    const paymentPromises = [];
    const successfulPayments = [];
    let failedPayments = 0;
    
    for (const paidMemberId of paidMembers) {
      try {
        const wallet = await Wallet.findOne({ userId: paidMemberId });
        if (!wallet) {
          console.warn(`Wallet not found for user ID: ${paidMemberId}`);
          failedPayments++;
          continue;
        }
        
        // Add transaction to wallet
        await wallet.addTransaction(
          amountPerPerson,
          'deposit',
          `Back payment distribution from community ${this.name}`,
          paidMemberId,
          this._id
        );
        
        console.log(`Back payment of €${amountPerPerson} distributed to member ID ${paidMemberId}.`);
        successfulPayments.push(paidMemberId);
      } catch (err) {
        console.error(`Failed to process payment to member ${paidMemberId}:`, err);
        failedPayments++;
      }
    }
    
    if (successfulPayments.length === 0) {
      throw new Error('Failed to distribute payments to any eligible members.');
    }
      // Step 8: Update the member's payment plan
    const prevAmount = member.paymentPlan.previousContribution;
    member.paymentPlan.previousContribution = 0;
    await member.save();
    
    // Update the owing member entry to mark as distributed
    const owingMemberIndex = this.owingMembers.findIndex(
      om => om.userId && om.userId.toString() === member.userId.toString()
    );
      if (owingMemberIndex >= 0) {
      this.owingMembers[owingMemberIndex].isDistributed = true;
      console.log(`Marked owing member at index ${owingMemberIndex} as distributed`);
      
      // Make sure to save the community to persist this change
      const saveResult = await this.save();
      console.log(`Community saved after marking owing member as distributed: ${saveResult._id}`);
    } else {
      console.warn(`Could not find owing member entry for userId ${member.userId}`);
    }
    
    // Step 9: Update the mid-cycle documents for each paid member
    // Get the MidCycle model to directly query and update mid-cycle documents
    const MidCycle = mongoose.model('MidCycle');
    
    // Get current active cycle
    const activeCycle = this.cycles.find(c => !c.isComplete);
    const currentCycleNumber = activeCycle?.cycleNumber;
    
    if (!currentCycleNumber) {
      console.warn('No active cycle found, but continuing with payment distribution.');
    }
    
    // Find relevant mid-cycles for the paid members
    let updatedMidCycles = 0;
    let midCycleUpdateErrors = 0;
    
    for (const paidMemberId of successfulPayments) {
      try {
        // Find mid-cycles where this paid member is the next in line
        const relevantMidCycles = await MidCycle.find({
          _id: { $in: this.midCycle },
          'nextInLine.userId': paidMemberId
        });
        
        for (const midCycle of relevantMidCycles) {          try {
            // Make sure the contributionsToNextInLine exists and handle it as a Map
            if (!midCycle.contributionsToNextInLine) {
              midCycle.contributionsToNextInLine = new Map();
            }
            
            // Add to contributionsToNextInLine using the proper Map methods
            const joinerIdStr = midCycleJoiner.joiners.toString();
            
            // Get the current value using Map.get() or default to 0
            let currentAmount = 0;
            if (midCycle.contributionsToNextInLine instanceof Map) {
              currentAmount = midCycle.contributionsToNextInLine.get(joinerIdStr) || 0;
            } else {
              // Handle the case where it's stored as a plain object
              currentAmount = (midCycle.contributionsToNextInLine[joinerIdStr] || 0);
              // Convert to a proper Map if it's not already
              const tempMap = new Map();
              Object.keys(midCycle.contributionsToNextInLine).forEach(key => {
                tempMap.set(key, midCycle.contributionsToNextInLine[key]);
              });
              midCycle.contributionsToNextInLine = tempMap;
            }
            
            const totalAmount = prevAmount / paidMembers.length;
            
            // Update the amount in the contributions map using Map.set()
            midCycle.contributionsToNextInLine.set(joinerIdStr, currentAmount + totalAmount);
            
            // Mark the field as modified to ensure MongoDB updates it
            midCycle.markModified('contributionsToNextInLine');
            
            // Log the update for debugging
            console.log(`Updated contributionsToNextInLine for member ${paidMemberId} in midCycle ${midCycle._id}:`, {
              joinerIdStr,
              previousAmount: currentAmount,
              addedAmount: totalAmount,
              newTotal: currentAmount + totalAmount
            });
            
            // Make sure the contributions array exists
            if (!midCycle.contributions) {
              midCycle.contributions = [];
            }
              // Create a proper contribution record with amount information
            const Contribution = mongoose.model('Contribution');
            const newContribution = new Contribution({
              communityId: this._id,
              userId: midCycleJoiner.joiners,
              amount: totalAmount, // Use the calculated amount per person
              midCycleId: midCycle._id,
              cycleNumber: midCycle.cycleNumber,
              status: 'completed',
              date: new Date(),
              penalty: 0,
              missedReason: null,
              paymentPlan: { 
                type: 'Full', 
                remainingAmount: 0, 
                installments: 0 
              }
            });
            
            // Save the new contribution
            const savedContribution = await newContribution.save();
            console.log(`Created new contribution record with amount ${totalAmount} and ID ${savedContribution._id}`);
            
            // Add to contributions array
            const userContribIdx = midCycle.contributions.findIndex(c => 
              c.user && c.user.toString() === midCycleJoiner.joiners.toString()
            );
            
            if (userContribIdx >= 0) {
              // User already has a contribution entry, add the new contribution to it
              midCycle.contributions[userContribIdx].contributions.push(savedContribution._id);
            } else {
              // Create a new contribution entry with the reference to the saved contribution
              midCycle.contributions.push({
                user: midCycleJoiner.joiners,
                contributions: [savedContribution._id]
              });
            }
              // Also update the User document's contributions
            try {
              const User = mongoose.model('User');
              const user = await User.findById(midCycleJoiner.joiners);
              if (user && user.addContribution) {
                await user.addContribution(savedContribution._id, savedContribution.amount);
                console.log(`Updated user ${midCycleJoiner.joiners} with contribution reference`);
              }
            } catch (userUpdateErr) {
              console.warn(`Error updating user's contribution references: ${userUpdateErr.message}`);
              // Continue even if user update fails
            }
            
            // Save the updates to this mid-cycle
            await midCycle.save();
            updatedMidCycles++;
          } catch (err) {
            console.error(`Error updating mid-cycle ${midCycle._id}:`, err);
            midCycleUpdateErrors++;
          }
        }
      } catch (err) {
        console.error(`Error finding relevant mid-cycles for member ${paidMemberId}:`, err);
        midCycleUpdateErrors++;
      }
    }      // Step 10: Mark the midCycleJoiner as complete
    let joinerMarkedComplete = false;
    try {
      // Use findOne instead of findById for more flexibility
      const MidCycle = mongoose.model('MidCycle');
      let midCycleToUpdate;
      
      if (midCycleJoiner.midCycleId) {
        midCycleToUpdate = await MidCycle.findById(midCycleJoiner.midCycleId);
      }
      
      // If we couldn't find it by ID, try to find it by the joiner's ID
      if (!midCycleToUpdate) {
        midCycleToUpdate = await MidCycle.findOne({
          _id: { $in: this.midCycle },
          'midCycleJoiners._id': midCycleJoinersId
        });
      }
      
      if (midCycleToUpdate) {
        // Get the ID string for comparison
        const targetJoinerId = midCycleJoinersId.toString();
        
        // Find the joiner index by stringifying the IDs before comparison
        const joinerIndex = midCycleToUpdate.midCycleJoiners.findIndex(j => 
          j._id && j._id.toString() === targetJoinerId
        );
        
        if (joinerIndex >= 0) {
          midCycleToUpdate.midCycleJoiners[joinerIndex].isComplete = true;
          midCycleToUpdate.midCycleJoiners[joinerIndex].secondInstallmentPaid = true;
          midCycleToUpdate.midCycleJoiners[joinerIndex].backPaymentDistributed = true;
          midCycleToUpdate.midCycleJoiners[joinerIndex].distributionDate = new Date();
          await midCycleToUpdate.save();
          joinerMarkedComplete = true;
          console.log(`Successfully marked joiner at index ${joinerIndex} as complete`);
        } else {
          console.warn(`Could not find joiner entry in mid-cycle ${midCycleToUpdate._id}. Looking for ID: ${targetJoinerId}`);
        }
      } else {
        console.warn(`Could not find mid-cycle for joiner ID: ${midCycleJoinersId}`);
      }
    } catch (err) {
      console.error(`Error marking midCycleJoiner as complete:`, err);
    }
    
    // Save community updates (mainly for backup fund)
    await this.save();
      console.log('Back payment distribution completed successfully');
    return { 
      success: true,
      message: 'Back payment distribution completed successfully.',
      details: {
        amountDistributed: distributableAmount,
        amountPerPerson,
        recipientCount: successfulPayments.length,
        failedPayments,
        backupFundContribution: backupFund,
        updatedMidCycles,
        midCycleUpdateErrors,
        joinerMarkedComplete,
        isDistributed: true,
        owingMemberUpdated: (owingMemberIndex >= 0)
      }    };  } catch (err) {
    console.error('Error in backPaymentDistribute:', err);
    console.error('Error stack:', err.stack);
    
    // Log more context information for debugging
    console.log('Context for error:', {
      communityId: this._id,
      communityName: this.name,
      midCycleJoinersId: midCycleJoinersId ? midCycleJoinersId.toString() : 'undefined',
      midCycleCount: this.midCycle ? this.midCycle.length : 'unknown'
    });
    
    // Handle known error cases with user-friendly messages
    if (err.message.includes('Member has not completed their payment plan') ||
        err.message.includes('Second installment must be paid') ||
        err.message.includes('Member must complete two installments')) {
      return { 
        success: false,
        message: err.message
      };
    }
    
    // Handle mid-cycle joiner not found errors
    if (err.message.includes('No mid-cycle joiner found') ||
        err.message.includes('No paid members found')) {
      return { 
        success: false,
        message: 'No mid-cycle joiner found for the given ID. Please verify the ID is correct.',
        details: err.message
      };
    }
    
    // For other errors, return a generic error message with details
    return {
      success: false,
      message: 'An error occurred while distributing back payments.',
      details: err.message
    };
  }
};
