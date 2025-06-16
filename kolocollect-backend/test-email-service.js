const emailService = require('./services/emailService');
require('dotenv').config();

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');
  
  try {
    // Test 1: Get provider info
    console.log('1. Provider Information:');
    const info = emailService.getProviderInfo();
    console.log(`   Current Provider: ${info.provider}`);
    console.log(`   Initialized: ${info.isInitialized}`);
    console.log(`   Supported: ${info.supportedProviders.join(', ')}\n`);
    
    // Test 2: Test configuration
    console.log('2. Testing Configuration...');
    const isConfigured = await emailService.testEmailConfiguration();
    console.log(`   Configuration Valid: ${isConfigured ? '✅' : '❌'}\n`);
    
    if (!isConfigured) {
      console.log('❌ Email configuration failed. Please check your environment variables.');
      return;
    }
    
    // Test 3: Test generic email sending (optional - commented out to avoid spam)
    /*
    console.log('3. Testing Generic Email...');
    const testEmailResult = await emailService.sendEmail({
      to: process.env.TEST_EMAIL || 'test@example.com',
      subject: 'Kolocollect Email Service Test',
      text: 'This is a test email from Kolocollect email service.',
      html: '<h2>✅ Email Service Test</h2><p>This is a test email from Kolocollect email service.</p>'
    });
    console.log(`   Test Email Result: ${testEmailResult.success ? '✅' : '❌'}`);
    console.log(`   Message ID: ${testEmailResult.messageId}\n`);
    */
    
    // Test 4: Test invitation email structure (without sending)
    console.log('3. Testing Invitation Email Structure...');
    const invitationHTML = emailService.generateInvitationEmailHTML({
      communityName: 'Test Community',
      inviterName: 'Test Inviter',
      inviteLink: 'https://example.com/invite/test123',
      customMessage: 'This is a test invitation',
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    console.log(`   HTML Template Length: ${invitationHTML.length} characters ✅\n`);
    
    console.log('✅ All tests completed successfully!');
    console.log('\n📧 Email Service Status: READY');
    console.log(`🔧 Current Provider: ${info.provider.toUpperCase()}`);
    console.log('📝 To switch providers, update EMAIL_PROVIDER in your .env file');
    
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your .env file has correct email configuration');
    console.log('2. For Gmail, ensure you\'re using an app password, not your regular password');
    console.log('3. Verify 2FA is enabled on your Gmail account');
    console.log('4. Check firewall/network restrictions');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEmailService();
}

module.exports = testEmailService;
