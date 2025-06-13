const mongoose = require('mongoose');

/**
 * Adds a new member to the community during a mid-cycle
 * @param {ObjectId} userId - ID of the user joining
 * @param {string} name - Name of the user
 * @param {string} email - Email of the user
 * @param {number} contributionAmount - Amount the user is contributing
 * @param {ObjectId} communityId - ID of the community
 * @returns {Promise<Object>} Result of adding the member
 */
module.exports = async function addNewMemberMidCycle(userId, name, email, contributionAmount, communityId) {
    try {
        const Cycle = mongoose.model('Cycle');
        const MidCycle = mongoose.model('MidCycle');
        const Member = mongoose.model('Member');
        const Wallet = mongoose.model('Wallet');

        console.log(`Adding new member ${name} (${userId}) to mid-cycle...`);
        console.log(`Contribution amount: €${contributionAmount}`);
        console.log(`Community ID: ${communityId}`);

        // Find the active cycle
        const activeCycle = await Cycle.findOne({
            communityId,
            isComplete: false
        });
        if (!activeCycle) throw new Error('No active cycle found.');

        // Find the active mid-cycle
        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            cycleNumber: activeCycle.cycleNumber,
            isComplete: false
        });
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        // Get current members count for position calculation
        const currentMembers = await Member.find({ communityId: this._id });
        const missedCycles = activeCycle.paidMembers ? activeCycle.paidMembers.length : 0;
        const totalAmount = (missedCycles + 1) * this.settings.minContribution;

        // Calculate required contribution
        let requiredContribution;
        if (missedCycles <= Math.floor(currentMembers.length / 2)) {
            requiredContribution = this.settings.minContribution + totalAmount * 0.5;
        } else {
            const missedPercentage = missedCycles / currentMembers.length;
            requiredContribution = missedPercentage * totalAmount;
        }

        // Validate contribution amount
        if (contributionAmount < requiredContribution) {
            throw new Error(
                `Insufficient contribution. You must contribute at least €${requiredContribution.toFixed(2)} to join mid-cycle.`
            );
        }

        // Calculate backup fund
        const backupFund = (this.settings.backupFundPercentage / 100) * contributionAmount;
        this.backupFund += backupFund;

        // Handle wallet transaction
        const wallet = await Wallet.findOne({ userId });
        if (!wallet) throw new Error('Wallet not found.');

        const remainingAmount = contributionAmount - this.settings.minContribution;
        if (wallet.availableBalance < remainingAmount) {
            throw new Error('Insufficient wallet balance for the contribution.');
        }

        await wallet.addTransaction(
            remainingAmount,
            'contribution',
            `Contribution to community ${this.name}`,
            null,
            this._id
        );        // Create new member
        const newMember = new Member({
            communityId: this._id,
            userId,
            name,
            email,
            // Set status to 'waiting' if cycleLockEnabled is true, otherwise 'active'
            status: this.cycleLockEnabled ? 'waiting' : 'active',
            penalty: 0,
            missedContributions: [],
            paymentPlan: {
                type: 'Incremental',
                totalPreviousContribution: this.settings.minContribution * missedCycles,
                remainingAmount: (totalAmount - this.settings.minContribution) - (contributionAmount - this.settings.minContribution),
                previousContribution: contributionAmount - this.settings.minContribution,
                installments: 1
            }
        });        // Save the new member
        await newMember.save();        // Add the new member to the community's members array
        this.members.push(newMember._id);
        
        // Set position for the new member only (no need to update all members)
        newMember.position = currentMembers.length + 1;
        await newMember.save();        // Update mid-cycle joiners, ensuring the array exists first
        if (!activeMidCycle.midCycleJoiners) {
            activeMidCycle.midCycleJoiners = [];
        }
        
        activeMidCycle.midCycleJoiners.push({
            joiners: userId,
            paidMembers: activeCycle.paidMembers || [],
            isComplete: false
        });
        await activeMidCycle.save();

        // Handle owing members tracking
        // if (newMember.paymentPlan.remainingAmount > 0) {
            this.owingMembers.push({
                userId: newMember.userId,
                userName: newMember.name,
                remainingAmount: newMember.paymentPlan.remainingAmount,
                paidAmount: contributionAmount - this.settings.minContribution,
                installments: newMember.paymentPlan.installments
            });
        // }       
        
        // Create contribution
        console.log(`Creating contribution for user ${userId} in community ${this._id} with amount ${this.settings.minContribution}`);
        const Contribution = mongoose.model('Contribution');
        await Contribution.createContribution(userId, this._id, this.settings.minContribution, activeMidCycle._id);

        // Save community changes
        console.log('Saving community changes with new member:', newMember._id);
        await this.save();

        return { 
            message: 'Member successfully added during mid-cycle.',
            memberId: newMember._id,
            status: newMember.status
        };
    } catch (err) {
        throw new Error(`Failed to add new member mid-cycle: ${err.message}`);
    }
};
