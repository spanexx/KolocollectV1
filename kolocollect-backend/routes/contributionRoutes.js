const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(authMiddleware);
const contributionController = require('../controllers/contributionController');

// Contribution Routes

// Get all contributions
router.get('/', contributionController.getContributions);

// Get all contributions for a specific community
router.get('/community/:communityId', contributionController.getContributionsByCommunity);

// Get all contributions by a specific user
router.get('/user/:userId', contributionController.getContributionsByUser);

// Create a new contribution
router.post('/create', contributionController.createContribution);

// Get a single contribution by ID - must come after other specific GET routes
router.get('/:id', contributionController.getContributionById);

// Update a contribution
router.put('/:id', contributionController.updateContribution);

// Delete a contribution
router.delete('/:id', contributionController.deleteContribution);

// Get all contributions in mid-cycles for a community
// router.get('/community/:communityId/midcycles', contributionController.getMidCycleContributions);

// Fetch all contributions for a specific mid-cycle
// router.get('/midcycle/:midCycleId', contributionController.getContributionsByMidCycle);


module.exports = router;
