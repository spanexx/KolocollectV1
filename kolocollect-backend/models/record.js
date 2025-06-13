const mongoose = require('mongoose');

/**
 * Records a contribution in the community and processes associated updates
 * @param {Object} contribution - Contribution details containing contributorId, recipientId, amount, contributionId
 * @returns {Promise<Object>} Result of recording the contribution
 */
module.exports = async function record(contribution) {
    let retries = 3;
    while (retries-- > 0) {
        try {
            const { contributorId, recipientId, amount, contributionId } = contribution;

            const MidCycle = mongoose.model('MidCycle');
            const activeMidCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                isComplete: false
            });

            if (!contributorId || !recipientId || !contributionId) {
                throw new Error('Contributor ID, Recipient ID, and Contribution ID are required.');
            }
            if (!amount || amount <= 0) {
                throw new Error('Contribution amount must be greater than zero.');
            }
            if (!activeMidCycle) {
                throw new Error('No active mid-cycle found.');
            }

            if (!activeMidCycle.contributions) {
                activeMidCycle.contributions = [];
            }
            if (!activeMidCycle.contributionsToNextInLine) {
                activeMidCycle.contributionsToNextInLine = new Map();
            }

        let userContribution = activeMidCycle.contributions.find(c => c.user.equals(contributorId));
            if (userContribution) {
                userContribution.contributions.push(contributionId);
            } else {
                activeMidCycle.contributions.push({
                    user: contributorId,
                    contributions: [contributionId]
                });
            }            
            
            // Ensure contributionsToNextInLine is a Map
            if (!activeMidCycle.contributionsToNextInLine) {
                activeMidCycle.contributionsToNextInLine = new Map();
            } else if (!(activeMidCycle.contributionsToNextInLine instanceof Map)) {
                // Convert to Map if it's stored as a plain object
                const tempMap = new Map();
                Object.keys(activeMidCycle.contributionsToNextInLine).forEach(key => {
                    tempMap.set(key, activeMidCycle.contributionsToNextInLine[key]);
                });
                activeMidCycle.contributionsToNextInLine = tempMap;
            }
            
            // Update the contribution in the Map
            const contributorKey = contributorId.toString();
            const currentTotalStr = activeMidCycle.contributionsToNextInLine.get(contributorKey);
            const currentTotal = currentTotalStr ? Number(currentTotalStr) : 0;
            const numAmount = Number(amount);
            activeMidCycle.contributionsToNextInLine.set(contributorKey, currentTotal + numAmount);
            
            // Mark as modified to ensure Mongoose saves the changes
            activeMidCycle.markModified('contributionsToNextInLine');
            
            // Calculate total amount from contributions array
            const midCycleTotalAmount = activeMidCycle.contributions.reduce((total, contrib) => {
                return total + (contrib.contributions.length * this.settings.minContribution);
            }, 0);

            const midCycleBackupFund = (this.settings.backupFundPercentage / 100) * midCycleTotalAmount;

            this.backupFund += midCycleBackupFund;
            this.totalContribution += amount;
            activeMidCycle.payoutAmount = midCycleTotalAmount - midCycleBackupFund;
            
            // Add retry mechanism for saving the midcycle
            let saveRetries = 3;
            let saveSuccess = false;
            
            while (saveRetries > 0 && !saveSuccess) {
                try {
                    await activeMidCycle.save({
                        maxTimeMS: 30000 // 30 second timeout
                    });
                    saveSuccess = true;
                    console.log('Successfully saved midcycle with contribution updates');
                } catch (err) {
                    saveRetries--;
                    console.error(`Error saving midcycle, retries left: ${saveRetries}`, err.message);
                    if (saveRetries > 0) {
                        // Wait before retrying (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - saveRetries)));
                    } else {
                        throw err; // Re-throw if all retries failed
                    }
                }
            }
            
            console.log('Calling validateMidCycleAndContributions with contributorId:', contributorId);
            const validationResult = await this.validateMidCycleAndContributions(contributorId);
            await this.updatePayoutInfo();

            this.markModified('midCycle');
            
            // Add retry mechanism for saving the community
            let communitySaveRetries = 3;
            let communitySaveSuccess = false;
            
            while (communitySaveRetries > 0 && !communitySaveSuccess) {
                try {
                    await this.save({
                        maxTimeMS: 30000 // 30 second timeout
                    });
                    communitySaveSuccess = true;
                    console.log('Successfully saved community with contribution updates');
                } catch (err) {
                    communitySaveRetries--;
                    console.error(`Error saving community, retries left: ${communitySaveRetries}`, err.message);
                    if (communitySaveRetries > 0) {
                        // Wait before retrying (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - communitySaveRetries)));
                    } else {
                        throw err; // Re-throw if all retries failed
                    }
                }
            }

            return {
                message: 'Contribution recorded successfully.',
                totalContribution: this.totalContribution,
                backupFund: this.backupFund,
                midCycleBackupFund,
                validationMessage: validationResult.message,
                isMidCycleReady: validationResult.isReady,
            };
        } catch (err) {
            if (err.name === 'VersionError' && retries > 0) {
                console.log(`Retrying record operation (${retries} retries left)`);
                continue;
            }
            console.error('Error in record method:', err);
            throw err;
        }
    }
};
