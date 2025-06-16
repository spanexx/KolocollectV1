const { SESClient, VerifyEmailIdentityCommand, GetSendQuotaCommand, ListVerifiedEmailAddressesCommand } = require('@aws-sdk/client-ses');
require('dotenv').config();

async function setupAWSSES() {
  console.log('🔧 AWS SES Setup Helper\n');
  
  // Initialize SES client
  const sesClient = new SESClient({
    region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    // Check current quota and sending limits
    console.log('1. Checking AWS SES quota...');
    const quotaCommand = new GetSendQuotaCommand({});
    const quotaResult = await sesClient.send(quotaCommand);
    console.log(`   Max 24-hour send: ${quotaResult.Max24HourSend}`);
    console.log(`   Sent last 24 hours: ${quotaResult.SentLast24Hours}`);
    console.log(`   Max send rate: ${quotaResult.MaxSendRate} emails/second\n`);

    // List verified email addresses
    console.log('2. Checking verified email addresses...');
    const listCommand = new ListVerifiedEmailAddressesCommand({});
    const listResult = await sesClient.send(listCommand);
    
    if (listResult.VerifiedEmailAddresses && listResult.VerifiedEmailAddresses.length > 0) {
      console.log('   ✅ Verified email addresses:');
      listResult.VerifiedEmailAddresses.forEach(email => {
        console.log(`      - ${email}`);
      });
    } else {
      console.log('   ❌ No verified email addresses found');
    }

    // Check if our FROM email is verified
    const fromEmail = process.env.SES_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
    const isVerified = listResult.VerifiedEmailAddresses && 
                      listResult.VerifiedEmailAddresses.includes(fromEmail);
    
    console.log(`\n3. Your FROM email (${fromEmail}): ${isVerified ? '✅ Verified' : '❌ Not Verified'}`);
    
    if (!isVerified) {
      console.log('\n🚨 ACTION REQUIRED: Your FROM email needs to be verified');
      console.log('   Options:');
      console.log('   A) Verify your email address:');
      console.log(`      aws ses verify-email-identity --email-address ${fromEmail} --region ${process.env.SES_REGION || 'us-east-1'}`);
      console.log('   B) Or run this verification command:');
      
      try {
        const verifyCommand = new VerifyEmailIdentityCommand({
          EmailAddress: fromEmail
        });
        await sesClient.send(verifyCommand);
        console.log(`   ✅ Verification email sent to ${fromEmail}`);
        console.log('   📧 Check your email and click the verification link');
      } catch (verifyError) {
        console.log(`   ❌ Failed to send verification email: ${verifyError.message}`);
      }
    }

    // Check if we're in sandbox mode
    if (quotaResult.Max24HourSend <= 200) {
      console.log('\n⚠️  AWS SES appears to be in SANDBOX MODE');
      console.log('   - You can only send emails to verified addresses');
      console.log('   - To send to any email, request production access:');
      console.log('   - https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html');
    }

  } catch (error) {
    console.error('❌ AWS SES setup failed:', error.message);
    
    if (error.name === 'AccessDenied') {
      console.log('\n🔧 Access Denied - Possible solutions:');
      console.log('1. Check your AWS credentials are correct');
      console.log('2. Ensure your IAM user/role has SES permissions:');
      console.log('   - ses:SendEmail');
      console.log('   - ses:SendRawEmail');
      console.log('   - ses:GetSendQuota');
      console.log('   - ses:ListVerifiedEmailAddresses');
      console.log('   - ses:VerifyEmailIdentity');
    }
  }
}

// Run setup if this file is executed directly  
if (require.main === module) {
  setupAWSSES();
}

module.exports = setupAWSSES;
