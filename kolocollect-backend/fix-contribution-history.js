/**
 * fix-contribution-history.js
 * 
 * This script fixes the connection between midcycles and their parent cycles
 * to ensure the contribution history view displays all midcycles correctly.
 */

const mongoose = require('mongoose');
const config = require('./config');
const Community = require('./models/Community');
const { fixMidcycleCycleConnections } = require('./models/midcycleCompletionHandler');

// Connect to MongoDB
mongoose.connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected');
    processCommunities();
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

async function processCommunities() {
    try {
        // Get all communities
        const communities = await Community.find({});
        console.log(`Found ${communities.length} communities to process`);
        
        let totalStats = {
            processedCommunities: 0,
            processedMidcycles: 0,
            addedConnections: 0,
            errors: 0
        };
        
        // Process each community
        for (const community of communities) {
            console.log(`\nProcessing community: ${community.name} (${community._id})`);
            
            try {
                const stats = await fixMidcycleCycleConnections(community._id);
                console.log(`Results for community ${community.name}:`, stats);
                
                totalStats.processedCommunities++;
                totalStats.processedMidcycles += stats.processedMidcycles;
                totalStats.addedConnections += stats.addedConnections;
                totalStats.errors += stats.errors;
            } catch (err) {
                console.error(`Error processing community ${community._id}:`, err.message);
                totalStats.errors++;
            }
        }
        
        console.log('\n======= FINAL RESULTS =======');
        console.log(`Communities processed: ${totalStats.processedCommunities}`);
        console.log(`Midcycles processed: ${totalStats.processedMidcycles}`);
        console.log(`Connections added: ${totalStats.addedConnections}`);
        console.log(`Errors: ${totalStats.errors}`);
        console.log('============================\n');
        
        console.log('Finished processing all communities');
        process.exit(0);
    } catch (err) {
        console.error('Error processing communities:', err);
        process.exit(1);
    }
}

// Handle script termination
process.on('SIGINT', () => {
    console.log('Script interrupted');
    mongoose.connection.close();
    process.exit(0);
});
