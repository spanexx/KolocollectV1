const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Transaction Schema to track deposits, withdrawals, and other activities
const transactionSchema = new Schema(
  {
    amount: { 
      type: mongoose.Schema.Types.Decimal128, 
      required: true,
      get: v => v ? parseFloat(v.toString()) : 0
    },
    type: { 
      type: String, 
      enum: ['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer', 'payout', 'fixed'], 
      required: true 
    },
    description: { type: String },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    sUserId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: false // Make it optional
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Fixed Funds Schema to track funds that are locked for a specific duration
const fixedFundsSchema = new Schema(
  {
    amount: { 
      type: mongoose.Schema.Types.Decimal128, 
      required: true,
      get: v => v ? parseFloat(v.toString()) : 0
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isMatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Wallet Schema to store balance, transactions, and fixed funds for each user
const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  availableBalance: { 
    type: mongoose.Schema.Types.Decimal128, 
    default: 0,
    get: v => v ? parseFloat(v.toString()) : 0
  },
  fixedBalance: { 
    type: mongoose.Schema.Types.Decimal128, 
    default: 0,
    get: v => v ? parseFloat(v.toString()) : 0
  },
  totalBalance: { 
    type: mongoose.Schema.Types.Decimal128, 
    default: 0,
    get: v => v ? parseFloat(v.toString()) : 0
  },
  transactions: [transactionSchema],
  fixedFunds: [fixedFundsSchema],
  isFrozen: { type: Boolean, default: false },
}, { 
  timestamps: true,
  toJSON: { getters: true }
});

// Method to add a transaction and adjust balances
walletSchema.methods.addTransaction = async function (amount, type, description, recipient = null, communityId = null, sUserId = null) {
  if (!['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer', 'payout', 'fixed'].includes(type)) {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transactions allowed.');
  }

  // Adjust balances
  if (['withdrawal', 'transfer', 'penalty', 'contribution'].includes(type)) {
    if (this.availableBalance < amount) {
      throw new Error('Insufficient balance for the transaction.');
    }
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error(`Invalid amount value: ${amount}`);
    }
    this.availableBalance = Number((this.availableBalance - amount).toFixed(2));
  } else if (['deposit', 'payout', 'fixed'].includes(type)) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error(`Invalid amount value: ${amount}`);
    }
    this.availableBalance += type === 'fixed' ? -amount : amount;
    if (type === 'fixed') {
      this.fixedBalance += amount;
    }
  }

  // Add new transaction - only include sUserId if it's a valid ObjectId
  const transactionData = {
    amount,
    type,
    description,
    recipient,
    communityId
  };

  // Only add sUserId if it's a valid ObjectId
  if (sUserId && mongoose.Types.ObjectId.isValid(sUserId)) {
    transactionData.sUserId = sUserId;
  }

  this.transactions.push(transactionData);

  // Save wallet with selective validation
  this.markModified('transactions');
  this.totalBalance = this.availableBalance + this.fixedBalance;

  await this.save();
};

// withdrawFunds Method
walletSchema.methods.withdrawFunds = async function (amount) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No withdrawals allowed.');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for withdrawal.');
  }

  // Use addTransaction for withdrawal
  await this.addTransaction(amount, 'withdrawal', 'Manual withdrawal');
};

// transferFunds Method
walletSchema.methods.transferFunds = async function (amount, recipientWalletId, description = '') {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transfers allowed.');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for transfer.');
  }

  // Deduct funds from sender's wallet
  await this.addTransaction(
    amount,
    'transfer',
    description || `Transfer to Wallet ID ${recipientWalletId}`,
    recipientWalletId
  );

  // Add funds to recipient's wallet
  const recipientWallet = await mongoose.model('Wallet').findById(recipientWalletId);
  if (!recipientWallet) {
    throw new Error('Recipient wallet not found.');
  }

  await recipientWallet.addTransaction(
    amount,
    'deposit',
    description || `Transfer from Wallet ID ${this._id}`,
    this.userId
  );
};

// deductPenalty Method
walletSchema.methods.deductPenalty = async function (penaltyAmount) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No penalty deduction allowed.');
  }

  if (this.availableBalance < penaltyAmount) {
    throw new Error('Insufficient balance for penalty deduction.');
  }

  // Use addTransaction for penalty
  await this.addTransaction(penaltyAmount, 'penalty', 'Penalty deduction');
};

