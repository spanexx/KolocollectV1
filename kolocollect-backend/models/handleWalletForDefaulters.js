/**
 * Handles wallet operations for defaulting members
 * @param {ObjectId} userId - ID of the defaulting member
 * @param {string} action - Action to take ('freeze' or 'deduct')
 * @returns {Promise<Object>} Result of the wallet operation
 * 
 * Manages penalty enforcement for missed contributions:
 * - Freezes wallet if member has received payout but missed contributions
 * - Deducts penalties from wallet and adds to backup fund
 * - Unfreezes wallet after successful penalty deduction
 */
// Import mongoose and required models
const mongoose = require('mongoose');
const Member = require('./Member');
const Wallet = require('./Wallet');
const Cycle = require('./Cycle');
const MidCycle = require('./Midcycle');
const User = require('./User');

module.exports = async function (userId, action = 'freeze') {
    try {

        // Find the member in the Member collection
        const member = await Member.findOne({
            communityId: this._id,
            userId: userId
        });

        if (!member) {
            throw new Error('Member not found in this community.');
        }

        // Get the member's wallet
        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            throw new Error('Wallet not found for this user.');
        }

        // Get the active cycle for the community
        const activeCycle = await Cycle.findOne({
            communityId: this._id,
            isComplete: false
        });

        if (!activeCycle) {
            throw new Error('No active cycle found for this community.');
        }

        // Check if the member has received a payout in the current cycle
        const receivedPayout = activeCycle.paidMembers.some(
            paidMemberId => paidMemberId.toString() === userId.toString()
        );

        if (receivedPayout) {
            // Calculate total penalty based on missed contributions
            let penaltyTotal = member.penalty || 0;
            
            // Add up missed contributions
            if (member.missedContributions && member.missedContributions.length > 0) {
                for (const missedContribution of member.missedContributions) {
                    penaltyTotal += missedContribution.amount || 0;
                }
            }

            console.log(`Total penalty for member ${member.name}: €${penaltyTotal}`);            if (action === 'freeze') {
                // Freeze the wallet if it has available balance
                if (wallet.availableBalance > 0) {
                    wallet.isFrozen = true;
                    await wallet.save();
                    
                    console.log(`Wallet frozen for user ${userId}. Available balance: €${wallet.availableBalance}`);
                      // Log activity for the user
                    const user = await User.findById(userId);
                    if (user) {
                        await user.addNotification(
                            'warning',
                            `Your wallet has been frozen due to missed contributions in community ${this.name}.`,
                            this._id
                        );                        // Send wallet freeze notification email
                        try {
                            const emailService = require('../services/emailService');
                            await emailService.sendWalletFreezeNotification({
                                memberEmail: user.email,
                                communityName: this.name,
                                frozenBalance: wallet.availableBalance,
                                reason: 'missed contributions',
                                actionRequired: 'Pay outstanding penalties to unfreeze'
                            });
                        } catch (emailError) {
                            console.error('Error sending wallet freeze notification email:', emailError);
                        }
                    }
                }
            } else if (action === 'deduct') {
                // Validate if wallet has enough balance to cover the penalty
                let deductionAmount = penaltyTotal;
                let remainingPenalty = 0;
                
                if (wallet.availableBalance < penaltyTotal) {
                    console.log(`Insufficient balance (€${wallet.availableBalance}) to cover full penalty (€${penaltyTotal})`);
                    deductionAmount = wallet.availableBalance;
                    remainingPenalty = penaltyTotal - deductionAmount;
                }
                
                if (deductionAmount > 0) {
                    // Deduct the amount from the wallet
                    await wallet.addTransaction(
                        -deductionAmount, // Use negative value for deduction
                        'penalty',
                        `Penalty deduction for ${member.missedContributions.length} missed contributions in community ${this.name}`,
                        null, 
                        this._id
                    );
                    
                    console.log(`Deducted €${deductionAmount} from wallet for user ${userId}`);
                    
                    // Add the penalty amount to the community backupFund
                    this.backupFund += deductionAmount;
                      // Update penalty and clear missedContributions, matching the approach in distributePayouts.js
                    member.penalty = remainingPenalty;
                    
                    // Always clear missed contributions regardless of remaining penalty
                    // If there's still penalty left, it's now consolidated in the penalty field
                    member.missedContributions = [];
                      // If there's still a remaining penalty, notify the user
                    if (remainingPenalty > 0) {
                        const User = mongoose.model('User');
                        const userDoc = await User.findById(userId);
                        if (userDoc && userDoc.addNotification) {
                            await userDoc.addNotification(
                                'penalty',
                                `Your wallet was charged €${deductionAmount} for penalties. You still owe €${remainingPenalty.toFixed(2)}.`,
                                this._id
                            );

                            // Send penalty notification email
                            try {
                                const emailService = require('../services/emailService');
                                await emailService.sendPenaltyNotification({
                                    memberEmail: userDoc.email,
                                    deductedAmount: deductionAmount,
                                    remainingPenalty: remainingPenalty,
                                    communityName: this.name,
                                    missedContributions: member.missedContributions.length
                                });
                            } catch (emailError) {
                                console.error('Error sending penalty notification email:', emailError);
                            }
                        }
                    }
                    
                    // Unfreeze wallet after deduction
                    wallet.isFrozen = false;
                    
                    // Save wallet and member changes
                    await wallet.save();
                    await member.save();
                      // Log activity for the user
                    const user = await User.findById(userId);
                    if (user) {
                        if (remainingPenalty === 0) {
                            await user.addNotification(
                                'penalty',
                                `A penalty of €${deductionAmount} has been deducted from your wallet for missed contributions in community ${this.name}.`,
                                this._id
                            );
                        } else {
                            await user.addNotification(
                                'penalty',
                                `€${deductionAmount} has been deducted from your wallet for missed contributions in community ${this.name}. You still owe €${remainingPenalty}.`,
                                this._id
                            );
                        }
                    }
                    
                    // Log activity for the community
                    await this.addActivityLog('penalty_deducted', userId);
                }
            }
            
            // Save community changes (mainly for backup fund update)
            await this.save();
        } else {
            console.log(`Member ${userId} has not received a payout yet, no penalty applied.`);
        }

        return { 
            message: `Wallet handled successfully for action: ${action}.`,
            userId,
            action,
            success: true
        };
    } catch (err) {
        console.error(`Error in handleWalletForDefaulters (${action}):`, err);
        throw err;
    }
};
