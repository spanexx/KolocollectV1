const mongoose = require('mongoose');
const Community = require('../models/Community'); // Import the Community model

/**
 * Check if all active members have been paid in the active cycle.
 * @param {ObjectId} communityId - The ID of the community.
 * @returns {Promise<boolean>} - Returns true if all active members have been paid, otherwise false.
 */
const checkAllActiveMembersPaid = async (communityId) => {
    try {
        const community = await Community.findById(communityId);
        if (!community) throw new Error('Community not found');

        const activeCycle = community.cycles.find(cycle => !cycle.isComplete);
        if (!activeCycle) throw new Error('No active cycle found');

        const activeMembers = community.members.filter(member => member.status === 'active').map(member => member.userId.toString());
        const paidMembers = activeCycle.paidMembers.map(id => id.toString());

        const allPaid = activeMembers.every(id => paidMembers.includes(id));
        return allPaid;
    } catch (err) {
        console.error('Error in checkAllActiveMembersPaid:', err);
        throw err;
    }
};

/**
 * Add the recipient to the paidMembers array in the active cycle.
 * @param {ObjectId} communityId - The ID of the community.
 * @param {ObjectId} recipientId - The ID of the recipient.
 * @returns {Promise<void>}
 */
const addRecipientToPaidMembers = async (communityId, recipientId) => {
    try {
        const community = await Community.findById(communityId);
        if (!community) throw new Error('Community not found');

        const activeCycle = community.cycles.find(cycle => !cycle.isComplete);
        if (!activeCycle) throw new Error('No active cycle found');

        if (!activeCycle.paidMembers.includes(recipientId)) {
            activeCycle.paidMembers.push(recipientId);
            await community.save();
        }
    } catch (err) {
        console.error('Error in addRecipientToPaidMembers:', err);
        throw err;
    }
};

/**
 * Retrieve the next recipient and check their eligibility.
 * @param {ObjectId} communityId - The ID of the community.
 * @returns {Promise<Object>} - Returns the recipient object if eligible, otherwise throws an error.
 */
const getNextRecipient = async (communityId) => {
    try {
        const community = await Community.findById(communityId);
        if (!community) throw new Error('Community not found');

        const activeMidCycle = community.midCycle.find((mc) => mc.isReady && !mc.isComplete);
        if (!activeMidCycle) throw new Error('No mid-cycle ready for payout distribution.');

        const nextRecipientId = activeMidCycle.nextInLine.userId;
        const recipient = community.members.find((m) => m.userId.equals(nextRecipientId));
        if (!recipient || recipient.status !== 'active') {
            throw new Error('Next-in-line recipient is not eligible for payout.');
        }

        return { recipient, nextRecipientId, payoutAmount: activeMidCycle.payoutAmount };
    } catch (err) {
        console.error('Error in getNextRecipient:', err);
        throw err;
    }
};

module.exports = {
    checkAllActiveMembersPaid,
    addRecipientToPaidMembers,
    getNextRecipient,
};