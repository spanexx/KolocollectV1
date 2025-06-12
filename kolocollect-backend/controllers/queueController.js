/**
 * Queue Controller
 * Phase 4: Scalability Improvements - Queue Management API
 * 
 * Provides API endpoints to:
 * - Monitor queue status
 * - Manage jobs
 * - View queue metrics
 */

const { getQueueService } = require('../utils/queueService');

const queueController = {
  /**
   * Get status of all queues
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getQueueStatus: async (req, res) => {
    try {
      const queueService = getQueueService();
      const stats = await queueService.getStats();
      
      return res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      console.error('Error getting queue status:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get queue status',
        error: error.message
      });
    }
  },
  
  /**
   * Get all jobs for a specific queue
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getQueueJobs: async (req, res) => {
    try {
      const { queueName } = req.params;
      const { status = 'active' } = req.query;
      
      const queueService = getQueueService();
      
      // Check if queue exists
      if (!queueService.queues[queueName]) {
        return res.status(404).json({
          status: 'error',
          message: `Queue "${queueName}" not found`
        });
      }
      
      const queue = queueService.queues[queueName];
      
      // Get jobs based on status
      let jobs = [];
      switch (status) {
        case 'active':
          jobs = await queue.getActive();
          break;
        case 'waiting':
          jobs = await queue.getWaiting();
          break;
        case 'delayed':
          jobs = await queue.getDelayed();
          break;
        case 'completed':
          jobs = await queue.getCompleted();
          break;
        case 'failed':
          jobs = await queue.getFailed();
          break;
        case 'all':
          const activeJobs = await queue.getActive();
          const waitingJobs = await queue.getWaiting();
          const delayedJobs = await queue.getDelayed();
          const completedJobs = await queue.getCompleted();
          const failedJobs = await queue.getFailed();
          
          jobs = [
            ...activeJobs.map(job => ({ ...job, status: 'active' })),
            ...waitingJobs.map(job => ({ ...job, status: 'waiting' })),
            ...delayedJobs.map(job => ({ ...job, status: 'delayed' })),
            ...completedJobs.map(job => ({ ...job, status: 'completed' })),
            ...failedJobs.map(job => ({ ...job, status: 'failed' }))
          ];
          break;
        default:
          return res.status(400).json({
            status: 'error',
            message: `Invalid status: ${status}`
          });
      }
      
      // Format jobs for response
      const formattedJobs = jobs.map(job => ({
        id: job.id,
        data: job.data,
        status: job.status || status,
        progress: job.progress,
        delay: job.opts?.delay,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
        finishedOn: job.finishedOn,
        processedOn: job.processedOn
      }));
      
      return res.status(200).json({
        status: 'success',
        data: {
          queue: queueName,
          status,
          count: formattedJobs.length,
          jobs: formattedJobs
        }
      });
    } catch (error) {
      console.error('Error getting queue jobs:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get queue jobs',
        error: error.message
      });
    }
  },
  
  /**
   * Retry a failed job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  retryJob: async (req, res) => {
    try {
      const { queueName, jobId } = req.params;
      
      const queueService = getQueueService();
      
      // Check if queue exists
      if (!queueService.queues[queueName]) {
        return res.status(404).json({
          status: 'error',
          message: `Queue "${queueName}" not found`
        });
      }
      
      const queue = queueService.queues[queueName];
      
      // Get the job
      const job = await queue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({
          status: 'error',
          message: `Job ${jobId} not found in queue "${queueName}"`
        });
      }
      
      // Retry the job
      await job.retry();
      
      return res.status(200).json({
        status: 'success',
        message: `Job ${jobId} in queue "${queueName}" has been retried`,
        data: {
          jobId,
          queueName
        }
      });
    } catch (error) {
      console.error('Error retrying job:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retry job',
        error: error.message
      });
    }
  },
  
  /**
   * Remove a job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  removeJob: async (req, res) => {
    try {
      const { queueName, jobId } = req.params;
      
      const queueService = getQueueService();
      
      // Check if queue exists
      if (!queueService.queues[queueName]) {
        return res.status(404).json({
          status: 'error',
          message: `Queue "${queueName}" not found`
        });
      }
      
      const queue = queueService.queues[queueName];
      
      // Get the job
      const job = await queue.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({
          status: 'error',
          message: `Job ${jobId} not found in queue "${queueName}"`
        });
      }
      
      // Remove the job
      await job.remove();
      
      return res.status(200).json({
        status: 'success',
        message: `Job ${jobId} in queue "${queueName}" has been removed`,
        data: {
          jobId,
          queueName
        }
      });
    } catch (error) {
      console.error('Error removing job:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to remove job',
        error: error.message
      });
    }
  },
  
  /**
   * Add a job to a queue
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  addJob: async (req, res) => {
    try {
      const { queueName } = req.params;
      const { data, options } = req.body;
      
      const queueService = getQueueService();
      
      // Check if queue exists
      if (!queueService.queues[queueName]) {
        return res.status(404).json({
          status: 'error',
          message: `Queue "${queueName}" not found`
        });
      }
      
      // Add the job
      const job = await queueService.addJob(queueName, data, options);
      
      return res.status(201).json({
        status: 'success',
        message: `Job added to queue "${queueName}"`,
        data: {
          jobId: job.id,
          queueName,
          data: job.data,
          options: job.opts
        }
      });
    } catch (error) {
      console.error('Error adding job:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to add job',
        error: error.message
      });
    }
  },
  
  /**
   * Manually trigger a payout for a community
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  triggerPayout: async (req, res) => {
    try {
      const { communityId } = req.params;
      
      const queueService = getQueueService();
      
      // Schedule immediate payout
      const job = await queueService.schedulePayout(communityId, new Date());
      
      return res.status(200).json({
        status: 'success',
        message: `Payout triggered for community ${communityId}`,
        data: {
          jobId: job.id,
          communityId,
          scheduledTime: new Date()
        }
      });
    } catch (error) {
      console.error('Error triggering payout:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to trigger payout',
        error: error.message
      });
    }
  }
};

module.exports = queueController;
