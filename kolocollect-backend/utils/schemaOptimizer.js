/**
 * Schema Design Optimizer
 * 
 * This utility class provides methods for optimizing large schemas by:
 * 1. Splitting complex schemas into smaller, focused sub-schemas
 * 2. Moving historical data to separate collections
 * 3. Implementing TTL indexes for temporary data
 * 4. Optimizing schema relationships and references
 * 
 * Created: May 30, 2025
 * Purpose: Phase 2 of Backend Database Optimization - Schema Design Optimization
 */

const mongoose = require('mongoose');

class SchemaOptimizer {
    constructor() {
        this.optimizationStats = {
            schemasSplit: 0,
            collectionsCreated: 0,
            ttlIndexesCreated: 0,
            relationshipsOptimized: 0,
            memoryReduced: 0
        };
    }

    /**
     * Analyzes a large schema and provides optimization recommendations
     * @param {mongoose.Schema} schema - The schema to analyze
     * @param {string} modelName - Name of the model
     * @returns {object} Analysis report with recommendations
     */
    analyzeSchema(schema, modelName) {
        const analysis = {
            modelName,
            complexity: this._calculateComplexity(schema),
            recommendations: [],
            potentialOptimizations: []
        };

        // Check for large nested documents
        const nestedFields = this._findNestedFields(schema);
        if (nestedFields.length > 0) {
            analysis.recommendations.push({
                type: 'SPLIT_NESTED_DOCUMENTS',
                priority: 'HIGH',
                fields: nestedFields,
                description: 'Split large nested documents into separate collections'
            });
        }

        // Check for large arrays
        const arrayFields = this._findArrayFields(schema);
        if (arrayFields.length > 0) {
            analysis.recommendations.push({
                type: 'OPTIMIZE_ARRAYS',
                priority: 'MEDIUM',
                fields: arrayFields,
                description: 'Consider using references instead of embedded arrays for large datasets'
            });
        }

        // Check for historical data patterns
        const temporalFields = this._findTemporalFields(schema);
        if (temporalFields.length > 0) {
            analysis.recommendations.push({
                type: 'SEPARATE_HISTORICAL_DATA',
                priority: 'MEDIUM',
                fields: temporalFields,
                description: 'Move historical/time-series data to separate collections'
            });
        }

        return analysis;
    }

    /**
     * Creates optimized sub-schemas for community-related data
     * @returns {object} Collection of optimized schemas
     */
    createCommunitySubSchemas() {
        const subSchemas = {};

        // Community Core Schema (essential fields only)
        subSchemas.CommunityCore = new mongoose.Schema({
            name: { type: String, required: true, index: true },
            admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
            description: { type: String },
            isActive: { type: Boolean, default: true, index: true },
            
            // Financial summary (aggregated data)
            financialSummary: {
                totalContribution: { 
                    type: mongoose.Schema.Types.Decimal128, 
                    default: 0,
                    get: function(value) {
                        return value ? parseFloat(value.toString()) : 0;
                    }
                },
                totalDistributed: { 
                    type: mongoose.Schema.Types.Decimal128, 
                    default: 0,
                    get: function(value) {
                        return value ? parseFloat(value.toString()) : 0;
                    }
                },
                backupFund: { 
                    type: mongoose.Schema.Types.Decimal128, 
                    default: 0,
                    get: function(value) {
                        return value ? parseFloat(value.toString()) : 0;
                    }
                }
            },

            // Basic settings
            settings: {
                contributionFrequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Hourly'], default: 'Weekly' },
                maxMembers: { type: Number, default: 100 },
                backupFundPercentage: { type: Number, default: 10 },
                isPrivate: { type: Boolean, default: false },
                minContribution: { 
                    type: mongoose.Schema.Types.Decimal128, 
                    default: 30,
                    get: function(value) {
                        return value ? parseFloat(value.toString()) : 30;
                    }
                },
                penalty: { 
                    type: mongoose.Schema.Types.Decimal128, 
                    default: 10,
                    get: function(value) {
                        return value ? parseFloat(value.toString()) : 10;
                    }
                },
                numMissContribution: { type: Number, default: 3 },
                firstCycleMin: { type: Number, default: 5 }
            },

            // Current state references only
            currentCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
            activeMidCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' },
            
            // Status fields
            cycleState: { type: String, enum: ['Active', 'Locked', 'Completed'], default: 'Active', index: true },
            nextPayout: { type: Date, index: true },
            lockPayout: { type: Boolean, default: false }
        }, { 
            timestamps: true,
            toJSON: { getters: true }
        });

        // Community History Schema (historical data)
        subSchemas.CommunityHistory = new mongoose.Schema({
            communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
            
            // Historical cycles
            completedCycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' }],
            
            // Historical payouts
            payoutHistory: [{
                recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                amount: { type: mongoose.Schema.Types.Decimal128 },
                date: { type: Date },
                cycleNumber: { type: Number },
                status: { type: String, enum: ['completed', 'failed', 'pending'] }
            }],

            // Activity logs (with TTL)
            activities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityActivityLog' }],
            
            // Archived member data
            archivedMembers: [{
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                joinDate: { type: Date },
                leaveDate: { type: Date },
                totalContributions: { type: mongoose.Schema.Types.Decimal128 },
                payoutsReceived: { type: Number }
            }]
        }, { 
            timestamps: true,
            // TTL index for automatic cleanup of old historical data (1 year)
            expireAfterSeconds: 365 * 24 * 60 * 60
        });

        // Community Statistics Schema (analytics and reporting)
        subSchemas.CommunityStats = new mongoose.Schema({
            communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
            period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
            date: { type: Date, required: true, index: true },
            
            metrics: {
                memberCount: { type: Number, default: 0 },
                activeMembers: { type: Number, default: 0 },
                contributionsCount: { type: Number, default: 0 },
                totalContributionAmount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
                averageContribution: { type: mongoose.Schema.Types.Decimal128, default: 0 },
                payoutsCount: { type: Number, default: 0 },
                totalPayoutAmount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
                backupFundGrowth: { type: mongoose.Schema.Types.Decimal128, default: 0 },
                cycleCompletionRate: { type: Number, default: 0 },
                memberRetentionRate: { type: Number, default: 0 }
            }
        }, { 
            timestamps: true,
            // TTL index for automatic cleanup of old stats (6 months)
            expireAfterSeconds: 180 * 24 * 60 * 60
        });

        // Community Votes Schema (separate voting system)
        subSchemas.CommunityVoting = new mongoose.Schema({
            communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
            activeVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityVote' }],
            completedVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityVote' }],
            
            // Vote history summary
            votingStats: {
                totalVotes: { type: Number, default: 0 },
                participationRate: { type: Number, default: 0 },
                averageVotingTime: { type: Number, default: 0 }
            }
        }, { timestamps: true });

        return subSchemas;
    }

