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
  try {    const { userId, amount, recipientId, recipientEmail, description } = req.body;

    console.log('Transfer funds request body:', req.body);

    // Validate the sender ID and amount
    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID format.');
    }

    if (!amount || amount <= 0) {
      return createErrorResponse(res, 400, 'Invalid amount. Amount must be greater than 0.');
    }    let recipientUser;
    // Handle both recipientId and recipientEmail
    if (recipientId && isValidObjectId(recipientId)) {
      console.log('Looking up recipient by ID:', recipientId);
      recipientUser = await User.findById(recipientId);
    } else if (recipientEmail) {
      console.log('Looking up recipient by email:', recipientEmail);
      recipientUser = await User.findOne({ email: recipientEmail });
    } else {
      return createErrorResponse(res, 400, 'Recipient ID or email is required.');
    }

    if (!recipientUser) {
      return createErrorResponse(res, 404, 'Recipient user not found. Please check the email or ID provided.');
    }

    // Check if sender is transferring to themselves
    if (recipientUser._id.toString() === userId) {
      return createErrorResponse(res, 400, 'Cannot transfer funds to yourself.');
    }    const senderWallet = await Wallet.findOne({ userId });
    if (!senderWallet) return createErrorResponse(res, 404, 'Sender wallet not found.');

    let recipientWallet = await Wallet.findOne({ userId: recipientUser._id });
    if (!recipientWallet) {
      // Create a wallet for the recipient if one doesn't exist
      console.log('Creating new wallet for recipient:', recipientUser._id);
      recipientWallet = new Wallet({
        userId: recipientUser._id,
        availableBalance: 0,
        totalBalance: 0,
        fixedBalance: 0,
        transactions: []
      });
      await recipientWallet.save();
    }

    // Check if sender has sufficient funds
    if (senderWallet.availableBalance < amount) {
      return createErrorResponse(res, 400, 'Insufficient funds for this transfer.');
    }

    // Use schema method
    await senderWallet.transferFunds(amount, recipientWallet._id, description);// Notify sender
    const sender = await User.findById(userId);
    if (sender) {
      await sender.addNotification('info', `You transferred €${amount} to ${recipientUser.email}.`);
    }

    // Notify recipient
    if (recipientUser) {
      await recipientUser.addNotification('info', `You received €${amount} from ${sender.email}.`);
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
    const { userId } = req.params;
    const { amount, duration } = req.body;
    console.log('Fixing funds:', req.body, 'for user:', userId);

    // Validate userId
    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID format.');
    }
    
    // Validate amount
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return createErrorResponse(res, 400, 'Amount must be a positive number.');
    }
    
    // Validate duration
    if (!duration || isNaN(duration) || parseInt(duration) <= 0) {
      return createErrorResponse(res, 400, 'Duration must be a positive number of days.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    if (wallet.availableBalance < amount) {
      return createErrorResponse(res, 400, 'Insufficient funds for fixing.');
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);    // Make sure we have a parsed amount
    const parsedAmount = parseFloat(amount);
    const parsedDuration = parseInt(duration);
    
    // Use addTransaction for fixing funds
    await wallet.addTransaction(
      parsedAmount,
      'fixed',
      `Fixed €${parsedAmount} for ${parsedDuration} days`
    );
    
    // Initialize fixedFunds array if it's undefined
    if (!wallet.fixedFunds) {
      wallet.fixedFunds = [];
    }
    
    // Add fixed fund record
    wallet.fixedFunds.push({
      amount: parsedAmount,
      startDate: new Date(),
      endDate,
      isMatured: false,
    });
    
    // Update wallet balances (move funds from available to fixed)
    wallet.availableBalance -= parsedAmount;
    wallet.fixedBalance += parsedAmount;
    
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

    const wallet = await Wallet.findOne({ userId }).select('fixedBalance fixedFunds');
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');

    // Initialize fixedFunds if it doesn't exist
    if (!wallet.fixedFunds) {
      wallet.fixedFunds = [];
    }

    res.status(200).json({ 
      fixedBalance: wallet.fixedBalance,
      fixedFunds: wallet.fixedFunds
    });
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
