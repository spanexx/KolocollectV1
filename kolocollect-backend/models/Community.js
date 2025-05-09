const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const fs = require('fs');
const Contribution = require('../models/Contribution');
const Payout = require('../models/Payout');
const { calculateNextPayoutDate } = require('../utils/payoutUtils');
const CommunityActivityLog = require('./CommunityActivityLog');
const CommunityVote = require('./CommunityVote');
const Cycle = require('./Cycle');
const MidCycle = require('./Midcycle');
const Member = require('./Member');

const CommunitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalContribution: { type: Number, default: 0 },
    totalDistributed: { type: Number, default: 0 },
    description: { type: String },
    backupFund: { type: Number, default: 0 },
    lockPayout: { type: Boolean, default: false },

    // Reference to MidCycle documents
    midCycle: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }],

    // Reference to Cycle documents
    cycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' }],

    // Reference to Member documents
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],

    nextPayout: { type: Date },
    payoutDetails: {
        nextRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cycleNumber: { type: Number },
        payoutAmount: { type: Number, default: 0 },
        midCycleStatus: { type: String, default: "Just Started" }
    },

    settings: {
        contributionFrequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Hourly'], default: 'Weekly' },
        maxMembers: { type: Number, default: 100 },
        backupFundPercentage: { type: Number, default: 10 },
        isPrivate: { type: Boolean, default: false },
        minContribution: { type: Number, default: 30 },
        penalty: { type: Number, default: 10 },
        numMissContribution: { type: Number, default: 3 },
        firstCycleMin: { type: Number, default: 5 },
    },

    positioningMode: { type: String, enum: ['Random', 'Fixed'], default: 'Random' },
    cycleLockEnabled: { type: Boolean, default: false },
    firstCycleMin: { type: Number, default: 5 },
    cycleState: { type: String, enum: ['Active', 'Locked', 'Completed'], default: 'Active' },

    // Reference to CommunityVote documents
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityVote' }],

    owingMembers: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        remainingAmount: { type: Number },
        paidAmount: { type: Number },
        installments: { type: Number }
    }],

    // Reference to CommunityActivityLog documents
    activityLog: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityActivityLog' }],
}, { timestamps: true });

// Post-save hook to check member count and start the first cycle
CommunitySchema.post('save', async function(doc, next) {
    try {
        // Only try to start first cycle if no cycles exist and we have enough members
        if (doc.cycles.length === 0 && doc.members.length >= doc.firstCycleMin) {
            console.log('First cycle conditions met, starting first cycle...');
            const result = await doc.startFirstCycle();
            console.log(result.message); // Log success message for debugging
        }
    } catch (err) {
        console.error('Error in post-save hook for starting first cycle:', err);
        next(err); // Pass the error to Mongoose middleware chain
    } finally {
        next(); // Ensure next middleware is called to avoid hanging
    }
});

// Hook to validate settings update
CommunitySchema.pre('save', function(next) {
    if (this.settings.firstCycleMin < 5) {
        this.settings.firstCycleMin = 5; // Ensure minimum value in settings
    }
    this.firstCycleMin = this.settings.firstCycleMin; // Sync root-level with settings
    next();
});

/**
 * Adds an activity log entry for the community
 * @param {string} activityType - Type of activity being logged
 * @param {ObjectId} userId - ID of the user who performed the activity
 * @returns {Promise} The saved community document
 * 
 * Creates a new CommunityActivityLog document and links it to the community.
 * Activities are tracked with timestamps for audit purposes.
 */
CommunitySchema.methods.addActivityLog = async function(activityType, userId) {
    const activityLog = new CommunityActivityLog({
        communityId: this._id,
        activityType,
        userId,
        timestamp: new Date()
    });
    await activityLog.save();
    this.activityLog.push(activityLog._id);
    return this.save();
};

/**
 * Updates the contributions for a specific mid-cycle
 * @param {Object} midCycle - The mid-cycle to update
 * @param {ObjectId} userId - The contributing user's ID
 * @param {ObjectId} contributionId - The ID of the contribution
 * 
 * Helper function that manages contribution records within a mid-cycle.
 * Either adds a new contribution record or updates existing one.
 */
CommunitySchema.methods.updateContributions = function (midCycle, userId, contributionId) {
    const userContribution = midCycle.contributions.find(c => c.user.equals(userId));
    if (userContribution) {
        userContribution.contributions.push(contributionId);
    } else {
        midCycle.contributions.push({
            user: userId,
            contributions: [contributionId]
        });
    }
};

/**
 * Synchronizes mid-cycles with their parent cycles
 * @returns {Promise} The saved community document
 * 
 * Ensures that each cycle correctly references its associated mid-cycles.
 * Validates mid-cycle references and filters out invalid ones.
 */
CommunitySchema.methods.syncMidCyclesToCycles = async function () {
    try {
        this.cycles.forEach((cycle) => {
            const relatedMidCycles = this.midCycle.filter(mc => mc.cycleNumber === cycle.cycleNumber);
            const validMidCycles = relatedMidCycles.filter(mc => mc && mc._id);

            if (validMidCycles.length !== relatedMidCycles.length) {
                console.warn('Some mid-cycles were invalid and excluded during synchronization.');
            }

            cycle.midCycles = validMidCycles.map(mc => mc._id);
            console.log(`Synchronized mid-cycles for cycle ${cycle.cycleNumber}:`, cycle.midCycles);
        });
        await this.save();
    } catch (err) {
        console.error('Error syncing mid-cycles to cycles:', err);
        throw err;
    }
};

/**
 * Checks if there is an active mid-cycle
 * @returns {boolean} True if there is an active mid-cycle
 * 
 * Determines if any mid-cycle is currently in progress by checking completion status.
 */
CommunitySchema.methods.isMidCycleActive = function () {
    return this.midCycle.some(midCycle => !midCycle.isComplete);
};

/**
 * Updates and validates the firstCycleMin value
 * @param {number} newFirstCycleMin - New minimum value for first cycle
 * @returns {Promise} The saved community document
 * 
 * Ensures the minimum number of members required to start first cycle is valid.
 * Updates both root-level and settings-level values for consistency.
 */
CommunitySchema.methods.syncFirstCycleMin = async function (newFirstCycleMin) {
    // Enforce a minimum of 5
    if (newFirstCycleMin < 5) {
        throw new Error('firstCycleMin cannot be less than 5.');
    }

    // Update both root-level and settings-level values
    this.firstCycleMin = newFirstCycleMin;
    this.settings.firstCycleMin = newFirstCycleMin;

    // Save the updated document
    await this.save();
};

