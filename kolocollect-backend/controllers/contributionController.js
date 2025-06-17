const { calculateTotalOwed, processBackPayment, recordContribution } = require('../utils/contributionUtils');
const TransactionManager = require('../utils/transactionManager');
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
    const userIdObject = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;    // Call the static method to handle the contribution logic
    const result = await Contribution.createContributionWithInstallment(userIdObject, communityId, amount, midCycleId);

    // Send contribution confirmation email
    if (result.success && result.contributionData) {
      try {
        const emailService = require('../services/emailService');
        await emailService.sendContributionConfirmation({
          memberEmail: result.user.email,
          amount: result.contribution.amount,
          communityName: result.community.name,
          cycleNumber: result.midCycle.cycleNumber,
          transactionId: result.contribution._id.toString()
        });
      } catch (emailError) {
        console.error('Error sending contribution confirmation email:', emailError);
        // Don't fail the entire operation if email fails
      }
    }

    res.status(201).json({
      message: 'Contribution created successfully and recorded in community.',
      contribution: result.contribution,
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
    const { amount: newAmount, reason } = req.body;

    // Validate required fields
    if (!newAmount || newAmount <= 0) {
      return createErrorResponse(res, 400, 'INVALID_AMOUNT', 'Valid amount is required');
    }

    // Use TransactionManager for ACID-compliant update
    const result = await TransactionManager.handleContributionUpdate({
      contributionId: id,
      newAmount: parseFloat(newAmount),
      reason: reason || 'Amount update'
    });

    res.status(200).json({
      message: result.message,
      contribution: result.contribution,
      oldAmount: result.oldAmount,
      newAmount: result.newAmount,
      amountDifference: result.amountDifference
    });
  } catch (err) {
    console.error('Error updating contribution:', err);
    if (err.message === 'Contribution not found') {
      return createErrorResponse(res, 404, 'CONTRIBUTION_NOT_FOUND', 'Contribution not found');
    }
    createErrorResponse(res, 500, 'UPDATE_CONTRIBUTION_ERROR', 'Server error while updating contribution: ' + err.message);
  }
};

// Delete a contribution
exports.deleteContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Use TransactionManager for ACID-compliant deletion
    const result = await TransactionManager.handleContributionDeletion({
      contributionId: id,
      reason: reason || 'Administrative deletion'
    });

    res.status(200).json({
      message: result.message,
      refundedAmount: result.refundedAmount,
      deletedContribution: result.deletedContribution
    });
  } catch (err) {
    console.error('Error deleting contribution:', err);
    if (err.message === 'Contribution not found') {
      return createErrorResponse(res, 404, 'CONTRIBUTION_NOT_FOUND', 'Contribution not found');
    }
    createErrorResponse(res, 500, 'DELETE_CONTRIBUTION_ERROR', 'Server error while deleting contribution: ' + err.message);
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
      return res.status(200).json([]);
    }

    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching user contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching user contributions.');
  }
};
