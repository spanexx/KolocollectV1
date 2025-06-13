const mongoose = require('mongoose');

/**
 * Processes the second installment payment for a member with payment plan
 * @param {ObjectId} userId - ID of the user paying the second installment
 * @returns {Promise<Object>} Result of the payment processing
 */
module.exports = async function paySecondInstallment(userId) {
    try {
        // Find the owing member in the community's owingMembers array
        const owingMember = this.owingMembers.find(m => m.userId.equals(userId));
        if (!owingMember) throw new Error('Owing member not found.');
        
        let remainingAmount = owingMember.remainingAmount;
        console.log(`Remaining amount for second installment: ${remainingAmount}`);
        
        // Check if there is an actual remaining amount to pay
        if (owingMember.remainingAmount > 0) {
            // Get the user's wallet
            const Wallet = mongoose.model('Wallet');
            const wallet = await Wallet.findOne({ userId });
            if (!wallet) throw new Error('Wallet not found.');

            // Check if the wallet has sufficient balance
            if (wallet.availableBalance < remainingAmount) {
                throw new Error('Insufficient wallet balance for the second installment.');
            }

            // Deduct the amount from the wallet
            await wallet.addTransaction(
                remainingAmount,
                'contribution',
                `Second installment payment for community ${this.name}`,
                null,
                this._id
            );

            // Update the owingMember record
            owingMember.remainingAmount = 0;

            // Update the member's payment plan in the Member model
            await this.memberUpdate(userId, remainingAmount);

            // Remove the user from owingMembers array
            this.owingMembers = this.owingMembers.filter(m => !m.userId.equals(userId));
            
            // Update the community backup fund
            const backupFund = (this.settings.backupFundPercentage / 100) * remainingAmount;
            this.backupFund += backupFund;

            // Get the midcycle document that contains this user as a joiner
            const MidCycle = mongoose.model('MidCycle');
            const midCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                'midCycleJoiners.joiners': userId
            });
            
            if (midCycle) {
                // Find the specific joiner entry for this user
                const joinerIndex = midCycle.midCycleJoiners.findIndex(
                    joiner => joiner.joiners.equals(userId)
                );
                
                if (joinerIndex !== -1) {
                    // Update the isComplete field to true
                    midCycle.midCycleJoiners[joinerIndex].isComplete = true;
                    await midCycle.save();
                }
            }

            await this.save();
            return { message: 'Second installment paid successfully.' };
        } else {
            return { message: 'No second installment due or already paid.' };
        }
    } catch (err) {
        console.error('Error in paySecondInstallment:', err);
        throw err;
    }
};
