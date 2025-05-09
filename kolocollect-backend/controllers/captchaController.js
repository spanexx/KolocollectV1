const axios = require('axios');

// Function to verify hCaptcha
const verifyCaptcha = async (captchaResponse) => {
  const secret = process.env.Captcha_secret; // Use environment variable for security

  try {
    const response = await axios.post('https://hcaptcha.com/siteverify', null, {
      params: {
        secret: secret,
        response: captchaResponse,
      },
    });

    if (response.data.success) {
      console.log('hCaptcha verification successful');
      return true;
    } else {
      console.error('hCaptcha verification failed');
      return false;
    }
  } catch (error) {
    console.error('Error verifying hCaptcha:', error);
    return false;
  }
};

module.exports = { verifyCaptcha };
