/**
 * Debug script for testing the compensateDefaulters utility
 * This script creates mock data and runs tests on compensateDefaulters function
 */

const compensateDefaulters = require('./utils/compensateDefaulters');
const mongoose = require('mongoose');

// Mock data for testing
const createMockCommunity = (backupFund, minContribution, backupFundPercentage, memberCount) => {
  const members = Array.from({ length: memberCount }, (_, i) => ({
    userId: `user_${i}`,
    role: 'member',
    joinedAt: new Date()
  }));

  return {
    _id: `mockCommunity_${Date.now()}`,
    name: 'Test Community',
    members,
    backupFund,
    settings: {
      minContribution,
      backupFundPercentage
    },
    save: async function() {
      console.log('[MOCK] Community saved');
      return this;
    }
  };
};

const createMockMidCycle = (payoutAmount) => {
  return {
    _id: `mockMidCycle_${Date.now()}`,
    payoutAmount,
    compensations: [],
    defaulters: [],
    constructor: {
      updateOne: async function(filter, update) {
        console.log('[MOCK] MidCycle updateOne called with:');
        console.log('Filter:', JSON.stringify(filter));
        console.log('Update:', JSON.stringify(update));
        return { nModified: 1 };
      }
    }
  };
};

// Test cases
const runTests = async () => {
  console.log('='.repeat(50));
  console.log('STARTING COMPENSATION DEFAULTERS DEBUG TESTS');
  console.log('='.repeat(50));

  // Test Case 1: Normal case with sufficient backup fund
  await runTest(
    'Test Case 1: Sufficient backup fund',
    1000, // backupFund
    100,  // minContribution
    0.1,  // backupFundPercentage (10%)
    10,   // memberCount
    [1, 2, 3], // defaulters (3 members)
    7     // contributionsCount (7 members paid)
  );

  // Test Case 2: Insufficient backup fund
  await runTest(
    'Test Case 2: Insufficient backup fund',
    150, // backupFund (only enough for 1.5 members)
    100, // minContribution
    0.1, // backupFundPercentage (10%)
    10,  // memberCount
    [1, 2, 3, 4], // defaulters (4 members)
    6    // contributionsCount (6 members paid)
  );

  // Test Case 3: No backup fund
  await runTest(
    'Test Case 3: No backup fund',
    0,   // backupFund
    100, // minContribution
    0.1, // backupFundPercentage (10%)
    10,  // memberCount
    [1, 2], // defaulters (2 members)
    8    // contributionsCount (8 members paid)
  );

  // Test Case 4: Mismatch between defaulters array and actual defaulters
  await runTest(
    'Test Case 4: Defaulter count mismatch',
    500, // backupFund
    100, // minContribution
    0.1, // backupFundPercentage (10%)
    10,  // memberCount
    [1],  // defaulters (only 1 listed, but actually 3)
    7    // contributionsCount (7 members paid, so 3 defaulted)
  );

  // Test Case 5: High backup fund percentage
  await runTest(
    'Test Case 5: High backup fund percentage (30%)',
    1000, // backupFund
    100,  // minContribution
    0.3,  // backupFundPercentage (30%)
    10,   // memberCount
    [1, 2, 3], // defaulters (3 members)
    7     // contributionsCount (7 members paid)
  );
};

