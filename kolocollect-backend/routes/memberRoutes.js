const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET all members
router.get('/', memberController.getAllMembers);

// GET members by community ID
router.get('/community/:communityId', memberController.getMembersByCommunityId);

// GET active member count by community ID
router.get('/community/:communityId/active-count', memberController.getActiveMemberCount);

// GET active member counts for multiple communities in one request
router.post('/communities/active-counts', memberController.getBatchActiveMemberCounts);

// GET member by ID
router.get('/:memberId', memberController.getMemberById);

// PATCH update member status
router.patch(
  '/:memberId/status',
  [
    check('status').isIn(['active', 'inactive', 'waiting'])
      .withMessage('Status must be active, inactive, or waiting')
  ],
  memberController.updateMemberStatus
);

module.exports = router;
