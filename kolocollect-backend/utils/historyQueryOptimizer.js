/**
 * Enhanced Query Optimizer Extension for community history
 * 
 * This extension adds additional methods to ensure completed midcycles
 * are properly included in the contribution history.
 */

const Community = require('../models/Community');
const Cycle = require('../models/Cycle');
const MidCycle = require('../models/Midcycle');
const mongoose = require('mongoose');
const { QueryOptimizer } = require('./queryOptimizer');

// Extend the QueryOptimizer with a specialized method for contribution history
QueryOptimizer.getCompleteCommunityHistory = async (communityId) => {
    try {
        console.log(`Getting complete history for community ${communityId}`);
        
        // Get basic community data
        const community = await Community.findById(communityId)
            .select('name description admin members cycles midCycle')
            .lean();
            
        if (!community) {
            throw new Error('Community not found');
        }
        
        // Get all cycles
        const cycles = await Cycle.find({ _id: { $in: community.cycles } })
            .sort({ cycleNumber: 1 })
            .lean();
        
        console.log(`Found ${cycles.length} cycles`);
            
        // Get all midcycles
        const midcycles = await MidCycle.find({ _id: { $in: community.midCycle } })
            .populate('contributions.user')
            .populate('contributions.contributions')
            .populate('nextInLine.userId')
            .populate('nextInLine.memberReference')
            .lean();
            
        console.log(`Found ${midcycles.length} midcycles`);
        
        // Group midcycles by cycle number
        const midcyclesByCycle = {};
        
        for (const mc of midcycles) {
            const cycleNumber = mc.cycleNumber || 'unknown';
            
            if (!midcyclesByCycle[cycleNumber]) {
                midcyclesByCycle[cycleNumber] = [];
            }
            
            midcyclesByCycle[cycleNumber].push(mc);
        }
        
        // Build the history structure expected by the frontend
        const history = [];
        
        for (const cycle of cycles) {
            const cycleData = {
                cycle: {
                    _id: cycle._id,
                    cycleNumber: cycle.cycleNumber,
                    name: `Cycle ${cycle.cycleNumber}`,
                    startDate: cycle.startDate,
                    expectedEndDate: cycle.expectedEndDate,
                    isComplete: cycle.isComplete
                },
                midcycles: []
            };
            
            // Add midcycles for this cycle
            const cycleMidcycles = midcyclesByCycle[cycle.cycleNumber] || [];
            
            if (cycleMidcycles.length > 0) {
                // Process midcycles
                for (const mc of cycleMidcycles) {
                    // Format contributions
                    const enhancedContributions = mc.contributions ? mc.contributions.map(contribution => {
                        // Calculate total amount
                        let totalAmount = 0;
                        if (contribution.contributions && contribution.contributions.length > 0) {
                            totalAmount = contribution.contributions.reduce((sum, contrib) => {
                                const amount = contrib.amount ? 
                                    (typeof contrib.amount === 'object' && contrib.amount.toString ? 
                                    parseFloat(contrib.amount.toString()) : contrib.amount) : 0;
                                return sum + amount;
                            }, 0);
                        }
                        
                        // Format user info
                        let userInfo = null;
                        if (contribution.user) {
                            userInfo = {
                                _id: contribution.user._id,
                                name: contribution.user.name || 'Unknown',
                                email: contribution.user.email || ''
                            };
                        }
                        
                        return {
                            _id: contribution._id,
                            user: userInfo,
                            contributions: contribution.contributions ? contribution.contributions.map(c => ({
                                _id: c._id,
                                amount: typeof c.amount === 'object' ? parseFloat(c.amount.toString()) : c.amount,
                                date: c.date,
                                status: c.status
                            })) : [],
                            totalAmount: totalAmount
                        };
                    }) : [];
                    
                    // Format next in line
                    let nextInLineDetails = null;
                    
                    if (mc.nextInLine) {
                        if (mc.nextInLine.memberReference) {
                            const memberRef = mc.nextInLine.memberReference;
                            if (memberRef) {
                                nextInLineDetails = {
                                    userId: memberRef.userId,
                                    name: memberRef.name || 'Unknown',
                                    email: memberRef.email,
                                    position: memberRef.position
                                };
                            }
                        } else if (mc.nextInLine.userId) {
                            if (typeof mc.nextInLine.userId === 'object' && mc.nextInLine.userId !== null) {
                                nextInLineDetails = {
                                    userId: mc.nextInLine.userId._id,
                                    name: mc.nextInLine.userId.name || 'Unknown',
                                    email: mc.nextInLine.userId.email || ''
                                };
                            }
                        } else if (mc.nextInLine.userName) {
                            nextInLineDetails = {
                                name: mc.nextInLine.userName,
                                position: mc.nextInLine.position || ''
                            };
                        } else if (mc.nextInLine.name) {
                            nextInLineDetails = {
                                name: mc.nextInLine.name,
                                position: mc.nextInLine.position || ''
                            };
                        }
                    }
                    
                    // Add formatted midcycle
                    cycleData.midcycles.push({
                        _id: mc._id,
                        cycleNumber: mc.cycleNumber,
                        isReady: mc.isReady,
                        isComplete: mc.isComplete,
                        payoutDate: mc.payoutDate,
                        payoutAmount: mc.payoutAmount,
                        nextInLine: nextInLineDetails,
                        contributions: enhancedContributions
                    });
                }
            }
            
            // Only add cycles that have midcycles
            if (cycleData.midcycles.length > 0) {
                history.push(cycleData);
            }
        }
        
        return {
            ...community,
            contributionHistory: history
        };
    } catch (error) {
        console.error('Error in getCompleteCommunityHistory:', error);
        throw error;
    }
};

module.exports = {
    QueryOptimizer
};
