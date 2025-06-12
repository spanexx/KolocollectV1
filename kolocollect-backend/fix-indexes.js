const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully!');

        const db = mongoose.connection.db;
        const collection = db.collection('communities');

        console.log('Listing current indexes...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes.map(idx => idx.name));

        // Drop problematic indexes if they exist
        const problemIndexes = [
            'settings.contributionFrequency_1_members_1',
            'members_1_cycles_1_midCycle_1'
        ];

        for (const indexName of problemIndexes) {
            try {
                console.log(`Attempting to drop index: ${indexName}`);
                await collection.dropIndex(indexName);
                console.log(`✓ Dropped index: ${indexName}`);
            } catch (err) {
                if (err.codeName === 'IndexNotFound') {
                    console.log(`Index ${indexName} not found (already dropped or never existed)`);
                } else {
                    console.error(`Error dropping index ${indexName}:`, err.message);
                }
            }
        }

        console.log('Index cleanup completed!');
        
        // List indexes after cleanup
        const finalIndexes = await collection.indexes();
        console.log('Final indexes:', finalIndexes.map(idx => idx.name));

    } catch (err) {
        console.error('Error fixing indexes:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

fixIndexes();
