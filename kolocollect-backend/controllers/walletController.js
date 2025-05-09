const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const createErrorResponse = (res, status, message) => res.status(status).json({ error: { message } });
const User = require('../models/User');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createWallet = async (req, res) => {
  try {
    const { userId, availableBalance, fixedBalance, totalBalance } = req.body;

    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      return res.status(400).json({ message: 'Wallet already exists for this user.' });
    }

    const newWallet = new Wallet({
      userId,
      availableBalance: availableBalance || 0,
      fixedBalance: fixedBalance || 0,
      totalBalance: totalBalance || 0,
      transactions: [],
    });

    await newWallet.save();
    res.status(201).json({ message: 'Wallet created successfully.', wallet: newWallet });
  } catch (err) {
    console.error('Error creating wallet:', err);
    res.status(500).json({ message: 'Failed to create wallet.' });
  }
};


//  Add Funds
exports.addFunds = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!isValidObjectId(userId) || !amount || amount <= 0) {
      return createErrorResponse(res, 400, `Invalid user ID(${userId}) or amount.`);
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    // Use schema method
    await wallet.addFunds(amount, 'Funds added manually');

    // Notify user
    const user = await User.findById(userId);
    if (user) {
      await user.addNotification('info', `€${amount} has been added to your wallet.`);
    }

    res.status(200).json({ message: `Successfully added €${amount} to wallet.`, wallet });
  } catch (err) {
    console.error('Error adding funds:', err);
    createErrorResponse(res, 500, 'Failed to add funds.');
  }
};

//  Withdraw Funds
exports.withdrawFunds = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!isValidObjectId(userId) || !amount || amount <= 0) {
      return createErrorResponse(res, 400, 'Invalid user ID or amount.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    // Use schema method
    await wallet.withdrawFunds(amount);

    // Notify user
    const user = await User.findById(userId);
    if (user) {
      await user.addNotification('info', `€${amount} has been withdrawn from your wallet.`);
    }

    res.status(200).json({ message: `Successfully withdrew €${amount} from wallet.`, wallet });
  } catch (err) {
    console.error('Error withdrawing funds:', err);
    createErrorResponse(res, 500, 'Failed to withdraw funds.');
  }
};

//  Transfer Funds
exports.transferFunds = async (req, res) => {
  try {
    const { userId, amount, recipientId, description } = req.body;

    if (!isValidObjectId(userId) || !isValidObjectId(recipientId) || !amount || amount <= 0) {
      return createErrorResponse(res, 400, 'Invalid amount or recipient ID.');
    }

    const senderWallet = await Wallet.findOne({ userId });
    if (!senderWallet) return createErrorResponse(res, 404, 'Sender wallet not found.');

    const recipientWallet = await Wallet.findOne({ userId: recipientId });
    if (!recipientWallet) return createErrorResponse(res, 404, 'Recipient wallet not found.');

    // Use schema method
    await senderWallet.transferFunds(amount, recipientWallet._id, description);

    // Notify sender
    const sender = await User.findById(userId);
    if (sender) {
      await sender.addNotification('info', `You transferred €${amount} to ${recipientId}.`);
    }

    // Notify recipient
    const recipient = await User.findById(recipientId);
    if (recipient) {
      await recipient.addNotification('info', `You received €${amount} from ${userId}.`);
    }

    res.status(200).json({ message: `Successfully transferred €${amount}.`, senderWallet, recipientWallet });
  } catch (err) {
    console.error('Error transferring funds:', err);
    createErrorResponse(res, 500, 'Failed to transfer funds.');
  }
};

// Get Transaction History
exports.getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID.');
    }

    const wallet = await Wallet.findOne({ userId }).select('transactions');
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    res.status(200).json(wallet.transactions);
  } catch (err) {
    console.error('Error fetching transaction history:', err);
    createErrorResponse(res, 500, 'Failed to fetch transaction history.');
  }
};


// Fix Funds
exports.fixFunds = async (req, res) => {
  try {
    const { userId, amount, duration } = req.body;

    if (!isValidObjectId(userId) || !amount || amount <= 0 || !duration) {
      return createErrorResponse(res, 400, 'Invalid amount or duration.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    if (wallet.availableBalance < amount) {
      return createErrorResponse(res, 400, 'Insufficient funds for fixing.');
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    // Use addTransaction for fixing funds
    await wallet.addTransaction(
      amount,
      'fixed',
      `Fixed €${amount} for ${duration} days`
    );

    // Add fixed fund record
    wallet.fixedFunds.push({
      amount,
      startDate: new Date(),
      endDate,
      isMatured: false,
    });

    await wallet.save();

    // Notify user
    const user = await User.findById(userId);
    if (user) {
      const notificationMessage = `You have fixed €${amount} for ${duration} days.`;
      await user.addNotification('info', notificationMessage);

      user.activityLog.push({
        action: 'Fixed Funds',
        details: `Fixed €${amount} for ${duration} days.`,
      });
      await user.save();
    }

    res.status(200).json({ message: 'Funds fixed successfully.', wallet });
  } catch (err) {
    console.error('Error fixing funds:', err);
    createErrorResponse(res, 500, 'Failed to fix funds.');
  }
};


// Get Fixed Funds
exports.getFixedFunds = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID.');
    }

    const wallet = await Wallet.findOne({ userId }).select('fixedBalance');
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    res.status(200).json({ fixedBalance: wallet.fixedBalance });
  } catch (err) {
    console.error('Error fetching fixed funds:', err);
    createErrorResponse(res, 500, 'Failed to fetch fixed funds.');
  }
};


// Get Wallet Balance
exports.getWalletBalance = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    res.status(200).json({
      availableBalance: wallet.availableBalance,
      fixedBalance: wallet.fixedBalance,
      totalBalance: wallet.totalBalance,
    });
  } catch (err) {
    console.error('Error fetching wallet balance:', err);
    createErrorResponse(res, 500, 'Failed to fetch wallet balance.');
  }
};

// Get Wallet Details
exports.getWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID.');
    }

    const wallet = await Wallet.findOne({ userId }).populate('transactions.recipient', 'name email');
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    res.status(200).json(wallet);
  } catch (err) {
    console.error('Error fetching wallet:', err);
    createErrorResponse(res, 500, 'Failed to fetch wallet details.');
  }
};
