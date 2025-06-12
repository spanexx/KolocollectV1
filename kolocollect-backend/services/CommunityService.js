/**
 * Phase 5: Community Service Layer
 * 
 * Business logic extracted from Community model methods
 * All original methods are preserved as comments in Community.js
 * 
 * This service implements the optimized community operations while preserving
 * backward compatibility through method delegation.
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

class CommunityService {
    /**
     * Add activity log entry
     * Extracted from Community.addActivityLog method
     */
    static async addActivityLog(community, activityType, userId) {
        const activityLog = {
            activityType,
            userId,
            timestamp: new Date(),
            details: {}
        };

        // Use optimized history tracking if available
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            const CommunityHistory = require('../models/CommunityHistory');
            return await CommunityHistory.create({
                communityId: community._id,
                ...activityLog
            });
        }

        // Fallback to original array method
        community.activityLog.push(activityLog);
        return await community.save();
    }

    /**
     * Update contributions with cycle sync
     * Extracted from Community.updateContributions method
     */
    static async updateContributions(community, midCycle, userId, contributionId) {
        try {
            // Find and update the contribution
            const contribution = midCycle.contributions.find(c => 
                c.contributionId.toString() === contributionId.toString()
            );

            if (!contribution) {
                throw new Error('Contribution not found');
            }

            contribution.status = 'completed';
            contribution.completedAt = new Date();

            // Update community's midCycle array
            const midCycleIndex = community.midCycle.findIndex(mc => 
                mc._id.toString() === midCycle._id.toString()
            );

            if (midCycleIndex !== -1) {
                community.midCycle[midCycleIndex] = midCycle;
            }

            await community.save();

            // Add activity log
            await this.addActivityLog(community, 'contribution_completed', userId);

            return community;
        } catch (error) {
            throw new Error(`Failed to update contributions: ${error.message}`);
        }
    }

    /**
     * Sync midCycles to cycles
     * Extracted from Community.syncMidCyclesToCycles method
     */
    static async syncMidCyclesToCycles(community) {
        try {
            for (const midCycle of community.midCycle) {
                if (midCycle.status === 'completed') {
                    // Check if cycle already exists
                    const existingCycle = community.cycles.find(c => 
                        c.cycleNumber === midCycle.cycleNumber
                    );

                    if (!existingCycle) {
                        const cycle = {
                            cycleNumber: midCycle.cycleNumber,
                            startDate: midCycle.startDate,
                            endDate: midCycle.endDate || new Date(),
                            status: 'completed',
                            contributions: midCycle.contributions,
                            totalContributions: midCycle.totalContributions,
                            backupFundContribution: midCycle.backupFundContribution,
                            completedAt: new Date()
                        };

                        community.cycles.push(cycle);
                    }
                }
            }

            // Remove completed midCycles
            community.midCycle = community.midCycle.filter(mc => mc.status !== 'completed');

            return await community.save();
        } catch (error) {
            throw new Error(`Failed to sync cycles: ${error.message}`);
        }
    }

    /**
     * Start first cycle
     * Extracted from Community.startFirstCycle method
     */
    static async startFirstCycle(community) {
        try {
            if (community.cycles.length > 0) {
                throw new Error('Community already has cycles');
            }

            const firstCycle = {
                cycleNumber: 1,
                startDate: new Date(),
                status: 'active',
                contributions: [],
                totalContributions: new Decimal(0),
                backupFundContribution: new Decimal(0)
            };

            community.cycles.push(firstCycle);
            community.status = 'active';

            await community.save();

            // Add activity log
            await this.addActivityLog(community, 'cycle_started', null);

            return community;
        } catch (error) {
            throw new Error(`Failed to start first cycle: ${error.message}`);
        }
    }

    /**
     * Add member to community
     * Optimized version using CommunityMembership collection
     */
    static async addMember(community, memberData) {
        try {
            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                const CommunityMembership = require('../models/CommunityMembership');
                
                // Check if member already exists
                const existingMember = await CommunityMembership.findOne({
                    communityId: community._id,
                    userId: memberData.userId
                });

                if (existingMember) {
                    throw new Error('User is already a member of this community');
                }

                // Create new membership
                const membership = new CommunityMembership({
                    communityId: community._id,
                    userId: memberData.userId,
                    joinedAt: new Date(),
                    status: 'active',
                    role: memberData.role || 'member',
                    totalContributions: new Decimal(0),
                    totalPayouts: new Decimal(0),
                    penaltyAmount: new Decimal(0)
                });

                await membership.save();

                // Update community member count
                await community.updateOne({ $inc: { memberCount: 1 } });

                return membership;
            }

            // Fallback to original array method
            const member = {
                userId: memberData.userId,
                joinedAt: new Date(),
                status: 'active',
                role: memberData.role || 'member',
                totalContributions: new Decimal(0),
                totalPayouts: new Decimal(0),
                penaltyAmount: new Decimal(0)
            };

            community.members.push(member);
            return await community.save();
        } catch (error) {
            throw new Error(`Failed to add member: ${error.message}`);
        }
    }

    /**
     * Update community settings
     * Optimized version using CommunitySettings collection
     */
    static async updateSettings(community, settingsData) {
        try {
            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                const CommunitySettings = require('../models/CommunitySettings');
                
                let settings = await CommunitySettings.findOne({ communityId: community._id });
                
                if (!settings) {
                    settings = new CommunitySettings({
                        communityId: community._id,
                        ...settingsData
                    });
                } else {
                    Object.assign(settings, settingsData);
                }

                await settings.save();
                return settings;
            }

            // Fallback to original embedded method
            Object.assign(community.settings, settingsData);
            return await community.save();
        } catch (error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
    }

    /**
     * Get community members with pagination
     * Optimized version using CommunityMembership collection
     */
    static async getMembers(communityId, options = {}) {
        try {
            const { page = 1, limit = 50, status = 'active' } = options;

            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                const CommunityMembership = require('../models/CommunityMembership');
                
                const query = { 
                    communityId: communityId,
                    status: status
                };

                const members = await CommunityMembership.find(query)
                    .populate('userId', 'name email profilePicture')
                    .sort({ joinedAt: -1 })
                    .limit(limit * 1)
                    .skip((page - 1) * limit)
                    .exec();

                const total = await CommunityMembership.countDocuments(query);

                return {
                    members,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    total
                };
            }

            // Fallback to original array method
            const Community = require('../models/Community');
            const community = await Community.findById(communityId)
                .populate('members.userId', 'name email profilePicture');

            const filteredMembers = community.members.filter(m => m.status === status);
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

            return {
                members: paginatedMembers,
                totalPages: Math.ceil(filteredMembers.length / limit),
                currentPage: page,
                total: filteredMembers.length
            };
        } catch (error) {
            throw new Error(`Failed to get members: ${error.message}`);
        }
    }

    /**
     * Calculate member statistics
     * Optimized version with performance metrics
     */
    static async getMemberStats(communityId, userId) {
        try {
            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                const CommunityMembership = require('../models/CommunityMembership');
                
                const membership = await CommunityMembership.findOne({
                    communityId: communityId,
                    userId: userId
                });

                if (!membership) {
                    throw new Error('Member not found');
                }

                return {
                    totalContributions: membership.totalContributions,
                    totalPayouts: membership.totalPayouts,
                    penaltyAmount: membership.penaltyAmount,
                    participationScore: membership.participationScore,
                    reliabilityScore: membership.reliabilityScore,
                    joinedAt: membership.joinedAt,
                    lastContribution: membership.lastContributionDate,
                    lastPayout: membership.lastPayoutDate
                };
            }

            // Fallback to original calculation
            const Community = require('../models/Community');
            const community = await Community.findById(communityId);
            const member = community.members.find(m => m.userId.toString() === userId.toString());

            if (!member) {
                throw new Error('Member not found');
            }

            return {
                totalContributions: member.totalContributions,
                totalPayouts: member.totalPayouts,
                penaltyAmount: member.penaltyAmount,
                joinedAt: member.joinedAt
            };
        } catch (error) {
            throw new Error(`Failed to get member stats: ${error.message}`);
        }
    }

    /**
     * Handle owing members management
     * Optimized version using CommunityOwing collection
     */
    static async addOwingMember(communityId, owingData) {
        try {
            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                const CommunityOwing = require('../models/CommunityOwing');
                
                const owing = new CommunityOwing({
                    communityId: communityId,
                    userId: owingData.userId,
                    amount: new Decimal(owingData.amount),
                    reason: owingData.reason,
                    cycleNumber: owingData.cycleNumber,
                    dueDate: owingData.dueDate,
                    status: 'pending'
                });

                await owing.save();
                return owing;
            }

            // Fallback to original array method
            const Community = require('../models/Community');
            const community = await Community.findById(communityId);
            
            const owingMember = {
                userId: owingData.userId,
                amount: new Decimal(owingData.amount),
                reason: owingData.reason,
                cycleNumber: owingData.cycleNumber,
                dueDate: owingData.dueDate,
                status: 'pending',
                createdAt: new Date()
            };

            community.owingMembers.push(owingMember);
            return await community.save();
        } catch (error) {
            throw new Error(`Failed to add owing member: ${error.message}`);
        }
    }

    /**
     * Get community statistics
     * Optimized aggregation queries
     */
    static async getCommunityStats(communityId) {
        try {
            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                const CommunityMembership = require('../models/CommunityMembership');
                const CommunityOwing = require('../models/CommunityOwing');
                
                const [memberStats, owingStats] = await Promise.all([
                    CommunityMembership.aggregate([
                        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
                        {
                            $group: {
                                _id: null,
                                totalMembers: { $sum: 1 },
                                activeMembers: {
                                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                                },
                                totalContributions: { $sum: '$totalContributions' },
                                totalPayouts: { $sum: '$totalPayouts' },
                                avgParticipation: { $avg: '$participationScore' }
                            }
                        }
                    ]),
                    CommunityOwing.aggregate([
                        { $match: { communityId: new mongoose.Types.ObjectId(communityId) } },
                        {
                            $group: {
                                _id: null,
                                totalOwing: { $sum: '$amount' },
                                pendingOwing: {
                                    $sum: {
                                        $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
                                    }
                                }
                            }
                        }
                    ])
                ]);

                return {
                    ...(memberStats[0] || {}),
                    ...(owingStats[0] || {})
                };
            }

            // Fallback to original method
            const Community = require('../models/Community');
            const community = await Community.findById(communityId);
            
            const activeMembers = community.members.filter(m => m.status === 'active');
            const totalContributions = community.members.reduce((sum, m) => 
                sum.plus(m.totalContributions || 0), new Decimal(0));
            const totalOwing = community.owingMembers.reduce((sum, o) => 
                sum.plus(o.amount || 0), new Decimal(0));

            return {
                totalMembers: community.members.length,
                activeMembers: activeMembers.length,
                totalContributions,
                totalOwing
            };
        } catch (error) {
            throw new Error(`Failed to get community stats: ${error.message}`);
        }
    }

    /**
     * Bulk operations for data migration
     */
    static async migrateCommunityData(communityId) {
        try {
            const Community = require('../models/Community');
            const community = await Community.findById(communityId);

            if (!community) {
                throw new Error('Community not found');
            }

            // Migrate members
            if (community.members && community.members.length > 0) {
                const CommunityMembership = require('../models/CommunityMembership');
                
                const memberships = community.members.map(member => ({
                    communityId: community._id,
                    userId: member.userId,
                    joinedAt: member.joinedAt || new Date(),
                    status: member.status || 'active',
                    role: member.role || 'member',
                    totalContributions: member.totalContributions || new Decimal(0),
                    totalPayouts: member.totalPayouts || new Decimal(0),
                    penaltyAmount: member.penaltyAmount || new Decimal(0)
                }));

                await CommunityMembership.insertMany(memberships, { ordered: false });
            }

            // Migrate settings
            if (community.settings) {
                const CommunitySettings = require('../models/CommunitySettings');
                
                await CommunitySettings.create({
                    communityId: community._id,
                    ...community.settings.toObject()
                });
            }

            // Migrate owing members
            if (community.owingMembers && community.owingMembers.length > 0) {
                const CommunityOwing = require('../models/CommunityOwing');
                
                const owings = community.owingMembers.map(owing => ({
                    communityId: community._id,
                    userId: owing.userId,
                    amount: owing.amount,
                    reason: owing.reason,
                    cycleNumber: owing.cycleNumber,
                    dueDate: owing.dueDate,
                    status: owing.status || 'pending',
                    createdAt: owing.createdAt || new Date()
                }));

                await CommunityOwing.insertMany(owings, { ordered: false });
            }

            // Migrate history (cycles and activity logs)
            if (community.cycles && community.cycles.length > 0) {
                const CommunityHistory = require('../models/CommunityHistory');
                
                const historyEntries = [];

                // Add cycle history
                community.cycles.forEach(cycle => {
                    historyEntries.push({
                        communityId: community._id,
                        activityType: 'cycle_completed',
                        timestamp: cycle.endDate || cycle.startDate,
                        details: {
                            cycleNumber: cycle.cycleNumber,
                            totalContributions: cycle.totalContributions,
                            backupFundContribution: cycle.backupFundContribution
                        }
                    });
                });

                // Add activity log history
                if (community.activityLog) {
                    community.activityLog.forEach(log => {
                        historyEntries.push({
                            communityId: community._id,
                            activityType: log.activityType,
                            userId: log.userId,
                            timestamp: log.timestamp,
                            details: log.details || {}
                        });
                    });
                }

                if (historyEntries.length > 0) {
                    await CommunityHistory.insertMany(historyEntries, { ordered: false });
                }
            }

            return {
                success: true,
                migratedMembers: community.members?.length || 0,
                migratedOwing: community.owingMembers?.length || 0,
                migratedHistory: (community.cycles?.length || 0) + (community.activityLog?.length || 0)
            };
        } catch (error) {
            throw new Error(`Failed to migrate community data: ${error.message}`);
        }
    }
}

module.exports = CommunityService;
