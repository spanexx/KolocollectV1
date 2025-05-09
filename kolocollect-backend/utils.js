const Wallet = require('../models/Wallet');
const Community = require('../models/Community');

/**
 * Validate required fields in a request body.
 */
exports.validateFields = (fields, body) => {
  const missingFields = fields.filter((field) => !body[field]);
  if (missingFields.length) {
    return `Missing required fields: ${missingFields.join(', ')}`;
  }
  return null;
};

/**
 * Find a wallet by user ID and validate balance.
 */
exports.findWalletAndValidateBalance = async (userId, amount) => {
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) return { error: 'Wallet not found' };
  if (wallet.availableBalance < amount) return { error: 'Insufficient funds in wallet' };
  return { wallet };
};

/**
 * Update wallet balance and log transaction.
 */
exports.updateWalletBalance = async (wallet, amount, type, description) => {
  wallet.availableBalance += amount;
  wallet.totalBalance += amount;
  wallet.transactions.push({ amount, type, description });
  await wallet.save();
};

/**
 * Update community contributions.
 */
exports.updateCommunityContributions = async (community, userId, amount, contributionDate) => {
  community.totalContributions = (community.totalContributions || 0) + amount;
  community.contributionList = [
    ...(community.contributionList || []),
    { userId, amount, contributionDate },
  ];
  await community.save();
};
