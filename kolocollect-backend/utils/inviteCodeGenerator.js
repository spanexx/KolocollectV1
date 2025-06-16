const crypto = require('crypto');

/**
 * Generate a cryptographically secure invite code
 * @param {number} length - Length of the invite code (default: 32)
 * @returns {string} - Generated invite code
 */
function generateInviteCode(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a shorter, user-friendly invite code
 * @param {number} length - Length of the invite code (default: 8)
 * @returns {string} - Generated short invite code
 */
function generateShortInviteCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  
  return result;
}

/**
 * Validate invite code format
 * @param {string} code - Invite code to validate
 * @returns {boolean} - Whether the code is valid
 */
function validateInviteCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Check if it's a hex string (long format)
  if (/^[a-f0-9]{32,}$/i.test(code)) {
    return true;
  }
  
  // Check if it's a short format
  if (/^[A-Z0-9]{6,12}$/i.test(code)) {
    return true;
  }
  
  return false;
}

/**
 * Generate invite code with uniqueness check
 * @param {Function} checkUniqueness - Function to check if code exists
 * @param {number} maxRetries - Maximum retry attempts (default: 5)
 * @returns {Promise<string>} - Unique invite code
 */
async function generateUniqueInviteCode(checkUniqueness, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateInviteCode();
    const isUnique = await checkUniqueness(code);
    
    if (isUnique) {
      return code;
    }
  }
  
  throw new Error('Failed to generate unique invite code after maximum retries');
}

module.exports = {
  generateInviteCode,
  generateShortInviteCode,
  validateInviteCode,
  generateUniqueInviteCode
};
