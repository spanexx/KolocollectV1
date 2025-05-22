/**
 * Debug script for recreating the specific Hellenic community compensation issue
 * This script recreates the exact scenario that happened with Hellenic community
 */

const compensateDefaulters = require('./utils/compensateDefaulters');

// Set up the test case based on the log output
async function runTest() {
  console.log('='.repeat(50));
  console.log('DEBUG: HELLENIC COMMUNITY COMPENSATION ISSUE');
  console.log('='.repeat(50));
    // Create mock objects based on the actual Hellenic community data
  const mockCommunity = {
    _id: '682e22b613cf8d7b501c5eae',
    name: 'Hellenic',
    members: Array(10).fill({}).map((_, i) => ({ id: `member_${i}` })), // 10 members
    backupFund: 380,  // Actual backup fund from community data
    settings: {
      minContribution: 50,  // Actual min contribution from community settings
      backupFundPercentage: 3,  // Actual backup fund percentage (3%)
      contributionFrequency: 'Hourly',
      maxMembers: 10,
      isPrivate: true,
      penalty: 10,
      numMissContribution: 3,
      firstCycleMin: 5,
      positioningMode: 'Random',
      cycleLockEnabled: false,
      cycleState: 'Active'
    },
    save: async function() {
      console.log('[MOCK] Community saved');
      return this;
    }
  };
  
  const defaulters = ['682e22b113cf8d7b501c5e54', '682e22b113cf8d7b501c5e59'];  // Charlie Black and Diana Blue from logs
  const contributionsToNextInLine = Array(8).fill({});  // 8 contributed as per log: "Contributions: 8"
  
  const mockMidCycle = {
    _id: '682e262dffde00539f197920',
    payoutAmount: 236.5,  // Initial payout amount from logs
    defaulters: [],
    compensations: [],
    constructor: {
      updateOne: async function(filter, update) {
        console.log('[MOCK] MidCycle updateOne called with:');
        console.log('Filter:', JSON.stringify(filter));
        console.log('Update:', JSON.stringify(update));
        return { nModified: 1 };
      }
    }
  };
  
  console.log('\nINPUT DATA:');
  console.log(`- Community: ${mockCommunity.name} (${mockCommunity._id})`);
  console.log(`- Backup Fund: ${mockCommunity.backupFund}`);
  console.log(`- Minimum Contribution: ${mockCommunity.settings.minContribution}`);
  console.log(`- Backup Fund Percentage: ${mockCommunity.settings.backupFundPercentage * 100}%`);
  console.log(`- Total Members: ${mockCommunity.members.length}`);
  console.log(`- Defaulters (${defaulters.length}):`, defaulters);
  console.log(`- Contributions Count: ${contributionsToNextInLine.length}`);
  console.log(`- Initial Payout Amount: ${mockMidCycle.payoutAmount}`);
    // Expected results based on correct calculation (3% backup)
  const expectedNonContributedMembers = mockCommunity.members.length - contributionsToNextInLine.length; // 2
  const expectedDeficitAmount = mockCommunity.settings.minContribution * expectedNonContributedMembers; // 100
  const expectedWithdrawal = Math.min(mockCommunity.backupFund, expectedDeficitAmount); // 100
  const expectedBackupAmount = expectedWithdrawal * 0.03; // 3% of 100 = 3
  const expectedFinalWithdrawal = expectedWithdrawal - expectedBackupAmount; // 97
  const expectedUpdatedBackupFund = mockCommunity.backupFund - expectedFinalWithdrawal; // 283
  const expectedUpdatedPayoutAmount = mockMidCycle.payoutAmount + expectedFinalWithdrawal; // 236.5 + 97 = 333.5
    console.log('\nEXPECTED RESULTS (with 3% backup fund percentage):');
  console.log(`- Non-contributed Members: ${expectedNonContributedMembers}`);
  console.log(`- Deficit Amount: ${expectedDeficitAmount}`);
  console.log(`- Initial Withdrawal: ${expectedWithdrawal}`);
  console.log(`- Backup Amount (${mockCommunity.settings.backupFundPercentage}%): ${expectedBackupAmount}`);
  console.log(`- Final Withdrawal: ${expectedFinalWithdrawal}`);
  console.log(`- Updated Backup Fund: ${expectedUpdatedBackupFund}`);
  console.log(`- Updated Payout Amount: ${expectedUpdatedPayoutAmount}`);
  
  // What if the backup percentage is 3.0 (300%) instead of 0.1 (10%)?
  const backupPct300 = 3.0;
  const badBackupAmt = expectedWithdrawal * backupPct300; // 300
  const badFinalWithdrawal = expectedWithdrawal - badBackupAmt; // -200
  const badUpdatedBackupFund = mockCommunity.backupFund - badFinalWithdrawal; // 380
  const badUpdatedPayoutAmount = mockMidCycle.payoutAmount + badFinalWithdrawal; // 36.5
  
  console.log('\nRESULTS WITH INCORRECT 300% BACKUP PERCENTAGE:');
  console.log(`- Backup Amount (${backupPct300 * 100}%): ${badBackupAmt}`);
  console.log(`- Final Withdrawal: ${badFinalWithdrawal}`);
  console.log(`- Updated Backup Fund: ${badUpdatedBackupFund}`);
  console.log(`- Updated Payout Amount: ${badUpdatedPayoutAmount}`);
  
  console.log('\nRUNNING ACTUAL COMPENSATION:');
  try {
    // Run the compensation function
    const result = await compensateDefaulters(mockCommunity, defaulters, contributionsToNextInLine, mockMidCycle);
    
    console.log('\nACTUAL RESULTS:');
    console.log(`- Updated Backup Fund: ${result.community.backupFund}`);
    console.log(`- Updated Payout Amount: ${result.midCycle.payoutAmount}`);
    console.log(`- Defaulters: [${result.midCycle.defaulters.join(', ')}]`);
    
    if (result.midCycle.compensations && result.midCycle.compensations.length > 0) {
      const compensation = result.midCycle.compensations[result.midCycle.compensations.length - 1];
      console.log('\nCOMPENSATION RECORD:');
      console.log(JSON.stringify(compensation, null, 2));
    }
    
    console.log('\nANALYSIS:');
      // Compare with expected values (3% backup)
    const isBackupFundExpected = Math.abs(result.community.backupFund - expectedUpdatedBackupFund) < 0.001;
    const isPayoutAmountExpected = Math.abs(result.midCycle.payoutAmount - expectedUpdatedPayoutAmount) < 0.001;
    
    console.log(`- Matches expected 3% calculation: ${isBackupFundExpected && isPayoutAmountExpected ? 'Yes ✓' : 'No ✗'}`);
    
    // Compare with incorrect values (300% backup)
    const isBackupFundBad = Math.abs(result.community.backupFund - badUpdatedBackupFund) < 0.001;
    const isPayoutAmountBad = Math.abs(result.midCycle.payoutAmount - badUpdatedPayoutAmount) < 0.001;
    
    console.log(`- Matches incorrect 300% calculation: ${isBackupFundBad && isPayoutAmountBad ? 'Yes ✓' : 'No ✗'}`);
    
    // Check the actual backup percentage used
    if (!isBackupFundExpected) {
      // Try to reverse-calculate the backup percentage that was actually used
      const actualWithdrawal = expectedWithdrawal; // This is likely still 100
      const actualBackupAmt = actualWithdrawal - (result.midCycle.payoutAmount - mockMidCycle.payoutAmount);
      const actualBackupPct = actualBackupAmt / actualWithdrawal;
      
      console.log(`- Actual backup percentage appears to be: ${(actualBackupPct * 100).toFixed(1)}%`);
    }
    
  } catch (error) {
    console.error('\nERROR DURING TEST:', error);
  }
}

// Run the test
runTest()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
  });