/**
 * Handles wallet operations for defaulting members
 * @param {ObjectId} userId - ID of the defaulting member
 * @param {string} action - Action to take ('freeze' or 'deduct')
 * @returns {Promise<Object>} Result of the wallet operation
 * 
 * Manages penalty enforcement for missed contributions:
 * - Freezes wallet if member has received payout but missed contributions
 * - Deducts penalties from wallet and adds to backup fund
 * - Unfreezes wallet after successful penalty deduction
 */
CommunitySchema.methods.handleWalletForDefaulters = async function (userId, action = 'freeze') {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

        const wallet = await mongoose.model('Wallet').findOne({ userId });
        if (!wallet) throw new Error('Wallet not found.');

        // Check if the member has received a payout
        const receivedPayout = this.midCycle.some(
            (midCycle) => midCycle.nextInLine.userId.equals(userId)
        );

        if (receivedPayout) {
            const totalPenalty = this.settings.penalty * member.missedContributions.length;

            if (action === 'freeze') {
                if (wallet.availableBalance > 0) {
                    wallet.isFrozen = true;
                    await wallet.save();
                }
            } else if (action === 'deduct') {
                await wallet.addTransaction(
                    totalPenalty,
                    'penalty',
                    `Penalty deduction for ${member.missedContributions.length} missed contributions in community ${this.name}`,
                    null,
                    this._id
                );
                member.penalty = 0; // Clear penalty
                wallet.isFrozen = false; // Unfreeze wallet after deduction

                // Add the penalty amount to the community backupFund
                this.backupFund += totalPenalty;
                
                await wallet.save();
            }
        }

        await this.save();
        return { message: `Wallet handled successfully for action: ${action}.` };
    } catch (err) {
        console.error(`Error in handleWalletForDefaulters (${action}):`, err);
        throw err;
    }
};

/**
 * Checks if a cycle is complete
 * @returns {boolean} True if the last cycle is complete
 * 
 * Helper function to determine if the current cycle has ended.
 */
CommunitySchema.methods.isCompleteCycle = function () {
    const lastCycle = this.cycles[this.cycles.length - 1];
    return lastCycle && lastCycle.isComplete;
};

/**
 * Initiates the first cycle of the community
 * @returns {Promise<Object>} Result of starting first cycle
 * 
 * Handles the initialization of the first community cycle:
 * - Validates minimum member requirement
 * - Creates first cycle record
 * - Starts first mid-cycle
 */
CommunitySchema.methods.startFirstCycle = async function () {
    try {
        const Cycle = mongoose.model('Cycle');
        const Member = mongoose.model('Member');

        // Get all cycles for this community
        const existingCycles = await Cycle.find({ communityId: this._id });
        const members = await Member.find({ communityId: this._id });
        console.log(`Existing cycles: ${existingCycles.length}, Members: ${members.length}`);

        // Ensure there are no cycles yet and the minimum required members have joined
        if (existingCycles.length === 0 && members.length >= this.firstCycleMin) {
            // Create first cycle
            const firstCycle = new Cycle({
                communityId: this._id,
                cycleNumber: 1,
                isComplete: false,
                startDate: new Date()
            });
            await firstCycle.save();
            
            // Add the cycle to the community's cycles array and save
            this.cycles.push(firstCycle._id);
            await this.save();
            
            // Update member positions
            await this.updateMemberPositions(members, true);
            
            // Start the first mid-cycle now that the cycle is properly saved and linked
            await this.startMidCycle();

            // Update payout information
            await this.updatePayoutInfo();

            return { message: 'First cycle and its mid-cycle have started successfully.' };
        } else {
            throw new Error('First cycle cannot start due to insufficient members or existing cycles.');
        }
    } catch (err) {
        console.error('Error starting first cycle:', err);
        throw err;
    }
};

/**
 * Starts a new cycle in the community
 * @returns {Promise<Object>} Result of starting new cycle
 * 
 * Manages transition to a new cycle:
 * - Ensures current cycle is complete
 * - Resolves pending votes
 * - Handles member positioning based on community settings
 * - Processes defaulter penalties
 * - Initializes new mid-cycle
 */
CommunitySchema.methods.startNewCycle = async function () {
    try {
        const Cycle = mongoose.model('Cycle');
        const Member = mongoose.model('Member');
        const CommunityVote = mongoose.model('CommunityVote');
        const Wallet = mongoose.model('Wallet');

        // Ensure the current cycle is complete
        const activeCycle = await Cycle.findOne({ 
            communityId: this._id,
            isComplete: false 
        });
        if (activeCycle) {
            throw new Error('Cannot start a new cycle until the current cycle is complete.');
        }

        // Get the last cycle number
        const lastCycle = await Cycle.findOne({ communityId: this._id })
            .sort({ cycleNumber: -1 });
        const newCycleNumber = (lastCycle?.cycleNumber || 0) + 1;

        // Get all active members
        const members = await Member.find({ 
            communityId: this._id,
            status: 'active'
        });

        // Handle unresolved votes
        const unresolvedVotes = await CommunityVote.find({
            communityId: this._id,
            resolved: false
        });
        for (const vote of unresolvedVotes) {
            await this.resolveVote(vote._id);
        }
        await this.applyResolvedVotes();

        // Update member positions for the new cycle
        await this.updateMemberPositions(members, false);

        // Create new cycle
        const newCycle = new Cycle({
            communityId: this._id,
            cycleNumber: newCycleNumber,
            isComplete: false,
            startDate: new Date()
        });
        await newCycle.save();

        // Handle defaulters' wallets
        for (const member of members) {
            if (member.missedContributions.length > 0 || member.penalty > 0) {
                const wallet = await Wallet.findOne({ userId: member.userId });
                if (wallet) {
                    await this.handleWalletForDefaulters(member.userId, 'deduct');
                }
            }
        }

        // Start first mid-cycle and update payout info
        await this.startMidCycle();
        await this.updatePayoutInfo();

        return { message: `Cycle ${newCycleNumber} started successfully.` };
    } catch (err) {
        console.error('Error starting new cycle:', err);
        throw err;
    }
};

/**
 * Starts a new mid-cycle within the current cycle
 * @returns {Promise<Object>} The created mid-cycle
 * 
 * Creates and initializes a new mid-cycle:
 * - Identifies next eligible recipient
 * - Sets up contribution tracking
 * - Updates community payout details
 * - Links mid-cycle to parent cycle
 */
