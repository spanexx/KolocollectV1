
const Community = require('../models/Community');
const Member = require('../models/Member');
const Cycle = require('../models/Cycle');
const MidCycle = require('../models/Midcycle');
const Contribution = require('../models/Contribution');
const mongoose = require('mongoose');

// Helper function to create standardized error responses
const createErrorResponse = (res, status, code, message) => {
  return res.status(status).json({
    status: 'error',
    error: {
      code,
      message
    }
  });
};

// Get community contribution history
exports.getCommunityContributionHistory = async (req, res) => {
  try {
    const { communityId } = req.params;    // First, find the community and populate cycles, mid-cycles, and members    console.log(`Fetching community history for ID: ${communityId}`);
    
    // Get the community with all necessary data
    const community = await Community.findById(communityId)
      .populate('cycles')
      .populate('members')
      .populate({
        path: 'midCycle',
        populate: [
          {
            path: 'nextInLine.userId',
            select: 'name email'
          },
          {
            path: 'nextInLine.memberReference',
            select: 'name email position userId'
          },
          {
            path: 'contributions',
            populate: [
              { 
                path: 'user', 
                select: 'name email' 
              },
              { 
                path: 'contributions', 
                model: 'Contribution', 
                select: 'amount date status user' 
              }
            ]
          }
        ]
      });
      
    console.log('Community loaded, has midCycle:', community && community.midCycle ? 
      community.midCycle.length : 'none');
      
    // If midCycle is populated, log the first one as a sample
    if (community && community.midCycle && community.midCycle.length > 0) {
      console.log('Sample midCycle:', {
        id: community.midCycle[0]._id,
        hasNextInLine: !!community.midCycle[0].nextInLine,
        contributionsCount: community.midCycle[0].contributions ? 
                           community.midCycle[0].contributions.length : 0
      });
    }
    
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    }
    
    // Group midcycles by their cycle number
    const cyclesWithMidcycles = {};
    
    // Process cycles
    if (community.cycles && community.cycles.length > 0) {
      community.cycles.forEach(cycle => {
        cyclesWithMidcycles[cycle.cycleNumber] = {
          cycle: {
            _id: cycle._id,
            cycleNumber: cycle.cycleNumber,
            startDate: cycle.startDate,
            expectedEndDate: cycle.expectedEndDate,
            isComplete: cycle.isComplete
          },
          midcycles: []
        };
      });
    }
    
    // Process midcycles and add them to their parent cycle
    if (community.midCycle && community.midCycle.length > 0) {
      community.midCycle.forEach(midcycle => {
        const cycleNumber = midcycle.cycleNumber;
        
        // If we don't have this cycle yet, add it to our structure
        if (!cyclesWithMidcycles[cycleNumber]) {
          cyclesWithMidcycles[cycleNumber] = {
            cycle: {
              cycleNumber,
              startDate: midcycle.startDate, // Approximation
              isComplete: midcycle.isComplete
            },
            midcycles: []
          };
        }        // Format contributions data
        let enhancedContributions = [];
        if (midcycle.contributions && midcycle.contributions.length > 0) {
          console.log(`Processing ${midcycle.contributions.length} contributions for midcycle ${midcycle._id}`);
          
          // Log a sample contribution to see its structure
          if (midcycle.contributions[0]) {
            console.log('Sample contribution structure:', JSON.stringify(midcycle.contributions[0], null, 2));
          }
          
          enhancedContributions = midcycle.contributions.map(contribution => {
            // Log the user object to see what's available
            console.log('Contribution user object:', contribution.user);
            
            // Calculate total contribution amount
            let totalAmount = 0;
            if (contribution.contributions && contribution.contributions.length > 0) {
              totalAmount = contribution.contributions.reduce((sum, contrib) => {
                const amount = contrib.amount ? 
                  (typeof contrib.amount === 'object' && contrib.amount.toString ? 
                    parseFloat(contrib.amount.toString()) : contrib.amount) : 0;
                return sum + amount;
              }, 0);
            }
            
            // Format user information
            let userInfo = null;
            if (contribution.user) {
              // Check if we have either name or _id
              const hasName = contribution.user.name && contribution.user.name !== 'Unknown';
              const hasId = contribution.user._id;
              
              console.log(`User info available - Name: ${hasName ? 'Yes' : 'No'}, ID: ${hasId ? 'Yes' : 'No'}`);
              
              userInfo = {
                _id: contribution.user._id,
                name: contribution.user.name || 'Unknown',
                email: contribution.user.email || ''
              };
              
              // Log the created userInfo
              console.log('Created userInfo:', userInfo);
            } else {
              console.log('No user object available for contribution');
            }
            
            return {
              _id: contribution._id,
              user: userInfo,
              contributions: contribution.contributions.map(c => ({
                _id: c._id,
                amount: typeof c.amount === 'object' ? parseFloat(c.amount.toString()) : c.amount,
                date: c.date,
                status: c.status
              })),
              totalAmount: totalAmount
            };
          });
        }// Get next in line member details
        let nextInLineDetails = null;
        
        console.log(`Processing nextInLine for midcycle ${midcycle._id}:`, 
          JSON.stringify(midcycle.nextInLine, null, 2));
        
        if (midcycle.nextInLine) {
          // Log full data structure for debugging
          console.log('Full nextInLine object:', midcycle.nextInLine);
          
          if (midcycle.nextInLine.memberReference) {
            // If the populated memberReference is available, use that
            const memberRef = midcycle.nextInLine.memberReference;
            console.log('Found memberRef:', memberRef);
            
            if (memberRef) {
              nextInLineDetails = {
                userId: memberRef.userId,
                name: memberRef.name || 'Unknown',
                email: memberRef.email,
                position: memberRef.position
              };
              console.log('Set nextInLineDetails from memberRef:', nextInLineDetails);
            }
          } 
          
          // Try using userId directly if it exists and is populated
          if (!nextInLineDetails && midcycle.nextInLine.userId) {
            if (typeof midcycle.nextInLine.userId === 'object' && midcycle.nextInLine.userId !== null) {
              nextInLineDetails = {
                userId: midcycle.nextInLine.userId._id,
                name: midcycle.nextInLine.userId.name || 'Unknown',
                email: midcycle.nextInLine.userId.email || ''
              };
            } 
            // Try to find in community members as a fallback
            else if (community.members && community.members.length > 0) {
              console.log('Searching in community members');
              const nextInLineMember = community.members.find(m => 
                (midcycle.nextInLine.memberReference && m._id.toString() === midcycle.nextInLine.memberReference.toString()) || 
                (m.userId && midcycle.nextInLine.userId && m.userId.toString() === midcycle.nextInLine.userId.toString())
              );
              
              if (nextInLineMember) {
                nextInLineDetails = {
                  userId: nextInLineMember.userId,
                  name: nextInLineMember.name || 'Unknown',
                  email: nextInLineMember.email,
                  position: nextInLineMember.position
                };
                console.log('Set nextInLineDetails from community members:', nextInLineDetails);
              }
            }
          }
          
          // If we still don't have details but we have userName, use that
          if (!nextInLineDetails && midcycle.nextInLine.userName) {
            nextInLineDetails = {
              name: midcycle.nextInLine.userName,
              position: midcycle.nextInLine.position || ''
            };
            console.log('Set nextInLineDetails from userName:', nextInLineDetails);
          }
          
          // If we still have nothing, look for any name property
          if (!nextInLineDetails && midcycle.nextInLine.name) {
            nextInLineDetails = {
              name: midcycle.nextInLine.name,
              position: midcycle.nextInLine.position || ''
            };
            console.log('Set nextInLineDetails from name property:', nextInLineDetails);
          }
        }
        
        console.log(`Final nextInLineDetails for midcycle ${midcycle._id}:`, nextInLineDetails);
        
        // Add mid-cycle to its parent cycle group
        cyclesWithMidcycles[cycleNumber].midcycles.push({
          _id: midcycle._id,
          cycleNumber: midcycle.cycleNumber,
          isReady: midcycle.isReady,
          isComplete: midcycle.isComplete,
          payoutDate: midcycle.payoutDate,
          payoutAmount: midcycle.payoutAmount,
          nextInLine: nextInLineDetails,
          contributions: enhancedContributions
        });
      });
    }
    
    // Convert to array for easier frontend processing
    const contributionHistory = Object.values(cyclesWithMidcycles);
      res.status(200).json({
      status: 'success',
      message: 'Community contribution history retrieved successfully',
      data: contributionHistory
    });
    console.log('Contribution history retrieved successfully:', contributionHistory);
  } catch (err) {
    console.error('Error fetching contribution history:', err);
    return createErrorResponse(
      res, 
      500, 
      'GET_CONTRIBUTION_HISTORY_ERROR', 
      'Error retrieving contribution history: ' + err.message
    );
  }
};
  
