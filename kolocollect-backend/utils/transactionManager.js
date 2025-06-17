const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Transaction Manager Utility
 * Provides comprehensive transaction management for financial operations
 * Ensures ACID compliance, proper error handling, and rollback mechanisms
 */
class TransactionManager {
  
  /**
   * Execute a financial operation within a transaction
   * @param {Function} operations - Async function containing operations to execute
   * @param {Object} options - Transaction options
   * @returns {Promise<any>} Result of the operations
   */
  static async executeTransaction(operations, options = {}) {
    const session = await mongoose.startSession();
    
    try {
      // Configure transaction options
      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true },
        maxTimeMS: 30000, // 30 seconds timeout
        ...options
      };

      let result;
      await session.withTransaction(async () => {
        result = await operations(session);
      }, transactionOptions);

      logger.info('Transaction completed successfully', {
        sessionId: session.id,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      logger.error('Transaction failed', {
        error: error.message,
        stack: error.stack,
        sessionId: session.id,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Handle contribution transaction with complete ACID compliance
   * @param {Object} params - Contribution parameters
   * @returns {Promise<Object>} Contribution result
   */
  static async handleContribution(params) {
    const { userId, communityId, amount, midCycleId } = params;

    return await this.executeTransaction(async (session) => {
      // Get required models
      const Community = mongoose.model('Community');
      const Contribution = mongoose.model('Contribution');
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');
      const CommunityActivityLog = mongoose.model('CommunityActivityLog');
      const MidCycle = mongoose.model('MidCycle');

      // 1. Validate community and mid-cycle
      const community = await Community.findById(communityId).session(session);
      if (!community) {
        throw new Error('Community not found');
      }

      const midCycle = await MidCycle.findById(midCycleId).session(session);
      if (!midCycle) {
        throw new Error('Mid-cycle not found');
      }

      // 2. Check wallet balance with lock
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.isFrozen) {
        throw new Error('Wallet is frozen. Cannot process contribution.');
      }

      if (wallet.availableBalance < amount) {
        throw new Error('Insufficient wallet balance');
      }

      // 3. Create contribution record
      const contribution = new Contribution({
        userId,
        communityId,
        amount,
        midCycleId,
        cycleNumber: midCycle.cycleNumber,
        status: 'completed',
        date: new Date()
      });

      const savedContribution = await contribution.save({ session });

      // 4. Update wallet with transaction
      await wallet.addTransactionInSession(
        amount,
        'contribution',
        `Contribution to community ${community.name}`,
        null,
        communityId,
        session
      );      // 5. Record contribution in community using the correct method name
      await community.recordInSession({
        contributorId: userId,
        recipientId: midCycle.nextInLine.userId,
        amount,
        contributionId: savedContribution._id
      }, session);

      // 6. Update user's contribution records
      const user = await User.findById(userId).session(session);
      if (user) {
        await user.addContributionInSession(savedContribution._id, amount, session);
      }

      // 7. Create activity log
      const activityLog = new CommunityActivityLog({
        communityId,
        userId,
        activityType: 'contribution_created',
        timestamp: new Date()
      });
      await activityLog.save({ session });      // 8. Update community activity log
      community.activityLog.push(activityLog._id);
      await community.save({ session });

      // 9. Send contribution confirmation email (outside transaction)
      // We'll do this after the transaction completes successfully
      const contributionData = {
        contribution: savedContribution,
        community,
        user,
        midCycle
      };      return {
        success: true,
        contribution: savedContribution,
        community,
        user,
        midCycle,
        contributionData,
        message: 'Contribution processed successfully'
      };
    });
  }

  /**
   * Handle fund addition with proper transaction management
   * @param {Object} params - Fund addition parameters
   * @returns {Promise<Object>} Fund addition result
   */
  static async handleFundAddition(params) {
    const { userId, amount, description = 'Funds added' } = params;
    console.log('Adding funds to wallet', { userId, amount, description });

    return await this.executeTransaction(async (session) => {
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');

      // 1. Find wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.isFrozen) {
        throw new Error('Wallet is frozen. Cannot add funds.');
      }

      // 2. Add funds to wallet
      await wallet.addFundsInSession(amount, description, session);

      // 3. Notify user
      const user = await User.findById(userId).session(session);
      if (user) {
        await user.addNotificationInSession(
          'info', 
          `€${amount} has been added to your wallet.`,
          null,
          session
        );
      }

      return {
        success: true,
        wallet,
        transaction: wallet.transactions[wallet.transactions.length - 1],
        message: 'Funds added successfully'
      };
    });
  }

  /**
   * Handle fund withdrawal with proper transaction management
   * @param {Object} params - Withdrawal parameters
   * @returns {Promise<Object>} Withdrawal result
   */
  static async handleWithdrawal(params) {
    const { userId, amount, description = 'Withdrawal' } = params;

    return await this.executeTransaction(async (session) => {
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');

      // 1. Find wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.isFrozen) {
        throw new Error('Wallet is frozen. Cannot withdraw funds.');
      }

      if (wallet.availableBalance < amount) {
        throw new Error('Insufficient funds for withdrawal');
      }

      // 2. Withdraw funds from wallet
      await wallet.withdrawFundsInSession(amount, description, session);

      // 3. Notify user
      const user = await User.findById(userId).session(session);
      if (user) {
        await user.addNotificationInSession(
          'info', 
          `€${amount} has been withdrawn from your wallet.`,
          null,
          session
        );
      }

      return {
        success: true,
        wallet,
        transaction: wallet.transactions[wallet.transactions.length - 1],
        message: 'Withdrawal processed successfully'
      };
    });
  }

  /**
   * Handle payout distribution with proper transaction management
   * @param {Object} params - Payout parameters
   * @returns {Promise<Object>} Payout result
   */
  static async handlePayout(params) {
    const { recipientId, amount, communityId, midCycleId, distributorId } = params;

    return await this.executeTransaction(async (session) => {
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');
      const MidCycle = mongoose.model('MidCycle');
      const CommunityActivityLog = mongoose.model('CommunityActivityLog');

      // 1. Validate recipient wallet
      let recipientWallet = await Wallet.findOne({ userId: recipientId }).session(session);
      if (!recipientWallet) {
        // Create wallet if it doesn't exist
        recipientWallet = new Wallet({
          userId: recipientId,
          availableBalance: 0,
          totalBalance: 0,
          fixedBalance: 0,
          transactions: []
        });
        await recipientWallet.save({ session });
      }

      // 2. Process payout transaction
      await recipientWallet.addTransactionInSession(
        amount,
        'payout',
        `Payout from community`,
        distributorId,
        communityId,
        session
      );      // 3. Update mid-cycle status
      const { completeMidcycle } = require('../models/midcycleCompletionHandler');
      await completeMidcycle(midCycleId, session);
      
      // Also update completedAt for historical reasons
      const midCycle = await MidCycle.findById(midCycleId).session(session);
      if (midCycle) {
        midCycle.completedAt = new Date();
        await midCycle.save({ session });
      }

      // 4. Notify recipient      const recipient = await User.findById(recipientId).session(session);
      if (recipient) {
        await recipient.addNotificationInSession(
          'success',
          `You received a payout of €${amount} from your community!`,
          communityId,
          session
        );
      }

      // 5. Create activity log
      const activityLog = new CommunityActivityLog({
        communityId,
        userId: recipientId,
        activityType: 'payout_distributed',
        timestamp: new Date()
      });
      await activityLog.save({ session });

      return {
        success: true,
        amount,
        recipient: recipientId,
        message: 'Payout processed successfully'
      };
    });
  }

  /**
   * Handle wallet transfer with transaction safety
   * @param {Object} params - Transfer parameters
   * @returns {Promise<Object>} Transfer result
   */
  static async handleTransfer(params) {
    const { senderId, recipientId, amount, description } = params;

    return await this.executeTransaction(async (session) => {
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');

      // 1. Get sender wallet with lock
      const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
      if (!senderWallet) {
        throw new Error('Sender wallet not found');
      }

      if (senderWallet.isFrozen) {
        throw new Error('Sender wallet is frozen');
      }

      if (senderWallet.availableBalance < amount) {
        throw new Error('Insufficient balance for transfer');
      }

      // 2. Get or create recipient wallet
      let recipientWallet = await Wallet.findOne({ userId: recipientId }).session(session);
      if (!recipientWallet) {
        recipientWallet = new Wallet({
          userId: recipientId,
          availableBalance: 0,
          totalBalance: 0,
          fixedBalance: 0,
          transactions: []
        });
        await recipientWallet.save({ session });
      }

      // 3. Process sender transaction
      await senderWallet.addTransactionInSession(
        amount,
        'transfer',
        description || `Transfer to user ${recipientId}`,
        recipientId,
        null,
        session
      );

      // 4. Process recipient transaction
      await recipientWallet.addTransactionInSession(
        amount,
        'deposit',
        description || `Transfer from user ${senderId}`,
        senderId,
        null,
        session
      );      // 5. Notify both parties
      const sender = await User.findById(senderId).session(session);
      const recipient = await User.findById(recipientId).session(session);

      if (sender) {
        await sender.addNotificationInSession(
          'info',
          `You transferred €${amount} to ${recipient ? recipient.email : 'another user'}`,
          null,
          session
        );
      }      if (recipient) {
        await recipient.addNotificationInSession(
          'info',
          `You received €${amount} from ${sender ? sender.email : 'another user'}`,
          null,
          session
        );
      }

      return {
        success: true,
        amount,
        sender: senderId,
        recipient: recipientId,
        message: 'Transfer completed successfully'
      };
    });
  }

  /**
   * Handle penalty deduction with proper transaction management
   * @param {Object} params - Penalty parameters
   * @returns {Promise<Object>} Penalty result
   */
  static async handlePenalty(params) {
    const { userId, amount, communityId, reason } = params;

    return await this.executeTransaction(async (session) => {
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');
      const Community = mongoose.model('Community');
      const CommunityActivityLog = mongoose.model('CommunityActivityLog');

      // 1. Get user wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.availableBalance < amount) {
        throw new Error('Insufficient balance for penalty deduction');
      }

      // 2. Process penalty transaction
      await wallet.addTransactionInSession(
        amount,
        'penalty',
        reason || 'Community penalty',
        null,
        communityId,
        session
      );

      // 3. Add to community backup fund
      const community = await Community.findById(communityId).session(session);
      if (community) {
        community.backupFund = (community.backupFund || 0) + amount;
        await community.save({ session });
      }

      // 4. Notify user
      const user = await User.findById(userId).session(session);      if (user) {
        await user.addNotificationInSession(
          'warning',
          `A penalty of €${amount} has been deducted from your wallet. Reason: ${reason}`,
          communityId,
          session
        );
      }

      // 5. Create activity log
      const activityLog = new CommunityActivityLog({
        communityId,
        userId,
        activityType: 'penalty_applied',
        timestamp: new Date()
      });
      await activityLog.save({ session });

      return {
        success: true,
        amount,
        userId,
        message: 'Penalty processed successfully'
      };
    });
  }

