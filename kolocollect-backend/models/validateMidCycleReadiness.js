/**
 * validateMidCycleReadiness.js
 * 
 * This module provides a robust validation function to check if a midcycle is ready
 * for payout based on contributions from all eligible members.
 * 
 * It includes built-in retry mechanisms and thorough error handling to ensure
 * reliable operation even under database connection issues.
 */

const mongoose = require('mongoose');
const MidCycle = require('./Midcycle');
const Cycle = require('./Cycle');
const Member = require('./Member');

/**
 * Validates if a midcycle is ready for payout based on contributions from all eligible members
 * 
 * @param {Object} community - The community document
 * @param {String|ObjectId} currentContribution - The ID of the current contributor (optional)
 * @param {Object} session - Mongoose session for transaction support (optional)
 * @returns {Object} - Validation result with status and message
 */
async function validateMidCycleReadiness(community, currentContribution, session = null) {
    let activeMidCycle = null;
    let retries = 3;
    
    console.log('Current contributor passed to validation:', currentContribution);
    
    try {
        // Use a query function that can be wrapped with session if provided
        const query = () => MidCycle.findOne({
            _id: { $in: community.midCycle },
            isComplete: false
        });
        
        // Execute the query with or without session
        activeMidCycle = session ? await query().session(session) : await query();
        
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle found.');
        }

        // Find active cycle with similar session handling
        const cycleQuery = () => Cycle.findOne({
            _id: { $in: community.cycles },
            isComplete: false
        });
        
        const activeCycle = session ? await cycleQuery().session(session) : await cycleQuery();
        
        if (!activeCycle) {
            throw new Error('No active cycle found.');
        }
        
        // Ensure midCycle is added to active cycle if not already present
        if (!activeCycle.midCycles.includes(activeMidCycle._id)) {
            const updateQuery = { $addToSet: { midCycles: activeMidCycle._id } };
            const updateOptions = session ? { session } : {};
            
            await Cycle.updateOne({ _id: activeCycle._id }, updateQuery, updateOptions);
        }

        // Find eligible members who should contribute
        const membersQuery = () => Member.find({
            _id: { $in: community.members },
            status: 'active'
        });
        
        const eligibleMembers = session ? 
            await membersQuery().session(session) : 
            await membersQuery();
        
        console.log(`Found ${eligibleMembers.length} eligible members for contribution check`);
        console.log('Eligible member IDs:', eligibleMembers.map(m => m.userId.toString()));
        console.log('Contributors in midcycle:', activeMidCycle.contributions.map(c => c.user.toString()));
        
        // Check contribution status for each eligible member
        const allContributed = await Promise.all(eligibleMembers.map(async (member) => {
            // Check if this is the current contributor
            if (currentContribution) {
                // Convert both IDs to strings for comparison
                const memberId = member.userId.toString();
                const contributorId = typeof currentContribution === 'object' ? 
                    currentContribution.toString() : currentContribution.toString();
                
                console.log(`Comparing member ID ${memberId} with contributor ID ${contributorId}`);
                
                if (memberId === contributorId) {
                    console.log(`Match found! ${memberId} is current contributor`);
                    return true; // The current user is contributing right now
                }
            }

            // Check if the member has already contributed
            const hasContributed = activeMidCycle.contributions.some(c => 
                c.user.equals(member.userId) && c.contributions.length > 0
            );
            return hasContributed;
        }));
        
        // Determine if the midcycle is ready based on all contributions
        const isReady = allContributed.every(contributed => contributed);
        console.log('All contributions check result:', allContributed);
        console.log('Setting isReady to:', isReady);

        // Update the midcycle isReady status with retry mechanism
        let updateSuccess = false;
        let updateRetries = 3;
        
        while (updateRetries > 0 && !updateSuccess) {
            try {
                const updateQuery = { $set: { isReady } };
                const updateOptions = {
                    maxTimeMS: 30000 // 30 second timeout
                };
                
                // Add session to options if provided
                if (session) {
                    updateOptions.session = session;
                }
                
                await MidCycle.updateOne(
                    { _id: activeMidCycle._id },
                    updateQuery,
                    updateOptions
                );
                
                updateSuccess = true;
                console.log('Successfully updated midcycle isReady status to:', isReady);
            } catch (err) {
                updateRetries--;
                console.error(`Error updating midcycle ready status, retries left: ${updateRetries}`, err.message);
                
                if (updateRetries > 0) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * (4 - updateRetries)));
                } else {
                    throw err; // Re-throw if all retries failed
                }
            }
        }
        
        console.log('Contribution status by member:', allContributed);

        // Add activity log if midcycle is now ready
        if (isReady && updateSuccess) {
            try {
                // Only add activity log if community has the method and we're not in a transaction
                // In a transaction, the activity log should be added by the caller
                if (!session && typeof community.addActivityLog === 'function') {
                    await community.addActivityLog('mid_cycle_ready', community.admin);
                }
            } catch (err) {
                console.error('Failed to add activity log, but midcycle is still marked as ready:', err.message);
                // Don't throw this error as it's not critical
            }
        }

        // Return validation result
        return {
            midCycle: activeMidCycle._id,
            isReady,
            allContributed,
            eligibleCount: eligibleMembers.length,
            contributedCount: allContributed.filter(c => c).length,
            message: isReady
                ? 'Mid-cycle is validated and ready for payout.'
                : 'Mid-cycle validated. Waiting for remaining contributions.',
        };
    } catch (err) {
        console.error('Error validating mid-cycle and contributions:', err);
        throw err;
    }
}

module.exports = validateMidCycleReadiness;