// Helper function to run each test
async function runTest(
  testName,
  backupFund,
  minContribution,
  backupFundPercentage,
  memberCount,
  defaulterIndices,
  contributionsCount
) {
  console.log('\n' + '-'.repeat(50));
  console.log(testName);
  console.log('-'.repeat(50));

  // Create mock data
  const community = createMockCommunity(
    backupFund, 
    minContribution, 
    backupFundPercentage,
    memberCount
  );

  // Create defaulters array
  const defaulters = defaulterIndices.map(i => `user_${i}`);

  // Create contributions array (these would typically be objects, but for testing we just need the count)
  const contributionsToNextInLine = Array(contributionsCount).fill({});

  // Create mock midCycle
  const midCycle = createMockMidCycle(contributionsCount * minContribution);

  console.log('\nINPUT DATA:');
  console.log(`- Backup Fund: ${backupFund}`);
  console.log(`- Minimum Contribution: ${minContribution}`);
  console.log(`- Backup Fund Percentage: ${backupFundPercentage * 100}%`);
  console.log(`- Total Members: ${memberCount}`);
  console.log(`- Defaulters (${defaulters.length}): ${defaulters.join(', ')}`);
  console.log(`- Contributions Count: ${contributionsCount}`);
  console.log(`- Initial Payout Amount: ${midCycle.payoutAmount}`);

  // Expected calculations
  const expectedNonContributedMembers = memberCount - contributionsCount;
  const expectedDeficitAmount = minContribution * expectedNonContributedMembers;
  const expectedWithdrawal = Math.min(backupFund, expectedDeficitAmount);
  const expectedBackupAmount = expectedWithdrawal * backupFundPercentage;
  const expectedFinalWithdrawal = expectedWithdrawal - expectedBackupAmount;
  const expectedUpdatedBackupFund = backupFund - expectedFinalWithdrawal;
  const expectedUpdatedPayoutAmount = midCycle.payoutAmount + expectedFinalWithdrawal;

  console.log('\nEXPECTED RESULTS:');
  console.log(`- Non-contributed Members: ${expectedNonContributedMembers}`);
  console.log(`- Deficit Amount: ${expectedDeficitAmount}`);
  console.log(`- Initial Withdrawal: ${expectedWithdrawal}`);
  console.log(`- Backup Amount (${backupFundPercentage * 100}%): ${expectedBackupAmount}`);
  console.log(`- Final Withdrawal: ${expectedFinalWithdrawal}`);
  console.log(`- Updated Backup Fund: ${expectedUpdatedBackupFund}`);
  console.log(`- Updated Payout Amount: ${expectedUpdatedPayoutAmount}`);

  console.log('\nRUNNING COMPENSATION:');
  // Run the compensation function
  try {
    const result = await compensateDefaulters(community, defaulters, contributionsToNextInLine, midCycle);
    
    console.log('\nACTUAL RESULTS:');
    console.log(`- Updated Backup Fund: ${result.community.backupFund}`);
    console.log(`- Updated Payout Amount: ${result.midCycle.payoutAmount}`);
    
    // Perform validation    console.log('\nVALIDATION:');
    validateResult('Backup Fund', result.community.backupFund, expectedUpdatedBackupFund);
    validateResult('Payout Amount', result.midCycle.payoutAmount, expectedUpdatedPayoutAmount);
    
    // Validate defaulters array
    if (result.midCycle.defaulters) {
      console.log(`- Defaulters in midCycle: [${result.midCycle.defaulters.join(', ')}]`);
      const expectedDefaultersLength = Math.max(defaulterIndices.length, expectedNonContributedMembers);
      validateResult('Defaulters Count', result.midCycle.defaulters.length, expectedDefaultersLength);
    }
    
    if (result.midCycle.compensations && result.midCycle.compensations.length > 0) {
      const compensation = result.midCycle.compensations[result.midCycle.compensations.length - 1];
      console.log('\nCOMPENSATION RECORD:');
      console.log(JSON.stringify(compensation, null, 2));
      validateResult('Compensation Amount', compensation.amount, expectedFinalWithdrawal);
    }
    
  } catch (error) {
    console.error('\nERROR DURING TEST:');
    console.error(error);
  }
}

// Helper function to validate results
function validateResult(field, actual, expected) {
  const isMatch = Math.abs(actual - expected) < 0.001; // For floating point comparison
  console.log(`- ${field}: ${isMatch ? '✓' : '✗'} (Expected: ${expected}, Actual: ${actual})`);
  if (!isMatch) {
    console.log(`  DISCREPANCY: ${actual - expected}`);
  }
}

// Run all the tests
runTests()
  .then(() => {
    console.log('\nAll tests completed.');
    // If connected to a real database, disconnect
    if (mongoose.connection.readyState) {
      return mongoose.disconnect();
    }
  })
  .catch(err => {
    console.error('Error running tests:', err);
    // If connected to a real database, disconnect
    if (mongoose.connection.readyState) {
      return mongoose.disconnect();
    }
  });
