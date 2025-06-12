/**
 * Phase 5: Migration Runner Script
 * 
 * Simple script to run community schema migration
 * Usage: node migrations/run-migration.js [options]
 */

const mongoose = require('mongoose');
const CommunityMigration = require('./CommunityMigration');

// Database connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kolocollect', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for migration');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

// Parse command line arguments
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        action: 'migrate',
        communityId: null,
        batchSize: 10,
        skipExisting: true,
        dryRun: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--action':
                options.action = args[++i];
                break;
            case '--community':
                options.communityId = args[++i];
                break;
            case '--batch-size':
                options.batchSize = parseInt(args[++i]);
                break;
            case '--no-skip-existing':
                options.skipExisting = false;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            case '--help':
                showHelp();
                process.exit(0);
                break;
        }
    }

    return options;
};

// Show help information
const showHelp = () => {
    console.log(`
Phase 5 Community Schema Migration Runner

Usage: node migrations/run-migration.js [options]

Options:
  --action <action>        Action to perform: migrate, rollback, verify, report
  --community <id>         Migrate specific community (optional)
  --batch-size <number>    Number of communities to process at once (default: 10)
  --no-skip-existing      Don't skip already migrated communities
  --dry-run               Show what would be done without making changes
  --help                  Show this help message

Examples:
  # Migrate all communities
  node migrations/run-migration.js --action migrate

  # Migrate specific community
  node migrations/run-migration.js --action migrate --community 60a7c2b8f123456789abcdef

  # Verify migration integrity
  node migrations/run-migration.js --action verify

  # Get migration report
  node migrations/run-migration.js --action report

  # Rollback specific community
  node migrations/run-migration.js --action rollback --community 60a7c2b8f123456789abcdef

Environment Variables:
  MONGO_URI               MongoDB connection string
  USE_OPTIMIZED_SCHEMA    Set to 'true' to enable optimized schema usage
`);
};

// Main migration function
const runMigration = async () => {
    const options = parseArgs();
    const migration = new CommunityMigration();

    console.log('=== Phase 5 Community Schema Migration ===');
    console.log(`Action: ${options.action}`);
    console.log(`Options:`, options);
    console.log('');

    if (options.dryRun) {
        console.log('DRY RUN MODE - No changes will be made');
        console.log('');
    }

    try {
        await connectDB();

        switch (options.action) {
            case 'migrate':
                if (options.communityId) {
                    console.log(`Migrating single community: ${options.communityId}`);
                    const result = await migration.migrateCommunity(options.communityId);
                    console.log('Migration result:', result);
                } else {
                    console.log('Migrating all communities...');
                    const status = await migration.migrateAllCommunities({
                        batchSize: options.batchSize,
                        skipExisting: options.skipExisting
                    });
                    console.log('Migration completed:', status);
                }
                break;

            case 'verify':
                if (options.communityId) {
                    console.log(`Verifying community: ${options.communityId}`);
                    const integrity = await migration.verifyDataIntegrity(options.communityId);
                    console.log('Verification result:', integrity);
                } else {
                    console.log('Verification of all communities not implemented yet');
                }
                break;

            case 'rollback':
                if (!options.communityId) {
                    console.error('Community ID required for rollback');
                    process.exit(1);
                }
                console.log(`Rolling back community: ${options.communityId}`);
                const rollbackResult = await migration.rollbackCommunity(options.communityId);
                console.log('Rollback result:', rollbackResult);
                break;            case 'report':
                console.log('Migration Report:');
                const dbStats = await migration.getDatabaseStats();
                const report = {
                    timestamp: new Date(),
                    databaseStats: dbStats,
                    migrationStats: migration.getMigrationReport(),
                    summary: {
                        communitiesTotal: dbStats.totalCommunities,
                        communitiesMigrated: dbStats.migratedCommunities,
                        migrationProgress: dbStats.migrationProgress,
                        pendingMigration: dbStats.totalCommunities - dbStats.migratedCommunities
                    }
                };
                console.log(JSON.stringify(report, null, 2));
                break;

            default:
                console.error(`Unknown action: ${options.action}`);
                showHelp();
                process.exit(1);
        }

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Database disconnected');
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\nMigration interrupted');
    await mongoose.disconnect();
    process.exit(0);
});

// Run migration if this file is executed directly
if (require.main === module) {
    runMigration().catch(error => {
        console.error('Migration runner error:', error);
        process.exit(1);
    });
}

module.exports = { runMigration, CommunityMigration };
