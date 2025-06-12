/**
 * Distributed Scheduler - Phase 4: Scalability Improvements
 * 
 * Uses Bull queue for distributed job processing:
 * - Schedules payouts using queue instead of direct processing
 * - Monitors communities and schedules jobs as needed
 * - Provides more reliable and scalable processing
 * 
 * Note: This is an enhancement to the original scheduler.js implementation
 * which used direct cron-based scheduling.
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const { getQueueService, initializeQueueService, QUEUE_NAMES } = require('./queueService');
const { processPayoutJob, getActiveMidCycle, syncPayoutDates } = require('./payoutProcessor');
const logger = require('./logger');

// Import models
const Community = require('../models/Community');
const MidCycle = require('../models/Midcycle');

/**
 * Main function to initialize the distributed scheduler system
 */
const initializeDistributedScheduler = async () => {
  try {
    logger.info('Initializing distributed scheduler system...');
    
    // Initialize queue service
    const queueService = await initializeQueueService();
    
    // Register payout processor
    queueService.registerProcessor(QUEUE_NAMES.PAYOUTS, processPayoutJob, 2);
    
    // Start the schedule monitoring process
    startScheduleMonitoring();
    
    logger.info('Distributed scheduler system initialized successfully');
    return true;
  } catch (error) {
    logger.error({ msg: 'Failed to initialize distributed scheduler system', error });
    return false;
  }
};

/**
 * Monitor communities and schedule payout jobs as needed
 */
const startScheduleMonitoring = () => {
  // Run every minute to monitor communities and manage job scheduling
  cron.schedule('* * * * *', async () => {
    try {
      logger.info('Running schedule monitoring...');
      
      const queueService = getQueueService();
      const now = new Date();
      
      // Fetch all communities with their active mid-cycles
      const allCommunities = await Community.find();
      
      logger.info(`Checking ${allCommunities.length} communities for scheduling`);
      
      // Process each community
      for (const community of allCommunities) {
        try {
          // Get the active mid-cycle
          const activeMidCycle = await getActiveMidCycle(community);
          
          if (!activeMidCycle) {
            continue; // Skip communities without active mid-cycles
          }
          
          // Synchronize community.nextPayout with midCycle.payoutDate
          await syncPayoutDates(community, activeMidCycle);
          
          // Check if this community already has a scheduled job
          const stats = await queueService.getStats();
          const payoutQueueStats = stats.queues[QUEUE_NAMES.PAYOUTS];
          
          // Only schedule if we have a valid payout date
          if (activeMidCycle.payoutDate) {
            const payoutDate = new Date(activeMidCycle.payoutDate);
            
            // If payout date is in the past, schedule immediately
            if (payoutDate <= now) {
              logger.info(`Payout overdue for community ${community.name} (${community._id}). Scheduling immediate processing.`);
              await queueService.removeScheduledPayout(community._id.toString());
              await queueService.schedulePayout(community._id.toString(), now);
            } else {
              // Payout is in the future, schedule it with appropriate delay
              const timeToNextPayout = payoutDate - now;
              const minutesToNextPayout = Math.floor(timeToNextPayout / 60000);
              
              logger.info(`Community ${community.name} (${community._id}) next payout in ${minutesToNextPayout} minutes`);
              
              // Schedule or reschedule as needed (remove existing job and schedule again)
              await queueService.removeScheduledPayout(community._id.toString());
              await queueService.schedulePayout(community._id.toString(), payoutDate);
            }
          }
        } catch (communityError) {
          logger.error({ 
            msg: `Error processing community ${community.name} (${community._id})`, 
            error: communityError.message 
          });
        }
      }
      
      // Log queue statistics
      const stats = await queueService.getStats();
      logger.info({
        msg: 'Queue statistics',
        stats: stats.queues
      });
      
    } catch (error) {
      logger.error({ msg: 'Error in schedule monitoring', error });
    }
  });
  
  logger.info('Schedule monitoring started');
};

module.exports = initializeDistributedScheduler;
