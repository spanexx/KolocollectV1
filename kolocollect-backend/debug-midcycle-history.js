/**
 * debug-midcycle-history.js
 * 
 * This script analyzes a community's midcycles and cycles to debug
 * the contribution history view issues.
 */

const mongoose = require('mongoose');
const config = require('./config');
const Community = require('./models/Community');
const Cycle = require('./models/Cycle');
const MidCycle = require('./models/Midcycle');

// Connect to MongoDB
mongoose.connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
    
    // Get the community ID from command line arguments
    const communityId = process.argv[2];
    if (!communityId) {
        console.error('Please provide a community ID as an argument');
        process.exit(1);
    }
    
    analyzeCommunity(communityId);
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

async function analyzeCommunity(communityId) {
    try {
        console.log(`Analyzing community: ${communityId}`);
        
        // Fetch the community with cycles and midcycles
        const community = await Community.findById(communityId)
            .populate('cycles')
            .populate('midCycle');
            
        if (!community) {
            console.error('Community not found');
            process.exit(1);
        }
        
        console.log(`Community: ${community.name}`);
        console.log('----------------------------');
        
        // Analyze cycles
        console.log(`\nCYCLES (${community.cycles.length}):`);
        console.log('----------------------------');
        
        for (const cycle of community.cycles) {
            console.log(`Cycle ${cycle.cycleNumber} (${cycle._id}):`);
            console.log(`  isComplete: ${cycle.isComplete}`);
            
            // Fetch the actual midcycles for this cycle
            const cycleMidcycles = await Cycle.findById(cycle._id)
                .populate('midCycles');
                
            if (cycleMidcycles && cycleMidcycles.midCycles) {
                console.log(`  Contains ${cycleMidcycles.midCycles.length} midcycles:`);
                
                for (const mc of cycleMidcycles.midCycles) {
                    console.log(`    - Midcycle ID: ${mc._id}, isComplete: ${mc.isComplete}`);
                }
            } else {
                console.log('  No midcycles associated with this cycle');
            }
            console.log('');
        }
        
        // Analyze midcycles
        console.log(`\nMIDCYCLES (${community.midCycle.length}):`);
        console.log('----------------------------');
        
        const midcyclesByCycle = {};
        
        for (const midcycle of community.midCycle) {
            const cycleNumber = midcycle.cycleNumber || 'unknown';
            
            if (!midcyclesByCycle[cycleNumber]) {
                midcyclesByCycle[cycleNumber] = [];
            }
            
            midcyclesByCycle[cycleNumber].push(midcycle);
        }
        
        // Display midcycles grouped by cycle
        for (const [cycleNumber, midcycles] of Object.entries(midcyclesByCycle)) {
            console.log(`Cycle ${cycleNumber}:`);
            
            for (const mc of midcycles) {
                console.log(`  - Midcycle ID: ${mc._id}, isComplete: ${mc.isComplete}`);
                
                // Check if this midcycle exists in its parent cycle's midCycles array
                const parentCycle = community.cycles.find(c => c.cycleNumber.toString() === cycleNumber.toString());
                
                if (parentCycle) {
                    // We need to check if the midcycle is in the cycle's midCycles array
                    const cycleWithMidcycles = await Cycle.findById(parentCycle._id);
                    
                    const isLinked = cycleWithMidcycles && 
                                     cycleWithMidcycles.midCycles && 
                                     cycleWithMidcycles.midCycles.some(mcId => mcId.toString() === mc._id.toString());
                                     
                    console.log(`    Linked to parent cycle: ${isLinked ? 'YES' : 'NO'}`);
                    
                    if (!isLinked) {
                        console.log(`    WARNING: This midcycle is not linked to its parent cycle!`);
                    }
                } else {
                    console.log(`    WARNING: No parent cycle found for cycle number ${cycleNumber}`);
                }
            }
            console.log('');
        }
        
        // Provide fix recommendations
        console.log('\nRECOMMENDATIONS:');
        console.log('----------------------------');
        
        const unlinkedMidcycles = [];
        
        for (const [cycleNumber, midcycles] of Object.entries(midcyclesByCycle)) {
            const parentCycle = community.cycles.find(c => c.cycleNumber.toString() === cycleNumber.toString());
            
            if (parentCycle) {
                const cycleWithMidcycles = await Cycle.findById(parentCycle._id);
                
                for (const mc of midcycles) {
                    const isLinked = cycleWithMidcycles && 
                                     cycleWithMidcycles.midCycles && 
                                     cycleWithMidcycles.midCycles.some(mcId => mcId.toString() === mc._id.toString());
                                     
                    if (!isLinked) {
                        unlinkedMidcycles.push({
                            midcycleId: mc._id,
                            cycleId: parentCycle._id,
                            cycleNumber
                        });
                    }
                }
            }
        }
        
        if (unlinkedMidcycles.length > 0) {
            console.log(`Found ${unlinkedMidcycles.length} unlinked midcycles. Here's how to fix them:`);
            
            for (const unlinked of unlinkedMidcycles) {
                console.log(`\nCycle ${unlinked.cycleNumber} (${unlinked.cycleId}):`);
                console.log(`  Add midcycle ${unlinked.midcycleId} to this cycle's midCycles array.`);
                
                // Auto-fix if requested
                if (process.argv.includes('--fix')) {
                    await Cycle.updateOne(
                        { _id: unlinked.cycleId },
                        { $addToSet: { midCycles: unlinked.midcycleId } }
                    );
                    console.log('  ✓ Fixed automatically');
                }
            }
            
            if (!process.argv.includes('--fix')) {
                console.log('\nTo automatically fix these issues, run this script with the --fix flag:');
                console.log(`node debug-midcycle-history.js ${communityId} --fix`);
            }
        } else {
            console.log('All midcycles are properly linked to their parent cycles.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error analyzing community:', err);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('Script interrupted');
    mongoose.connection.close();
    process.exit(0);
});
