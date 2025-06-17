/**
 * Implementation of handleUnreadyMidCycle method for Community model
 * 
 * This implementation:
 * 1. Finds members who missed contributions
 * 2. Adds missed contribution records
 * 3. Freezes wallets if members exceed the allowed missed contribution threshold
 * 4. Compensates the next-in-line member using the backup fund
 * 5. Marks the mid-cycle as ready despite missing contributions
 */
const compensateDefaulters = require('../utils/compensateDefaulters');

module.exports = async function() {
    try {
        // Get fresh instance of the active mid-cycle
        const MidCycle = require('./Midcycle');
        const Member = require('./Member');

        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            isComplete: false
        });

        if (!activeMidCycle) {
            console.log('No active mid-cycle found to prepare.');
            return false;
        }

        console.log(`Preparing mid-cycle ${activeMidCycle._id} (cycle ${activeMidCycle.cycleNumber}) for payout...`);

        // Get all active members
        const eligibleMembers = await Member.find({
            _id: { $in: this.members },
            status: 'active'
        });

        // For each member, check if they've contributed
        let missingContributions = [];
        for (const member of eligibleMembers) {
            const hasContributed = activeMidCycle.contributions.some(c => 
                c.user.equals(member.userId) && c.contributions.length > 0
            );
              if (!hasContributed) {
                missingContributions.push({
                    memberId: member._id,
                    userId: member.userId,
                    name: member.name,
                    email: member.email
                });                
                // Create the missed contribution record
                const missedContribution = {
                    cycleNumber: activeMidCycle.cycleNumber, // Add the required cycleNumber
                    midCycles: [activeMidCycle._id],
                    amount: this.settings.minContribution,
                    date: new Date()
                };

                // Update the member using updateOne instead of save
                await Member.updateOne(
                    { _id: member._id },
                    { 
                        $inc: { penalty: this.settings.penalty },
                        $push: { missedContributions: missedContribution }
                    }
                );
                
                console.log(`Added missed contribution record for member ${member.name} (${member.userId})`);
                
                // Send missed contribution email notification
                try {
                    const User = mongoose.model('User');
                    const memberUser = await User.findById(member.userId);
                    
                    if (memberUser && memberUser.email) {
                        const emailService = require('../services/emailService');
                        await emailService.sendMissedContributionAlert({
                            memberEmail: memberUser.email,
                            communityName: this.name,
                            penaltyAmount: this.settings.penalty,
                            missedCount: (updatedMember?.missedContributions?.length || 0) + 1, // Add 1 for the current missed contribution
                            thresholdWarning: ((updatedMember?.missedContributions?.length || 0) + 1) >= this.settings.numMissContribution
                        });
                        console.log(`✅ Missed contribution alert email sent to ${memberUser.email}`);
                    }
                } catch (emailError) {
                    console.error('Failed to send missed contribution alert email:', emailError);
                    // Non-critical error, don't throw
                }
                
                // Get updated member to check the count of missed contributions
                const updatedMember = await Member.findById(member._id);
                if (updatedMember.missedContributions.length >= this.settings.numMissContribution) {
                    console.log(`Member ${updatedMember.name} has reached or exceeded the missed contribution threshold (${this.settings.numMissContribution}). Freezing wallet and setting member to inactive...`);
                    
                    // Set member status to inactive
                    await Member.updateOne(
                        { _id: updatedMember._id },
                        { $set: { status: 'inactive' } }
                    );                    console.log(`Member ${updatedMember.name} status set to inactive due to excessive missed contributions.`);
                    
                    // Log this significant status change to the community activity log
                    await this.addActivityLog(
                        'member_status_change',
                        updatedMember.userId,
                        `Member ${updatedMember.name} set to inactive due to ${updatedMember.missedContributions.length} missed contributions.`
                    );
                    
                    // Call handleWalletForDefaulters with 'freeze' action
                    try {
                        const result = await this.handleWalletForDefaulters(updatedMember.userId, 'freeze');
                        console.log(`Wallet freeze result: ${JSON.stringify(result)}`);
                    } catch (freezeErr) {
                        console.error(`Failed to freeze wallet for member ${updatedMember.name}:`, freezeErr);
                    }
                      // Notify the user about their status change with detailed information
                    try {
                        const mongoose = require('mongoose');
                        const User = mongoose.model('User');
                        const userDoc = await User.findById(updatedMember.userId);
                        if (userDoc) {
                            await userDoc.addNotification(
                                'alert',
                                `Your membership in community "${this.name}" has been set to inactive due to ${updatedMember.missedContributions.length} missed contributions. As an inactive member, you will no longer receive payouts, but you are still responsible for any outstanding penalties. Please contact the community admin if you wish to reinstate your membership.`,
                                this._id
                            );
                            
                            // Add a record to the user's activity log
                            userDoc.activityLog.push({
                                action: 'membership_status_change',
                                details: `Membership status in community "${this.name}" changed to inactive due to missed contributions.`,
                                date: new Date()
                            });
                            
                            await userDoc.save();
                            
                            console.log(`Notification sent to user ${updatedMember.userId} about inactive status in community ${this.name}`);
                        }
                    } catch (notifyErr) {
                        console.error(`Failed to notify user ${updatedMember.userId} about status change:`, notifyErr);
                    }
                }
            }
        }        // Create defaulters array with user IDs
        const defaulters = missingContributions.map(member => member.userId);
        
        // Get contributions made to the next-in-line
        const contributionsToNextInLine = activeMidCycle.contributions
            .filter(c => c.contributions && c.contributions.length > 0)
            .map(c => c.user);
          // Compensate the next-in-line member for defaulters using the backup fund
        if (defaulters.length > 0) {
            console.log(`Compensating for ${defaulters.length} defaulters using backup fund...`);
              // Call our compensateDefaulters function
            const { community, midCycle } = await compensateDefaulters(
                this, // community
                defaulters,
                contributionsToNextInLine,
                activeMidCycle
            );
              // Update the community using updateOne instead of save to avoid DivergentArrayError
            await this.constructor.updateOne(
                { _id: this._id },
                { $set: { 
                    backupFund: community.backupFund,
                    // Also update the community's payoutDetails.payoutAmount to match the midCycle
                    'payoutDetails.payoutAmount': midCycle.payoutAmount
                } }
            );
            
            // Add activity log for the compensation - only pass the admin user ID
            await this.addActivityLog('defaulter_compensation', this.admin);
            
            // Log compensation details separately
            console.log(`Compensation details: Amount: ${activeMidCycle.payoutAmount}, Defaulters: ${defaulters.length}`);
            console.log(`Next-in-line compensated from backup fund. New payout amount: ${activeMidCycle.payoutAmount}`);
        }        // Mark the mid-cycle as ready despite missing contributions using updateOne
        await MidCycle.updateOne(
            { _id: activeMidCycle._id },
            { $set: { isReady: true } }
        );
        
        // Add activity log with correct user ID parameter
        await this.addActivityLog('mid_cycle_forced_ready', this.admin);
        
        console.log(`Mid-cycle ${activeMidCycle._id} marked as ready for payout.`);
        console.log(`${missingContributions.length} members missed their contributions.`);
        
        return true;
    } catch (err) {
        console.error('Error in handleUnreadyMidCycle:', err);
        return false;
    }
};
