/**
 * Phase 5: Community Query Service
 * 
 * Optimized queries for community data that replace direct array population
 * with efficient reverse queries and pagination support.
 */

const mongoose = require('mongoose');
const CommunityMembership = require('../models/CommunityMembership');
const CommunitySettings = require('../models/CommunitySettings');
const MidCycle = require('../models/Midcycle');
const Cycle = require('../models/Cycle');
const CommunityActivityLog = require('../models/CommunityActivityLog');
const CommunityVote = require('../models/CommunityVote');
const Member = require('../models/Member');

class CommunityQueryService {
    
    /**
     * Replace: community.populate('midCycle')
     * Get mid-cycles with pagination and filtering
     */
    static async getMidCycles(communityId, options = {}) {
        const { page = 1, limit = 10, status, cycleNumber, sortBy = 'createdAt', sortOrder = -1 } = options;
        const skip = (page - 1) * limit;
        
        const query = { communityId };
        if (status) query.status = status;
        if (cycleNumber) query.cycleNumber = cycleNumber;
        
        const midCycles = await MidCycle.find(query)
            .populate('nextInLine.userId', 'name email')
            .populate('contributions.user', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder });
            
        const total = await MidCycle.countDocuments(query);
        
        return {
            data: midCycles,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    
    /**
     * Replace: community.populate('cycles')
     * Get cycles with pagination and filtering
     */
    static async getCycles(communityId, options = {}) {
        const { page = 1, limit = 10, isComplete, sortBy = 'cycleNumber', sortOrder = -1 } = options;
        const skip = (page - 1) * limit;
        
        const query = { communityId };
        if (typeof isComplete === 'boolean') query.isComplete = isComplete;
        
        const cycles = await Cycle.find(query)
            .populate('midCycles')
            .populate('paidMembers', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ [sortBy]: sortOrder });
            
        const total = await Cycle.countDocuments(query);
        
        return {
            data: cycles,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    
    /**
     * Replace: community.members array access
     * Get members with pagination and status filtering
     */
    static async getMembers(communityId, options = {}) {
        const { page = 1, limit = 20, status = 'active', sortBy = 'position', sortOrder = 1 } = options;
        
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            // Use optimized CommunityMembership collection
            return await CommunityMembership.getActiveMembers(communityId, { page, limit });
        } else {
            // Fallback to original Member collection
            const skip = (page - 1) * limit;
            const query = { communityId };
            if (status) query.status = status;
            
            const members = await Member.find(query)
                .populate('userId', 'name email avatarUrl')
                .skip(skip)
                .limit(limit)
                .sort({ [sortBy]: sortOrder });
                
            const total = await Member.countDocuments(query);
            
            return {
                data: members,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        }
    }
    
    /**
     * Replace: community.populate('activityLog')
     * Get activity logs with pagination and filtering
     */
    static async getActivityLogs(communityId, options = {}) {
        const { page = 1, limit = 50, activityType, userId, startDate, endDate } = options;
        const skip = (page - 1) * limit;
        
        const query = { communityId };
        if (activityType) query.activityType = activityType;
        if (userId) query.userId = userId;
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }
        
        const activityLogs = await CommunityActivityLog.find(query)
            .populate('userId', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ timestamp: -1 });
            
        const total = await CommunityActivityLog.countDocuments(query);
        
        return {
            data: activityLogs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    
    /**
     * Replace: community.populate('votes')
     * Get votes with pagination and filtering
     */
    static async getVotes(communityId, options = {}) {
        const { page = 1, limit = 20, resolved, voteType } = options;
        const skip = (page - 1) * limit;
        
        const query = { communityId };
        if (typeof resolved === 'boolean') query.resolved = resolved;
        if (voteType) query.voteType = voteType;
        
        const votes = await CommunityVote.find(query)
            .populate('initiatedBy', 'name email')
            .populate('targetUser', 'name email')
            .populate('votes.votedBy', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
            
        const total = await CommunityVote.countDocuments(query);
        
        return {
            data: votes,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
    
    /**
     * Get community settings
     * Replaces: community.settings
     */
    static async getSettings(communityId) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            return await CommunitySettings.findOne({ communityId });
        } else {
            const community = await mongoose.model('Community').findById(communityId);
            return community?.settings;
        }
    }
    
    /**
     * Get active cycle for community
     * Optimized query to find current active cycle
     */
    static async getActiveCycle(communityId) {
        return await Cycle.findOne({
            communityId,
            isComplete: false
        }).populate('midCycles');
    }
    
    /**
     * Get active mid-cycle for community
     * Optimized query to find current active mid-cycle
     */
    static async getActiveMidCycle(communityId) {
        const activeCycle = await this.getActiveCycle(communityId);
        if (!activeCycle) return null;
        
        return await MidCycle.findOne({
            communityId,
            cycleNumber: activeCycle.cycleNumber,
            isComplete: false
        }).populate('nextInLine.userId', 'name email');
    }
    
    /**
     * Get member count by status
     * Optimized counting without loading full documents
     */
    static async getMemberCount(communityId, status = 'active') {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            return await CommunityMembership.getMemberCount(communityId, status);
        } else {
            return await Member.countDocuments({ communityId, status });
        }
    }
    
    /**
     * Get next in line member
     * Optimized query to find the next recipient
     */
    static async getNextInLine(communityId) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            return await CommunityMembership.getNextInLine(communityId);
        } else {
            return await Member.findOne({
                communityId,
                status: 'active',
                position: 1
            }).populate('userId', 'name email');
        }
    }
    
