/**
 * Phase 5: Integration Test Script
 * 
 * Tests the optimized schema components to ensure they work correctly
 * and maintain backward compatibility
 */

const mongoose = require('mongoose');
const Decimal = require('decimal.js');

// Import optimized models
const CommunityOptimizedCore = require('../models/CommunityOptimizedCore');
const CommunitySettings = require('../models/CommunitySettings');
const CommunityMembership = require('../models/CommunityMembership');
const CommunityOwing = require('../models/CommunityOwing');
const CommunityActivity = require('../models/CommunityActivity');

// Import services
const CommunityService = require('../services/CommunityService');
const CommunityQueryService = require('../services/CommunityQueryService');

// Import compatibility layer
const CommunityCompatibility = require('../utils/CommunityCompatibility');

class Phase5IntegrationTest {
    constructor() {
        this.testResults = [];
        this.errors = [];
    }

    /**
     * Log test result
     */
    logTest(testName, success, message = '') {
        const result = {
            test: testName,
            success,
            message,
            timestamp: new Date()
        };
        this.testResults.push(result);
        
        const status = success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testName}: ${message}`);
    }

    /**
     * Test schema creation and basic operations
     */
    async testSchemaOperations() {
        try {
            // Test 1: Create community with optimized core
            const testCommunityId = new mongoose.Types.ObjectId();
            
            const coreData = {
                _id: testCommunityId,
                name: 'Test Community Phase 5',
                description: 'Testing optimized schema',
                type: 'rotating_savings',
                status: 'active',
                createdBy: new mongoose.Types.ObjectId(),
                memberCount: 0,
                totalContributions: new Decimal(0),
                totalPayouts: new Decimal(0),
                backupFund: new Decimal(0)
            };

            const community = await CommunityOptimizedCore.create(coreData);
            this.logTest('Create Optimized Community Core', true, `Created community ${community._id}`);

            // Test 2: Create community settings
            const settingsData = {
                communityId: testCommunityId,
                minContribution: new Decimal(5000),
                maxMembers: 20,
                cycleDuration: 30,
                penalty: new Decimal(500),
                backupFundPercentage: new Decimal(5),
                autoStart: true,
                requiresApproval: false
            };

            const settings = await CommunitySettings.create(settingsData);
            this.logTest('Create Community Settings', true, `Created settings for community ${testCommunityId}`);

            // Test 3: Add community members
            const userId1 = new mongoose.Types.ObjectId();
            const userId2 = new mongoose.Types.ObjectId();

            const membership1 = await CommunityMembership.create({
                communityId: testCommunityId,
                userId: userId1,
                status: 'active',
                role: 'admin',
                totalContributions: new Decimal(25000),
                totalPayouts: new Decimal(0),
                penaltyAmount: new Decimal(0)
            });

            const membership2 = await CommunityMembership.create({
                communityId: testCommunityId,
                userId: userId2,
                status: 'active',
                role: 'member',
                totalContributions: new Decimal(15000),
                totalPayouts: new Decimal(0),
                penaltyAmount: new Decimal(500)
            });

            this.logTest('Create Community Memberships', true, `Created 2 memberships for community ${testCommunityId}`);

            // Test 4: Add owing member
            const owing = await CommunityOwing.create({
                communityId: testCommunityId,
                userId: userId2,
                amount: new Decimal(500),
                reason: 'penalty',
                cycleNumber: 1,
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                status: 'pending'
            });

            this.logTest('Create Owing Record', true, `Created owing record for ${owing.amount} NGN`);

            // Test 5: Add activity history
            const activity = await CommunityActivity.create({
                communityId: testCommunityId,
                entryType: 'activity_log',
                activityType: 'member_joined',
                userId: userId1,
                details: { role: 'admin' }
            });

            this.logTest('Create Activity History', true, `Created activity log entry`);

            // Test 6: Query operations
            const members = await CommunityMembership.find({ communityId: testCommunityId });
            this.logTest('Query Members', members.length === 2, `Found ${members.length} members`);

            const pendingOwings = await CommunityOwing.find({ 
                communityId: testCommunityId, 
                status: 'pending' 
            });
            this.logTest('Query Owing Members', pendingOwings.length === 1, `Found ${pendingOwings.length} pending owings`);

            // Test 7: Service layer operations
            const memberStats = await CommunityService.getMemberStats(testCommunityId, userId1);
            this.logTest('Service Layer - Member Stats', !!memberStats, `Retrieved member stats`);

            const communityStats = await CommunityService.getCommunityStats(testCommunityId);
            this.logTest('Service Layer - Community Stats', !!communityStats, `Retrieved community stats`);

            // Cleanup
            await this.cleanupTestData(testCommunityId);

            return true;
        } catch (error) {
            this.logTest('Schema Operations', false, error.message);
            this.errors.push(error);
            return false;
        }
    }

    /**
     * Test backward compatibility
     */
    async testBackwardCompatibility() {
        try {
            // Set optimized schema mode
            process.env.USE_OPTIMIZED_SCHEMA = 'true';

            const testCommunityId = new mongoose.Types.ObjectId();
            
            // Create test data using optimized schemas
            await CommunityOptimizedCore.create({
                _id: testCommunityId,
                name: 'Compatibility Test Community',
                description: 'Testing backward compatibility',
                type: 'rotating_savings',
                status: 'active',
                createdBy: new mongoose.Types.ObjectId(),
                memberCount: 2,
                totalContributions: new Decimal(40000),
                totalPayouts: new Decimal(0),
                backupFund: new Decimal(2000)
            });

            await CommunitySettings.create({
                communityId: testCommunityId,
                minContribution: new Decimal(5000),
                maxMembers: 20,
                cycleDuration: 30
            });

            const userId1 = new mongoose.Types.ObjectId();
            const userId2 = new mongoose.Types.ObjectId();

            await CommunityMembership.create({
                communityId: testCommunityId,
                userId: userId1,
                status: 'active',
                role: 'admin'
            });

            await CommunityMembership.create({
                communityId: testCommunityId,
                userId: userId2,
                status: 'active',
                role: 'member'
            });

            // Test compatibility layer
            const compatibilityWrapper = new CommunityCompatibility();
            const communityProxy = await compatibilityWrapper.getCommunityProxy(testCommunityId);

            // Test array-like access to members
            const membersArray = await communityProxy.members;
            this.logTest('Compatibility - Members Array Access', 
                Array.isArray(membersArray) && membersArray.length === 2, 
                `Members array has ${membersArray.length} items`);

            // Test settings access
            const settings = await communityProxy.settings;
            this.logTest('Compatibility - Settings Access', 
                !!settings && settings.minContribution, 
                `Settings accessible with minContribution: ${settings.minContribution}`);

            // Cleanup
            await this.cleanupTestData(testCommunityId);

            return true;
        } catch (error) {
            this.logTest('Backward Compatibility', false, error.message);
            this.errors.push(error);
            return false;
        }
    }

    /**
     * Test performance improvements
     */
    async testPerformanceImprovements() {
        try {
            const testCommunityId = new mongoose.Types.ObjectId();
            
            // Create community with many members for performance testing
            await CommunityOptimizedCore.create({
                _id: testCommunityId,
                name: 'Performance Test Community',
                description: 'Testing performance improvements',
                type: 'rotating_savings',
                status: 'active',
                createdBy: new mongoose.Types.ObjectId(),
                memberCount: 100
            });

            // Create 100 test members
            const members = [];
            for (let i = 0; i < 100; i++) {
                members.push({
                    communityId: testCommunityId,
                    userId: new mongoose.Types.ObjectId(),
                    status: 'active',
                    role: 'member',
                    totalContributions: new Decimal(Math.random() * 50000),
                    joinedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
                });
            }

            await CommunityMembership.insertMany(members);

            // Test paginated member queries
            const startTime = Date.now();
            const paginatedMembers = await CommunityService.getMembers(testCommunityId, {
                page: 1,
                limit: 20,
                status: 'active'
            });
            const queryTime = Date.now() - startTime;

            this.logTest('Performance - Paginated Member Query', 
                paginatedMembers.members.length === 20 && queryTime < 1000, 
                `Retrieved 20 members in ${queryTime}ms`);

            // Test indexed queries
            const startTime2 = Date.now();
            const activeMembers = await CommunityMembership.find({ 
                communityId: testCommunityId, 
                status: 'active' 
            }).limit(10);
            const queryTime2 = Date.now() - startTime2;

            this.logTest('Performance - Indexed Query', 
                activeMembers.length === 10 && queryTime2 < 500, 
                `Indexed query completed in ${queryTime2}ms`);

            // Cleanup
            await this.cleanupTestData(testCommunityId);

            return true;
        } catch (error) {
            this.logTest('Performance Improvements', false, error.message);
            this.errors.push(error);
            return false;
        }
    }

    /**
     * Test data integrity
     */
    async testDataIntegrity() {
        try {
            const testCommunityId = new mongoose.Types.ObjectId();
            
            // Create community
            const community = await CommunityOptimizedCore.create({
                _id: testCommunityId,
                name: 'Integrity Test Community',
                description: 'Testing data integrity',
                type: 'rotating_savings',
                status: 'active',
                createdBy: new mongoose.Types.ObjectId(),
                totalContributions: new Decimal(50000),
                totalPayouts: new Decimal(25000),
                backupFund: new Decimal(2500)
            });

            // Test Decimal128 precision
            const preciseAmount = new Decimal('12345.67890123456789');
            community.totalContributions = preciseAmount;
            await community.save();

            const savedCommunity = await CommunityOptimizedCore.findById(testCommunityId);
            const retrievedAmount = savedCommunity.totalContributions;

            this.logTest('Data Integrity - Decimal Precision', 
                retrievedAmount.toString() === preciseAmount.toString(), 
                `Decimal precision maintained: ${retrievedAmount.toString()}`);

            // Test schema validation
            try {
                await CommunityMembership.create({
                    communityId: testCommunityId,
                    userId: 'invalid-user-id', // Should fail validation
                    status: 'active'
                });
                this.logTest('Data Integrity - Schema Validation', false, 'Invalid data was accepted');
            } catch (validationError) {
                this.logTest('Data Integrity - Schema Validation', true, 'Schema validation working correctly');
            }

            // Cleanup
            await this.cleanupTestData(testCommunityId);

            return true;
        } catch (error) {
            this.logTest('Data Integrity', false, error.message);
            this.errors.push(error);
            return false;
        }
    }

    /**
     * Clean up test data
     */
    async cleanupTestData(communityId) {
        try {
            await Promise.all([
                CommunityOptimizedCore.findByIdAndDelete(communityId),
                CommunitySettings.deleteOne({ communityId }),
                CommunityMembership.deleteMany({ communityId }),
                CommunityOwing.deleteMany({ communityId }),
                CommunityActivity.deleteMany({ communityId })
            ]);
        } catch (error) {
            console.log(`Cleanup warning: ${error.message}`);
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Phase 5 Integration Tests\n');

        const tests = [
            'testSchemaOperations',
            'testBackwardCompatibility',
            'testPerformanceImprovements',
            'testDataIntegrity'
        ];

        let passedTests = 0;
        const totalTests = tests.length;

        for (const testName of tests) {
            console.log(`\n📋 Running ${testName}...`);
            try {
                const success = await this[testName]();
                if (success) passedTests++;
            } catch (error) {
                this.logTest(testName, false, `Test execution error: ${error.message}`);
                this.errors.push(error);
            }
        }

        // Generate test report
        console.log('\n📊 Test Results Summary:');
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`Passed: ${this.testResults.filter(t => t.success).length}`);
        console.log(`Failed: ${this.testResults.filter(t => !t.success).length}`);
        console.log(`Test Suites Passed: ${passedTests}/${totalTests}`);

        if (this.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            this.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.message}`);
            });
        }

        return {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(t => t.success).length,
            failed: this.testResults.filter(t => !t.success).length,
            suitesPassedAll: passedTests === totalTests,
            results: this.testResults,
            errors: this.errors
        };
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const mongoose = require('mongoose');
    
    const runTests = async () => {
        try {
            // Connect to database
            await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kolocollect-test', {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('Connected to test database');

            const tester = new Phase5IntegrationTest();
            const results = await tester.runAllTests();

            console.log('\n✅ Tests completed!');
            
            // Disconnect
            await mongoose.disconnect();
            
            // Exit with appropriate code
            process.exit(results.suitesPassedAll ? 0 : 1);
        } catch (error) {
            console.error('Test execution failed:', error);
            process.exit(1);
        }
    };

    runTests();
}

module.exports = Phase5IntegrationTest;
