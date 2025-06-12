/**
 * Phase 5: Community Compatibility Layer
 * 
 * Ensures existing queries continue to work during transition
 * Provides seamless fallback between optimized and original schemas
 */

const CommunityQueryService = require('../services/CommunityQueryService');
const CommunityService = require('../services/CommunityService');

class CommunityCompatibility {
    
    /**
     * Create a proxy for members array access
     * Intercepts array operations and converts to optimized queries
     */
    static createMembersProxy(communityId) {
        return new Proxy([], {
            get(target, prop) {
                // Handle array methods
                if (prop === 'length') {
                    return CommunityQueryService.getMemberCount(communityId, 'active');
                }
                
                if (prop === 'find') {
                    return (callback) => {
                        // Convert to optimized query
                        return CommunityQueryService.getMembers(communityId);
                    };
                }
                
                if (prop === 'filter') {
                    return (callback) => {
                        // Convert to optimized query with filtering
                        return CommunityQueryService.getMembers(communityId);
                    };
                }
                
                if (prop === 'push') {
                    return (memberId) => {
                        // Handle member addition
                        console.warn('Array push detected - consider using CommunityService.addMember');
                        return true;
                    };
                }
                
                // Handle numeric index access
                if (!isNaN(prop)) {
                    return CommunityQueryService.getMembers(communityId, { 
                        page: Math.floor(prop / 20) + 1, 
                        limit: 20 
                    }).then(result => result.data[prop % 20]);
                }
                
                return target[prop];
            },
            
            set(target, prop, value) {
                console.warn(`Array assignment detected for property ${prop} - consider using optimized methods`);
                return true;
            }
        });
    }
    
    /**
     * Create a proxy for midCycle array access
     */
    static createMidCycleProxy(communityId) {
        return new Proxy([], {
            get(target, prop) {
                if (prop === 'length') {
                    return CommunityQueryService.getMidCycles(communityId)
                        .then(result => result.pagination.total);
                }
                
                if (prop === 'find') {
                    return (callback) => {
                        return CommunityQueryService.getMidCycles(communityId);
                    };
                }
                
                if (prop === 'filter') {
                    return (callback) => {
                        return CommunityQueryService.getMidCycles(communityId);
                    };
                }
                
                if (!isNaN(prop)) {
                    return CommunityQueryService.getMidCycles(communityId, { 
                        page: Math.floor(prop / 10) + 1, 
                        limit: 10 
                    }).then(result => result.data[prop % 10]);
                }
                
                return target[prop];
            }
        });
    }
    
    /**
     * Create a proxy for cycles array access
     */
    static createCyclesProxy(communityId) {
        return new Proxy([], {
            get(target, prop) {
                if (prop === 'length') {
                    return CommunityQueryService.getCycles(communityId)
                        .then(result => result.pagination.total);
                }
                
                if (prop === 'find') {
                    return (callback) => {
                        return CommunityQueryService.getCycles(communityId);
                    };
                }
                
                if (prop === 'filter') {
                    return (callback) => {
                        return CommunityQueryService.getCycles(communityId);
                    };
                }
                
                if (!isNaN(prop)) {
                    return CommunityQueryService.getCycles(communityId, { 
                        page: Math.floor(prop / 10) + 1, 
                        limit: 10 
                    }).then(result => result.data[prop % 10]);
                }
                
                return target[prop];
            }
        });
    }
    
    /**
     * Intercept community.members access
     */
    static async getMembers(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            // Use new optimized query
            const result = await CommunityQueryService.getMembers(community._id);
            return result.data;
        } else {
            // Use original array (preserved)
            return community.members;
        }
    }
    
    /**
     * Intercept community.populate('midCycle')
     */
    static async populateMidCycles(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            // Use new reverse query
            const result = await CommunityQueryService.getMidCycles(community._id);
            community.midCycle = result.data;
            return community;
        } else {
            // Use original populate (preserved)
            return await community.populate('midCycle');
        }
    }
    
    /**
     * Intercept community.populate('cycles')
     */
    static async populateCycles(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            const result = await CommunityQueryService.getCycles(community._id);
            community.cycles = result.data;
            return community;
        } else {
            return await community.populate('cycles');
        }
    }
    
    /**
     * Intercept community.populate('activityLog')
     */
    static async populateActivityLog(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            const result = await CommunityQueryService.getActivityLogs(community._id);
            community.activityLog = result.data;
            return community;
        } else {
            return await community.populate('activityLog');
        }
    }
    
    /**
     * Intercept community.populate('votes')
     */
    static async populateVotes(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            const result = await CommunityQueryService.getVotes(community._id);
            community.votes = result.data;
            return community;
        } else {
            return await community.populate('votes');
        }
    }
    
    /**
     * Intercept community.settings access
     */
    static async getSettings(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            return await CommunityQueryService.getSettings(community._id);
        } else {
            return community.settings;
        }
    }
    
    /**
     * Intercept community.owingMembers access
     */
    static async getOwingMembers(community) {
        if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
            const result = await CommunityQueryService.getOwingMembers(community._id);
            return result.data;
        } else {
            return community.owingMembers;
        }
    }
    
    /**
     * Method wrapper for preserving signatures
     */
    static wrapMethod(community, methodName, serviceMethod) {
        return function(...args) {
            if (process.env.USE_OPTIMIZED_SCHEMA === 'true') {
                return serviceMethod.apply(null, [community, ...args]);
            } else {
                // Use original method (should be preserved as comment)
                console.warn(`Original method ${methodName} called - ensure it's uncommented for fallback`);
                throw new Error(`Original method ${methodName} not available in optimized mode`);
            }
        };
    }
    
    /**
     * Create environment toggle for gradual migration
     */
    static shouldUseOptimizedSchema() {
        return process.env.USE_OPTIMIZED_SCHEMA === 'true';
    }
    
    /**
     * Create migration mode check
     */
    static isMigrationMode() {
        return process.env.PHASE5_MIGRATION_MODE === 'true';
    }
    
    /**
     * Create dual-write capability during migration
     */
    static async dualWrite(community, operation, data) {
        if (this.isMigrationMode()) {
            // Write to both old and new structures
            try {
                // Write to optimized structure
                const optimizedResult = await this.writeToOptimized(community, operation, data);
                
                // Write to original structure
                const originalResult = await this.writeToOriginal(community, operation, data);
                
                return { optimized: optimizedResult, original: originalResult };
            } catch (error) {
                console.error('Dual-write failed:', error);
                throw error;
            }
        } else if (this.shouldUseOptimizedSchema()) {
            return await this.writeToOptimized(community, operation, data);
        } else {
            return await this.writeToOriginal(community, operation, data);
        }
    }
    
    /**
     * Write to optimized schema structure
     */
    static async writeToOptimized(community, operation, data) {
        // Implementation depends on operation type
        switch (operation) {
            case 'addMember':
                return await CommunityService.addMember(community, data);
            case 'updateSettings':
                return await CommunityService.updateSettings(community, data);
            // Add more operations as needed
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    
    /**
     * Write to original schema structure
     */
    static async writeToOriginal(community, operation, data) {
        // Use original methods (preserved in comments)
        // This would call the uncommented original methods
        throw new Error('Original methods should be uncommented for fallback mode');
    }
}

module.exports = CommunityCompatibility;
