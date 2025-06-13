/**
 * Implementation of startNewCycle method for Community model
 * 
 * This implementation handles the complete new cycle creation process:
 * 
 * 1. VALIDATION AND PREPARATION
 *    - Checks for active cycles and ensures current cycle is complete
 *    - Validates all members have been paid before starting new cycle
 *    - Ensures minimum member requirement is met
 *
 * 2. VOTE RESOLUTION
 *    - Handles unresolved community votes
 *    - Applies resolved vote outcomes to community settings
 *
 * 3. MEMBER MANAGEMENT
 *    - Updates member positions based on community positioning mode
 *    - Activates waiting members if cycle lock is disabled
 *    - Handles defaulter wallet operations
 *
 * 4. CYCLE CREATION
 *    - Creates new cycle record with sequential cycle number
 *    - Links cycle to community
 *    - Starts first mid-cycle of the new cycle
 *    - Updates payout information
 */

const mongoose = require('mongoose');

module.exports = async function () {
    try {
        const Cycle = mongoose.model('Cycle');
        const Member = mongoose.model('Member');
        const CommunityVote = mongoose.model('CommunityVote');
        const Wallet = mongoose.model('Wallet');

        // STEP 1: Check for any active cycles and validate completion
        const activeCycle = await Cycle.findOne({ 
            communityId: this._id,
            isComplete: false 
        });
        console.log(`Active cycle found: ${activeCycle}`);
        
        // If there's an active cycle, ensure it's properly completed
        if (activeCycle) {
            console.log('Found active cycle that should be complete:', activeCycle._id);
            
            // Double check if all members have been paid to be sure
            const activeMembers = await Member.find({ 
                communityId: this._id,
                status: 'active' 
            });
            
            const paidMemberIds = activeCycle.paidMembers.map(id => id.toString());
            const allPaid = activeMembers.every(member => 
                paidMemberIds.includes(member.userId.toString())
            );
            
            if (allPaid) {
                // All members are paid, so we can safely mark it complete
                console.log('All members were actually paid, marking cycle complete');
                activeCycle.isComplete = true;
                activeCycle.endDate = new Date();
                await activeCycle.save();
            } else {
                throw new Error('Cannot start a new cycle until the current cycle is complete and all members have been paid.');
            }
        }

        // STEP 2: Calculate new cycle number
        // Get all cycles for this community, including ones that were just marked complete
        const existingCycles = await Cycle.find({ communityId: this._id });
        console.log('community id:', this._id);
        console.log(`Found ${existingCycles.length} existing cycles for this community`);
        
        // Log each cycle to debug
        existingCycles.forEach(cycle => {
            console.log(`Cycle ID: ${cycle._id}, Number: ${cycle.cycleNumber}, isComplete: ${cycle.isComplete}`);
        });
        
        // Simply use the length of the community's cycles array plus 1
        // This ensures we always get a sequential cycle number
        const completedCycleCount = this.cycles.length;
        const newCycleNumber = completedCycleCount + 1;
        
        console.log(`Community has ${completedCycleCount} cycle(s), new cycle number will be: ${newCycleNumber}`);

        // STEP 3: Get all active members
        let members = await Member.find({ 
            communityId: this._id,
            status: 'active'
        });

        // STEP 4: Handle unresolved votes
        const unresolvedVotes = await CommunityVote.find({
            communityId: this._id,
            resolved: false
        });
        for (const vote of unresolvedVotes) {
            await this.resolveVote(vote._id);
        }
        await this.applyResolvedVotes();

        // STEP 5: Update member positions for the new cycle
        await this.updateMemberPositions(members, false);
        
        // STEP 6: Validate minimum member requirement
        if (members.length < this.settings.firstCycleMin) {
            throw new Error(`Cannot start a new cycle: minimum required members is ${this.settings.firstCycleMin}, but only ${members.length} present.`);
        }
        
        // STEP 7: Create new cycle
        const newCycle = new Cycle({
            communityId: this._id,
            cycleNumber: newCycleNumber,
            isComplete: false,
            startDate: new Date()
        });
        await newCycle.save();
        console.log(`New cycle created: ${newCycle}`);

        // STEP 8: Add the new cycle to the community's cycles array and save
        this.cycles.push(newCycle._id);
        await this.save();
        console.log(`Added new cycle to community's cycles array`);

        // STEP 9: Activate waiting members if cycleLockEnabled is false
        const activationResult = await this.activateWaitingMembers();
        console.log(activationResult.message);

        // If members were activated, get the updated list of active members
        if (activationResult.activatedCount > 0) {
            members = await Member.find({ 
                communityId: this._id,
                status: 'active'
            });
            // Update positions for newly activated members
            await this.updateMemberPositions(members, false);
        }

        // STEP 10: Handle defaulters' wallets
        for (const member of members) {
            if (member.missedContributions.length > 0 || member.penalty > 0) {
                const wallet = await Wallet.findOne({ userId: member.userId });
                if (wallet) {
                    await this.handleWalletForDefaulters(member.userId, 'deduct');
                }
            }
        }

        // STEP 11: Start first mid-cycle and update payout info
        await this.startMidCycle();
        await this.updatePayoutInfo();

        return { message: `Cycle ${newCycleNumber} started successfully.` };
    } catch (err) {
        console.error('Error starting new cycle:', err);
        throw err;
    }
};
