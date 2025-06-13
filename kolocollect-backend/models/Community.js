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
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },    totalContribution: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    totalDistributed: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    description: { type: String },
    backupFund: { 
        type: mongoose.Schema.Types.Decimal128, 
        default: 0,
        get: function(value) {
            return value ? parseFloat(value.toString()) : 0;
        }
    },
    lockPayout: { type: Boolean, default: false },

    // Reference to MidCycle documents
    midCycle: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }],

    // Reference to Cycle documents
    cycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' }],

    // Reference to Member documents
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],

    nextPayout: { type: Date },    payoutDetails: {
        nextRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cycleNumber: { type: Number },
        payoutAmount: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 0,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 0;
            }
        },
        midCycleStatus: { type: String, default: "Just Started" }
    },

    settings: {
        contributionFrequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Hourly'], default: 'Weekly' },
        maxMembers: { type: Number, default: 100 },
        backupFundPercentage: { type: Number, default: 10 },
        isPrivate: { type: Boolean, default: false },        minContribution: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 30,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 30;
            }
        },
        penalty: { 
            type: mongoose.Schema.Types.Decimal128, 
            default: 10,
            get: function(value) {
                return value ? parseFloat(value.toString()) : 10;
            }
        },
        numMissContribution: { type: Number, default: 3 },
        firstCycleMin: { type: Number, default: 5 },
    },

    positioningMode: { type: String, enum: ['Random', 'Fixed'], default: 'Random' },
    cycleLockEnabled: { type: Boolean, default: false },
    firstCycleMin: { type: Number, default: 5 },
    cycleState: { type: String, enum: ['Active', 'Locked', 'Completed'], default: 'Active' },

    // Reference to CommunityVote documents
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityVote' }],    owingMembers: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        remainingAmount: { type: Number },
        paidAmount: { type: Number },
        installments: { type: Number },
        isDistributed: { type: Boolean, default: false }
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
    
    // Update using updateOne instead of save to avoid DivergentArrayError
    await this.constructor.updateOne(
        { _id: this._id },
        { $push: { activityLog: activityLog._id } }
    );
    
    return activityLog;
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
        const Cycle = mongoose.model('Cycle');
        const MidCycle = mongoose.model('MidCycle');
        
        // Get fresh data for all cycles and midcycles
        const allCycles = await Cycle.find({ _id: { $in: this.cycles } });
        const allMidCycles = await MidCycle.find({ _id: { $in: this.midCycle } });
        
        console.log(`Syncing ${allMidCycles.length} mid-cycles to ${allCycles.length} cycles`);
        
        // For each cycle, find all associated mid-cycles
        for (const cycle of allCycles) {
            // Find mid-cycles that belong to this cycle
            const relatedMidCycles = allMidCycles.filter(mc => mc.cycleNumber === cycle.cycleNumber);
            const validMidCycles = relatedMidCycles.filter(mc => mc && mc._id);
            
            if (validMidCycles.length !== relatedMidCycles.length) {
                console.warn('Some mid-cycles were invalid and excluded during synchronization.');
            }
            
            // Update the cycle's midCycles array
            cycle.midCycles = validMidCycles.map(mc => mc._id);
            console.log(`Synchronized ${cycle.midCycles.length} mid-cycles for cycle ${cycle.cycleNumber}`);
            
            // Save the updated cycle
            await cycle.save();
        }
        
        // Return the updated community
        return this;
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
CommunitySchema.methods.handleWalletForDefaulters = require('./handleWalletForDefaulters');

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
CommunitySchema.methods.startNewCycle = async function () {    try {
        const Cycle = mongoose.model('Cycle');
        const Member = mongoose.model('Member');
        const CommunityVote = mongoose.model('CommunityVote');
        const Wallet = mongoose.model('Wallet');

        // Check for any active cycles
        const activeCycle = await Cycle.findOne({ 
            communityId: this._id,
            isComplete: false 
        });
        console.log(`Active cycle found: ${activeCycle}`);
        
        // If there's an active cycle and it's not already marked as complete in our previous operation,
        // we need to prevent starting a new cycle
        if (activeCycle) {
            console.log('Found active cycle that should be complete:', activeCycle._id);
            
            // Double check if all members have been paid to be sure
            const activeMembers = await Member.find({ 
                communityId: this._id,
                status: 'active' 
            });
            
            const paidMemberIds = activeCycle.paidMembers.map(id => id.toString());
            const allPaid = activeMembers.every(member => 
                paidMemberIds.includes(member.userId.toString())
            );
            
            if (allPaid) {
                // All members are paid, so we can safely mark it complete
                console.log('All members were actually paid, marking cycle complete');
                activeCycle.isComplete = true;
                activeCycle.endDate = new Date();
                await activeCycle.save();
            } else {
                throw new Error('Cannot start a new cycle until the current cycle is complete and all members have been paid.');
            }
        }        // Get all cycles for this community, including ones that were just marked complete
        const existingCycles = await Cycle.find({ communityId: this._id });
        console.log('community id:', this._id);
        console.log(`Found ${existingCycles.length} existing cycles for this community`);
        
        // Log each cycle to debug
        existingCycles.forEach(cycle => {
            console.log(`Cycle ID: ${cycle._id}, Number: ${cycle.cycleNumber}, isComplete: ${cycle.isComplete}`);
        });
        
        // Simply use the length of the community's cycles array plus 1
        // This ensures we always get a sequential cycle number
        const completedCycleCount = this.cycles.length;
        const newCycleNumber = completedCycleCount + 1;
        
        console.log(`Community has ${completedCycleCount} cycle(s), new cycle number will be: ${newCycleNumber}`);

        // Get all active members
        let members = await Member.find({ 
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
        
            if (members.length < this.settings.firstCycleMin) {
            throw new Error(`Cannot start a new cycle: minimum required members is ${this.settings.firstCycleMin}, but only ${members.length} present.`);
        }
        
        // Create new cycle
        const newCycle = new Cycle({
            communityId: this._id,
            cycleNumber: newCycleNumber,
            isComplete: false,
            startDate: new Date()
        });
        await newCycle.save();
        console.log(`New cycle created: ${newCycle}`);
          // Add the new cycle to the community's cycles array and save
        this.cycles.push(newCycle._id);
        await this.save();
        console.log(`Added new cycle to community's cycles array`);

        // Activate waiting members if cycleLockEnabled is false
        const activationResult = await this.activateWaitingMembers();
        console.log(activationResult.message);

        // If members were activated, get the updated list of active members
        if (activationResult.activatedCount > 0) {
            members = await Member.find({ 
                communityId: this._id,
                status: 'active'
            });
            // Update positions for newly activated members
            await this.updateMemberPositions(members, false);
        }

        // Handle defaulters' wallets
        for (const member of members) {
            if (member.missedContributions.length > 0 || member.penalty > 0) {
                const wallet = await Wallet.findOne({ userId: member.userId });
                if (wallet) {
                    await this.handleWalletForDefaulters(member.userId, 'deduct');
                }
            }
        }        // Start first mid-cycle and update payout info
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
CommunitySchema.methods.startMidCycle = async function () {    try {
        const activeCycle = await Cycle.findOne({ _id: { $in: this.cycles }, isComplete: false });
        console.log(`Active cycle found: ${activeCycle}`);
        if (!activeCycle) throw new Error('No active cycle found.');       
        
        // Get all active members sorted by position
        const activeMembers = await Member.find({ 
            _id: { $in: this.members },
            status: 'active',
            position: { $ne: null }
        }).sort('position');
        
        // Find members who haven't been paid yet in this cycle
        const unpaidMembers = activeMembers.filter(member => {
            // Convert ObjectIds to strings for comparison
            const memberUserId = member.userId.toString();
            return !activeCycle.paidMembers.some(paidMemberId => 
                paidMemberId.toString() === memberUserId
            );
        });
        
        // If no unpaid members, we've completed the cycle
        if (unpaidMembers.length === 0) {
            throw new Error('All active members have received payouts in this cycle.');
        }
        
        // Select the member with the lowest position who hasn't been paid yet
        const nextInLine = unpaidMembers[0];
        
        if (!nextInLine) {
            throw new Error('No eligible member found for payout.');
        }        // Log the selected next in line member for debugging
        console.log(`Next in line: Member ${nextInLine.name} with position ${nextInLine.position}`);
          const newMidCycle = new MidCycle({
            cycleNumber: activeCycle.cycleNumber,
            nextInLine: { userId: nextInLine.userId },
            contributions: [],
            midCycleJoiners: [], // Initialize with empty array to prevent undefined errors
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
CommunitySchema.methods.addNewMemberMidCycle = async function (userId, name, email, contributionAmount, communityId) {
    try {
        const Cycle = mongoose.model('Cycle');
        const MidCycle = mongoose.model('MidCycle');
        const Member = mongoose.model('Member');
        const Wallet = mongoose.model('Wallet');

        console.log(`Adding new member ${name} (${userId}) to mid-cycle...`);
        console.log(`Contribution amount: €${contributionAmount}`);
        console.log(`Community ID: ${communityId}`);

        // Find the active cycle
        const activeCycle = await Cycle.findOne({
            communityId,
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
        );        // Create new member
        const newMember = new Member({
            communityId: this._id,
            userId,
            name,
            email,
            // Set status to 'waiting' if cycleLockEnabled is true, otherwise 'active'
            status: this.cycleLockEnabled ? 'waiting' : 'active',
            penalty: 0,
            missedContributions: [],
            paymentPlan: {
                type: 'Incremental',
                totalPreviousContribution: this.settings.minContribution * missedCycles,
                remainingAmount: (totalAmount - this.settings.minContribution) - (contributionAmount - this.settings.minContribution),
                previousContribution: contributionAmount - this.settings.minContribution,
                installments: 1
            }
        });        // Save the new member
        await newMember.save();        // Add the new member to the community's members array
        this.members.push(newMember._id);
        
        // Set position for the new member only (no need to update all members)
        newMember.position = currentMembers.length + 1;
        await newMember.save();        // Update mid-cycle joiners, ensuring the array exists first
        if (!activeMidCycle.midCycleJoiners) {
            activeMidCycle.midCycleJoiners = [];
        }
        
        activeMidCycle.midCycleJoiners.push({
            joiners: userId,
            paidMembers: activeCycle.paidMembers || [],
            isComplete: false
        });
        await activeMidCycle.save();

        // Handle owing members tracking
        // if (newMember.paymentPlan.remainingAmount > 0) {
            this.owingMembers.push({
                userId: newMember.userId,
                userName: newMember.name,
                remainingAmount: newMember.paymentPlan.remainingAmount,
                paidAmount: contributionAmount - this.settings.minContribution,
                installments: newMember.paymentPlan.installments
            });
        // }       
        
        // Create contribution
        console.log(`Creating contribution for user ${userId} in community ${this._id} with amount ${this.settings.minContribution}`);
        const Contribution = mongoose.model('Contribution');
        await Contribution.createContribution(userId, this._id, this.settings.minContribution, activeMidCycle._id);

        // Save community changes
        console.log('Saving community changes with new member:', newMember._id);
        await this.save();

        return { 
            message: 'Member successfully added during mid-cycle.',
            memberId: newMember._id,
            status: newMember.status
        };
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
// Import the new validation function
const validateMidCycleReadiness = require('./validateMidCycleReadiness');

// Replace the old implementation with a wrapper that calls the new function
CommunitySchema.methods.validateMidCycleAndContributions = async function (currentContribution, session = null) {
    try {
        // Call the new validation function with optional session
        const result = await validateMidCycleReadiness(this, currentContribution, session);
        
        // Return the same format as before for backward compatibility
        return {
            message: result.message,
            isReady: result.isReady,
            details: result // Include the full result for advanced usage
        };
    } catch (err) {
        console.error('Error in validateMidCycleAndContributions wrapper:', err);
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
CommunitySchema.methods.distributePayouts = require('./distributePayouts');

/**
 * Activates members with waiting status if cycleLockEnabled is false
 * @returns {Promise<Object>} Result of activating waiting members
 * 
 * If cycleLockEnabled is false, this function changes the status of all members
 * with status 'waiting' to 'active' at the beginning of a new cycle.
 * Returns information about how many members were activated.
 */
CommunitySchema.methods.activateWaitingMembers = async function() {
    try {
        // If cycle lock is enabled, do nothing
        if (this.cycleLockEnabled) {
            return { message: 'Cycle lock is enabled. No waiting members activated.', activatedCount: 0 };
        }
        
        const Member = mongoose.model('Member');
        
        // Find all waiting members for this community
        const waitingMembers = await Member.find({
            communityId: this._id,
            status: 'waiting'
        });
        
        if (waitingMembers.length === 0) {
            return { message: 'No waiting members found.', activatedCount: 0 };
        }
        
        // Activate all waiting members
        for (const member of waitingMembers) {
            member.status = 'active';
            await member.save();
        }
        
        console.log(`Activated ${waitingMembers.length} waiting members in community ${this.name}`);
        
        return { 
            message: `${waitingMembers.length} waiting members have been activated.`,
            activatedCount: waitingMembers.length 
        };
    } catch (err) {
        console.error('Error activating waiting members:', err);
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
        // Import required models
        const Member = mongoose.model('Member');
        const MidCycle = mongoose.model('MidCycle');
        
        // Find the member in the Member collection
        const member = await Member.findOne({
            _id: { $in: this.members },
            userId: userId
        });
        
        if (!member) {
            throw new Error('Member not found.');
        }

        // Update payment plan if there's a remaining amount
        if (member.paymentPlan.remainingAmount !== 0) {
            // Reduce remaining amount, increase previous contribution, increment installments
            member.paymentPlan.remainingAmount -= remainder;
            member.paymentPlan.previousContribution += remainder;
            member.paymentPlan.installments += 1;

            // Update or add entry to owingMembers array in community document
            const owingMember = this.owingMembers.find(m => m.userId.equals(userId));
            if (owingMember) {
                // Update existing owing member record
                owingMember.remainingAmount = member.paymentPlan.remainingAmount;
                owingMember.installments = member.paymentPlan.installments;
            } else {
                // Add new owing member record
                this.owingMembers.push({
                    userId: member.userId,
                    userName: member.name,
                    remainingAmount: member.paymentPlan.remainingAmount,
                    installments: member.paymentPlan.installments
                });
            }
        }

        // If payment plan is completed (remainingAmount is 0)
        if (member.paymentPlan.remainingAmount === 0) {
            // Find the midcycle where this user is a mid-cycle joiner
            const activeMidCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                'midCycleJoiners.joiners': userId
            });

            if (activeMidCycle) {
                // Find the joiner entry for this user
                const joinerIndex = activeMidCycle.midCycleJoiners.findIndex(joiner => 
                    joiner.joiners.equals(userId)
                );

                if (joinerIndex !== -1) {
                    // Get the list of paid members this joiner needs to contribute to
                    const paidMembers = activeMidCycle.midCycleJoiners[joinerIndex].paidMembers || [];
                    
                    // Find all midcycles where the paid members are next in line
                    const relatedMidCycles = await MidCycle.find({
                        _id: { $in: this.midCycle },
                        'nextInLine.userId': { $in: paidMembers }
                    });

                    // For each related midcycle, update contributions to next-in-line
                    for (const relatedMidCycle of relatedMidCycles) {
                        // Initialize contributionsToNextInLine if it doesn't exist
                        if (!relatedMidCycle.contributionsToNextInLine) {
                            relatedMidCycle.contributionsToNextInLine = new Map();
                        }
                        
                        // Calculate and update the contribution amount
                        const currentAmount = relatedMidCycle.contributionsToNextInLine.get(userId.toString()) || 0;
                        const contributionPerMember = member.paymentPlan.previousContribution / paidMembers.length;
                        
                        relatedMidCycle.contributionsToNextInLine.set(
                            userId.toString(),
                            currentAmount + contributionPerMember
                        );
                        
                        // Save the updated midcycle
                        await relatedMidCycle.save();
                    }
                }
            }
        }

        // Save all changes
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
 * Processes payment of a member's second installment
 * @param {ObjectId} userId - ID of the member paying second installment
 * @returns {Promise<Object>} Result of the payment process
 * 
 * Handles the payment of a second installment for mid-cycle joiners:
 * - Validates member owes a second installment
 * - Processes wallet transaction
 * - Updates payment plan and owing members records
 * - Updates midcycle joiner status
 * - Adjusts community backup fund
 */
CommunitySchema.methods.paySecondInstallment = async function (userId) {
    try {
        // Find the owing member in the community's owingMembers array
        const owingMember = this.owingMembers.find(m => m.userId.equals(userId));
        if (!owingMember) throw new Error('Owing member not found.');
        
        let remainingAmount = owingMember.remainingAmount;
        console.log(`Remaining amount for second installment: ${remainingAmount}`);
        
        // Check if there is an actual remaining amount to pay
        if (owingMember.remainingAmount > 0) {
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

            // Update the owingMember record
            owingMember.remainingAmount = 0;

            // Update the member's payment plan in the Member model
            await this.memberUpdate(userId, remainingAmount);

            // Remove the user from owingMembers array
            this.owingMembers = this.owingMembers.filter(m => !m.userId.equals(userId));
            
            // Update the community backup fund
            const backupFund = (this.settings.backupFundPercentage / 100) * remainingAmount;
            this.backupFund += backupFund;

            // Get the midcycle document that contains this user as a joiner
            const MidCycle = mongoose.model('MidCycle');
            const midCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                'midCycleJoiners.joiners': userId
            });
            
            if (midCycle) {
                // Find the specific joiner entry for this user
                const joinerIndex = midCycle.midCycleJoiners.findIndex(
                    joiner => joiner.joiners.equals(userId)
                );
                
                if (joinerIndex !== -1) {
                    // Update the isComplete field to true
                    midCycle.midCycleJoiners[joinerIndex].isComplete = true;
                    await midCycle.save();
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


/**
 * Starts monitoring payouts for this community
 * Checks for ready payouts every minute and processes them automatically
 */

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
      // Debug mid-cycles to identify issues
      console.log(`Checking midCycle array for user ${userId}`);
      this.midCycle.forEach((mc, index) => {
          console.log(`Mid-cycle ${index} (ID: ${mc._id}): hasJoiners=${Boolean(mc.midCycleJoiners)}, isArray=${mc.midCycleJoiners ? Array.isArray(mc.midCycleJoiners) : false}`);
      });
      
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

          // Update the owingMember record
          owingMember.remainingAmount = 0;
          owingMember.installments = 2;
          owingMember.paidAmount += remainingAmount;

          // Update member's payment plan directly without updating contributionsToNextInLine
          // This avoids duplicate updates when backPaymentDistribute is called later
          const Member = mongoose.model('Member');
          const member = await Member.findOne({
              _id: { $in: this.members },
              userId: userId
          });
          
          if (member) {
              // Update payment plan directly
              member.paymentPlan.remainingAmount -= remainingAmount;
              member.paymentPlan.previousContribution += remainingAmount;
              member.paymentPlan.installments += 1;
              await member.save();
          }          const backupFund = (this.settings.backupFundPercentage / 100) * remainingAmount;
          this.backupFund += backupFund;

          // Get the user midCycleJoiners object and update the isComplete field to true
          // First check if any mid-cycles have the midCycleJoiners property
          try {
              // Find the mid-cycle with this user as a joiner
              const MidCycle = mongoose.model('MidCycle');
              const midCycle = await MidCycle.findOne({
                  _id: { $in: this.midCycle },
                  'midCycleJoiners.joiners': userId
              });
              
              if (midCycle && midCycle.midCycleJoiners) {
                  const joinerIndex = midCycle.midCycleJoiners.findIndex(joiner => 
                      joiner.joiners && joiner.joiners.equals(userId)
                  );
                  
                  if (joinerIndex >= 0) {
                      // Mark this joiner's second installment as paid but not yet distributed
                      midCycle.midCycleJoiners[joinerIndex].secondInstallmentPaid = true;
                      await midCycle.save();
                      console.log(`Marked mid-cycle joiner at index ${joinerIndex} as having paid second installment`);
                  }
              } else {
                  console.log('Could not find matching midCycle or midCycleJoiners for this user, continuing with payment anyway');
              }
          } catch (midCycleErr) {
              // Log the error but continue with the process
              console.warn('Error updating midCycleJoiners, but continuing with payment:', midCycleErr.message);
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
            
            // Ensure contributionsToNextInLine is a Map
            if (!activeMidCycle.contributionsToNextInLine) {
                activeMidCycle.contributionsToNextInLine = new Map();
            } else if (!(activeMidCycle.contributionsToNextInLine instanceof Map)) {
                // Convert to Map if it's stored as a plain object
                const tempMap = new Map();
                Object.keys(activeMidCycle.contributionsToNextInLine).forEach(key => {
                    tempMap.set(key, activeMidCycle.contributionsToNextInLine[key]);
                });
                activeMidCycle.contributionsToNextInLine = tempMap;
            }
            
            // Update the contribution in the Map
            const contributorKey = contributorId.toString();
            const currentTotalStr = activeMidCycle.contributionsToNextInLine.get(contributorKey);
            const currentTotal = currentTotalStr ? Number(currentTotalStr) : 0;
            const numAmount = Number(amount);
            activeMidCycle.contributionsToNextInLine.set(contributorKey, currentTotal + numAmount);
            
            // Mark as modified to ensure Mongoose saves the changes
            activeMidCycle.markModified('contributionsToNextInLine');
            
            // Calculate total amount from contributions array
            const midCycleTotalAmount = activeMidCycle.contributions.reduce((total, contrib) => {
                return total + (contrib.contributions.length * this.settings.minContribution);
            }, 0);

            const midCycleBackupFund = (this.settings.backupFundPercentage / 100) * midCycleTotalAmount;

            this.backupFund += midCycleBackupFund;
            this.totalContribution += amount;
            activeMidCycle.payoutAmount = midCycleTotalAmount - midCycleBackupFund;
            
            // Add retry mechanism for saving the midcycle
            let saveRetries = 3;
            let saveSuccess = false;
            
            while (saveRetries > 0 && !saveSuccess) {
                try {
                    await activeMidCycle.save({
                        maxTimeMS: 30000 // 30 second timeout
                    });
                    saveSuccess = true;
                    console.log('Successfully saved midcycle with contribution updates');
                } catch (err) {
                    saveRetries--;
                    console.error(`Error saving midcycle, retries left: ${saveRetries}`, err.message);
                    if (saveRetries > 0) {
                        // Wait before retrying (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - saveRetries)));
                    } else {
                        throw err; // Re-throw if all retries failed
                    }
                }
            }
            
            console.log('Calling validateMidCycleAndContributions with contributorId:', contributorId);
            const validationResult = await this.validateMidCycleAndContributions(contributorId);
            await this.updatePayoutInfo();

            this.markModified('midCycle');
            
            // Add retry mechanism for saving the community
            let communitySaveRetries = 3;
            let communitySaveSuccess = false;
            
            while (communitySaveRetries > 0 && !communitySaveSuccess) {
                try {
                    await this.save({
                        maxTimeMS: 30000 // 30 second timeout
                    });
                    communitySaveSuccess = true;
                    console.log('Successfully saved community with contribution updates');
                } catch (err) {
                    communitySaveRetries--;
                    console.error(`Error saving community, retries left: ${communitySaveRetries}`, err.message);
                    if (communitySaveRetries > 0) {
                        // Wait before retrying (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - communitySaveRetries)));
                    } else {
                        throw err; // Re-throw if all retries failed
                    }
                }
            }

            return {
                message: 'Contribution recorded successfully.',
                totalContribution: this.totalContribution,
                backupFund: this.backupFund,
                midCycleBackupFund,
                validationMessage: validationResult.message,
                isMidCycleReady: validationResult.isReady,
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
 * Records a contribution in the community within a transaction session
 */
CommunitySchema.methods.recordInSession = async function (contribution, session) {
    let retries = 3;
    while (retries-- > 0) {
        try {
            const { contributorId, recipientId, amount, contributionId } = contribution;

            const activeMidCycle = await MidCycle.findOne({
                _id: { $in: this.midCycle },
                isComplete: false
            }).session(session);

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
            
            // Ensure contributionsToNextInLine is a Map
            if (!activeMidCycle.contributionsToNextInLine) {
                activeMidCycle.contributionsToNextInLine = new Map();
            } else if (!(activeMidCycle.contributionsToNextInLine instanceof Map)) {
                // Convert to Map if it's stored as a plain object
                const tempMap = new Map();
                Object.keys(activeMidCycle.contributionsToNextInLine).forEach(key => {
                    tempMap.set(key, activeMidCycle.contributionsToNextInLine[key]);
                });
                activeMidCycle.contributionsToNextInLine = tempMap;
            }
              // Update the contribution in the Map
            const contributorKey = contributorId.toString();
            const currentTotalStr = activeMidCycle.contributionsToNextInLine.get(contributorKey);
            const currentTotal = currentTotalStr ? Number(currentTotalStr) : 0;
            const numAmount = Number(amount);
            activeMidCycle.contributionsToNextInLine.set(contributorKey, currentTotal + numAmount);
            
            // Mark as modified to ensure Mongoose saves the changes
            activeMidCycle.markModified('contributionsToNextInLine');
            
            // Calculate total amount from contributions array
            const midCycleTotalAmount = activeMidCycle.contributions.reduce((total, contrib) => {
                return total + (contrib.contributions.length * this.settings.minContribution);
            }, 0);

            const midCycleBackupFund = (this.settings.backupFundPercentage / 100) * midCycleTotalAmount;

            this.backupFund += midCycleBackupFund;
            this.totalContribution += amount;
            activeMidCycle.payoutAmount = midCycleTotalAmount - midCycleBackupFund;

            // Add retry mechanism for saving the midcycle
            let saveRetries = 3;
            let saveSuccess = false;
            
            while (saveRetries > 0 && !saveSuccess) {
                try {
                    // Set a timeout for the save operation
                    await activeMidCycle.save({ 
                        session,
                        maxTimeMS: 30000 // 30 second timeout
                    });
                    saveSuccess = true;
                    console.log('Successfully saved midcycle with contribution updates');
                } catch (err) {
                    saveRetries--;
                    console.error(`Error saving midcycle, retries left: ${saveRetries}`, err.message);
                    if (saveRetries > 0) {
                        // Wait before retrying (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - saveRetries)));
                    } else {
                        throw err; // Re-throw if all retries failed
                    }
                }
            }
              const updatedMidCycle = await MidCycle.findById(activeMidCycle._id).session(session);

            console.log('Calling validateMidCycleAndContributions with contributorId:', contributorId);
            // Pass the session to the validation function
            const validationResult = await this.validateMidCycleAndContributions(contributorId, session);
            await this.updatePayoutInfo();this.markModified('midCycle');
            
            // Add retry mechanism for saving the community
            let communitySaveRetries = 3;
            let communitySaveSuccess = false;
            
            while (communitySaveRetries > 0 && !communitySaveSuccess) {
                try {
                    await this.save({ 
                        session,
                        maxTimeMS: 30000 // 30 second timeout
                    });
                    communitySaveSuccess = true;
                    console.log('Successfully saved community with contribution updates');
                } catch (err) {
                    communitySaveRetries--;
                    console.error(`Error saving community, retries left: ${communitySaveRetries}`, err.message);
                    if (communitySaveRetries > 0) {
                        // Wait before retrying (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - communitySaveRetries)));
                    } else {
                        throw err; // Re-throw if all retries failed
                    }
                }
            }

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
 * @param {ObjectId} contributorId - ID of contributing member
 * @param {ObjectId} midCycleId - ID of current midCycle
 * @param {number} contributionAmount - Amount of current contribution
 * @returns {Promise<Object>} Result with amount to deduct and message
 * 
 * This method determines if the contributor previously received payment
 * from the current nextInLine member, and calculates what is owed in reverse.
 */
CommunitySchema.methods.payNextInLine = async function(contributorId, midCycleId, contributionAmount) {
    try {
        // Get the MidCycle model
        const MidCycle = mongoose.model('MidCycle');
        const Cycle = mongoose.model('Cycle');
        
        // Find the midCycle that corresponds to the provided midCycleId
        const midCycle = await MidCycle.findById(midCycleId);
        if (!midCycle) {
            throw new Error('MidCycle not found.');
        }
          // Find the cycle associated with this midCycle
        const cycle = await Cycle.findOne({
            midCycles: midCycleId,
            isComplete: false
        });
        
        // If no active cycle is found, try to find any cycle (even completed ones)
        // that contains this midCycle
        if (!cycle) {
            const anyCycle = await Cycle.findOne({
                midCycles: midCycleId
            });
            
            if (anyCycle) {
                console.log(`Found a completed cycle (${anyCycle._id}) for mid-cycle ${midCycleId}`);
                // Use the completed cycle for processing
                return {
                    message: 'This mid-cycle belongs to a completed cycle. No payment processing needed.',
                    amountToDeduct: 0,
                };
            } else {
                throw new Error('No cycle found for this mid-cycle. The mid-cycle may need to be reassigned to a cycle.');
            }
        }

        console.log('MidCycle:', midCycle._id, "MidCycle CycleNumber:", midCycle.cycleNumber);

        // Retrieve the user ID of the current next in line
        const nextInLineId = midCycle.nextInLine?.userId;
        console.log('NextInLine ID:', nextInLineId);
        
        if (!nextInLineId) {
            throw new Error('No next in line found in this mid-cycle.');
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
        // First check if the contributor is in the paidMembers list of the current cycle
        const isPreviouslyPaid = await Cycle.exists({
            _id: cycle._id,
            paidMembers: contributorId
        });
        
        if (isPreviouslyPaid) {
            // Find midCycles in the same cycle where the contributor was the next in line
            const previousMidCycles = await MidCycle.find({
                _id: { $in: cycle.midCycles },
                'nextInLine.userId': contributorId
            });
            
            console.log(`Found ${previousMidCycles.length} previous mid-cycles where contributor was next in line`);
            
            // Check each previous midCycle to see if the current nextInLine contributed to the contributor
            for (const previousMidCycle of previousMidCycles) {
                console.log(`Checking previous mid-cycle: ${previousMidCycle._id}`);
                
                // Ensure contributionsToNextInLine is properly handled
                let contributionsMap = previousMidCycle.contributionsToNextInLine;
                
                // Handle different storage formats (Map or plain object)
                if (contributionsMap) {
                    let nextInLineContribution = null;
                    
                    if (contributionsMap instanceof Map) {
                        nextInLineContribution = contributionsMap.get(nextInLineId.toString());
                    } else if (typeof contributionsMap === 'object') {
                        // Handle case where it's stored as a plain object                        nextInLineContribution = contributionsMap[nextInLineId.toString()];
                    }
                    
                    console.log(`NextInLine contribution in previous mid-cycle: ${nextInLineContribution}`);
                    
                    if (nextInLineContribution) {
                        totalAmountOwed += parseFloat(nextInLineContribution);
                    }
                }
            }
        }
          console.log(`Total amount owed by contributor to nextInLine: €${totalAmountOwed}`);
        
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


/**
 * Search for mid-cycle joiners by ID
 * @param {ObjectId} midCycleJoinersId - ID of the mid-cycle joiner entry
 * @returns {Promise<Object>} Found mid-cycle joiner or error message
 * 
 * This method searches across all mid-cycles referenced by the community
 * to find a specific mid-cycle joiner entry by its ID.
 * Since MidCycle is now a separate schema, we need to query those documents.
 */
CommunitySchema.methods.searchMidcycleJoiners = async function (midCycleJoinersId) {
    try {
        // Log the search request with more details
        console.log(`Searching for midCycleJoiner with ID: ${midCycleJoinersId}`);
        console.log(`Community ID: ${this._id}, Name: ${this.name}`);
        console.log(`Number of mid-cycles: ${this.midCycle ? this.midCycle.length : 0}`);
        
        // Convert ID to string format for consistent comparison
        const searchIdStr = midCycleJoinersId.toString();
        
        // Get the MidCycle model
        const MidCycle = mongoose.model('MidCycle');
        
        // Get all mid-cycles referenced by this community
        const midCycles = await MidCycle.find({
            _id: { $in: this.midCycle }
        });
        
        console.log(`Found ${midCycles.length} mid-cycles in the community`);
        
        // More detailed logging for debugging
        midCycles.forEach((mc, idx) => {
            const joinersCount = mc.midCycleJoiners && Array.isArray(mc.midCycleJoiners) ? 
                mc.midCycleJoiners.length : 'undefined/not an array';
            console.log(`Mid-cycle #${idx+1} (${mc._id}): Has ${joinersCount} joiners`);
            
            // Log structure of first joiner in each mid-cycle if exists
            if (mc.midCycleJoiners && mc.midCycleJoiners.length > 0) {
                console.log(`Sample joiner structure:`, {
                    _id: mc.midCycleJoiners[0]._id ? mc.midCycleJoiners[0]._id.toString() : 'undefined',
                    hasJoiners: !!mc.midCycleJoiners[0].joiners,
                    joinerType: mc.midCycleJoiners[0].joiners ? typeof mc.midCycleJoiners[0].joiners : 'undefined',
                    keys: Object.keys(mc.midCycleJoiners[0])
                });
            }
        });
        
        // Search through each mid-cycle for the joiner
        let foundJoiner = null;
        
        for (const midCycle of midCycles) {
            // Make sure midCycleJoiners exists and is an array
            if (midCycle.midCycleJoiners && Array.isArray(midCycle.midCycleJoiners)) {
                // Try multiple approaches to find the joiner
                
                // Method 1: Direct ID comparison with toString()
                const joiner = midCycle.midCycleJoiners.find(
                    joiner => joiner._id && joiner._id.toString() === searchIdStr
                );
                
                if (joiner) {
                    console.log(`Found joiner using direct ID comparison`);
                    foundJoiner = {
                        ...joiner.toObject(),
                        midCycleId: midCycle._id,
                        cycleNumber: midCycle.cycleNumber
                    };
                    break;
                }
                
                // Method 2: Case-insensitive string comparison (for safety)
                const joinerAlt = midCycle.midCycleJoiners.find(
                    joiner => joiner._id && joiner._id.toString().toLowerCase() === searchIdStr.toLowerCase()
                );
                
                if (joinerAlt) {
                    console.log(`Found joiner using case-insensitive comparison`);
                    foundJoiner = {
                        ...joinerAlt.toObject(),
                        midCycleId: midCycle._id,
                        cycleNumber: midCycle.cycleNumber
                    };
                    break;
                }
                
                // Method 3: Try with ObjectId comparison if previous methods fail
                try {
                    const objectIdToFind = new mongoose.Types.ObjectId(searchIdStr);
                    const joinerObjectId = midCycle.midCycleJoiners.find(
                        joiner => joiner._id && joiner._id.equals(objectIdToFind)
                    );
                    
                    if (joinerObjectId) {
                        console.log(`Found joiner using ObjectId equals() method`);
                        foundJoiner = {
                            ...joinerObjectId.toObject(),
                            midCycleId: midCycle._id,
                            cycleNumber: midCycle.cycleNumber
                        };
                        break;
                    }
                } catch (err) {
                    console.log(`ObjectId comparison failed:`, err.message);
                }
            }
        }
        
        console.log(`Midcycle Joiner search result:`, foundJoiner);
        
        // Return appropriate response
        if (!foundJoiner) {
            throw new Error('No mid-cycle joiner found for the given ID.');
        }
        
        return foundJoiner;
    } catch (err) {
        console.error('Error in searchMidcycleJoiners:', err);
        throw err;
    }
};

/**
 * Distribute second installment back payments from a mid-cycle joiner to eligible members
 * 
 * This method processes the distribution of a mid-cycle joiner's second installment 
 * to the members who were part of the paidMembers array in the midCycleJoiners object.
 * 
 * @param {ObjectId} midCycleJoinersId - ID of the mid-cycle joiner entry
 * @returns {Promise<Object>} Result of the distribution process
 */
CommunitySchema.methods.backPaymentDistribute = async function (midCycleJoinersId) {
  try {
    console.log(`Starting back payment distribution for midCycleJoinersId: ${midCycleJoinersId}`);
    
    // Step 1: Find the mid-cycle joiner using the updated searchMidcycleJoiners method
    const midCycleJoiner = await this.searchMidcycleJoiners(midCycleJoinersId);
    
    console.log(`Found mid-cycle joiner:`, midCycleJoiner);
    
    // Step 2: Get the Member document for this joiner
    const Member = mongoose.model('Member');
    const member = await Member.findOne({ 
      userId: midCycleJoiner.joiners, 
      communityId: this._id
    });
    
    if (!member) {
      throw new Error('Member not found in this community.');
    }
    
    console.log(`Found member:`, {
      memberId: member._id,
      name: member.name,
      email: member.email,
      remainingAmount: member.paymentPlan?.remainingAmount,
      installments: member.paymentPlan?.installments
    });
      // Step 3: Check if the member's payment plan is complete
    if (!member.paymentPlan) {
      throw new Error('Member does not have a payment plan.');
    }
    
    if (member.paymentPlan.remainingAmount !== 0) {
      throw new Error('Member has not completed their payment plan. Second installment must be paid first.');
    }
    
    
    // Also verify the midCycleJoiner entry has secondInstallmentPaid marked as true
    // This helps ensure we don't try to distribute payments that haven't been properly recorded
    if (midCycleJoiner.secondInstallmentPaid !== true) {
      console.log('Second installment payment not properly recorded in midCycleJoiner entry. Marking it now.');
      // Instead of failing, let's just mark it as paid since we've already verified the payment plan
      midCycleJoiner.secondInstallmentPaid = true;
      
      // Find and update the midcycle directly
      try {
        const MidCycle = mongoose.model('MidCycle');
        const midCycle = await MidCycle.findOne({ 
          'midCycleJoiners._id': midCycleJoinersId 
        });
        
        if (midCycle) {
          const joinerIndex = midCycle.midCycleJoiners.findIndex(j => 
            j._id.toString() === midCycleJoinersId.toString()
          );
          
          if (joinerIndex >= 0) {
            midCycle.midCycleJoiners[joinerIndex].secondInstallmentPaid = true;
            await midCycle.save();
            console.log('Updated midCycleJoiner record with secondInstallmentPaid = true');
          }
        }
      } catch (err) {
        console.warn('Failed to update midCycleJoiner.secondInstallmentPaid flag:', err.message);
      }
    }
    
    // Step 4: Calculate net contribution after accounting for backup fund
    const backupFundPercentage = this.settings.backupFundPercentage || 0;
    const backupFund = (backupFundPercentage / 100) * member.paymentPlan.previousContribution;
    
    // Update the backup fund amount in the community
    this.backupFund += backupFund;
      // Step 5: Process the paid members from the mid-cycle joiner entry
    // Ensure paidMembers is an array of ObjectIds
    if (!midCycleJoiner.paidMembers || !Array.isArray(midCycleJoiner.paidMembers)) {
      console.error(`Invalid paidMembers structure:`, midCycleJoiner.paidMembers);
      throw new Error('No valid paid members array found in the mid-cycle joiner record.');
    }
    
    // Safely convert all members to ObjectIds, handling any invalid IDs gracefully
    let paidMembers;
    try {
      paidMembers = midCycleJoiner.paidMembers
        .filter(id => id) // Remove any null/undefined values
        .map(id => {
          try {
            return typeof id === 'object' ? id : new mongoose.Types.ObjectId(id.toString());
          } catch (err) {
            console.warn(`Invalid ObjectId format for member: ${id}`);
            return null;
          }
        })
        .filter(id => id !== null); // Remove any invalid conversions
    } catch (e) {
      console.error('Error processing paidMembers array:', e);
      throw new Error('Failed to process the list of paid members. Data format issue.');
    }
      
    if (paidMembers.length === 0) {
      console.error('Empty paidMembers array after processing', { 
        originalArray: midCycleJoiner.paidMembers 
      });
      throw new Error('No valid paid members found for this mid-cycle joiner.');
    }
    
    console.log(`Found ${paidMembers.length} paid members to distribute payments to`);
    
    // Step 6: Calculate distribution amount
    const previousContribution = member.paymentPlan.previousContribution || 0;
    const distributableAmount = previousContribution - backupFund;
    const amountPerPerson = distributableAmount / paidMembers.length;
    
    if (amountPerPerson <= 0) {
      throw new Error('No positive amount available for distribution after backup fund deduction.');
    }
    
    console.log(`Distribution details:`, {
      previousContribution,
      backupFundPercentage: `${backupFundPercentage}%`,
      backupFund,
      distributableAmount,
      amountPerPerson,
      totalRecipients: paidMembers.length
    });
    
    // Step 7: Process payments to eligible members' wallets
    const Wallet = mongoose.model('Wallet');
    const paymentPromises = [];
    const successfulPayments = [];
    let failedPayments = 0;
    
    for (const paidMemberId of paidMembers) {
      try {
        const wallet = await Wallet.findOne({ userId: paidMemberId });
        if (!wallet) {
          console.warn(`Wallet not found for user ID: ${paidMemberId}`);
          failedPayments++;
          continue;
        }
        
        // Add transaction to wallet
        await wallet.addTransaction(
          amountPerPerson,
          'deposit',
          `Back payment distribution from community ${this.name}`,
          paidMemberId,
          this._id
        );
        
        console.log(`Back payment of €${amountPerPerson} distributed to member ID ${paidMemberId}.`);
        successfulPayments.push(paidMemberId);
      } catch (err) {
        console.error(`Failed to process payment to member ${paidMemberId}:`, err);
        failedPayments++;
      }
    }
    
    if (successfulPayments.length === 0) {
      throw new Error('Failed to distribute payments to any eligible members.');
    }
      // Step 8: Update the member's payment plan
    const prevAmount = member.paymentPlan.previousContribution;
    member.paymentPlan.previousContribution = 0;
    await member.save();
    
    // Update the owing member entry to mark as distributed
    const owingMemberIndex = this.owingMembers.findIndex(
      om => om.userId && om.userId.toString() === member.userId.toString()
    );
      if (owingMemberIndex >= 0) {
      this.owingMembers[owingMemberIndex].isDistributed = true;
      console.log(`Marked owing member at index ${owingMemberIndex} as distributed`);
      
      // Make sure to save the community to persist this change
      const saveResult = await this.save();
      console.log(`Community saved after marking owing member as distributed: ${saveResult._id}`);
    } else {
      console.warn(`Could not find owing member entry for userId ${member.userId}`);
    }
    
    // Step 9: Update the mid-cycle documents for each paid member
    // Get the MidCycle model to directly query and update mid-cycle documents
    const MidCycle = mongoose.model('MidCycle');
    
    // Get current active cycle
    const activeCycle = this.cycles.find(c => !c.isComplete);
    const currentCycleNumber = activeCycle?.cycleNumber;
    
    if (!currentCycleNumber) {
      console.warn('No active cycle found, but continuing with payment distribution.');
    }
    
    // Find relevant mid-cycles for the paid members
    let updatedMidCycles = 0;
    let midCycleUpdateErrors = 0;
    
    for (const paidMemberId of successfulPayments) {
      try {
        // Find mid-cycles where this paid member is the next in line
        const relevantMidCycles = await MidCycle.find({
          _id: { $in: this.midCycle },
          'nextInLine.userId': paidMemberId
        });
        
        for (const midCycle of relevantMidCycles) {          try {
            // Make sure the contributionsToNextInLine exists and handle it as a Map
            if (!midCycle.contributionsToNextInLine) {
              midCycle.contributionsToNextInLine = new Map();
            }
            
            // Add to contributionsToNextInLine using the proper Map methods
            const joinerIdStr = midCycleJoiner.joiners.toString();
            
            // Get the current value using Map.get() or default to 0
            let currentAmount = 0;
            if (midCycle.contributionsToNextInLine instanceof Map) {
              currentAmount = midCycle.contributionsToNextInLine.get(joinerIdStr) || 0;
            } else {
              // Handle the case where it's stored as a plain object
              currentAmount = (midCycle.contributionsToNextInLine[joinerIdStr] || 0);
              // Convert to a proper Map if it's not already
              const tempMap = new Map();
              Object.keys(midCycle.contributionsToNextInLine).forEach(key => {
                tempMap.set(key, midCycle.contributionsToNextInLine[key]);
              });
              midCycle.contributionsToNextInLine = tempMap;
            }
            
            const totalAmount = prevAmount / paidMembers.length;
            
            // Update the amount in the contributions map using Map.set()
            midCycle.contributionsToNextInLine.set(joinerIdStr, currentAmount + totalAmount);
            
            // Mark the field as modified to ensure MongoDB updates it
            midCycle.markModified('contributionsToNextInLine');
            
            // Log the update for debugging
            console.log(`Updated contributionsToNextInLine for member ${paidMemberId} in midCycle ${midCycle._id}:`, {
              joinerIdStr,
              previousAmount: currentAmount,
              addedAmount: totalAmount,
              newTotal: currentAmount + totalAmount
            });
            
            // Make sure the contributions array exists
            if (!midCycle.contributions) {
              midCycle.contributions = [];
            }
              // Create a proper contribution record with amount information
            const Contribution = mongoose.model('Contribution');
            const newContribution = new Contribution({
              communityId: this._id,
              userId: midCycleJoiner.joiners,
              amount: totalAmount, // Use the calculated amount per person
              midCycleId: midCycle._id,
              cycleNumber: midCycle.cycleNumber,
              status: 'completed',
              date: new Date(),
              penalty: 0,
              missedReason: null,
              paymentPlan: { 
                type: 'Full', 
                remainingAmount: 0, 
                installments: 0 
              }
            });
            
            // Save the new contribution
            const savedContribution = await newContribution.save();
            console.log(`Created new contribution record with amount ${totalAmount} and ID ${savedContribution._id}`);
            
            // Add to contributions array
            const userContribIdx = midCycle.contributions.findIndex(c => 
              c.user && c.user.toString() === midCycleJoiner.joiners.toString()
            );
            
            if (userContribIdx >= 0) {
              // User already has a contribution entry, add the new contribution to it
              midCycle.contributions[userContribIdx].contributions.push(savedContribution._id);
            } else {
              // Create a new contribution entry with the reference to the saved contribution
              midCycle.contributions.push({
                user: midCycleJoiner.joiners,
                contributions: [savedContribution._id]
              });
            }
              // Also update the User document's contributions
            try {
              const User = mongoose.model('User');
              const user = await User.findById(midCycleJoiner.joiners);
              if (user && user.addContribution) {
                await user.addContribution(savedContribution._id, savedContribution.amount);
                console.log(`Updated user ${midCycleJoiner.joiners} with contribution reference`);
              }
            } catch (userUpdateErr) {
              console.warn(`Error updating user's contribution references: ${userUpdateErr.message}`);
              // Continue even if user update fails
            }
            
            // Save the updates to this mid-cycle
            await midCycle.save();
            updatedMidCycles++;
          } catch (err) {
            console.error(`Error updating mid-cycle ${midCycle._id}:`, err);
            midCycleUpdateErrors++;
          }
        }
      } catch (err) {
        console.error(`Error finding relevant mid-cycles for member ${paidMemberId}:`, err);
        midCycleUpdateErrors++;
      }
    }      // Step 10: Mark the midCycleJoiner as complete
    let joinerMarkedComplete = false;
    try {
      // Use findOne instead of findById for more flexibility
      const MidCycle = mongoose.model('MidCycle');
      let midCycleToUpdate;
      
      if (midCycleJoiner.midCycleId) {
        midCycleToUpdate = await MidCycle.findById(midCycleJoiner.midCycleId);
      }
      
      // If we couldn't find it by ID, try to find it by the joiner's ID
      if (!midCycleToUpdate) {
        midCycleToUpdate = await MidCycle.findOne({
          _id: { $in: this.midCycle },
          'midCycleJoiners._id': midCycleJoinersId
        });
      }
      
      if (midCycleToUpdate) {
        // Get the ID string for comparison
        const targetJoinerId = midCycleJoinersId.toString();
        
        // Find the joiner index by stringifying the IDs before comparison
        const joinerIndex = midCycleToUpdate.midCycleJoiners.findIndex(j => 
          j._id && j._id.toString() === targetJoinerId
        );
        
        if (joinerIndex >= 0) {
          midCycleToUpdate.midCycleJoiners[joinerIndex].isComplete = true;
          midCycleToUpdate.midCycleJoiners[joinerId].secondInstallmentPaid = true;
          midCycleToUpdate.midCycleJoiners[joinerId].backPaymentDistributed = true;
          midCycleToUpdate.midCycleJoiners[joinerId].distributionDate = new Date();
          await midCycleToUpdate.save();
          joinerMarkedComplete = true;
          console.log(`Successfully marked joiner at index ${joinerIndex} as complete`);
        } else {
          console.warn(`Could not find joiner entry in mid-cycle ${midCycleToUpdate._id}. Looking for ID: ${targetJoinerId}`);
        }
      } else {
        console.warn(`Could not find mid-cycle for joiner ID: ${midCycleJoinersId}`);
      }
    } catch (err) {
      console.error(`Error marking midCycleJoiner as complete:`, err);
    }
    
    // Save community updates (mainly for backup fund)
    await this.save();
      console.log('Back payment distribution completed successfully');
    return { 
      success: true,
      message: 'Back payment distribution completed successfully.',
      details: {
        amountDistributed: distributableAmount,
        amountPerPerson,
        recipientCount: successfulPayments.length,
        failedPayments,
        backupFundContribution: backupFund,
        updatedMidCycles,
        midCycleUpdateErrors,
        joinerMarkedComplete,
        isDistributed: true,
        owingMemberUpdated: (owingMemberIndex >= 0)
      }    };  } catch (err) {
    console.error('Error in backPaymentDistribute:', err);
    console.error('Error stack:', err.stack);
    
    // Log more context information for debugging
    console.log('Context for error:', {
      communityId: this._id,
      communityName: this.name,
      midCycleJoinersId: midCycleJoinersId ? midCycleJoinersId.toString() : 'undefined',
      midCycleCount: this.midCycle ? this.midCycle.length : 'unknown'
    });
    
    // Handle known error cases with user-friendly messages
    if (err.message.includes('Member has not completed their payment plan') ||
        err.message.includes('Second installment must be paid') ||
        err.message.includes('Member must complete two installments')) {
      return { 
        success: false,
        message: err.message
      };
    }
    
    // Handle mid-cycle joiner not found errors
    if (err.message.includes('No mid-cycle joiner found') ||
        err.message.includes('No paid members found')) {
      return { 
        success: false,
        message: 'No mid-cycle joiner found for the given ID. Please verify the ID is correct.',
        details: err.message
      };
    }
    
    // For other errors, return a generic error message with details
    return {
      success: false,
      message: 'An error occurred while distributing back payments.',
      details: err.message
    };
  }
};

/**
 * Handles a member leaving the community
 * @param {ObjectId} userId - ID of the member leaving
 * @returns {Promise<Object>} Result of leaving the community
 * 
 * Manages the process of a member leaving:
 * - Updates member status to 'inactive'
 * - Handles any outstanding obligations
 * - Updates community records
 */
CommunitySchema.methods.leaveCommunity = async function (userId) {
    try {
        const Member = mongoose.model('Member');
        
        // Find the member in this community
        const member = await Member.findOne({
            communityId: this._id,
            userId: userId
        });
        
        if (!member) {
            throw new Error('Member not found in this community');
        }
        
        // Check if the member is the admin
        if (this.admin.equals(userId)) {
            throw new Error('Community admin cannot leave the community. Transfer admin rights first.');
        }
        
        // Check for active cycles where the member is next in line
        const activeMidCycle = await MidCycle.findOne({
            _id: { $in: this.midCycle },
            'nextInLine.userId': userId,
            isComplete: false
        });
        
        if (activeMidCycle) {
            throw new Error('Cannot leave community while you are the next in line to receive a payout.');
        }
        
        // Check for outstanding obligations
        if (member.penalty > 0) {
            throw new Error('You have outstanding penalties to pay before leaving the community.');
        }
        
        // Change member status to inactive
        member.status = 'inactive';
        member.leaveDate = new Date();
        await member.save();
        
        await this.addActivityLog('member_left', userId);
        
        return {
            success: true,
            message: 'You have successfully left the community.',
            memberId: member._id
        };
    } catch (err) {
        console.error('Error in leaveCommunity method:', err);
        throw err;
    }
};

CommunitySchema.methods.handleUnreadyMidCycle = require('./handleUnreadyMidCycle');

// Strategic compound indexes for performance optimization
// Removed compound index with array field for MongoDB compatibility
CommunitySchema.index({ 'settings.contributionFrequency': 1 });
CommunitySchema.index({ 'admin': 1, 'settings.isPrivate': 1 });
CommunitySchema.index({ 'nextPayout': 1, 'cycleState': 1 });
CommunitySchema.index({ 'name': 'text', 'description': 'text' }); // Text index for search
// Removed problematic compound index on parallel arrays (members, cycles, midCycle)
// These can be indexed separately if needed:
// CommunitySchema.index({ 'members': 1 });
// CommunitySchema.index({ 'cycles': 1 });
// CommunitySchema.index({ 'midCycle': 1 });
CommunitySchema.index({ 'payoutDetails.nextRecipient': 1, 'payoutDetails.cycleNumber': 1 });

module.exports = mongoose.model('Community', CommunitySchema);
