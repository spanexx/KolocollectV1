const emailService = require('./services/emailService');
require('dotenv').config();

async function demonstrateSmartFallback() {
  console.log('🧠 Smart Email Fallback System - Demonstration\n');
  
  // Show current configuration
  const info = emailService.getProviderInfo();
  console.log('📊 Current Configuration:');
  console.log('┌─────────────────────────────────────────────┐');
  console.log(`│ Smart Fallback: ${info.isSmartFallback ? '✅ ENABLED' : '❌ DISABLED'}                   │`);
  console.log(`│ Primary Provider: ${info.provider.padEnd(27)} │`);
  console.log(`│ Fallback Order: ${info.fallbackOrder.join(' → ').padEnd(29)} │`);
  console.log(`│ Available: ${info.availableProviders.join(', ').padEnd(34)} │`);
  console.log(`│ Retry Attempts: ${info.retryAttempts.toString().padEnd(29)} │`);
  console.log(`│ Retry Delay: ${info.retryDelay.toString().padEnd(32)}ms │`);
  console.log('└─────────────────────────────────────────────┘\n');
  
  // Test configuration
  console.log('🔧 Testing Configuration...');
  const isConfigured = await emailService.testEmailConfiguration();
  console.log(`   Configuration Status: ${isConfigured ? '✅ READY' : '❌ FAILED'}\n`);
  
  if (!isConfigured) {
    console.log('❌ Email configuration failed. Please check your settings.');
    return;
  }
  
  console.log('✅ Smart Email Fallback System is ready!');
  console.log('\n💡 How it works:');
  console.log('   1. Tries SMTP first (fastest for development)');
  console.log('   2. Falls back to AWS SES if SMTP fails');
  console.log('   3. Would try SendGrid if configured and needed');
  console.log('   4. Returns detailed information about which provider succeeded');
  console.log('\n🎯 Benefits:');
  console.log('   ✅ Automatic failover ensures emails always send');
  console.log('   ✅ No code changes needed to switch providers');
  console.log('   ✅ Detailed logging for troubleshooting');
  console.log('   ✅ Cost optimization (cheaper providers first)');
  console.log('   ✅ Reliability (multiple backup providers)');
  
  // Uncomment this section to send a test email
  /*
  console.log('\n📧 Sending test email...');
  try {
    const result = await emailService.sendEmail({
      to: 'victorchideraani@gmail.com',
      subject: '🧠 Smart Fallback Demo - Success!',
      html: `
        <h2>🎉 Smart Email Fallback Working!</h2>
        <p>This email demonstrates your intelligent email system.</p>
        <div style="background: #f0f8ff; padding: 15px; border-radius: 5px;">
          <h3>📊 Sending Details:</h3>
          <p><strong>Provider Used:</strong> ${result?.provider || 'Unknown'}</p>
          <p><strong>Fallback Used:</strong> ${result?.fallbackUsed ? 'Yes' : 'No'}</p>
          <p><strong>Message ID:</strong> ${result?.messageId}</p>
        </div>
      `
    });
    
    console.log(`   ✅ Success! Provider: ${result.provider}`);
    console.log(`   🔄 Fallback used: ${result.fallbackUsed ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  */
}

if (require.main === module) {
  demonstrateSmartFallback();
}

module.exports = demonstrateSmartFallback;