CommunitySchema.methods.startMidCycle = async function () {
    try {
        const activeCycle = await Cycle.findOne({ _id: { $in: this.cycles }, isComplete: false });
        if (!activeCycle) throw new Error('No active cycle found.');

        const activeMembers = await Member.find({ 
            _id: { $in: this.members },
            status: 'active',
            position: { $ne: null }
        }).sort('position');

        const nextInLine = await Member.findOne({
            _id: { $in: this.members },
            userId: { $nin: activeCycle.paidMembers }
        });

        if (!nextInLine) {
            throw new Error('No eligible member found for payout.');
        }

        const newMidCycle = new MidCycle({
            cycleNumber: activeCycle.cycleNumber,
            nextInLine: { userId: nextInLine.userId },
            contributions: [],
            isComplete: false,
            isReady: false,
            payoutAmount: 0,
            contributionsToNextInLine: new Map(),
            payoutDate: calculateNextPayoutDate(this.settings.contributionFrequency)
        });

        await newMidCycle.save();
        
        // Add the new midcycle to both arrays
        this.midCycle.push(newMidCycle._id);
        activeCycle.midCycles.push(newMidCycle._id);
        
        await activeCycle.save();
        await this.updatePayoutInfo();

        this.markModified('midCycle');
        await this.save();

        await this.addActivityLog('start_mid_cycle', this.admin);

        return { message: 'Mid-cycle started successfully.', midCycle: newMidCycle };
    } catch (err) {
        console.error('Error starting mid-cycle:', err);
        throw err;
    }
};

/**
 * Adds a new member during an active mid-cycle
 * @param {ObjectId} userId - ID of new member
 * @param {string} name - Name of new member
 * @param {string} email - Email of new member
 * @param {number} contributionAmount - Initial contribution amount
 * @returns {Promise<Object>} Result of adding new member
 * 
 * Handles mid-cycle member addition with catch-up payments:
 * - Calculates required contribution based on missed cycles
 * - Manages payment plan setup
 * - Updates member status and records
 * - Processes initial contribution
 */
CommunitySchema.methods.addNewMemberMidCycle = async function (userId, name, email, contributionAmount) {
    try {
        const Cycle = mongoose.model('Cycle');
        const MidCycle = mongoose.model('MidCycle');
        const Member = mongoose.model('Member');
        const Wallet = mongoose.model('Wallet');

        // Find the active cycle
        const activeCycle = await Cycle.findOne({
            communityId: this._id,
            isComplete: false
        });
        if (!activeCycle) throw new Error('No active cycle found.');

        // Find the active mid-cycle
        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            cycleNumber: activeCycle.cycleNumber,
            isComplete: false
        });
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        // Get current members count for position calculation
        const currentMembers = await Member.find({ communityId: this._id });
        const missedCycles = activeCycle.paidMembers ? activeCycle.paidMembers.length : 0;
        const totalAmount = (missedCycles + 1) * this.settings.minContribution;

        // Calculate required contribution
        let requiredContribution;
        if (missedCycles <= Math.floor(currentMembers.length / 2)) {
            requiredContribution = this.settings.minContribution + totalAmount * 0.5;
        } else {
            const missedPercentage = missedCycles / currentMembers.length;
            requiredContribution = missedPercentage * totalAmount;
        }

        // Validate contribution amount
        if (contributionAmount < requiredContribution) {
            throw new Error(
                `Insufficient contribution. You must contribute at least €${requiredContribution.toFixed(2)} to join mid-cycle.`
            );
        }

        // Calculate backup fund
        const backupFund = (this.settings.backupFundPercentage / 100) * contributionAmount;
        this.backupFund += backupFund;

        // Handle wallet transaction
        const wallet = await Wallet.findOne({ userId });
        if (!wallet) throw new Error('Wallet not found.');

        const remainingAmount = contributionAmount - this.settings.minContribution;
        if (wallet.availableBalance < remainingAmount) {
            throw new Error('Insufficient wallet balance for the contribution.');
        }

        await wallet.addTransaction(
            remainingAmount,
            'contribution',
            `Contribution to community ${this.name}`,
            null,
            this._id
        );

        // Create new member
        const newMember = new Member({
            communityId: this._id,
            userId,
            name,
            email,
            status: 'active',
            penalty: 0,
            missedContributions: [],
            paymentPlan: {
                type: 'Incremental',
                totalPreviousContribution: this.settings.minContribution * missedCycles,
                remainingAmount: (totalAmount - this.settings.minContribution) - (contributionAmount - this.settings.minContribution),
                previousContribution: contributionAmount - this.settings.minContribution,
                installments: 1
            }
        });

        // Save the new member
        await newMember.save();

        // Update member positions
        const allMembers = [...currentMembers, newMember];
        await this.updateMemberPositions(allMembers, false);

        // Update mid-cycle joiners
        activeMidCycle.midCycleJoiners.push({
            joiners: userId,
            paidMembers: activeCycle.paidMembers || []
        });
        await activeMidCycle.save();

        // Handle owing members tracking
        if (newMember.paymentPlan.remainingAmount > 0) {
            this.owingMembers.push({
                userId: newMember.userId,
                userName: newMember.name,
                remainingAmount: newMember.paymentPlan.remainingAmount,
                paidAmount: contributionAmount - this.settings.minContribution,
                installments: newMember.paymentPlan.installments
            });
        }

        // Create contribution
        const Contribution = mongoose.model('Contribution');
        await Contribution.createContribution(userId, this._id, this.settings.minContribution, activeMidCycle._id);

        // Save community changes
        await this.save();

        return { message: 'Member successfully added during mid-cycle.' };
    } catch (err) {
        throw new Error(`Failed to add new member mid-cycle: ${err.message}`);
    }
};

/**
 * Validates contributions and mid-cycle readiness
 * @returns {Promise<Object>} Validation result
 * 
 * Checks if all required contributions are made:
 * - Verifies active members have contributed
 * - Updates mid-cycle ready status
 * - Links mid-cycle to parent cycle
 */
CommunitySchema.methods.validateMidCycleAndContributions = async function () {
    try {
        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            isComplete: false
        });
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        const activeCycle = await Cycle.findOne({
            _id: { $in: this.cycles },
            isComplete: false
        });
        if (!activeCycle) throw new Error('No active cycle found.');

        if (!activeCycle.midCycles.includes(activeMidCycle._id)) {
            activeCycle.midCycles.push(activeMidCycle._id);
            await activeCycle.save();
        }

        const eligibleMembers = await Member.find({
            _id: { $in: this.members },
            status: 'active'
        });

        const allContributed = await Promise.all(eligibleMembers.map(async (member) => {
            const hasContributed = activeMidCycle.contributions.some(c => 
                c.user.equals(member.userId) && c.contributions.length > 0
            );
            return hasContributed;
        }));

        activeMidCycle.isReady = allContributed.every(contributed => contributed);
        await activeMidCycle.save();

        if (activeMidCycle.isReady) {
            await this.addActivityLog('mid_cycle_ready', this.admin);
        }

        this.markModified('midCycle');
        await this.save();

        return {
            message: activeMidCycle.isReady
                ? 'Mid-cycle is validated and ready for payout.'
                : 'Mid-cycle validated. Waiting for remaining contributions.',
            isReady: activeMidCycle.isReady,
        };
    } catch (err) {
        console.error('Error validating mid-cycle and contributions:', err);
        throw err;
    }
};

