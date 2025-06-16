const EmailService = require('./services/emailService');

async function testCommunityEmails() {
  console.log('🧪 Testing Community Email Functionality...\n');

  // Test data
  const testCommunityData = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Savings Community',
    description: 'A test community for savings',
    settings: {
      maxMembers: 10,
      contributionFrequency: 'weekly'
    },
    createdAt: new Date()
  };

  const testAdminData = {
    name: 'John Doe',
    email: process.env.TEST_EMAIL || 'test@example.com'
  };

  const testMemberData = {
    name: 'Jane Smith',
    email: process.env.TEST_EMAIL || 'test@example.com',
    position: 2
  };

  const testJoinContext = {
    isMidCycle: false,
    adminName: 'John Doe'
  };

  try {
    // Test community created email
    console.log('1. Testing Community Created Email...');
    const createdEmailResult = await EmailService.sendCommunityCreatedEmail(testCommunityData, testAdminData);
    console.log('✅ Community created email sent successfully!');
    console.log('   Message ID:', createdEmailResult.messageId || createdEmailResult.success);
    
    // Test community joined email
    console.log('\n2. Testing Community Joined Email...');
    const joinedEmailResult = await EmailService.sendCommunityJoinedEmail(testCommunityData, testMemberData, testJoinContext);
    console.log('✅ Community joined email sent successfully!');
    console.log('   Message ID:', joinedEmailResult.messageId || joinedEmailResult.success);

    console.log('\n🎉 All community email tests passed!');
    
  } catch (error) {
    console.error('❌ Error testing community emails:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  require('dotenv').config();
  testCommunityEmails()
    .then(() => {
      console.log('\nTest completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testCommunityEmails };
