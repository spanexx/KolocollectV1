/**
 * Implementation of distributePayouts method for Community model
 * 
 * This implementation handles the entire payout distribution process:
 * 
 * 1. PREPARATION AND VALIDATION
 *    - Finds active mid-cycle that's ready for payout
 *    - Validates the next-in-line recipient exists in community members
 *    - Ensures payout amount is valid (greater than zero)
 *
 * 2. HANDLING SPECIAL CASES
 *    - Handles inactive recipients by adding payout to backup fund
 *    - Manages penalties and missed contributions by deducting from payout
 *    - Handles insufficient payout amounts for covering penalties
 *
 * 3. TRANSACTION PROCESSING
 *    - Creates formal payout record
 *    - Adds transaction to recipient's wallet
 *    - Updates community's total distributed amount
 *
 * 4. CYCLE MANAGEMENT
 *    - Marks mid-cycle as complete
 *    - Updates active cycle's paid members list
 *    - Determines if all members are paid in the current cycle
 *    - Either completes the cycle and starts a new one, or starts the next mid-cycle
 *
 * 5. ACTIVITY LOGGING
 *    - Records payout distribution in the community's activity log
 */

module.exports = async function () {
    try {
        // Import required models
        const mongoose = require('mongoose');
        const MidCycle = mongoose.model('MidCycle');
        const Cycle = mongoose.model('Cycle');
        const Member = mongoose.model('Member');
        const Payout = mongoose.model('Payout');
        const { calculateNextPayoutDate } = require('../utils/payoutUtils');

        // STEP 1: Find active mid-cycle that is ready for payout distribution
        // This gets the mid-cycle that has been validated and is awaiting distribution
        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            isReady: true,
            isComplete: false
        });
        
        // Exit early if no active mid-cycle is found
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle ready for distribution found.');
        }

        // STEP 2: Get the next-in-line recipient
        // This identifies who should receive the payout
        const nextRecipientId = activeMidCycle.nextInLine.userId;
        const recipient = await Member.findOne({
            _id: { $in: this.members },
            userId: nextRecipientId
        });
        
        // Verify recipient exists in the community
        if (!recipient) {
            throw new Error('Next-in-line recipient not found in community members.');
        }

        // STEP 3: Validate payout amount
        const payoutAmount = activeMidCycle.payoutAmount;
        if (payoutAmount <= 0) {
            throw new Error('Invalid payout amount.');
        }

        // Initialize net payout equal to total payout amount
        // This may be reduced for penalties or missed contributions
        let netPayout = payoutAmount;

        // STEP 4: Handle inactive recipients
        // If recipient is not active, add payout to backup fund instead of distributing
        if (recipient.status !== 'active') {
            // Add the entire payout to backup fund
            this.backupFund += payoutAmount;
            console.log(`Recipient ${recipient.name} is inactive. Payout amount €${payoutAmount} added to backup fund.`);
            netPayout = 0;
        } else {
            // STEP 5: Calculate and handle penalties
            // Calculate total penalties from direct penalties and missed contributions
            let penaltyTotal = recipient.penalty || 0;
            let missedTotal = 0;
            
            // Sum up missed contribution amounts
            if (recipient.missedContributions && recipient.missedContributions.length > 0) {
                missedTotal = recipient.missedContributions.reduce((sum, mc) => sum + (mc.amount || 0), 0);
            }
            penaltyTotal += missedTotal;

            // Handle penalties when they exist
            if (penaltyTotal > 0) {
                // Case 1: Payout amount covers all penalties
                if (payoutAmount >= penaltyTotal) {
                    // Reduce net payout by penalty amount
                    netPayout = payoutAmount - penaltyTotal;
                    // Add penalties to backup fund
                    this.backupFund += penaltyTotal;
                    // Clear penalties since they are now paid
                    recipient.penalty = 0;
                    recipient.missedContributions = [];
                    await recipient.save();
                } 
                // Case 2: Payout is insufficient to cover penalties
                else {
                    // Add entire payout to backup fund
                    this.backupFund += payoutAmount;
                    // Calculate remaining penalties
                    const outstanding = penaltyTotal - payoutAmount;
                    netPayout = 0;
                    
                    // Notify user about outstanding penalties
                    const User = mongoose.model('User');
                    const userDoc = await User.findById(recipient.userId);
                    if (userDoc && userDoc.addNotification) {
                        await userDoc.addNotification(
                            'penalty',
                            `Your payout of €${payoutAmount} was insufficient to cover your penalty. You still owe €${outstanding.toFixed(2)}.`,
                            this._id
                        );
                    }
                    
                    // Update recipient's penalties
                    recipient.penalty = outstanding;
                    recipient.missedContributions = [];
                    await recipient.save();
                }
            }
        }

        // STEP 6: Process the payout transaction if there's a net amount to pay
        if (netPayout > 0) {
            // Get recipient's wallet
            const Wallet = mongoose.model('Wallet');
            const recipientWallet = await Wallet.findOne({ userId: nextRecipientId });
            
            if (!recipientWallet) {
                throw new Error('Recipient wallet not found.');
            }

            // Create formal payout record
            await Payout.createPayout(
                this._id,
                nextRecipientId,
                netPayout,
                activeMidCycle.cycleNumber,
                activeMidCycle._id
            );

            // Add transaction to recipient's wallet
            await recipientWallet.addTransaction(
                netPayout,
                'payout',
                `Payout from community "${this.name}" mid-cycle.`,
                null,
                this._id
            );
            
            // Update the community's total distributed amount
            this.totalDistributed = (this.totalDistributed || 0) + netPayout;
            
            // Send payout email notification
            try {
                const User = mongoose.model('User');
                const recipientUser = await User.findById(nextRecipientId);
                
                if (recipientUser && recipientUser.email) {
                    const emailService = require('../services/emailService');
                    await emailService.sendPayoutNotification({
                        recipient: recipientUser.email,
                        amount: netPayout,
                        communityName: this.name,
                        cycleNumber: activeMidCycle.cycleNumber,
                        payoutDate: new Date()
                    });
                    console.log(`✅ Payout notification email sent to ${recipientUser.email}`);
                }
            } catch (emailError) {
                console.error('Failed to send payout notification email:', emailError);
                // Non-critical error, don't throw - payout was successful
            }
        }
        
        // STEP 7: Mark mid-cycle as complete using the handler
        const { completeMidcycle } = require('./midcycleCompletionHandler');
        await completeMidcycle(activeMidCycle._id);

        // STEP 8: Update the active cycle's paid members list
        const activeCycle = await Cycle.findOne({ _id: { $in: this.cycles }, isComplete: false });
        
        // Add the recipient to the list of paid members if they're active
        if (activeCycle && recipient.status === 'active' && !activeCycle.paidMembers.includes(nextRecipientId)) {
            activeCycle.paidMembers.push(nextRecipientId);
            await activeCycle.save();
        }
        
        // STEP 9: Check if all active members have been paid
        const activeMembers = await Member.find({ 
            _id: { $in: this.members }, 
            status: 'active' 
        });
        
        // Debug the payment status for each member
        console.log('Active members count:', activeMembers.length);
        console.log('Paid members in cycle:', activeCycle.paidMembers.length);
        
        // Convert all ObjectId values to strings for proper comparison
        const paidMemberIds = activeCycle.paidMembers.map(id => id.toString());
        
        // Check which members have been paid
        const unpaidMembers = activeMembers.filter(member => {
            const memberUserId = member.userId.toString();
            const isPaid = paidMemberIds.includes(memberUserId);
            console.log(`Member ${member._id} (userId: ${memberUserId}): Paid = ${isPaid}`);
            return !isPaid;
        });
        
        // Determine if all active members have been paid
        const allPaid = unpaidMembers.length === 0;
        console.log('All members paid?', allPaid);

        // STEP 10: Start new cycle or mid-cycle based on payment status
        if (allPaid) {
            // All members have been paid, complete the current cycle and start a new one            console.log('All members have been paid, marking cycle as complete');
            activeCycle.isComplete = true;
            activeCycle.endDate = new Date();
            await activeCycle.save();

            // Send cycle completion notification to admin
            try {
                const User = mongoose.model('User');
                const admin = await User.findById(this.admin);
                
                if (admin && admin.email) {
                    const emailService = require('../services/emailService');
                    await emailService.sendCycleCompletionNotification({
                        adminEmail: admin.email,
                        communityName: this.name,
                        completedCycleNumber: activeCycle.cycleNumber,
                        totalDistributed: this.totalDistributed || 0,
                        newCycleStart: true
                    });
                    console.log(`✅ Cycle completion notification sent to admin: ${admin.email}`);
                }
            } catch (emailError) {
                console.error('Error sending cycle completion notification email:', emailError);
                // Don't fail the cycle completion if email fails
            }
            
            try {
                // Attempt to start a new cycle
                console.log('Starting new cycle');
                const newCycleResult = await this.startNewCycle();
                console.log(newCycleResult.message);
            } catch (cycleError) {
                // Handle errors when starting new cycle
                console.error('Error starting new cycle:', cycleError);
                // Clear next payout date even if we can't start a new cycle
                this.nextPayout = null;
                await this.save();
            }
        } else {
            // Some members still need to be paid, start a new mid-cycle
            console.log(`${unpaidMembers.length} members still need to be paid, starting new mid-cycle`);
            const newMidCycleResult = await this.startMidCycle();
            
            // Update payout information and schedule next payout
            await this.updatePayoutInfo();
            this.nextPayout = calculateNextPayoutDate(this.settings.contributionFrequency);
            console.log('New mid-cycle started:', newMidCycleResult.message);
        }

        // STEP 11: Log the payout activity
        await this.addActivityLog('payout_distributed', recipient.userId);

        // STEP 12: Return success message
        return {
            message: `Payout processed. Net payout of €${netPayout} was ${
                recipient.status === 'active' ? 'distributed' : 'added to backup fund'
            }.`
        };
    } catch (err) {
        // Handle and propagate errors
        console.error('Error distributing payouts:', err);
        throw err;
    }
};