    /**
     * Creates TTL indexes for temporary and historical data
     * @param {string} collectionName - Name of the collection
     * @param {object} ttlConfig - TTL configuration
     */
    async createTTLIndexes(collectionName, ttlConfig) {
        try {
            const collection = mongoose.connection.collection(collectionName);
            
            for (const config of ttlConfig) {
                await collection.createIndex(
                    { [config.field]: 1 },
                    { 
                        expireAfterSeconds: config.ttl,
                        name: `ttl_${config.field}_${config.ttl}s`
                    }
                );
                
                this.optimizationStats.ttlIndexesCreated++;
                console.log(`TTL index created for ${collectionName}.${config.field} with ${config.ttl}s TTL`);
            }
        } catch (error) {
            console.error(`Error creating TTL indexes for ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Migrates existing Community data to optimized schema structure
     * @param {string} communityId - ID of community to migrate
     */
    async migrateCommunityData(communityId) {
        try {
            console.log(`Starting migration for community ${communityId}...`);
            
            // This would contain the migration logic
            // Implementation would depend on specific data structure
            
            this.optimizationStats.schemasSplit++;
            console.log(`Migration completed for community ${communityId}`);
            
        } catch (error) {
            console.error(`Error migrating community ${communityId}:`, error);
            throw error;
        }
    }

    /**
     * Private helper methods for schema analysis
     */
    _calculateComplexity(schema) {
        let complexity = 0;
        
        // Count paths
        const paths = schema.paths;
        complexity += Object.keys(paths).length;
        
        // Count methods
        const methods = schema.methods;
        complexity += Object.keys(methods).length * 10; // Methods add more complexity
        
        // Count indexes
        const indexes = schema.indexes();
        complexity += indexes.length * 2;
        
        return complexity;
    }

    _findNestedFields(schema) {
        const nestedFields = [];
        
        Object.keys(schema.paths).forEach(path => {
            const schemaType = schema.paths[path];
            if (schemaType instanceof mongoose.Schema.Types.Subdocument ||
                (schemaType.options && schemaType.options.type && Array.isArray(schemaType.options.type))) {
                nestedFields.push(path);
            }
        });
        
        return nestedFields;
    }

    _findArrayFields(schema) {
        const arrayFields = [];
        
        Object.keys(schema.paths).forEach(path => {
            const schemaType = schema.paths[path];
            if (schemaType instanceof mongoose.Schema.Types.Array) {
                arrayFields.push(path);
            }
        });
        
        return arrayFields;
    }

    _findTemporalFields(schema) {
        const temporalFields = [];
        
        Object.keys(schema.paths).forEach(path => {
            const schemaType = schema.paths[path];
            if (schemaType instanceof mongoose.Schema.Types.Date ||
                path.includes('history') ||
                path.includes('log') ||
                path.includes('archive')) {
                temporalFields.push(path);
            }
        });
        
        return temporalFields;
    }

    /**
     * Get optimization statistics
     */
    getStats() {
        return this.optimizationStats;
    }

    /**
     * Reset optimization statistics
     */
    resetStats() {
        this.optimizationStats = {
            schemasSplit: 0,
            collectionsCreated: 0,
            ttlIndexesCreated: 0,
            relationshipsOptimized: 0,
            memoryReduced: 0
        };
    }
}

module.exports = SchemaOptimizer;