/**
 * Creates a new community vote
 * @param {string} topic - Vote topic
 * @param {string[]} options - Available voting options
 * @returns {Promise<Object>} Created vote
 * 
 * Initializes a new vote in the community:
 * - Creates CommunityVote document
 * - Links vote to community
 * - Sets up vote tracking
 */
CommunitySchema.methods.createVote = async function (topic, options) {
    try {
        const vote = new CommunityVote({
            communityId: this._id,
            topic,
            options,
            votes: [],
            numVotes: 0,
            resolved: false,
            resolution: null,
        });
        await vote.save();
        this.votes.push(vote._id);
        await this.save();
        await this.addActivityLog('vote_created', this.admin);
        return { message: 'Vote created successfully.', vote };
    } catch (err) {
        console.error('Error creating vote:', err);
        throw err;
    }
};

/**
 * Records a member's vote
 * @param {ObjectId} voteId - ID of the vote
 * @param {ObjectId} userId - ID of voting member
 * @param {string} choice - Selected option
 * @returns {Promise<Object>} Updated vote
 * 
 * Processes a member's vote:
 * - Updates or creates vote record
 * - Updates vote counts
 * - Logs voting activity
 */
CommunitySchema.methods.castVote = async function (voteId, userId, choice) {
    try {
        const vote = await CommunityVote.findById(voteId);
        if (!vote) throw new Error('Vote not found.');

        const existingVote = vote.votes.find(v => v.userId.equals(userId));
        if (existingVote) {
            existingVote.choice = choice;
        } else {
            vote.votes.push({ userId, choice });
        }

        vote.numVotes = vote.votes.length;
        await vote.save();
        await this.addActivityLog('vote_cast', userId);
        return { message: 'Vote cast successfully.', vote };
    } catch (err) {
        console.error('Error casting vote:', err);
        throw err;
    }
};

/**
 * Resolves a completed vote
 * @param {ObjectId} voteId - ID of vote to resolve
 * @returns {Promise<Object>} Resolution result
 * 
 * Finalizes a community vote:
 * - Tallies votes
 * - Determines winning option
 * - Marks vote as resolved
 */
CommunitySchema.methods.resolveVote = async function (voteId) {
    try {
        const vote = await CommunityVote.findById(voteId);
        if (!vote) throw new Error('Vote not found.');

        const voteCounts = vote.votes.reduce((acc, v) => {
            acc[v.choice] = (acc[v.choice] || 0) + 1;
            return acc;
        }, {});

        const resolution = Object.keys(voteCounts).reduce((a, b) => (voteCounts[a] > voteCounts[b] ? a : b));
        vote.resolved = true;
        vote.resolution = resolution;

        await vote.save();
        await this.addActivityLog('vote_resolved', this.admin);
        return { message: 'Vote resolved successfully.', vote };
    } catch (err) {
        console.error('Error resolving vote:', err);
        throw err;
    }
};

/**
 * Applies resolved vote outcomes
 * @returns {Promise<Object>} Result of applying votes
 * 
 * Implements vote decisions:
 * - Updates community settings based on vote results
 * - Handles different vote types (positioning, payouts, etc.)
 * - Marks votes as applied
 */
CommunitySchema.methods.applyResolvedVotes = async function () {
    try {
        const resolvedVotes = await CommunityVote.find({
            _id: { $in: this.votes },
            resolved: true,
            applied: false
        });

        for (const vote of resolvedVotes) {
            if (vote.topic === 'positioningMode') {
                this.positioningMode = vote.resolution;
            } else if (vote.topic === 'lockPayout') {
                this.lockPayout = vote.resolution === 'true' || vote.resolution === true;
            } else if (vote.topic === 'paymentPlan') {
                await Member.updateMany(
                    { _id: { $in: this.members } },
                    { 'paymentPlan.type': vote.resolution }
                );
            } else if (vote.topic === 'backupFundPercentage') {
                this.settings.backupFundPercentage = vote.resolution;
            } else if (vote.topic === 'minContribution') {
                this.settings.minContribution = vote.resolution;
            }

            vote.applied = true;
            await vote.save();
        }

        await this.save();
        await this.addActivityLog('resolved_votes_applied', this.admin);
        return { message: 'Resolved votes applied successfully.' };
    } catch (err) {
        console.error('Error applying resolved votes:', err);
        throw err;
    }
};

/**
 * Processes payout distribution
 * @returns {Promise<Object>} Payout result
 * 
 * Manages the complete payout process:
 * - Validates mid-cycle readiness
 * - Calculates net payout after penalties
 * - Handles defaulter cases
 * - Updates wallet balances
 * - Records payout transaction
 * - Starts next mid-cycle or cycle
 */
