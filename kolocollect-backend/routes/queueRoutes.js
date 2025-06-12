/**
 * Queue Routes
 * Phase 4: Scalability Improvements - Queue Management API
 * 
 * Provides API endpoints to:
 * - Monitor queue status
 * - Manage jobs
 * - View queue metrics
 * - Manually trigger payouts
 */

const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');
const authMiddleware = require('../middlewares/authMiddleware');

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

// Get status of all queues
router.get('/status', queueController.getQueueStatus);

// Get all jobs for a specific queue
router.get('/queues/:queueName/jobs', queueController.getQueueJobs);

// Retry a failed job
router.post('/queues/:queueName/jobs/:jobId/retry', queueController.retryJob);

// Remove a job
router.delete('/queues/:queueName/jobs/:jobId', queueController.removeJob);

// Add a job to a queue
router.post('/queues/:queueName/jobs', queueController.addJob);

// Manually trigger a payout for a community
router.post('/trigger-payout/:communityId', queueController.triggerPayout);

module.exports = router;
