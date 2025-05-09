const { calculateTotalOwed, processBackPayment, recordContribution } = require('../utils/contributionUtils');
const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');


const createErrorResponse = (res, status, errorCode, message) => res.status(status).json({
  error: {
    code: errorCode,
    message,
    timestamp: new Date().toISOString(),
    documentation: "https://api.kolocollect.com/docs/errors/" + errorCode
  }
});

// Get all contributions
exports.getContributions = async (req, res) => {
  try {
    const contributions = await Contribution.find();
    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching contributions:', err);
    createErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Server error while fetching contributions.');
  }
};

// Get a single contribution by ID
exports.getContributionById = async (req, res) => {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return createErrorResponse(res, 404, 'Contribution not found.');
    }
    res.status(200).json(contribution);
  } catch (err) {
    console.error('Error fetching contribution by ID:', err);
    createErrorResponse(res, 500, 'Server error while fetching contribution.');
  }
};

// Create a new contribution
exports.createContribution = async (req, res) => {
  console.log('Incoming Contribution Data:', req.body);

  try {
    const { userId, communityId, amount, midCycleId } = req.body;
    console.log('amount passed to createContribution:', amount);

    // Validate required fields
    if (!userId || !communityId || !amount || !midCycleId) {
      console.error('Missing required fields:', req.body);
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Convert userId to ObjectId if it's a string
    const userIdObject = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Call the static method to handle the contribution logic
    const savedContribution = await Contribution.createContributionWithInstallment(userIdObject, communityId, amount, midCycleId);

    res.status(201).json({
      message: 'Contribution created successfully and recorded in community.',
      contribution: savedContribution,
    });
  } catch (err) {
    console.error('Error creating contribution:', err);
    res.status(500).json({ message: 'Server error while creating contribution.', error: err.message });
  }
};



// Update a contribution
exports.updateContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount: newAmount } = req.body;

    const contribution = await Contribution.findById(id);
    if (!contribution) {
      return createErrorResponse(res, 404, 'Contribution not found.');
    }

    const oldAmount = contribution.amount;

    if (newAmount !== oldAmount) {
      const wallet = await Wallet.findOne({ userId: contribution.userId });
      if (!wallet) {
        return createErrorResponse(res, 404, 'Wallet not found.');
      }

      wallet.availableBalance += oldAmount;
      wallet.availableBalance -= newAmount;
      await wallet.save();
    }

    contribution.amount = newAmount;
    await contribution.save();

    res.status(200).json({ message: 'Contribution updated successfully.', contribution });
  } catch (err) {
    console.error('Error updating contribution:', err);
    createErrorResponse(res, 500, 'Server error while updating contribution.');
  }
};

// Delete a contribution
exports.deleteContribution = async (req, res) => {
  try {
    const { id } = req.params;

    const contribution = await Contribution.findByIdAndDelete(id);
    if (!contribution) {
      return createErrorResponse(res, 404, 'Contribution not found.');
    }

    const wallet = await Wallet.findOne({ userId: contribution.userId });
    if (wallet) {
      wallet.availableBalance += contribution.amount;
      await wallet.save();
    }

    res.status(200).json({ message: 'Contribution deleted successfully.' });
  } catch (err) {
    console.error('Error deleting contribution:', err);
    createErrorResponse(res, 500, 'Server error while deleting contribution.');
  }
};

// Get contributions by community
exports.getContributionsByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const contributions = await Contribution.find({ communityId });

    if (!contributions.length) {
      return createErrorResponse(res, 404, 'No contributions found for this community.');
    }

    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching community contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching community contributions.');
  }
};

// Get contributions by user
exports.getContributionsByUser = async (req, res) => {
  try {
    console.log('Fetching contributions for user ID:', req.params.userId);
    const { userId } = req.params;
    const contributions = await Contribution.find({ userId });

    // Return empty array instead of 404 when no contributions are found
    if (!contributions.length) {
      console.log('No contributions found for user ID:', userId);
      return res.status(200).json([]);
    }

    console.log(`Found ${contributions.length} contributions for user ID: ${userId}`);
    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching user contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching user contributions.');
  }
};
