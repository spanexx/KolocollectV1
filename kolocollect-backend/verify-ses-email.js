const { SESClient, VerifyEmailIdentityCommand, ListVerifiedEmailAddressesCommand } = require('@aws-sdk/client-ses');
require('dotenv').config();

async function verifySESEmail() {
  console.log('🔍 AWS SES Email Verification Tool\n');

  // Check if AWS credentials are set
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS credentials not found in environment variables');
    console.log('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    return;
  }

  const emailToVerify = process.env.SES_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  
  if (!emailToVerify) {
    console.error('❌ No email address found to verify');
    console.log('Please set SES_FROM_EMAIL, SMTP_FROM, or SMTP_USER in your environment');
    return;
  }

  console.log(`📧 Target email: ${emailToVerify}`);
  console.log(`🌎 AWS Region: ${process.env.AWS_REGION || 'us-east-1'}\n`);

  const sesClient = new SESClient({
    region: process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    // First, list already verified email addresses
    console.log('📋 Checking currently verified email addresses...');
    const listCommand = new ListVerifiedEmailAddressesCommand({});
    const listResult = await sesClient.send(listCommand);
    
    console.log('✅ Verified email addresses:');
    if (listResult.VerifiedEmailAddresses.length === 0) {
      console.log('   (none)');
    } else {
      listResult.VerifiedEmailAddresses.forEach(email => {
        console.log(`   - ${email}`);
      });
    }

    // Check if our email is already verified
    if (listResult.VerifiedEmailAddresses.includes(emailToVerify)) {
      console.log(`\n✅ Email ${emailToVerify} is already verified!`);
      console.log('🎉 You can use AWS SES to send emails from this address.');
      return;
    }

    console.log(`\n📨 Email ${emailToVerify} is NOT verified. Sending verification request...`);

    // Send verification request
    const verifyCommand = new VerifyEmailIdentityCommand({
      EmailAddress: emailToVerify
    });

    await sesClient.send(verifyCommand);
    
    console.log('✅ Verification email sent!');
    console.log(`📬 Check your inbox at ${emailToVerify} for a verification email from AWS.`);
    console.log('🔗 Click the verification link in the email to complete the process.');
    console.log('\n⏳ After verification, you can use AWS SES to send emails.');
    console.log('💡 Run this script again to check if verification is complete.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.name === 'InvalidParameterValue') {
      console.log('💡 Make sure the email address is valid and formatted correctly.');
    } else if (error.name === 'InvalidCredentials') {
      console.log('💡 Check your AWS credentials and permissions.');
    } else if (error.name === 'AccessDenied') {
      console.log('💡 Your AWS credentials may not have permission to use SES.');
      console.log('   Required permissions: ses:VerifyEmailIdentity, ses:ListVerifiedEmailAddresses');
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your AWS credentials are correct');
    console.log('2. Check if SES is available in your region');
    console.log('3. Ensure your AWS account has SES permissions');
    console.log('4. If you\'re in the SES sandbox, you can only send to verified addresses');
  }
}

if (require.main === module) {
  verifySESEmail();
}

module.exports = { verifySESEmail };