CommunitySchema.methods.distributePayouts = async function () {
    try {
        // Find the active mid-cycle that is ready for payout distribution
        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            isReady: true,
            isComplete: false
        });
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle ready for distribution found.');
        }

        // Get the next recipient
        const nextRecipientId = activeMidCycle.nextInLine.userId;
        const recipient = await Member.findOne({
            _id: { $in: this.members },
            userId: nextRecipientId
        });
        if (!recipient) {
            throw new Error('Next-in-line recipient not found in community members.');
        }

        const payoutAmount = activeMidCycle.payoutAmount;
        if (payoutAmount <= 0) {
            throw new Error('Invalid payout amount.');
        }

        let netPayout = payoutAmount;

        if (recipient.status !== 'active') {
            this.backupFund += payoutAmount;
            console.log(`Recipient ${recipient.name} is inactive. Payout amount €${payoutAmount} added to backup fund.`);
            netPayout = 0;
        } else {
            let penaltyTotal = recipient.penalty || 0;
            let missedTotal = 0;
            if (recipient.missedContributions && recipient.missedContributions.length > 0) {
                missedTotal = recipient.missedContributions.reduce((sum, mc) => sum + (mc.amount || 0), 0);
            }
            penaltyTotal += missedTotal;

            if (penaltyTotal > 0) {
                if (payoutAmount >= penaltyTotal) {
                    netPayout = payoutAmount - penaltyTotal;
                    this.backupFund += penaltyTotal;
                    recipient.penalty = 0;
                    recipient.missedContributions = [];
                    await recipient.save();
                } else {
                    this.backupFund += payoutAmount;
                    const outstanding = penaltyTotal - payoutAmount;
                    netPayout = 0;
                    const User = mongoose.model('User');
                    const userDoc = await User.findById(recipient.userId);
                    if (userDoc && userDoc.addNotification) {
                        await userDoc.addNotification(
                            `Your payout of €${payoutAmount} was insufficient to cover your penalty. You still owe €${outstanding.toFixed(2)}.`
                        );
                    }
                    recipient.penalty = outstanding;
                    recipient.missedContributions = [];
                    await recipient.save();
                }
            }
        }

        if (netPayout > 0) {
            const Wallet = mongoose.model('Wallet');
            const recipientWallet = await Wallet.findOne({ userId: nextRecipientId });
            if (!recipientWallet) {
                throw new Error('Recipient wallet not found.');
            }

            await Payout.createPayout(
                this._id,
                nextRecipientId,
                netPayout
            );

            await recipientWallet.addTransaction(
                netPayout,
                'payout',
                `Payout from community "${this.name}" mid-cycle.`,
                null,
                this._id
            );
            
            // Update the total distributed amount
            this.totalDistributed = (this.totalDistributed || 0) + netPayout;
        }

        activeMidCycle.isComplete = true;
        await activeMidCycle.save();

        const activeCycle = await Cycle.findOne({ _id: { $in: this.cycles }, isComplete: false });
        if (activeCycle && recipient.status === 'active' && !activeCycle.paidMembers.includes(nextRecipientId)) {
            activeCycle.paidMembers.push(nextRecipientId);
            await activeCycle.save();
        }

        const activeMembers = await Member.find({ 
            _id: { $in: this.members }, 
            status: 'active' 
        });
        const allPaid = activeMembers.every(member => 
            activeCycle.paidMembers.includes(member.userId)
        );

        if (allPaid) {
            activeCycle.isComplete = true;
            activeCycle.endDate = new Date();
            await activeCycle.save();
            const newCycleResult = await this.startNewCycle();
            console.log(newCycleResult.message);
        } else {
            const newMidCycleResult = await this.startMidCycle();
            await this.updatePayoutInfo();
            this.nextPayout = calculateNextPayoutDate(this.settings.contributionFrequency);
            console.log('New mid-cycle started:', newMidCycleResult.message);
        }

        await this.addActivityLog('payout_distributed', recipient.userId);

        return {
            message: `Payout processed. Net payout of €${netPayout} was ${
                recipient.status === 'active' ? 'distributed' : 'added to backup fund'
            }.`
        };
    } catch (err) {
        console.error('Error distributing payouts:', err);
        throw err;
    }
};

/**
 * Updates member payment plan progress
 * @param {ObjectId} userId - ID of member
 * @param {number} remainder - Remaining amount to pay
 * @returns {Promise<Object>} Update result
 * 
 * Manages incremental payments and payment plans:
 * - Updates remaining amounts
 * - Tracks installment progress
 * - Updates owing members records
 * - Distributes catch-up payments to previous recipients
 */
CommunitySchema.methods.memberUpdate = async function (userId, remainder = 0) {
    try {
        const member = await Member.findOne({
            _id: { $in: this.members },
            userId: userId
        });
        
        if (!member) {
            throw new Error('Member not found.');
        }

        if (member.paymentPlan.remainingAmount !== 0) {
            member.paymentPlan.remainingAmount -= remainder;
            member.paymentPlan.previousContribution += remainder;
            member.paymentPlan.installments += 1;

            const owingMember = this.owingMembers.find(m => m.userId.equals(userId));
            if (owingMember) {
                owingMember.remainingAmount = member.paymentPlan.remainingAmount;
                owingMember.installments = member.paymentPlan.installments;
            } else {
                this.owingMembers.push({
                    userId: member.userId,
                    userName: member.name,
                    remainingAmount: member.paymentPlan.remainingAmount,
                    installments: member.paymentPlan.installments
                });
            }
        }

        if (member.paymentPlan.remainingAmount === 0) {
            const activeMidCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                'midCycleJoiners.joiners': userId
            });

            if (activeMidCycle) {
                const joinerEntry = activeMidCycle.midCycleJoiners.find(joiner => 
                    joiner.joiners.equals(userId)
                );

                if (joinerEntry) {
                    const paidMembers = joinerEntry.paidMembers;
                    const relatedMidCycles = await MidCycle.find({
                        _id: { $in: this.midCycle },
                        'nextInLine.userId': { $in: paidMembers }
                    });

                    for (const relatedMidCycle of relatedMidCycles) {
                        if (!relatedMidCycle.contributionsToNextInLine) {
                            relatedMidCycle.contributionsToNextInLine = new Map();
                        }
                        const currentAmount = relatedMidCycle.contributionsToNextInLine.get(userId.toString()) || 0;
                        relatedMidCycle.contributionsToNextInLine.set(
                            userId.toString(),
                            currentAmount + (member.paymentPlan.previousContribution / paidMembers.length)
                        );
                        await relatedMidCycle.save();
                    }
                }
            }
        }

        await member.save();
        await this.save();
        await this.addActivityLog('member_update', userId);

        return {
            message: 'Member update successful.',
            member
        };
    } catch (err) {
        console.error('Error in memberUpdate:', err);
        throw err;
    }
};

/**
 * Updates the payout information for the community
 * @returns {Promise<void>}
 */
CommunitySchema.methods.updatePayoutInfo = async function () {
    try {
        const Cycle = mongoose.model('Cycle');
        const MidCycle = mongoose.model('MidCycle');
        const Member = mongoose.model('Member');

        // Get the active cycle and mid-cycle using their models
        const activeCycle = await Cycle.findOne({
            _id: { $in: this.cycles },
            isComplete: false
        });

        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            isComplete: false
        }).populate('nextInLine.userId');

        let nextRecipient = null;
        let payoutAmount = 0;
        let payoutDate = null;

        if (activeMidCycle) {
            // If there is an active mid-cycle, use its details for payout
            nextRecipient = activeMidCycle.nextInLine?.userId?._id;
            payoutAmount = activeMidCycle.payoutAmount || 0;
            payoutDate = activeMidCycle.payoutDate || calculateNextPayoutDate(this.settings.contributionFrequency);

            // Validate next recipient
            if (!nextRecipient) {
                console.warn('No next-in-line user for payout.');
            }

            // Verify recipient is still an active member
            if (nextRecipient) {
                const member = await Member.findOne({
                    _id: { $in: this.members },
                    userId: nextRecipient,
                    status: 'active'
                });
                if (!member) {
                    nextRecipient = null;
                    console.warn('Next recipient is no longer an active member.');
                }
            }
        }

        // Determine mid-cycle status based on active mid-cycle and cycle details
        const midCycleStatus = activeMidCycle
            ? activeMidCycle.isReady
                ? "Ready for Payout"
                : `In Progress, Length => ${this.midCycle.length}`
            : activeCycle
                ? "Cycle In Progress"
                : "No Active Cycle";

        // Update payout details
        this.payoutDetails = {
            nextRecipient,
            cycleNumber: activeCycle?.cycleNumber || 0,
            payoutAmount,
            midCycleStatus
        };

        // Update next payout date if applicable
        this.nextPayout = payoutDate;

        // If a recipient exists, update their payout information
        if (nextRecipient) {
            const User = mongoose.model('User');
            const recipient = await User.findById(nextRecipient);
            if (recipient) {
                await recipient.updateUserPayouts(this);
            }
        }

        // Save the updated community state
        await this.save();
        console.log('Payout info updated successfully:', this.payoutDetails);
    } catch (err) {
        console.error('Error updating payout info:', err);
        throw err;
    }
};

