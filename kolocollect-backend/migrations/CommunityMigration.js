/**
 * Phase 5: Community Schema Migration Script
 * 
 * This script migrates data from the monolithic Community schema
 * to the optimized sub-schemas while preserving 100% functionality
 * 
 * Migration Strategy:
 * 1. Dual-write mode: Write to both old and new schemas
 * 2. Gradual migration: Migrate communities one by one
 * 3. Verification: Compare data integrity before and after
 * 4. Rollback capability: Instant restoration if needed
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

// Import models with conflict resolution
// Only import the legacy Community model first
const Community = require('../models/Community');

// Import migration-specific optimized model (uses "CommunityOptimized" name)
const CommunityOptimized = require('../models/CommunityOptimizedMigration');
const CommunitySettings = require('../models/CommunitySettings');
const CommunityMembership = require('../models/CommunityMembership');
const CommunityOwing = require('../models/CommunityOwing');
const CommunityActivity = require('../models/CommunityActivity');

class CommunityMigration {
    constructor() {
        this.migrationLog = [];
        this.errors = [];
        this.stats = {
            totalCommunities: 0,
            migratedCommunities: 0,
            migratedMembers: 0,
            migratedSettings: 0,
            migratedOwing: 0,
            migratedHistory: 0,
            errors: 0
        };
    }

    /**
     * Log migration activity
     */
    log(message, level = 'info') {
        const logEntry = {
            timestamp: new Date(),
            level,
            message
        };
        this.migrationLog.push(logEntry);
        console.log(`[${level.toUpperCase()}] ${new Date().toISOString()}: ${message}`);
    }

    /**
     * Log error and continue
     */
    logError(error, context = '') {
        const errorEntry = {
            timestamp: new Date(),
            context,
            error: error.message,
            stack: error.stack
        };
        this.errors.push(errorEntry);
        this.stats.errors++;
        console.error(`[ERROR] ${new Date().toISOString()}: ${context} - ${error.message}`);
    }

    /**
     * Get migration status
     */
    getStatus() {
        return {
            stats: this.stats,
            recentLogs: this.migrationLog.slice(-10),
            recentErrors: this.errors.slice(-5)
        };
    }

    /**
     * Verify data integrity between old and new schemas
     */
    async verifyDataIntegrity(communityId) {
        try {            const [originalCommunity, optimizedCore, settings, memberships, owings, activities] = await Promise.all([
                Community.findById(communityId),
                CommunityOptimized.findById(communityId),
                CommunitySettings.findOne({ communityId }),
                CommunityMembership.find({ communityId }),
                CommunityOwing.find({ communityId }),
                CommunityActivity.find({ communityId })
            ]);

            const integrity = {
                isValid: true,
                issues: []
            };

            // Verify core data
            if (!optimizedCore) {
                integrity.isValid = false;
                integrity.issues.push('Missing optimized core document');
            } else {
                if (originalCommunity.name !== optimizedCore.name) {
                    integrity.issues.push('Name mismatch');
                }
                if (originalCommunity.totalContributions?.toString() !== optimizedCore.totalContributions?.toString()) {
                    integrity.issues.push('Total contributions mismatch');
                }
            }

            // Verify settings
            if (originalCommunity.settings && !settings) {
                integrity.isValid = false;
                integrity.issues.push('Missing settings document');
            }

            // Verify members count
            if (originalCommunity.members?.length !== memberships.length) {
                integrity.issues.push(`Members count mismatch: ${originalCommunity.members?.length} vs ${memberships.length}`);
            }

            // Verify owing members count
            if (originalCommunity.owingMembers?.length !== owings.length) {
                integrity.issues.push(`Owing members count mismatch: ${originalCommunity.owingMembers?.length} vs ${owings.length}`);
            }

            if (integrity.issues.length > 0) {
                integrity.isValid = false;
            }

            return integrity;
        } catch (error) {
            return {
                isValid: false,
                issues: [`Verification error: ${error.message}`]
            };
        }
    }

    /**
     * Migrate a single community
     */
    async migrateCommunity(communityId) {
        try {
            this.log(`Starting migration for community ${communityId}`);

            const community = await Community.findById(communityId);
            if (!community) {
                throw new Error(`Community ${communityId} not found`);
            }

            // 1. Migrate core community data
            await this.migrateCoreData(community);

            // 2. Migrate settings
            if (community.settings) {
                await this.migrateSettings(community);
            }

            // 3. Migrate members
            if (community.members && community.members.length > 0) {
                await this.migrateMembers(community);
            }

            // 4. Migrate owing members
            if (community.owingMembers && community.owingMembers.length > 0) {
                await this.migrateOwingMembers(community);
            }

            // 5. Migrate history (cycles and activity logs)
            await this.migrateHistory(community);

            // 6. Verify data integrity
            const integrity = await this.verifyDataIntegrity(communityId);
            if (!integrity.isValid) {
                throw new Error(`Data integrity check failed: ${integrity.issues.join(', ')}`);
            }

            this.stats.migratedCommunities++;
            this.log(`Successfully migrated community ${communityId}`);

            return { success: true, integrity };
        } catch (error) {
            this.logError(error, `migrateCommunity(${communityId})`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Migrate core community data
     */
    async migrateCoreData(community) {
        try {            const existingCore = await CommunityOptimized.findById(community._id);
            if (existingCore) {
                this.log(`Core data already exists for community ${community._id}, skipping`);
                return;
            }

            const coreData = {
                _id: community._id,
                name: community.name,
                description: community.description,
                type: community.type,
                status: community.status,
                createdBy: community.createdBy,
                memberCount: community.members?.length || 0,
                currentCycle: community.currentCycle,
                totalContributions: community.totalContributions || new Decimal(0),
                totalPayouts: community.totalPayouts || new Decimal(0),
                backupFund: community.backupFund || new Decimal(0),
                midCycle: community.midCycle || [],
                cycles: community.cycles || [],
                votes: community.votes || [],
                isActive: community.isActive,
                createdAt: community.createdAt,
                updatedAt: community.updatedAt
            };            await CommunityOptimized.create(coreData);
            this.log(`Created optimized core for community ${community._id}`);
        } catch (error) {
            throw new Error(`Failed to migrate core data: ${error.message}`);
        }
    }

    /**
     * Migrate community settings
     */
    async migrateSettings(community) {
        try {
            const existingSettings = await CommunitySettings.findOne({ communityId: community._id });
            if (existingSettings) {
                this.log(`Settings already exist for community ${community._id}, skipping`);
                return;
            }

            const settingsData = {
                communityId: community._id,
                ...community.settings.toObject()
            };

            await CommunitySettings.create(settingsData);
            this.stats.migratedSettings++;
            this.log(`Migrated settings for community ${community._id}`);
        } catch (error) {
            throw new Error(`Failed to migrate settings: ${error.message}`);
        }
    }

    /**
     * Migrate community members
     */
    async migrateMembers(community) {
        try {
            const existingMemberships = await CommunityMembership.find({ communityId: community._id });
            if (existingMemberships.length > 0) {
                this.log(`Memberships already exist for community ${community._id}, skipping`);
                return;
            }

            const memberships = community.members.map(member => ({
                communityId: community._id,
                userId: member.userId,
                joinedAt: member.joinedAt || new Date(),
                status: member.status || 'active',
                role: member.role || 'member',
                totalContributions: member.totalContributions || new Decimal(0),
                totalPayouts: member.totalPayouts || new Decimal(0),
                penaltyAmount: member.penaltyAmount || new Decimal(0),
                lastContributionDate: member.lastContributionDate,
                lastPayoutDate: member.lastPayoutDate,
                participationScore: this.calculateParticipationScore(member, community),
                reliabilityScore: this.calculateReliabilityScore(member, community)
            }));

            await CommunityMembership.insertMany(memberships, { ordered: false });
            this.stats.migratedMembers += memberships.length;
            this.log(`Migrated ${memberships.length} members for community ${community._id}`);
        } catch (error) {
            throw new Error(`Failed to migrate members: ${error.message}`);
        }
    }

    /**
     * Migrate owing members
     */
    async migrateOwingMembers(community) {
        try {
            const existingOwings = await CommunityOwing.find({ communityId: community._id });
            if (existingOwings.length > 0) {
                this.log(`Owing records already exist for community ${community._id}, skipping`);
                return;
            }

            const owings = community.owingMembers.map(owing => ({
                communityId: community._id,
                userId: owing.userId,
                amount: owing.amount || new Decimal(0),
                reason: owing.reason || 'penalty',
                cycleNumber: owing.cycleNumber || 1,
                dueDate: owing.dueDate || new Date(),
                status: owing.status || 'pending',
                createdAt: owing.createdAt || new Date(),
                paymentDetails: owing.paymentDetails,
                metadata: owing.metadata || {}
            }));

            await CommunityOwing.insertMany(owings, { ordered: false });
            this.stats.migratedOwing += owings.length;
            this.log(`Migrated ${owings.length} owing records for community ${community._id}`);
        } catch (error) {
            throw new Error(`Failed to migrate owing members: ${error.message}`);
        }
    }

    /**
     * Migrate history (cycles and activity logs)
     */
    async migrateHistory(community) {
        try {
            const existingHistory = await CommunityActivity.find({ communityId: community._id });
            if (existingHistory.length > 0) {
                this.log(`History already exists for community ${community._id}, skipping`);
                return;
            }

            const historyEntries = [];

            // Migrate cycles
            if (community.cycles && community.cycles.length > 0) {
                community.cycles.forEach(cycle => {
                    historyEntries.push({
                        communityId: community._id,
                        entryType: 'cycle_completed',
                        timestamp: cycle.endDate || cycle.startDate || new Date(),
                        cycleData: {
                            cycleNumber: cycle.cycleNumber,
                            startDate: cycle.startDate,
                            endDate: cycle.endDate,
                            status: cycle.status || 'completed',
                            totalContributions: cycle.totalContributions || new Decimal(0),
                            backupFundContribution: cycle.backupFundContribution || new Decimal(0),
                            participantCount: cycle.contributions?.length || 0,
                            completionRate: this.calculateCompletionRate(cycle)
                        }
                    });
                });
            }

            // Migrate activity logs
            if (community.activityLog && community.activityLog.length > 0) {
                community.activityLog.forEach(log => {
                    historyEntries.push({
                        communityId: community._id,
                        entryType: 'activity_log',
                        activityType: log.activityType,
                        userId: log.userId,
                        timestamp: log.timestamp || new Date(),
                        details: log.details || {}
                    });
                });
            }

            if (historyEntries.length > 0) {
                await CommunityActivity.insertMany(historyEntries, { ordered: false });
                this.stats.migratedHistory += historyEntries.length;
                this.log(`Migrated ${historyEntries.length} history entries for community ${community._id}`);
            }
        } catch (error) {
            throw new Error(`Failed to migrate history: ${error.message}`);
        }
    }

    /**
     * Calculate participation score for a member
     */
    calculateParticipationScore(member, community) {
        try {
            const totalCycles = community.cycles?.length || 1;
            const memberContributions = member.contributionCount || 0;
            return Math.min(100, (memberContributions / totalCycles) * 100);
        } catch {
            return 0;
        }
    }

    /**
     * Calculate reliability score for a member
     */
    calculateReliabilityScore(member, community) {
        try {
            const penalties = parseFloat(member.penaltyAmount?.toString() || '0');
            const contributions = parseFloat(member.totalContributions?.toString() || '0');
            
            if (contributions === 0) return 100;
            
            const penaltyRatio = penalties / contributions;
            return Math.max(0, 100 - (penaltyRatio * 100));
        } catch {
            return 100;
        }
    }

    /**
     * Calculate completion rate for a cycle
     */
    calculateCompletionRate(cycle) {
        try {
            if (!cycle.contributions || cycle.contributions.length === 0) {
                return new Decimal(0);
            }
            
            const completedContributions = cycle.contributions.filter(c => c.status === 'completed').length;
            return new Decimal(completedContributions).div(cycle.contributions.length).mul(100);
        } catch {
            return new Decimal(0);
        }
    }

    /**
     * Migrate all communities
     */
    async migrateAllCommunities(options = {}) {
        try {
            const { batchSize = 10, skipExisting = true } = options;
            
            this.log('Starting migration of all communities');
            
            const totalCommunities = await Community.countDocuments();
            this.stats.totalCommunities = totalCommunities;
            this.log(`Found ${totalCommunities} communities to migrate`);

            let skip = 0;
            let processedCount = 0;

            while (skip < totalCommunities) {
                const communities = await Community.find()
                    .select('_id name')
                    .skip(skip)
                    .limit(batchSize);

                for (const community of communities) {                    // Check if already migrated
                    if (skipExisting) {
                        const existingCore = await CommunityOptimized.findById(community._id);
                        if (existingCore) {
                            this.log(`Community ${community._id} already migrated, skipping`);
                            processedCount++;
                            continue;
                        }
                    }

                    const result = await this.migrateCommunity(community._id);
                    if (result.success) {
                        processedCount++;
                    }
                }

                skip += batchSize;
                this.log(`Processed ${processedCount}/${totalCommunities} communities`);
            }

            this.log(`Migration completed. Processed ${processedCount} communities`);
            return this.getStatus();
        } catch (error) {
            this.logError(error, 'migrateAllCommunities');
            throw error;
        }
    }

    /**
     * Rollback migration for a community
     */
    async rollbackCommunity(communityId) {
        try {
            this.log(`Starting rollback for community ${communityId}`);            // Delete optimized documents
            await Promise.all([
                CommunityOptimized.findByIdAndDelete(communityId),
                CommunitySettings.deleteOne({ communityId }),
                CommunityMembership.deleteMany({ communityId }),
                CommunityOwing.deleteMany({ communityId }),
                CommunityActivity.deleteMany({ communityId })
            ]);

            this.log(`Rollback completed for community ${communityId}`);
            return { success: true };
        } catch (error) {
            this.logError(error, `rollbackCommunity(${communityId})`);
            return { success: false, error: error.message };
        }
    }    /**
     * Get actual database statistics for migration report
     */
    async getDatabaseStats() {
        try {
            // Get total communities from original schema
            const totalCommunities = await Community.countDocuments();
            
            // Get migrated communities (those with optimized core records)
            const migratedCommunities = await CommunityOptimized.countDocuments();
            
            // Get migration statistics from sub-schemas
            const [settingsCount, membershipCount, owingCount, activityCount] = await Promise.all([
                CommunitySettings.countDocuments(),
                CommunityMembership.countDocuments(),
                CommunityOwing.countDocuments(),
                CommunityActivity.countDocuments()
            ]);

            return {
                totalCommunities,
                migratedCommunities,
                migratedMembers: membershipCount,
                migratedSettings: settingsCount,
                migratedOwing: owingCount,
                migratedHistory: activityCount,
                migrationProgress: totalCommunities > 0 
                    ? ((migratedCommunities / totalCommunities) * 100).toFixed(2) + '%'
                    : '0%'
            };
        } catch (error) {
            this.logError(error, 'getDatabaseStats');
            return {
                totalCommunities: 0,
                migratedCommunities: 0,
                migratedMembers: 0,
                migratedSettings: 0,
                migratedOwing: 0,
                migratedHistory: 0,
                migrationProgress: '0%'
            };
        }
    }

    /**
     * Get migration report
     */
    getMigrationReport() {
        return {
            timestamp: new Date(),
            stats: this.stats,
            logs: this.migrationLog,
            errors: this.errors,
            summary: {
                successRate: this.stats.totalCommunities > 0 
                    ? ((this.stats.migratedCommunities / this.stats.totalCommunities) * 100).toFixed(2) + '%'
                    : '0%',
                totalDataMigrated: {
                    communities: this.stats.migratedCommunities,
                    members: this.stats.migratedMembers,
                    settings: this.stats.migratedSettings,
                    owingRecords: this.stats.migratedOwing,
                    historyEntries: this.stats.migratedHistory
                }
            }
        };
    }
}

module.exports = CommunityMigration;
