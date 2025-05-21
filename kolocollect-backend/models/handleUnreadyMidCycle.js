/**
 * Implementation of handleUnreadyMidCycle method for Community model
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
                { $set: { backupFund: community.backupFund } }
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