// Method to check if fixed funds have matured
fixedFundsSchema.methods.checkMaturity = function () {
  return this.isMatured || new Date() >= this.endDate;
};

// Method to add funds to the wallet
walletSchema.methods.addFunds = async function (amount, description = 'Funds added') {
  if (amount <= 0) {
    throw new Error('Amount to be added must be greater than zero.');
  }

  // Use addTransaction for adding funds
  await this.addTransaction(amount, 'deposit', description);

  console.log(`Funds added successfully: €${amount}`);
};

// Method to fix funds for a specific duration
walletSchema.methods.fixFunds = async function (amount, endDate) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transactions allowed.');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance to fix funds.');
  }

  // Initialize fixedFunds array if it's undefined
  if (!this.fixedFunds) {
    this.fixedFunds = [];
  }

  // Create a new fixed funds entry
  this.fixedFunds.push({
    amount,
    startDate: new Date(),
    endDate,
    isMatured: false,
  });

  // Add a transaction for fixing funds
  await this.addTransaction(amount, 'fixed', 'Funds fixed');

  // Save the wallet
  await this.save();
};

// Method to add a transaction within a session (for transaction management)
walletSchema.methods.addTransactionInSession = async function (amount, type, description, recipient = null, communityId = null, session) {
  if (!['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer', 'payout', 'fixed'].includes(type)) {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transactions allowed.');
  }

  // Validate amount
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid amount value: ${amount}`);
  }

  // Adjust balances based on transaction type
  if (['withdrawal', 'transfer', 'penalty', 'contribution'].includes(type)) {
    if (this.availableBalance < amount) {
      throw new Error('Insufficient balance for the transaction.');
    }
    this.availableBalance = Number((this.availableBalance - amount).toFixed(2));
  } else if (['deposit', 'payout'].includes(type)) {
    this.availableBalance = Number((this.availableBalance + amount).toFixed(2));
  } else if (type === 'fixed') {
    if (this.availableBalance < amount) {
      throw new Error('Insufficient balance to fix funds.');
    }
    this.availableBalance = Number((this.availableBalance - amount).toFixed(2));
    this.fixedBalance = Number((this.fixedBalance + amount).toFixed(2));
  }

  // Create transaction record
  const transactionData = {
    amount,
    type,
    description,
    date: new Date()
  };

  // Add optional fields if provided
  if (recipient && mongoose.Types.ObjectId.isValid(recipient)) {
    transactionData.recipient = recipient;
  }
  if (communityId && mongoose.Types.ObjectId.isValid(communityId)) {
    transactionData.communityId = communityId;
  }

  this.transactions.push(transactionData);
  this.markModified('transactions');
  this.totalBalance = this.availableBalance + this.fixedBalance;

  // Save with session
  await this.save({ session });
};

// Transfer funds within a transaction session
walletSchema.methods.transferFundsInSession = async function (amount, recipientWallet, description, session) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transfers allowed.');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for transfer.');
  }

  // Deduct from sender
  await this.addTransactionInSession(
    amount,
    'transfer',
    description || `Transfer to ${recipientWallet.userId}`,
    recipientWallet.userId,
    null,
    session
  );

  // Add to recipient
  await recipientWallet.addTransactionInSession(
    amount,
    'deposit',
    description || `Transfer from ${this.userId}`,
    this.userId,
    null,
    session
  );
};

// Freeze/unfreeze wallet within transaction session
walletSchema.methods.setFreezeStatusInSession = async function (frozen, session) {
  this.isFrozen = frozen;
  await this.save({ session });
};

// Add funds within transaction session
walletSchema.methods.addFundsInSession = async function (amount, description = 'Funds added', session) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  this.availableBalance += amount;
  this.totalBalance += amount;

  await this.addTransactionInSession(
    amount,
    'deposit',
    description,
    null,
    null,
    session
  );

  await this.save({ session });
};

// Withdraw funds within transaction session
walletSchema.methods.withdrawFundsInSession = async function (amount, description = 'Withdrawal', session) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient funds');
  }

  this.availableBalance -= amount;
  this.totalBalance -= amount;

  await this.addTransactionInSession(
    -amount,
    'withdrawal',
    description,
    null,
    null,
    session
  );

  await this.save({ session });
};

// Indexing on userId for faster lookups
walletSchema.index({ userId: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;
