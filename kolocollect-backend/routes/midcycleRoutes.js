const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const authMiddleware = require('../middlewares/authMiddleware');

// Public midcycle endpoints (no auth required)
router.get('/community/:communityId/all', communityController.getMidcyclesByCommunityId);
router.get('/community/:communityId/active', communityController.getActiveMidcycle);
router.get('/community/:communityId/midcycle/:midcycleId', communityController.getMidcycleById);
router.get('/community/:communityId/current', communityController.getCurrentMidCycleDetails);

// Protected midcycle endpoints (auth required)
router.use(authMiddleware);

// Start a new midcycle
router.post('/community/:communityId/start', communityController.startMidCycle);

// Skip contribution and mark midcycle as ready
router.post('/:midcycleId/skipContribution', communityController.skipContributionAndMarkReady);

// Get midcycle contributions
router.get('/:midcycleId/contributions', communityController.getMidCycleContributions);

// Check midcycle readiness
router.get('/:midcycleId/readiness', communityController.checkMidcycleReadiness);

// Get midcycle joiners
router.get('/:midcycleId/joiners', communityController.getMidcycleJoiners);

// Route for backPaymentDistribute
router.post('/:midcycleId/joiners/:joinerId/distribute', communityController.backPaymentDistribute);

// Route for searchMidcycleJoiners
router.get('/:midcycleId/joiners/:joinerId', communityController.searchMidcycleJoiners);

module.exports = router;
