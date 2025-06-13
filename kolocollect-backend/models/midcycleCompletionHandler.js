/**
 * midcycleCompletionHandler.js
 * 
 * This module handles the logic for completing a midcycle and ensures
 * its connection to the parent cycle is maintained for history tracking.
 */

const mongoose = require('mongoose');
const MidCycle = require('./Midcycle');
const Cycle = require('./Cycle');

/**
 * Completes a midcycle and ensures it remains connected to its parent cycle
 * for proper history tracking in the contribution history view.
 * 
 * @param {string|ObjectId} midcycleId - The ID of the midcycle to complete
 * @param {Object} session - Mongoose session for transaction support (optional)
 * @returns {Object} - The completed midcycle and its parent cycle
 */
async function completeMidcycle(midcycleId, session = null) {
    try {
        // Find the midcycle
        const midcycleQuery = () => MidCycle.findById(midcycleId);
        const midcycle = session ? 
            await midcycleQuery().session(session) : 
            await midcycleQuery();
        
        if (!midcycle) {
            throw new Error(`Midcycle with ID ${midcycleId} not found`);
        }
        
        // Find the parent cycle (active cycle with this midcycle's cycleNumber)
        const cycleQuery = () => Cycle.findOne({
            cycleNumber: midcycle.cycleNumber,
            isComplete: false
        });
        
        const parentCycle = session ? 
            await cycleQuery().session(session) : 
            await cycleQuery();
        
        if (!parentCycle) {
            console.warn(`No active parent cycle found for midcycle ${midcycleId} with cycle number ${midcycle.cycleNumber}`);
            // Try to find any cycle with this cycle number as a fallback
            const fallbackCycleQuery = () => Cycle.findOne({ cycleNumber: midcycle.cycleNumber });
            const fallbackCycle = session ? 
                await fallbackCycleQuery().session(session) : 
                await fallbackCycleQuery();
                
            if (!fallbackCycle) {
                throw new Error(`No parent cycle found for midcycle ${midcycleId} with cycle number ${midcycle.cycleNumber}`);
            }
            
            // Use the fallback cycle
            console.log(`Using fallback cycle ${fallbackCycle._id} for midcycle ${midcycleId}`);
            
            // Ensure midcycle is added to the fallback cycle's midcycles array
            if (!fallbackCycle.midCycles.includes(midcycle._id)) {
                const updateOptions = session ? { session } : {};
                await Cycle.updateOne(
                    { _id: fallbackCycle._id },
                    { $addToSet: { midCycles: midcycle._id } },
                    updateOptions
                );
                console.log(`Added midcycle ${midcycle._id} to fallback cycle ${fallbackCycle._id}`);
            }
            
            // Mark midcycle as complete
            midcycle.isComplete = true;
            if (session) {
                await midcycle.save({ session });
            } else {
                await midcycle.save();
            }
            
            return { midcycle, cycle: fallbackCycle };
        }
        
        // Ensure midcycle is added to the parent cycle's midcycles array
        if (!parentCycle.midCycles.includes(midcycle._id)) {
            const updateOptions = session ? { session } : {};
            await Cycle.updateOne(
                { _id: parentCycle._id },
                { $addToSet: { midCycles: midcycle._id } },
                updateOptions
            );
            console.log(`Added midcycle ${midcycle._id} to parent cycle ${parentCycle._id}`);
        }
        
        // Mark midcycle as complete
        midcycle.isComplete = true;
        if (session) {
            await midcycle.save({ session });
        } else {
            await midcycle.save();
        }
        
        return { midcycle, cycle: parentCycle };
    } catch (error) {
        console.error(`Error completing midcycle: ${error.message}`);
        throw error;
    }
}

/**
 * Ensures that all completed midcycles are properly linked to their parent cycles
 * This can be run as a maintenance function to fix historical data
 * 
 * @param {string|ObjectId} communityId - The ID of the community to fix
 * @returns {Object} - Statistics about the fix operation
 */
async function fixMidcycleCycleConnections(communityId) {
    const stats = {
        processedMidcycles: 0,
        addedConnections: 0,
        errors: 0
    };
    
    try {
        // Find all completed midcycles for this community
        const completedMidcycles = await MidCycle.find({
            communityId,
            isComplete: true
        });
        
        console.log(`Found ${completedMidcycles.length} completed midcycles for community ${communityId}`);
        stats.processedMidcycles = completedMidcycles.length;
        
        // Find all cycles for this community
        const cycles = await Cycle.find({ communityId });
        console.log(`Found ${cycles.length} cycles for community ${communityId}`);
        
        // Process each midcycle
        for (const midcycle of completedMidcycles) {
            try {
                // Find the appropriate cycle based on cycle number
                const parentCycle = cycles.find(c => c.cycleNumber === midcycle.cycleNumber);
                
                if (!parentCycle) {
                    console.warn(`No parent cycle found for midcycle ${midcycle._id} with cycle number ${midcycle.cycleNumber}`);
                    continue;
                }
                
                // Check if midcycle is already in the cycle's midCycles array
                if (!parentCycle.midCycles.includes(midcycle._id)) {
                    // Add midcycle to cycle
                    await Cycle.updateOne(
                        { _id: parentCycle._id },
                        { $addToSet: { midCycles: midcycle._id } }
                    );
                    
                    stats.addedConnections++;
                    console.log(`Added midcycle ${midcycle._id} to cycle ${parentCycle._id}`);
                }
            } catch (err) {
                console.error(`Error processing midcycle ${midcycle._id}: ${err.message}`);
                stats.errors++;
            }
        }
        
        return stats;
    } catch (error) {
        console.error(`Error fixing midcycle-cycle connections: ${error.message}`);
        throw error;
    }
}

module.exports = {
    completeMidcycle,
    fixMidcycleCycleConnections
};