/**
 * Starts monitoring payouts for this community
 * Checks for ready payouts every minute and processes them automatically
 */
CommunitySchema.methods.paySecondInstallment = async function (userId) {
};


CommunitySchema.methods.startPayoutMonitor = function () {
  const checkInterval = 60 * 1000; // Check every minute
  const Community = mongoose.model('Community');

  setInterval(async () => {
    try {
      // Get a fresh instance of the community document.
      const freshCommunity = await Community.findById(this._id);
      if (!freshCommunity) return;

      const activeMidCycle = freshCommunity.midCycle.find(mc => !mc.isComplete);
      if (!activeMidCycle || !activeMidCycle.payoutDate) return;

      const now = new Date();
      if (now >= new Date(activeMidCycle.payoutDate)) {
        console.log(`Processing payout for midCycle ${activeMidCycle._id}`);
        
        // If the mid-cycle isn’t ready, update its status.
        if (!activeMidCycle.isReady) {
          await freshCommunity.handleUnreadyMidCycle();
        }
        
        // Distribute payouts.
        await freshCommunity.distributePayouts();
        console.log(`Payout successful for midCycle ${activeMidCycle._id}`);
        
        // Save all updates at once.
        await freshCommunity.save();
      }
    } catch (err) {
      console.error('Payout monitor error:', err);
    }
  }, checkInterval);
};


CommunitySchema.methods.payPenaltyAndMissedContribution = async function (userId, amount) {
  try {
    // Find the member by userId
    const member = this.members.find(m => m.userId.equals(userId));
    if (!member) throw new Error('Member not found.');
    if (member.status === 'Inactive') throw new Error('Member is Inactive. Reactivate.');

    const penaltyAmount = member.penalty;
    // The amount intended to cover missed contributions (after penalty is removed)
    const contributionAmount = amount - penaltyAmount;

    // Calculate the total penalty based on missed contributions
    const totalPenalty = penaltyAmount + member.missedContributions.reduce((sum, mc) => sum + mc.amount, 0);

    // Check if the provided amount exactly matches the required total penalty
    if (amount !== totalPenalty) {
      throw new Error(`Incorrect amount. You must pay exactly €${totalPenalty.toFixed(2)}.`);
    }

    // Process the penalty payment: record the transaction in the user's wallet
    const Wallet = mongoose.model('Wallet');
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found.');

    await wallet.addTransaction(
      amount,
      'penalty',
      `Payment for penalty and missed contributions in community ${this.name}`,
      null,
      this._id
    );

    // For each missed contribution, create a new Contribution document in its corresponding midCycle
    for (const mc of member.missedContributions) {
      // We assume mc.midCycles is an array of midCycle IDs; here we take the first one
      const midCycle = this.midCycle.id(mc.midCycles[0]);
      if (midCycle) {
        const newContribution = new Contribution({
          communityId: this._id,
          userId,
          amount: contributionAmount,
          midCycleId: midCycle._id,
          cycleNumber: midCycle.cycleNumber,
          status: 'completed',
          date: new Date(),
          penalty: 0,
          missedReason: null,
          paymentPlan: { type: 'Full', remainingAmount: 0, installments: 0 }
        });
        const savedContribution = await newContribution.save();

        const User = mongoose.model('User');
        const user = await User.findById(userId);
        await user.addContribution(savedContribution._id, savedContribution.amount);
        await user.handlePenalty(0, 'remove', 'Account reactivation', this._id);

        // Add the new Contribution _id to the midCycle's contributions array
        let userContribution = midCycle.contributions.find(c => c.user.equals(userId));
        if (userContribution) {
          userContribution.contributions.push(savedContribution._id);
        } else {
          midCycle.contributions.push({
            user: userId,
            contributions: [savedContribution._id]
          });
        }

        // Update the contributionsToNextInLine map with the missed contribution amount
        const currentTotal = midCycle.contributionsToNextInLine.get(userId.toString()) || 0;
        midCycle.contributionsToNextInLine.set(userId.toString(), currentTotal + mc.amount);
      }
    }

    // Calculate backup deduction and net distribution
    const backupDeduction = (this.settings.backupFundPercentage / 100) * contributionAmount;
    const netDistribution = contributionAmount - backupDeduction;
    // Update the community's backupFund
    this.backupFund += backupDeduction;

    // Retrieve nextInLine user IDs only from the midCycles referenced in the member's missedContributions
    let nextInLineIds = [];
    for (const missedContrib of member.missedContributions) {
      // Assume missedContrib.midCycles is an array of midCycle IDs
      for (const midCycleId of missedContrib.midCycles) {
        const midCycleObj = this.midCycle.id(midCycleId);
        if (midCycleObj && midCycleObj.nextInLine && midCycleObj.nextInLine.userId) {
          nextInLineIds.push(midCycleObj.nextInLine.userId.toString());
        }
      }
    }
    const uniqueNextInLineIds = [...new Set(nextInLineIds)];

    // Distribute the net distribution equally among each nextInLine's wallet
    if (uniqueNextInLineIds.length > 0) {
      const amountPerPerson = netDistribution / uniqueNextInLineIds.length;
      for (const nextUserId of uniqueNextInLineIds) {
        const nextWallet = await Wallet.findOne({ userId: nextUserId });
        if (!nextWallet) {
          console.warn(`Wallet not found for user ID: ${nextUserId}`);
          continue;
        }
        await nextWallet.addTransaction(
          amountPerPerson,
          'deposit',
          `Distribution from penalty/missed contribution payment in community ${this.name}`,
          nextUserId,
          this._id
        );
      }
    }

    // Reset the member's penalty and missed contributions
    member.penalty = 0;
    member.missedContributions = [];

    await this.save();
    return { message: 'Penalty and missed contributions paid and distributed successfully.' };
  } catch (err) {
    console.error('Error in payPenaltyAndMissedContribution:', err);
    throw err;
  }
};



