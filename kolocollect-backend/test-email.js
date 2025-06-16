const emailService = require('./services/emailService');

async function testEmail() {
  console.log('Testing email service...');
    try {
    const result = await emailService.sendInvitationEmail({
      to: 'spanexxvictor@gmail.com',
      communityName: 'Test Community',
      inviterName: 'Test Admin',
      inviteCode: 'test123',
      customMessage: 'This is a test invitation email!',
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });
    
    console.log('✓ Email sent successfully:', result);
  } catch (error) {
    console.log('✗ Email failed:', error.message);
    console.log('Error details:', error);
  }
}

testEmail();
