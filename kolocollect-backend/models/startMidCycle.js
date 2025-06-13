/**
 * Implementation of startMidCycle method for Community model
 * 
 * This implementation handles the complete mid-cycle creation process:
 * 
 * 1. VALIDATION AND PREPARATION
 *    - Finds active cycle that is not yet complete
 *    - Identifies eligible members who haven't been paid yet
 *    - Selects next-in-line recipient based on position order
 *
 * 2. MID-CYCLE CREATION
 *    - Creates new MidCycle document with proper initialization
 *    - Sets up contribution tracking structures
 *    - Calculates next payout date based on contribution frequency
 *
 * 3. LINKING AND UPDATES
 *    - Links mid-cycle to both community and active cycle
 *    - Updates community payout information
 *    - Creates activity log entry
 *    - Saves all changes to database
 */

const mongoose = require('mongoose');
const { calculateNextPayoutDate } = require('../utils/payoutUtils');

module.exports = async function () {
    try {
        const Cycle = mongoose.model('Cycle');
        const MidCycle = mongoose.model('MidCycle');
        const Member = mongoose.model('Member');

        // STEP 1: Find active cycle
        const activeCycle = await Cycle.findOne({ 
            _id: { $in: this.cycles }, 
            isComplete: false 
        });
        console.log(`Active cycle found: ${activeCycle}`);
        
        if (!activeCycle) {
            throw new Error('No active cycle found.');
        }

        // STEP 2: Get all active members sorted by position
        const activeMembers = await Member.find({ 
            _id: { $in: this.members },
            status: 'active',
            position: { $ne: null }
        }).sort('position');
        
        // STEP 3: Find members who haven't been paid yet in this cycle
        const unpaidMembers = activeMembers.filter(member => {
            // Convert ObjectIds to strings for comparison
            const memberUserId = member.userId.toString();
            return !activeCycle.paidMembers.some(paidMemberId => 
                paidMemberId.toString() === memberUserId
            );
        });
        
        // STEP 4: Validate there are unpaid members
        if (unpaidMembers.length === 0) {
            throw new Error('All active members have received payouts in this cycle.');
        }
        
        // STEP 5: Select the member with the lowest position who hasn't been paid yet
        const nextInLine = unpaidMembers[0];
        
        if (!nextInLine) {
            throw new Error('No eligible member found for payout.');
        }

        // Log the selected next in line member for debugging
        console.log(`Next in line: Member ${nextInLine.name} with position ${nextInLine.position}`);

        // STEP 6: Create new mid-cycle document
        const newMidCycle = new MidCycle({
            cycleNumber: activeCycle.cycleNumber,
            nextInLine: { userId: nextInLine.userId },
            contributions: [],
            midCycleJoiners: [], // Initialize with empty array to prevent undefined errors
            isComplete: false,
            isReady: false,
            payoutAmount: 0,
            contributionsToNextInLine: new Map(),
            payoutDate: calculateNextPayoutDate(this.settings.contributionFrequency)
        });

        await newMidCycle.save();
        
        // STEP 7: Add the new midcycle to both community and cycle arrays
        this.midCycle.push(newMidCycle._id);
        activeCycle.midCycles.push(newMidCycle._id);
        
        await activeCycle.save();

        // STEP 8: Update payout information
        await this.updatePayoutInfo();

        // STEP 9: Mark midCycle array as modified and save community
        this.markModified('midCycle');
        await this.save();

        // STEP 10: Add activity log entry
        await this.addActivityLog('start_mid_cycle', this.admin);

        return { 
            message: 'Mid-cycle started successfully.', 
            midCycle: newMidCycle 
        };
    } catch (err) {
        console.error('Error starting mid-cycle:', err);
        throw err;
    }
};
