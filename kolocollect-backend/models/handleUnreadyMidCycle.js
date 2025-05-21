/**
 * Implementation of handleUnreadyMidCycle method for Community model
 */
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

                // Apply penalty to the member for missed contribution
                member.penalty += this.settings.penalty;
                
                // Track the missed contribution with mid-cycle reference
                member.missedContributions.push({
                    midCycles: [activeMidCycle._id],
                    amount: this.settings.minContribution,
                    date: new Date()
                });
                
                // Save the updated member
                await member.save();
                
                console.log(`Added missed contribution record for member ${member.name} (${member.userId})`);
            }
        }

        // Mark the mid-cycle as ready despite missing contributions
        activeMidCycle.isReady = true;
        await activeMidCycle.save();
        
        await this.addActivityLog('mid_cycle_forced_ready', this.admin);
        
        console.log(`Mid-cycle ${activeMidCycle._id} marked as ready for payout.`);
        console.log(`${missingContributions.length} members missed their contributions.`);
        
        return true;
    } catch (err) {
        console.error('Error in handleUnreadyMidCycle:', err);
        return false;
    }
};