CommunitySchema.methods.paySecondInstallment = async function (userId) {
  try {
      const owingMember = this.owingMembers.find(m => m.userId.equals(userId));
      if (!owingMember) throw new Error('Owing member not found.');
      let remainingAmount = owingMember.remainingAmount;
      console.log(`remainingAmount: ${remainingAmount}`);
      if (owingMember.remainingAmount > 0 && owingMember.installments === 1) {
          // Get the user's wallet
          const Wallet = mongoose.model('Wallet');
          const wallet = await Wallet.findOne({ userId });
          if (!wallet) throw new Error('Wallet not found.');

          // Check if the wallet has sufficient balance
          if (wallet.availableBalance < remainingAmount) {
              throw new Error('Insufficient wallet balance for the second installment.');
          }

          // Deduct the amount from the wallet
          await wallet.addTransaction(
              remainingAmount,
              'contribution',
              `Second installment payment for community ${this.name}`,
              null,
              this._id
          );

          owingMember.remainingAmount = 0;
          owingMember.installments = 2;

          await this.memberUpdate(userId, remainingAmount);

          // Remove the user from owingMembers
          this.owingMembers = this.owingMembers.filter(m => !m.userId.equals(userId));
          const backupFund = (this.settings.backupFundPercentage / 100) * remainingAmount;
          this.backupFund += backupFund;


          // Get the user midCycleJoiners object and update the isComplete field to true
          const midCycle = this.midCycle.find(mc => 
              mc.midCycleJoiners.some(joiner => joiner.joiners.equals(userId))
          );
          if (midCycle) {
              const joinerEntry = midCycle.midCycleJoiners.find(joiner => joiner.joiners.equals(userId));
              if (joinerEntry) {
                  joinerEntry.isComplete = true;
              }
          }

          await this.save();

          return { message: 'Second installment paid successfully.' };
      } else {
          return { message: 'No second installment due or already paid.' };
      }
  } catch (err) {
      console.error('Error in paySecondInstallment:', err);
      throw err;
  }
};


  CommunitySchema.methods.payPenaltyAndMissedContribution = async function (userId, amount) {
  };
  
/**
 * Stops the payout monitor for this community
 */
CommunitySchema.methods.stopPayoutMonitor = function() {
    if (this._payoutMonitorInterval) {
        clearInterval(this._payoutMonitorInterval);
        this._payoutMonitorInterval = null;
    }
};

/**
 * Records a contribution in the community
 */
CommunitySchema.methods.record = async function (contribution) {
    let retries = 3;
    while (retries-- > 0) {
        try {
            const { contributorId, recipientId, amount, contributionId } = contribution;

            const activeMidCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                isComplete: false
            });

            if (!contributorId || !recipientId || !contributionId) {
                throw new Error('Contributor ID, Recipient ID, and Contribution ID are required.');
            }
            if (!amount || amount <= 0) {
                throw new Error('Contribution amount must be greater than zero.');
            }
            if (!activeMidCycle) {
                throw new Error('No active mid-cycle found.');
            }

            if (!activeMidCycle.contributions) {
                activeMidCycle.contributions = [];
            }
            if (!activeMidCycle.contributionsToNextInLine) {
                activeMidCycle.contributionsToNextInLine = new Map();
            }

            let userContribution = activeMidCycle.contributions.find(c => c.user.equals(contributorId));
            if (userContribution) {
                userContribution.contributions.push(contributionId);
            } else {
                activeMidCycle.contributions.push({
                    user: contributorId,
                    contributions: [contributionId]
                });
            }

            const currentTotal = activeMidCycle.contributionsToNextInLine.get(contributorId.toString()) || 0;
            activeMidCycle.contributionsToNextInLine.set(contributorId.toString(), currentTotal + amount);

            // Calculate total amount from contributions array
            const midCycleTotalAmount = activeMidCycle.contributions.reduce((total, contrib) => {
                return total + (contrib.contributions.length * this.settings.minContribution);
            }, 0);

            const midCycleBackupFund = (this.settings.backupFundPercentage / 100) * midCycleTotalAmount;

            this.backupFund += midCycleBackupFund;
            this.totalContribution += amount;
            activeMidCycle.payoutAmount = midCycleTotalAmount - midCycleBackupFund;

            await activeMidCycle.save();
            const validationResult = await this.validateMidCycleAndContributions();
            await this.updatePayoutInfo();

            this.markModified('midCycle');
            await this.save();

            return {
                message: 'Contribution recorded successfully.',
                totalContribution: this.totalContribution,
                backupFund: this.backupFund,
                midCycleBackupFund,
                validationMessage: validationResult.message,
                isMidCycleReady: activeMidCycle.isReady,
            };
        } catch (err) {
            if (err.name === 'VersionError' && retries > 0) {
                console.log(`Retrying record operation (${retries} retries left)`);
                continue;
            }
            console.error('Error in record method:', err);
            throw err;
        }
    }
};

/**
 * Reactivates an inactive member
 */
CommunitySchema.methods.reactivateMember = async function (userId, contributionAmount) {
    try {
        const member = await Member.findOne({
            _id: { $in: this.members },
            userId: userId,
            status: 'inactive'
        });
        if (!member) throw new Error('Member not found or is already active.');

        const requiredContribution = this.settings.minContribution +
            (this.settings.penalty * this.settings.numMissContribution);
        if (contributionAmount < requiredContribution) {
            throw new Error(`Insufficient contribution. You must pay at least €${requiredContribution.toFixed(2)} to reactivate your membership.`);
        }

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) throw new Error('Wallet not found.');

        await wallet.addTransaction(
            contributionAmount,
            'contribution',
            `Membership reactivation for community ${this.name}`,
            null,
            this._id
        );

        this.backupFund += contributionAmount;
        member.status = 'active';
        member.penalty = 0;
        member.missedContributions = [];

        await member.save();
        await this.save();
        await this.addActivityLog('member_reactivated', userId);

        return { message: 'Membership reactivated successfully!' };
    } catch (err) {
        console.error('Error reactivating member:', err);
        throw err;
    }
};

/**
 * Calculates total amount owed by a user
 */
CommunitySchema.methods.calculateTotalOwed = function (userId) {
    try {
        const defaulterMidCycles = this.midCycle.filter(midCycle => 
            midCycle.nextInLine.userId.equals(userId)
        );

        if (!defaulterMidCycles || defaulterMidCycles.length === 0) {
            throw new Error('No payout records found for this user.');
        }

        let totalOwed = 0;
        defaulterMidCycles.forEach(midCycle => {
            const totalContributions = this.members.length * this.settings.minContribution;
            const backupDeduction = totalContributions * (this.settings.backupFundPercentage / 100);
            const payoutReceived = totalContributions - backupDeduction;
            const minContributionPaid = this.settings.minContribution -
                (this.settings.minContribution * (this.settings.backupFundPercentage / 100));
            totalOwed += payoutReceived - minContributionPaid;
        });

        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found in the community.');

        const penaltyAmount = this.settings.penalty * member.missedContributions.length;
        totalOwed += penaltyAmount;

        return totalOwed;
    } catch (err) {
        console.error('Error calculating total owed:', err);
        throw err;
    }
};

