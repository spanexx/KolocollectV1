const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');
const authMiddleware = require('../middlewares/authMiddleware');
const User = require('../models/User');

// Middleware to require admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin privileges required' });
    }
    next();
  } catch (err) {
    console.error('Admin validation error:', err);
    return res.status(500).json({ message: 'Error validating admin status' });
  }
};

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(requireAdmin);

// Get payout status for all communities
router.get('/payout-status', schedulerController.getPayoutStatus);

// Manually trigger a payout check for a specific community
router.post('/trigger-payout/:communityId', schedulerController.triggerManualPayoutCheck);

// Fix synchronization issues between community nextPayout and midCycle payoutDate
router.post('/sync-payout-dates', schedulerController.syncAllPayoutDates);

module.exports = router;

// Fix synchronization issues between community nextPayout and midCycle payoutDate
router.post('/sync-payout-dates', schedulerController.syncAllPayoutDates);

module.exports = router;