  /**
   * Handle wallet freeze/unfreeze operations
   * @param {Object} params - Freeze parameters
   * @returns {Promise<Object>} Freeze result
   */
  static async handleWalletFreeze(params) {
    const { userId, freeze, reason } = params;

    return await this.executeTransaction(async (session) => {
      const Wallet = mongoose.model('Wallet');
      const User = mongoose.model('User');

      // 1. Get wallet
      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // 2. Update freeze status
      wallet.isFrozen = freeze;
      await wallet.save({ session });

      // 3. Notify user
      const user = await User.findById(userId).session(session);
      if (user) {
        const message = freeze 
          ? `Your wallet has been frozen. Reason: ${reason}`
          : `Your wallet has been unfrozen.`;
          await user.addNotificationInSession(
          freeze ? 'warning' : 'success',
          message,
          null,
          session
        );
      }

      return {
        success: true,
        frozen: freeze,
        userId,
        message: freeze ? 'Wallet frozen successfully' : 'Wallet unfrozen successfully'
      };
    });
  }

  /**
   * Validate transaction parameters
   * @param {Object} params - Parameters to validate
   * @throws {Error} If validation fails
   */
  static validateTransactionParams(params) {
    const { amount, userId } = params;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount. Must be a positive number');
    }

    if (amount > 1000000) { // 1 million limit
      throw new Error('Amount exceeds maximum transaction limit');
    }
  }

  /**
   * Get transaction statistics for monitoring
   * @param {string} timeframe - Timeframe for statistics ('day', 'week', 'month')
   * @returns {Promise<Object>} Transaction statistics
   */
  static async getTransactionStats(timeframe = 'day') {
    const Wallet = mongoose.model('Wallet');
    
    const timeMap = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - timeMap[timeframe]);

    try {
      const stats = await Wallet.aggregate([
        { $unwind: '$transactions' },
        { $match: { 'transactions.date': { $gte: since } } },
        {
          $group: {
            _id: '$transactions.type',
            count: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: '$transactions.amount' } },
            avgAmount: { $avg: { $toDouble: '$transactions.amount' } }
          }
        }
      ]);

      return {
        timeframe,
        since,
        statistics: stats,
        totalTransactions: stats.reduce((sum, stat) => sum + stat.count, 0)
      };
    } catch (error) {
      logger.error('Error getting transaction statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle contribution update with ACID compliance
   * @param {Object} params - Update parameters
   * @param {string} params.contributionId - ID of contribution to update
   * @param {number} params.newAmount - New contribution amount
   * @param {string} params.reason - Reason for update
   * @returns {Object} Update result
   */
  static async handleContributionUpdate({ contributionId, newAmount, reason = 'Amount update' }) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // 1. Find the contribution
        const contribution = await Contribution.findById(contributionId).session(session);
        if (!contribution) {
          throw new Error('Contribution not found');
        }

        const oldAmount = contribution.amount;
        const amountDifference = newAmount - oldAmount;

        // 2. Find related entities
        const [user, community, wallet] = await Promise.all([
          User.findById(contribution.userId).session(session),
          Community.findById(contribution.communityId).session(session),
          Wallet.findOne({ userId: contribution.userId }).session(session)
        ]);

        if (!user || !community || !wallet) {
          throw new Error('Required entities not found');
        }

        // 3. Update wallet balance
        if (amountDifference !== 0) {
          await wallet.withdrawFundsInSession(-amountDifference, session); // Negative withdrawal = addition
        }

        // 4. Update contribution record
        contribution.amount = newAmount;
        contribution.lastModified = new Date();
        await contribution.save({ session });

        // 5. Update community totals
        community.totalContribution += amountDifference;
        await community.save({ session });

        // 6. Add notification
        await user.addNotificationInSession(
          'info',
          `Your contribution has been updated. New amount: €${newAmount}. Reason: ${reason}`,
          contribution.communityId,
          session
        );

        // 7. Create activity log
        const CommunityActivityLog = mongoose.model('CommunityActivityLog');
        const activityLog = new CommunityActivityLog({
          communityId: contribution.communityId,
          activityType: 'contribution_updated',
          userId: contribution.userId,
          description: `Contribution updated from €${oldAmount} to €${newAmount}. Reason: ${reason}`,
          timestamp: new Date()
        });
        await activityLog.save({ session });

        return {
          success: true,
          contribution,
          oldAmount,
          newAmount,
          amountDifference,
          message: 'Contribution updated successfully'
        };
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error('Contribution update failed', { 
        contributionId, 
        newAmount, 
        error: error.message 
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Handle contribution deletion with ACID compliance
   * @param {Object} params - Deletion parameters
   * @param {string} params.contributionId - ID of contribution to delete
   * @param {string} params.reason - Reason for deletion
   * @returns {Object} Deletion result
   */
  static async handleContributionDeletion({ contributionId, reason = 'Administrative deletion' }) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // 1. Find the contribution
        const contribution = await Contribution.findById(contributionId).session(session);
        if (!contribution) {
          throw new Error('Contribution not found');
        }

        const contributionAmount = contribution.amount;

        // 2. Find related entities
        const [user, community, wallet] = await Promise.all([
          User.findById(contribution.userId).session(session),
          Community.findById(contribution.communityId).session(session),
          Wallet.findOne({ userId: contribution.userId }).session(session)
        ]);

        if (!user || !community || !wallet) {
          throw new Error('Required entities not found');
        }

        // 3. Refund to wallet
        await wallet.addFundsInSession(contributionAmount, session);

        // 4. Update community totals
        community.totalContribution -= contributionAmount;
        if (community.backupFund > 0) {
          const backupFundReduction = (community.settings.backupFundPercentage / 100) * contributionAmount;
          community.backupFund = Math.max(0, community.backupFund - backupFundReduction);
        }
        await community.save({ session });

        // 5. Remove from mid-cycle contributions if applicable
        if (contribution.midCycleId) {
          const MidCycle = mongoose.model('MidCycle');
          const midCycle = await MidCycle.findById(contribution.midCycleId).session(session);
          if (midCycle) {
            // Remove contribution from mid-cycle
            const userContribIndex = midCycle.contributions.findIndex(c => 
              c.user.equals(contribution.userId)
            );
            if (userContribIndex !== -1) {
              const userContrib = midCycle.contributions[userContribIndex];
              userContrib.contributions = userContrib.contributions.filter(c => 
                !c.equals(contributionId)
              );
              
              // Remove entire entry if no contributions left
              if (userContrib.contributions.length === 0) {
                midCycle.contributions.splice(userContribIndex, 1);
              }
            }
            await midCycle.save({ session });
          }
        }

        // 6. Remove from user's contributions
        user.contributions = user.contributions.filter(c => !c.equals(contributionId));
        user.totalContributed -= contributionAmount;
        await user.save({ session });

        // 7. Delete the contribution
        await Contribution.findByIdAndDelete(contributionId).session(session);

        // 8. Add notification
        await user.addNotificationInSession(
          'warning',
          `Your contribution of €${contributionAmount} has been deleted and refunded. Reason: ${reason}`,
          contribution.communityId,
          session
        );

        // 9. Create activity log
        const CommunityActivityLog = mongoose.model('CommunityActivityLog');
        const activityLog = new CommunityActivityLog({
          communityId: contribution.communityId,
          activityType: 'contribution_deleted',
          userId: contribution.userId,
          description: `Contribution of €${contributionAmount} deleted and refunded. Reason: ${reason}`,
          timestamp: new Date()
        });
        await activityLog.save({ session });

        return {
          success: true,
          refundedAmount: contributionAmount,
          deletedContribution: {
            id: contributionId,
            amount: contributionAmount,
            userId: contribution.userId,
            communityId: contribution.communityId
          },
          message: 'Contribution deleted and refunded successfully'
        };
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error('Contribution deletion failed', { 
        contributionId, 
        error: error.message 
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = TransactionManager;
