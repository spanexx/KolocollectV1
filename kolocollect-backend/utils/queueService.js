/**
 * Queue Service
 * Phase 4: Scalability Improvements - Distributed Job Processing
 * 
 * Provides centralized queue management with:
 * - Job queue for payout processing
 * - Job queue for heavy data processing tasks
 * - Error handling and retry mechanisms
 * - Queue monitoring
 */

const Queue = require('bull');
const logger = require('./logger');

// Queue configurations
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000 // 5 seconds initial delay
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 200      // Keep last 200 failed jobs
};

// Queue names
const QUEUE_NAMES = {
  PAYOUTS: 'payouts',
  ANALYTICS: 'analytics',
  NOTIFICATIONS: 'notifications',
  EXPORTS: 'exports'
};

class QueueService {
  constructor(options = {}) {
    this.isInitialized = false;
    this.options = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      ...options
    };
    
    // Queue instances
    this.queues = {};
    
    // Job processors
    this.processors = {};
  }
  
  /**
   * Initialize all queues
   */
  async initialize() {
    try {
      logger.info('Initializing Queue Service...');
      
      // Create queue instances
      for (const queueName of Object.values(QUEUE_NAMES)) {
        this.queues[queueName] = new Queue(queueName, this.options.redisUrl);
        
        // Set up event listeners for each queue
        this.setupQueueListeners(queueName);
      }
      
      this.isInitialized = true;
      logger.info('Queue Service initialized successfully');
      
      return true;
    } catch (error) {
      logger.error({ msg: 'Failed to initialize queue service', error });
      return false;
    }
  }
  
  /**
   * Setup queue event listeners
   * @param {string} queueName - Name of the queue
   */
  setupQueueListeners(queueName) {
    const queue = this.queues[queueName];
    
    queue.on('error', (error) => {
      logger.error({ msg: `Queue ${queueName} error`, error });
    });
    
    queue.on('failed', (job, error) => {
      logger.error({
        msg: `Job ${job.id} in queue ${queueName} failed`,
        jobId: job.id,
        data: job.data,
        error: error.message,
        attempts: job.attemptsMade
      });
    });
    
    queue.on('completed', (job) => {
      logger.info({
        msg: `Job ${job.id} in queue ${queueName} completed successfully`,
        jobId: job.id,
        data: job.data
      });
    });
    
    queue.on('stalled', (jobId) => {
      logger.warn({
        msg: `Job ${jobId} in queue ${queueName} stalled`,
        jobId
      });
    });
  }
  
  /**
   * Register a processor function for a queue
   * @param {string} queueName - Name of the queue
   * @param {Function} processorFn - Function to process jobs
   * @param {number} concurrency - Number of jobs to process concurrently
   */
  registerProcessor(queueName, processorFn, concurrency = 1) {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }
    
    if (!this.queues[queueName]) {
      throw new Error(`Queue "${queueName}" not found`);
    }
    
    this.queues[queueName].process(concurrency, async (job) => {
      try {
        logger.info({
          msg: `Processing job ${job.id} in queue ${queueName}`,
          jobId: job.id,
          data: job.data
        });
        
        return await processorFn(job);
      } catch (error) {
        logger.error({
          msg: `Error processing job ${job.id} in queue ${queueName}`,
          jobId: job.id,
          data: job.data,
          error: error.message
        });
        throw error;
      }
    });
    
    this.processors[queueName] = processorFn;
    logger.info(`Registered processor for queue "${queueName}" with concurrency ${concurrency}`);
  }
  
  /**
   * Add a job to a queue
   * @param {string} queueName - Name of the queue
   * @param {Object} data - Job data
   * @param {Object} options - Job options
   * @returns {Promise<Object>} - Job object
   */
  async addJob(queueName, data, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }
    
    if (!this.queues[queueName]) {
      throw new Error(`Queue "${queueName}" not found`);
    }
    
    const jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      ...options
    };
    
    const job = await this.queues[queueName].add(data, jobOptions);
    
    logger.info({
      msg: `Added job to queue "${queueName}"`,
      jobId: job.id,
      data,
      options: jobOptions
    });
    
    return job;
  }
  
  /**
   * Schedule a payout job
   * @param {string} communityId - Community ID
   * @param {Date} payoutDate - Scheduled payout date
   * @returns {Promise<Object>} - Job object
   */
  async schedulePayout(communityId, payoutDate) {
    const now = new Date();
    const payoutDateTime = new Date(payoutDate);
    const delay = Math.max(0, payoutDateTime - now);
    
    logger.info({
      msg: `Scheduling payout for community ${communityId}`,
      communityId,
      payoutDate: payoutDateTime.toISOString(),
      delay: `${Math.floor(delay / 1000)} seconds`
    });
    
    return this.addJob(QUEUE_NAMES.PAYOUTS, { communityId }, { delay });
  }
  
  /**
   * Remove scheduled payout for a community
   * @param {string} communityId - Community ID
   * @returns {Promise<number>} - Number of jobs removed
   */
  async removeScheduledPayout(communityId) {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }
    
    const payoutQueue = this.queues[QUEUE_NAMES.PAYOUTS];
    const jobs = await payoutQueue.getJobs(['delayed', 'waiting']);
    
    const communityJobs = jobs.filter(job => 
      job.data && job.data.communityId === communityId
    );
    
    // Remove all jobs for this community
    for (const job of communityJobs) {
      await job.remove();
      logger.info({
        msg: `Removed scheduled payout job for community ${communityId}`,
        jobId: job.id
      });
    }
    
    return communityJobs.length;
  }
  
  /**
   * Get queue statistics
   * @returns {Promise<Object>} - Queue statistics
   */
  async getStats() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }
    
    const stats = {};
    
    for (const [name, queue] of Object.entries(this.queues)) {
      stats[name] = {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
        delayed: await queue.getDelayedCount()
      };
    }
    
    return {
      status: 'active',
      queues: stats,
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (!this.isInitialized) {
      return;
    }
    
    logger.info('Shutting down Queue Service...');
    
    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        await queue.close();
        logger.info(`Closed queue: ${name}`);
      } catch (error) {
        logger.error({ msg: `Error closing queue ${name}`, error });
      }
    }
    
    this.isInitialized = false;
    logger.info('Queue Service shut down successfully');
  }
}

// Singleton instance
let queueServiceInstance = null;

/**
 * Get or create queue service instance
 */
function getQueueService(options = {}) {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService(options);
  }
  return queueServiceInstance;
}

/**
 * Initialize queue service (call once at app startup)
 */
async function initializeQueueService(options = {}) {
  // Always get the singleton instance
  const queueService = getQueueService(options);
  
  // Only initialize if not already initialized
  if (!queueService.isInitialized) {
    await queueService.initialize();
  }
  
  return queueService;
}

module.exports = {
  QueueService,
  getQueueService,
  initializeQueueService,
  QUEUE_NAMES
};
