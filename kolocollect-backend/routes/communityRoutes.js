const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
const communityController = require('../controllers/communityController');


// Route to search communities
router.get('/search', communityController.searchCommunity);  // GET for search with query params

// Route to filter communities
router.get('/filter', communityController.filterCommunity);    // Changed to GET with query params

// Public routes (no auth required)
router.get('/all', communityController.getAllCommunities);
router.get('/:id', communityController.getCommunityById);
router.get('/:communityId/midcycles/:midcycleId', communityController.getMidcycleById); // New route to get midcycle by ID
router.get('/:communityId/current-midcycle', communityController.getCurrentMidCycleDetails); // Get current mid-cycle details
router.get('/:communityId/midcycle-contributions', communityController.getMidCycleContributions); // Get mid-cycle contributions

// Protected routes (auth required)
router.use(authMiddleware);


// Route to create a new community
router.post('/', communityController.createCommunity);

// Route to join a community
router.post('/join/:communityId', communityController.joinCommunity);

// Route to update community settings
router.put('/:communityId', communityController.updateSettings);

// Route to delete a community
router.delete('/:communityId', communityController.deleteCommunity);

// Route to distribute payouts
router.post('/payouts/distribute/:communityId', communityController.distributePayouts);

// Route to reactivate a member
router.post('/member/reactivate/:communityId/:userId', communityController.reactivateMember);

// Route to create a new vote
router.post('/:communityId/votes', communityController.createVote);

// Route to cast a vote
router.post('/:communityId/votes/:voteId', communityController.castVote);

// Routes moved to public section above

router.get('/payout/:communityId', communityController.getPayoutInfo);

// Route to pay penalty and missed contributions
router.post('/:communityId/members/:userId/payPenaltyAndMissedContribution', communityController.payPenaltyAndMissedContribution);

// Route to skip contribution and mark mid-cycle as ready
router.post('/:communityId/midCycles/:midCycleId/skipContributionAndMarkReady', communityController.skipContributionAndMarkReady);

// Route to update member details
router.put('/:communityId/members/:userId', communityController.memberUpdate);

// Route to pay second installment
router.post('/:communityId/members/:userId/paySecondInstallment', communityController.paySecondInstallment);

// Route for backPaymentDistribute
router.post('/:communityId/midcycle_joiners/:midCycleJoinersId/back_payments', communityController.backPaymentDistribute);

// Route for searchMidcycleJoiners
router.get('/:communityId/midcycle_joiners/:midCycleJoinersId', communityController.searchMidcycleJoiners);

// Route to handle wallet operations for defaulters
router.post('/:communityId/defaulters/:userId/wallet', communityController.handleWalletForDefaulters);

// Leave a community
router.delete('/:communityId/leave/:userId', communityController.leaveCommunity);

// Route to start a new cycle
router.post('/:communityId/startNewCycle', communityController.startNewCycle);

module.exports = router;