/**
 * Checks if a member has outstanding payments
 * @param {ObjectId} userId - ID of member to check
 * @returns {Promise<boolean>} True if member has outstanding payments
 */
CommunitySchema.methods.isMemberOwing = async function(userId) {
    try {
        // Check owingMembers array first
        const owingMember = this.owingMembers.find(m => m.userId.equals(userId));
        if (owingMember && owingMember.remainingAmount > 0) {
            return true;
        }

        // Check member's payment plan
        const member = await Member.findOne({
            _id: { $in: this.members },
            userId: userId
        });
        
        if (!member) {
            throw new Error('Member not found');
        }

        return member.paymentPlan.remainingAmount > 0;
    } catch (err) {
        console.error('Error checking if member is owing:', err);
        throw err;
    }
};

/**
 * Checks and calculates payment amounts for next-in-line members
 */
CommunitySchema.methods.payNextInLine = async function(contributorId, midCycleId, contributionAmount) {
    try {
        // Find the active cycle
        const activeCycle = await Cycle.findOne({ 
            _id: { $in: this.cycles }, 
            isComplete: false 
        });
        if (!activeCycle) {
            throw new Error('No active cycle found.');
        }

        // Populate all necessary references
        await this.populate([
            { path: 'midCycle' },
            { path: 'cycles' }
        ]);

        // Find the mid-cycle with the given midCycleId
        const midCycle = await MidCycle.findOne({
            _id: midCycleId,
            _id: { $in: this.midCycle }
        });

        if (!midCycle) {
            throw new Error('MidCycle not found or does not belong to the active cycle.');
        }

        console.log('MidCycle:', midCycle._id, "MidCycle CycleNumber: ", midCycle.cycleNumber);

        // Retrieve the user ID of the current next in line
        const nextInLineId = midCycle.nextInLine?.userId;
        console.log('NextInLine ID:', nextInLineId);
        if (!nextInLineId) {
            throw new Error('No next in line found.');
        }

        // Handle the case where the contributor is the nextInLine
        if (contributorId.toString() === nextInLineId.toString()) {
            return {
                message: `The contributor is the next in line and cannot owe themselves.`,
                amountToDeduct: 0,
            };
        }

        let totalAmountOwed = 0;

        // Check if the contributor was previously a nextInLine and received payment from the current nextInLine
        if (this.cycles.some((cycle) => cycle.paidMembers.includes(contributorId))) {
            // Find the mid-cycle where the contributor was the next in line
            console.log('Checking previous mid-cycles for contributor payments...');
            const previousMidCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                'nextInLine.userId': contributorId,
                cycleNumber: activeCycle.cycleNumber
            });
            
            console.log('Previous MidCycle:', previousMidCycle);

            if (previousMidCycle) {
                // Initialize contributionsToNextInLine if it doesn't exist
                if (!previousMidCycle.contributionsToNextInLine) {
                    previousMidCycle.contributionsToNextInLine = new Map();
                }

                // Fetch how much the current nextInLine paid the contributor
                const nextInLineContribution = previousMidCycle.contributionsToNextInLine.get(nextInLineId.toString());
                console.log('NextInLine Contribution:', nextInLineContribution);

                if (nextInLineContribution) {
                    totalAmountOwed = nextInLineContribution;
                }
            }
        }

        // Calculate the difference between the total owed and the contributor's current contribution amount
        const amountToDeduct = Math.max(0, totalAmountOwed - contributionAmount);

        // If no payment is required (the contributor already covers the amount owed), return a success message
        if (amountToDeduct === 0) {
            return {
                message: `No payment required as the contribution amount (€${contributionAmount}) covers the total owed (€${totalAmountOwed}).`,
                amountToDeduct: 0,
            };
        }

        return {
            message: `Amount to deduct: €${amountToDeduct}.`,
            amountToDeduct,
        };
    } catch (error) {
        console.error('Error in payNextInLine:', error);
        throw error;
    }
};

/**
 * Updates member positions based on the community's positioning mode
 * @param {Array} members - Array of member documents to update positions for
 * @param {boolean} isFirstCycle - Whether this is for the first cycle (admin must be position 1)
 * @returns {Promise<Array>} Updated members array with new positions
 */
CommunitySchema.methods.updateMemberPositions = async function(members, isFirstCycle = false) {
    try {
        const Member = mongoose.model('Member');
        let updatedMembers = [];

        if (isFirstCycle) {
            // For first cycle, ensure admin is position 1
            const adminMember = await Member.findOne({ 
                communityId: this._id,
                userId: this.admin,
                status: 'active'
            });

            if (!adminMember) {
                throw new Error('Admin must be an active member before the first cycle starts.');
            }

            adminMember.position = 1;
            await adminMember.save();
            updatedMembers.push(adminMember);

            // Handle non-admin members
            const nonAdminMembers = members.filter(m => m.userId.toString() !== this.admin.toString());
            const assignedPositions = [1]; // Position 1 is reserved for admin

            for (const member of nonAdminMembers) {
                let randomPosition;
                do {
                    randomPosition = Math.floor(Math.random() * (this.firstCycleMin - 1)) + 2;
                } while (assignedPositions.includes(randomPosition));
                
                member.position = randomPosition;
                assignedPositions.push(randomPosition);
                await member.save();
                updatedMembers.push(member);
            }
        } else {
            // For subsequent cycles
            if (this.positioningMode === 'Random') {
                const assignedPositions = [];
                for (const member of members) {
                    let randomPosition;
                    do {
                        randomPosition = Math.floor(Math.random() * members.length) + 1;
                    } while (assignedPositions.includes(randomPosition));
                    
                    member.position = randomPosition;
                    assignedPositions.push(randomPosition);
                    await member.save();
                    updatedMembers.push(member);
                }
            } else if (this.positioningMode === 'Fixed') {
                // Sort members by userId for consistent ordering
                const sortedMembers = [...members].sort((a, b) => 
                    a.userId.toString().localeCompare(b.userId.toString())
                );

                for (let i = 0; i < sortedMembers.length; i++) {
                    sortedMembers[i].position = i + 1;
                    await sortedMembers[i].save();
                    updatedMembers.push(sortedMembers[i]);
                }
            }
        }

        return updatedMembers;
    } catch (err) {
        console.error('Error updating member positions:', err);
        throw err;
    }
};

// Add static method for searching communities
CommunitySchema.statics.searchCommunity = async function(keyword) {
    if (!keyword) {
        return [];
    }
    
    // Create a case-insensitive search pattern
    const searchPattern = new RegExp(keyword, 'i');
    
    // Search in name, description, and other relevant fields
    const communities = await this.find({
        $or: [
            { name: searchPattern },
            { description: searchPattern }
        ]
    });
    
    return communities;
};

module.exports = mongoose.model('Community', CommunitySchema);
