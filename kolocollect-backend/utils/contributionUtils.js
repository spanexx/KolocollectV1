// utils/contributionUtils.js

const mongoose = require('mongoose');
const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

/**
 * Calculate total amount owed by a user in a community.
 * @param {String} communityId - ID of the community.
 * @param {String} userId - ID of the user.
 * @returns {Number} - Total amount owed.
 */
async function calculateTotalOwed(communityId, userId) {
  const community = await Community.findById(communityId);
  if (!community) throw new Error('Community not found.');

  const totalOwed = community.calculateTotalOwed(userId);
  return totalOwed;
}

/**
 * Process back payment for a user in a community.
 * @param {String} communityId - ID of the community.
 * @param {String} userId - ID of the user.
 * @param {Number} paymentAmount - Amount to be paid.
 */
async function processBackPayment(communityId, userId, paymentAmount) {
  const community = await Community.findById(communityId);
  if (!community) throw new Error('Community not found.');

  await community.processBackPayment(userId, paymentAmount);
}

/**
 * Record a user's contribution to a community.
 * @param {String} communityId - ID of the community.
 * @param {String} userId - ID of the user.
 * @param {Array} contributions - List of contributions with recipientId and amount.
 */
async function recordContribution(communityId, userId, contributions) {
  const community = await Community.findById(communityId);
  if (!community) throw new Error('Community not found.');

  await community.recordContribution(userId, contributions);
}

module.exports = {
  calculateTotalOwed,
  processBackPayment,
  recordContribution,
};
