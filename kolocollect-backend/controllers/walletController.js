const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const createErrorResponse = (res, status, message) => res.status(status).json({ error: { message } });
const User = require('../models/User');
const TransactionManager = require('../utils/transactionManager');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createWallet = async (req, res) => {
  try {
    const { userId, authId, availableBalance, fixedBalance, totalBalance } = req.body;

    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      return res.status(400).json({ message: 'Wallet already exists for this user.' });
    }

    const newWallet = new Wallet({
      userId,
      authId, // Add authId field
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

    // Use TransactionManager for ACID-compliant fund addition
    const result = await TransactionManager.handleFundAddition({
      userId,
      amount,
      description: 'Funds added manually'
    });

    res.status(200).json({ 
      message: `Successfully added €${amount} to wallet.`, 
      wallet: result.wallet,
      transaction: result.transaction
    });
  } catch (err) {
    console.error('Error adding funds:', err);
    createErrorResponse(res, 500, err.message || 'Failed to add funds.');
  }
};

//  Withdraw Funds
exports.withdrawFunds = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!isValidObjectId(userId) || !amount || amount <= 0) {
      return createErrorResponse(res, 400, 'Invalid user ID or amount.');
    }

    // Use TransactionManager for ACID-compliant fund withdrawal
    const result = await TransactionManager.handleWithdrawal({
      userId,
      amount,
      description: 'Manual withdrawal'
    });

    res.status(200).json({ 
      message: `Successfully withdrew €${amount} from wallet.`, 
      wallet: result.wallet,
      transaction: result.transaction
    });
  } catch (err) {
    console.error('Error withdrawing funds:', err);
    createErrorResponse(res, 500, err.message || 'Failed to withdraw funds.');
  }
};

//  Transfer Funds
exports.transferFunds = async (req, res) => {
  try {    
    const { userId, amount, recipientId, recipientEmail, description } = req.body;

    console.log('Transfer funds request body:', req.body);

    // Validate the sender ID and amount
    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID format.');
    }

    if (!amount || amount <= 0) {
      return createErrorResponse(res, 400, 'Invalid amount. Amount must be greater than 0.');
    }    

    let recipientUser;
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
    }

    // Use TransactionManager for ACID-compliant fund transfer
    const result = await TransactionManager.handleTransfer({
      senderId: userId,
      recipientId: recipientUser._id,
      amount,
      description: description || `Transfer to ${recipientUser.email}`
    });

    res.status(200).json({ 
      message: `Successfully transferred €${amount}.`, 
      senderWallet: result.senderWallet,
      recipientWallet: result.recipientWallet,
      transaction: result.transaction
    });
  } catch (err) {
    console.error('Error transferring funds:', err);
    createErrorResponse(res, 500, err.message || 'Failed to transfer funds.');
  }
};

