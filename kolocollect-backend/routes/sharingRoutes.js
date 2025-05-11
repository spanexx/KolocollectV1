const express = require('express');
const router = express.Router();
const sharingController = require('../controllers/sharingController');
const authMiddleware = require('../middlewares/authMiddleware');

// PDF Generation and Download Routes
router.get('/communities/:id/export/pdf', authMiddleware, sharingController.exportCommunityAsPdf);
router.get('/contributions/:id/export/pdf', authMiddleware, sharingController.exportContributionAsPdf);
router.get('/communities/:communityId/cycles/:cycleId/export/pdf', authMiddleware, sharingController.exportCycleAsPdf);
router.get('/communities/:communityId/midcycles/:midcycleId/export/pdf', authMiddleware, sharingController.exportMidcycleAsPdf);

// Sharing Routes
router.post('/communities/share/:id', authMiddleware, sharingController.shareCommunity);
router.post('/contributions/share/:id', authMiddleware, sharingController.shareContribution);
router.post('/communities/:communityId/cycles/share/:cycleId', authMiddleware, sharingController.shareCycle);
router.post('/communities/:communityId/midcycles/share/:midcycleId', authMiddleware, sharingController.shareMidcycle);

module.exports = router;