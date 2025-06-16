const emailService = require('./services/emailService');
require('dotenv').config();

async function testSmartFallback() {
  console.log('🧠 Testing Smart Email Fallback System...\n');
  
  try {
    // Test 1: Show provider information
    console.log('1. Smart Fallback Configuration:');
    const info = emailService.getProviderInfo();
    console.log(`   Primary Provider: ${info.provider}`);
    console.log(`   Smart Fallback: ${info.isSmartFallback ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   Fallback Order: ${info.fallbackOrder.join(' → ')}`);
    console.log(`   Available Providers: ${info.availableProviders.join(', ')}`);
    console.log(`   Retry Attempts: ${info.retryAttempts}`);
    console.log(`   Retry Delay: ${info.retryDelay}ms\n`);
    
    // Test 2: Test email configuration for all providers
    console.log('2. Testing Provider Availability:');
    const isConfigured = await emailService.testEmailConfiguration();
    console.log(`   Overall Configuration: ${isConfigured ? '✅' : '❌'}\n`);
    
    // Test 3: Send test email with fallback
    console.log('3. Testing Smart Fallback Email Sending...');
    console.log('   📧 Attempting to send test email...');
    
    const result = await emailService.sendEmail({
      to: 'victorchideraani@gmail.com', // Your verified email
      subject: '🧠 Smart Fallback Test - Kolocollect',
      text: 'This email was sent using the smart fallback system!',
      html: `
        <h2>🧠 Smart Fallback System Test</h2>
        <p>This email was successfully sent using Kolocollect's smart email fallback system!</p>
        <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <h3>📊 Sending Details:</h3>
          <ul>
            <li><strong>Provider Used:</strong> ${result.provider || 'Unknown'}</li>
            <li><strong>Fallback Used:</strong> ${result.fallbackUsed ? 'Yes' : 'No'}</li>
            <li><strong>Attempted Providers:</strong> ${result.attemptedProviders ? result.attemptedProviders.join(', ') : 'N/A'}</li>
            <li><strong>Message ID:</strong> ${result.messageId}</li>
          </ul>
        </div>
        <p>✅ Your email system is working perfectly with intelligent fallback!</p>
        <hr>
        <p><em>Sent from Kolocollect Smart Email Service</em></p>
      `
    });
    
    console.log('   ✅ Email sent successfully!');
    console.log(`   📨 Provider Used: ${result.provider}`);
    console.log(`   🔄 Fallback Used: ${result.fallbackUsed ? 'Yes' : 'No'}`);
    console.log(`   📋 Attempted Providers: ${result.attemptedProviders ? result.attemptedProviders.join(', ') : 'N/A'}`);
    console.log(`   🆔 Message ID: ${result.messageId}`);
    console.log('\n📬 Check your email inbox for the test message!');
    
  } catch (error) {
    console.error('❌ Smart fallback test failed:', error.message);
    
    // Try to parse the error to show which providers failed
    if (error.message.includes('All email providers failed')) {
      console.log('\n🔍 Provider Failure Details:');
      try {
        const errorMatch = error.message.match(/Errors: (\[.*\])/);
        if (errorMatch) {
          const errors = JSON.parse(errorMatch[1]);
          errors.forEach(err => {
            console.log(`   ❌ ${err.provider}: ${err.error}`);
          });
        }
      } catch (parseError) {
        console.log('   Could not parse error details');
      }
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check that at least one email provider is properly configured');
    console.log('2. Verify your email addresses are verified (for AWS SES sandbox mode)');
    console.log('3. Check network connectivity');
    console.log('4. Review the provider-specific configuration in your .env file');
  }
}

// Simulate provider failure for testing
async function testProviderFailure() {
  console.log('\n🧪 Testing Provider Failure Scenarios...');
  
  // Temporarily break SMTP to test fallback
  const originalSMTPUser = process.env.SMTP_USER;
  process.env.SMTP_USER = 'invalid-email@example.com';
  
  try {
    const result = await emailService.sendEmail({
      to: 'victorchideraani@gmail.com',
      subject: '🔄 Fallback Test - Provider Failure',
      text: 'This should use AWS SES as fallback when SMTP fails',
      html: '<h2>🔄 Fallback Success!</h2><p>SMTP failed, but AWS SES worked as backup!</p>'
    });
    
    console.log('✅ Fallback worked successfully!');
    console.log(`   📨 Used Provider: ${result.provider}`);
    console.log(`   🔄 Fallback Used: ${result.fallbackUsed}`);
    
  } catch (error) {
    console.log('❌ Fallback test failed:', error.message);
  } finally {
    // Restore original SMTP config
    process.env.SMTP_USER = originalSMTPUser;
  }
}

if (require.main === module) {
  testSmartFallback().then(() => {
    // Uncomment to test provider failure scenarios
    // return testProviderFailure();
  });
}

module.exports = { testSmartFallback, testProviderFailure };
