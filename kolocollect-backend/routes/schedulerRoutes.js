const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');
const authMiddleware = require('../middlewares/authMiddleware');

// All routes require authentication and admin privileges
router.use(authMiddleware.authenticateToken);
router.use(authMiddleware.requireAdmin);

// Get payout status for all communities
router.get('/payout-status', schedulerController.getPayoutStatus);

// Manually trigger a payout check for a specific community
router.post('/trigger-payout/:communityId', schedulerController.triggerManualPayoutCheck);

// Fix synchronization issues between community nextPayout and midCycle payoutDate
router.post('/sync-payout-dates', schedulerController.syncAllPayoutDates);

module.exports = router;