// Get Transaction History
exports.getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 10,
      type,
      status,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      search,
      sort = 'date',
      order = 'desc'
    } = req.query;

    // Find user by authId or _id
    const User = require('../models/User');
    
    // Try to find user by authId or _id depending on what we got
    let userDoc = null;
    if (isValidObjectId(userId)) {
      // Try finding by _id first
      userDoc = await User.findById(userId);
      
      // If not found, try by authId
      if (!userDoc) {
        userDoc = await User.findOne({ authId: userId });
      }
    } else {
      // Non-ObjectId format, must be an authId
      userDoc = await User.findOne({ authId: userId });
    }

    if (!userDoc) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/USER_NOT_FOUND"
        }
      });
    }

    const wallet = await Wallet.findOne({ userId: userDoc._id });
    if (!wallet) {
      return res.status(404).json({
        error: {
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/WALLET_NOT_FOUND"
        }
      });
    }
    
    // Start with all transactions
    let filteredTransactions = [...wallet.transactions];
      // Apply filters
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      filteredTransactions = filteredTransactions.filter(tx => tx.type && types.includes(tx.type));
    }
    
    // Status field is not in the transaction schema, so we remove this filter
    // But we'll keep accepting the parameter for API compatibility
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredTransactions = filteredTransactions.filter(tx => new Date(tx.date) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredTransactions = filteredTransactions.filter(tx => new Date(tx.date) <= toDate);
    }
    
    if (minAmount) {
      filteredTransactions = filteredTransactions.filter(tx => tx.amount >= Number(minAmount));
    }
    
    if (maxAmount) {
      filteredTransactions = filteredTransactions.filter(tx => tx.amount <= Number(maxAmount));
    }
      if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = filteredTransactions.filter(tx => 
        (tx.description && tx.description.toLowerCase().includes(searchLower)) ||
        (tx.communityName && tx.communityName.toLowerCase().includes(searchLower))
      );
    }
    
    // Count total filtered transactions before pagination
    const total = filteredTransactions.length;
    
    // Sort transactions
    filteredTransactions.sort((a, b) => {
      let valueA = a[sort];
      let valueB = b[sort];
      
      if (sort === 'date') {
        valueA = new Date(valueA);
        valueB = new Date(valueB);
      }
      
      if (valueA < valueB) return order === 'asc' ? -1 : 1;
      if (valueA > valueB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Paginate results
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    // Return paginated results with metadata
    res.status(200).json({
      transactions: paginatedTransactions,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });  } catch (err) {
    console.error('Error fetching transaction history:', err);
    createErrorResponse(res, 500, 'Failed to fetch transaction history.');
  }
};

// Export Transaction History as CSV
exports.exportTransactionHistoryCSV = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      type,
      status,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      search,
      sort = 'date',
      order = 'desc'
    } = req.query;

    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');
      // Apply the same filtering logic as getTransactionHistory
    let filteredTransactions = [...wallet.transactions];
    
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      filteredTransactions = filteredTransactions.filter(tx => tx.type && types.includes(tx.type));
    }
    
    // Status field is not in the transaction schema, so we remove this filter
    // But we'll keep accepting the parameter for API compatibility
    
    // Apply other filters (date, amount, search)
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredTransactions = filteredTransactions.filter(tx => new Date(tx.date) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredTransactions = filteredTransactions.filter(tx => new Date(tx.date) <= toDate);
    }
    
    if (minAmount) {
      filteredTransactions = filteredTransactions.filter(tx => tx.amount >= Number(minAmount));
    }
    
    if (maxAmount) {
      filteredTransactions = filteredTransactions.filter(tx => tx.amount <= Number(maxAmount));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = filteredTransactions.filter(tx => 
        tx.description.toLowerCase().includes(searchLower) ||
        (tx.communityName && tx.communityName.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort transactions
    filteredTransactions.sort((a, b) => {
      let valueA = a[sort];
      let valueB = b[sort];
      
      if (sort === 'date') {
        valueA = new Date(valueA);
        valueB = new Date(valueB);
      }
      
      if (valueA < valueB) return order === 'asc' ? -1 : 1;
      if (valueA > valueB) return order === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Format date for CSV
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    };
      // Generate CSV headers - removed Status column as it doesn't exist in the model
    let csv = 'Type,Description,Amount,Date\n';
      // Add transaction data
    filteredTransactions.forEach(tx => {
      const type = tx.type ? (tx.type.charAt(0).toUpperCase() + tx.type.slice(1)) : 'Unknown';
      const description = tx.description ? `"${tx.description.replace(/"/g, '""')}"` : '';  // Escape quotes
      const amount = tx.amount ? tx.amount.toFixed(2) : '0.00';
      const date = formatDate(tx.date || new Date());
      
      csv += `${type},${description},${amount},${date}\n`;
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transaction-history.csv');
    
    // Send CSV data
    res.send(csv);
  } catch (err) {
    console.error('Error exporting transaction history as CSV:', err);
    createErrorResponse(res, 500, 'Failed to export transaction history.');
  }
};

// Export Transaction History as PDF
exports.exportTransactionHistoryPDF = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const { userId } = req.params;
    const {
      type,
      status,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      search,
      sort = 'date',
      order = 'desc'
    } = req.query;

    if (!isValidObjectId(userId)) {
      return createErrorResponse(res, 400, 'Invalid user ID.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return createErrorResponse(res, 404, 'Wallet not found.');
      // Apply the same filtering logic as in getTransactionHistory
    let filteredTransactions = [...wallet.transactions];
    
    if (type) {
      const types = Array.isArray(type) ? type : [type];
      filteredTransactions = filteredTransactions.filter(tx => tx.type && types.includes(tx.type));
    }
    
    // Status field is not in the transaction schema, so we remove this filter
    // But we'll keep accepting the parameter for API compatibility
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filteredTransactions = filteredTransactions.filter(tx => new Date(tx.date) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      filteredTransactions = filteredTransactions.filter(tx => new Date(tx.date) <= toDate);
    }
    
    if (minAmount) {
      filteredTransactions = filteredTransactions.filter(tx => tx.amount >= Number(minAmount));
    }
    
    if (maxAmount) {
      filteredTransactions = filteredTransactions.filter(tx => tx.amount <= Number(maxAmount));
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = filteredTransactions.filter(tx => 
        tx.description.toLowerCase().includes(searchLower) ||
        (tx.communityName && tx.communityName.toLowerCase().includes(searchLower))
      );
    }

    // Format date for display
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    };

    // Create a PDF document using PDFKit
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    
    // When document is done being created, set the response headers and send the data
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=transaction-history.pdf');
      res.setHeader('Content-Length', pdfData.length);
      res.send(pdfData);
    });

    // Add title and generation date
    doc.fontSize(20).text('Transaction History', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);    // Define table columns and positions
    const tableTop = 150;
    const typeX = 50;
    const descX = 150;
    const amountX = 350;
    const dateX = 500;
    
    // Add table headers
    doc.font('Helvetica-Bold');
    doc.fontSize(12);
    doc.text('Type', typeX, tableTop);
    doc.text('Description', descX, tableTop);
    doc.text('Amount', amountX, tableTop);
    doc.text('Date', dateX, tableTop);
    doc.moveDown();

    // Add a horizontal line
    doc.moveTo(50, tableTop + 20)
       .lineTo(550, tableTop + 20)
       .stroke();
    
    // Add transaction rows
    let yPosition = tableTop + 30;
    doc.font('Helvetica');
    
    filteredTransactions.forEach((tx, index) => {      // Add a new page if we're running out of space
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      // Safe check for transaction type
      const isPositive = tx.type ? ['deposit', 'payout', 'release-fixed-funds'].includes(tx.type) : false;
      const amountPrefix = isPositive ? '+' : '-';
      
      // Set color for amount (green for positive, red for negative)
      const textColor = isPositive ? 'green' : 'red';      // Write transaction data with null checks - removed status field
      const typeText = tx.type ? (tx.type.charAt(0).toUpperCase() + tx.type.slice(1)) : 'Unknown';
      const descriptionText = tx.description || '';
      const amountText = tx.amount ? tx.amount.toFixed(2) : '0.00';
      const dateText = formatDate(tx.date || new Date());
      
      doc.text(typeText, typeX, yPosition);
      doc.text(descriptionText, descX, yPosition, { width: 180 });
      
      // Save current text color
      const currentColor = doc.fillColor();
      doc.fillColor(textColor)
         .text(`${amountPrefix}$${amountText}`, amountX, yPosition)
         .fillColor(currentColor); // Reset to previous color
      
      doc.text(dateText, dateX, yPosition);
      
      // Move down for the next row
      yPosition += 25;
    });
    
    // Add a footer
    doc.fontSize(10);
    doc.text('KoloCollect - Wallet Transaction History', 50, doc.page.height - 50, {
      align: 'center'
    });
    
    // Finalize the PDF
    doc.end();
  } catch (err) {
    console.error('Error exporting transaction history as PDF:', err);
    createErrorResponse(res, 500, 'Failed to export transaction history.');
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

    // Find user by authId or _id
    const User = require('../models/User');
    
    // Try to find user by authId or _id depending on what we got
    let userDoc = null;
    if (isValidObjectId(userId)) {
      // Try finding by _id first
      userDoc = await User.findById(userId);
      
      // If not found, try by authId
      if (!userDoc) {
        userDoc = await User.findOne({ authId: userId });
      }
    } else {
      // Non-ObjectId format, must be an authId
      userDoc = await User.findOne({ authId: userId });
    }

    if (!userDoc) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/USER_NOT_FOUND"
        }
      });
    }

    const wallet = await Wallet.findOne({ userId: userDoc._id }).select('fixedBalance fixedFunds');
    if (!wallet) {
      return res.status(404).json({
        error: {
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/WALLET_NOT_FOUND"
        }
      });
    }

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
    const User = require('../models/User');

    // First check if this is a valid Object ID
    const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

    // Try to find user by authId or _id depending on what we got
    let userDoc = null;
    if (isValidObjectId(userId)) {
      // Try finding by _id first
      userDoc = await User.findById(userId);
      
      // If not found, try by authId
      if (!userDoc) {
        userDoc = await User.findOne({ authId: userId });
      }
    } else {
      // Non-ObjectId format, must be an authId
      userDoc = await User.findOne({ authId: userId });
    }

    if (!userDoc) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/USER_NOT_FOUND"
        }
      });
    }    // Use the _id from the user document to find the wallet
    let wallet = await Wallet.findOne({ userId: userDoc._id });
    
    // If not found by userId, try by authId if user has an authId
    if (!wallet && userDoc.authId) {
      wallet = await Wallet.findOne({ authId: userDoc.authId });
    }
    
    if (!wallet) {
      return res.status(404).json({
        error: {
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/WALLET_NOT_FOUND"
        }
      });
    }

    res.status(200).json({
      availableBalance: wallet.availableBalance,
      fixedBalance: wallet.fixedBalance,
      totalBalance: wallet.totalBalance,
    });
  } catch (err) {
    console.error('Error fetching wallet balance:', err);
    res.status(500).json({
      error: {
        code: 'WALLET_ERROR',
        message: 'Failed to fetch wallet balance.',
        timestamp: new Date().toISOString(),
        documentation: "https://api.kolocollect.com/docs/errors/WALLET_ERROR"
      }
    });
  }
};