    /**
     * Get members by position range
     * Useful for payout calculations
     */
    static async getMembersByPosition(communityId, startPosition, endPosition) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            return await CommunityMembership.getMembersByPosition(communityId, startPosition, endPosition);
        } else {
            return await Member.find({
                communityId,
                status: 'active',
                position: { $gte: startPosition, $lte: endPosition }
            }).populate('userId', 'name email').sort({ position: 1 });
        }
    }
    
    /**
     * Get owing members (mid-cycle joiners with remaining payments)
     * Replaces: community.owingMembers array
     */
    static async getOwingMembers(communityId, options = {}) {
        const { page = 1, limit = 20 } = options;
        
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            // In Phase 5, this would use CommunityOwing collection
            // For now, query from Member collection
            const skip = (page - 1) * limit;
            
            const members = await Member.find({
                communityId,
                'paymentPlan.remainingAmount': { $gt: 0 }
            })
            .populate('userId', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ 'paymentPlan.remainingAmount': -1 });
            
            const total = await Member.countDocuments({
                communityId,
                'paymentPlan.remainingAmount': { $gt: 0 }
            });
            
            return {
                data: members,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } else {
            // Use original community.owingMembers array
            const community = await mongoose.model('Community').findById(communityId);
            const owingMembers = community?.owingMembers || [];
            
            // Apply pagination to array
            const skip = (page - 1) * limit;
            const paginatedMembers = owingMembers.slice(skip, skip + limit);
            
            return {
                data: paginatedMembers,
                pagination: {
                    page,
                    limit,
                    total: owingMembers.length,
                    pages: Math.ceil(owingMembers.length / limit)
                }
            };
        }
    }
    
    /**
     * Get community statistics
     * Aggregated data for dashboard views
     */
    static async getCommunityStats(communityId) {
        const stats = await Promise.all([
            this.getMemberCount(communityId, 'active'),
            this.getMemberCount(communityId, 'inactive'),
            this.getMemberCount(communityId, 'pending'),
            Cycle.countDocuments({ communityId }),
            Cycle.countDocuments({ communityId, isComplete: false }),
            MidCycle.countDocuments({ communityId }),
            MidCycle.countDocuments({ communityId, isComplete: false }),
            CommunityActivityLog.countDocuments({ communityId }),
            CommunityVote.countDocuments({ communityId, resolved: false })
        ]);
        
        return {
            members: {
                active: stats[0],
                inactive: stats[1],
                pending: stats[2],
                total: stats[0] + stats[1] + stats[2]
            },
            cycles: {
                total: stats[3],
                active: stats[4],
                completed: stats[3] - stats[4]
            },
            midCycles: {
                total: stats[5],
                active: stats[6],
                completed: stats[5] - stats[6]
            },
            activityLogs: stats[7],
            pendingVotes: stats[8]
        };
    }
    
    /**
     * Search communities by name or description
     * Optimized text search with pagination
     */
    static async searchCommunities(keyword, options = {}) {
        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        
        if (!keyword) {
            return {
                data: [],
                pagination: { page, limit, total: 0, pages: 0 }
            };
        }
        
        // Create a case-insensitive search pattern
        const searchPattern = new RegExp(keyword, 'i');
        
        const query = {
            $or: [
                { name: searchPattern },
                { description: searchPattern }
            ]
        };
        
        const communities = await mongoose.model('Community').find(query)
            .populate('admin', 'name email')
            .skip(skip)
            .limit(limit)
            .sort({ name: 1 });
            
        const total = await mongoose.model('Community').countDocuments(query);
        
        return {
            data: communities,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }
}

module.exports = CommunityQueryService;
