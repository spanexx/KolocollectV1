const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(authMiddleware);
const payoutController = require('../controllers/payoutController');

// Payout Routes
router.get('/community/:communityId', payoutController.getPayoutsByCommunity); // Get all payouts for a specific community
router.get('/user/:userId', payoutController.getPayoutsByUser); // Get all payouts by a specific user
router.get('/:id', payoutController.getPayoutById); // Get a single payout by ID
router.delete('/:id', payoutController.deletePayout); // Delete a payout by ID
router.get('/', payoutController.getAllPayouts); // Get all payouts

module.exports = router;


