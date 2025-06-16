const axios = require('axios');

const testInvitationAPI = async () => {
  try {
    console.log('Testing invitation API...');
    
    // Use the actual community ID from the database
    const communityId = '684c56a4a7a4dd05d1cc4648';
    const email = 'test.user@example.com';
      const response = await axios.post(`http://localhost:9000/api/communities/${communityId}/invitations`, {
      inviteType: 'email',
      inviteeEmail: email,
      customMessage: 'Welcome to our Tech Savers Group community!'
    }, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NGM1NmEzYTdhNGRkMDVkMWNjNDYwMyIsImlhdCI6MTc0OTk2Nzc5NiwiZXhwIjoxNzQ5OTY4Njk2fQ.zqPM4KvblIFxzU9oIAZaLj7kkdX-mfKgkoXwBmpdaBw',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✓ Invitation created successfully:');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.error('✗ Error creating invitation:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
};

testInvitationAPI();