// Get Wallet Details
exports.getWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by authId or _id
    const User = require('../models/User');
    
    // Try to find user by authId or _id depending on what we got
    let userDoc = null;
    if (isValidObjectId(userId)) {
      // Try finding by _id first
      userDoc = await User.findById(userId);
      
      // If not found, try by authId
      if (!userDoc) {
        userDoc = await User.findOne({ authId: userId });
      }
    } else {
      // Non-ObjectId format, must be an authId
      userDoc = await User.findOne({ authId: userId });
    }    if (!userDoc) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/USER_NOT_FOUND"
        }
      });
    }

    // First try to find by userId
    let wallet = await Wallet.findOne({ userId: userDoc._id }).populate('transactions.recipient', 'name email');
    
    // If not found, try finding by authId
    if (!wallet && userDoc.authId) {
      wallet = await Wallet.findOne({ authId: userDoc.authId }).populate('transactions.recipient', 'name email');
    }
    if (!wallet) {
      return res.status(404).json({
        error: {
          code: 'WALLET_NOT_FOUND',
          message: 'Wallet not found.',
          timestamp: new Date().toISOString(),
          documentation: "https://api.kolocollect.com/docs/errors/WALLET_NOT_FOUND"
        }
      });
    }

    res.status(200).json(wallet);
  } catch (err) {
    console.error('Error fetching wallet:', err);
    createErrorResponse(res, 500, 'Failed to fetch wallet details.');
  }
};
