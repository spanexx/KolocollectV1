const emailService = require('./services/emailService');
require('dotenv').config();

async function testAWSSESEmail() {
  console.log('📧 Testing AWS SES Email Sending...\n');
  
  try {
    // Test sending to your verified email address
    const result = await emailService.sendEmail({
      to: 'victorchideraani@gmail.com', // Your verified email
      subject: '🎉 AWS SES Test - Kolocollect Email Service',
      text: 'This is a test email from Kolocollect using AWS SES!',
      html: `
        <h2>🎉 Success! AWS SES is Working</h2>
        <p>This test email confirms that your Kolocollect application can successfully send emails using AWS SES.</p>
        <ul>
          <li>✅ Provider: AWS SES</li>
          <li>✅ Region: ${process.env.AWS_REGION}</li>
          <li>✅ From: ${process.env.SES_FROM_EMAIL}</li>
          <li>✅ Status: Production Ready (Sandbox Mode)</li>
        </ul>
        <p><strong>Next Step:</strong> Request production access to send emails to any address.</p>
        <hr>
        <p><em>Sent from Kolocollect Email Service</em></p>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📨 Message ID:', result.messageId);
    console.log('📧 Sent to:', result.to);
    console.log('🏷️  Provider:', result.provider);
    console.log('\n📬 Check your email inbox for the test message!');
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
  }
}

if (require.main === module) {
  testAWSSESEmail();
}

module.exports = testAWSSESEmail;
