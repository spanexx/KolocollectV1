/**
 * Test Distributed Scheduler
 * 
 * This script tests the distributed scheduler implementation by:
 * 1. Initializing the queue service
 * 2. Adding a test job to the queue
 * 3. Verifying the job was processed correctly
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { initializeQueueService, getQueueService, QUEUE_NAMES } = require('./utils/queueService');
const { processPayoutJob } = require('./utils/payoutProcessor');
const Community = require('./models/Community');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Test function
async function testDistributedScheduler() {
  try {
    console.log('Starting distributed scheduler test...');
    
    // Step 1: Initialize the queue service
    console.log('Initializing queue service...');
    const queueService = await initializeQueueService();
    
    // Register the payout processor
    queueService.registerProcessor(QUEUE_NAMES.PAYOUTS, processPayoutJob, 1);
    
    // Step 2: Get an existing community from the database
    const communities = await Community.find().limit(1);
    
    if (communities.length === 0) {
      console.error('No communities found in the database. Test cannot continue.');
      process.exit(1);
    }
    
    const testCommunity = communities[0];
    console.log(`Using community "${testCommunity.name}" (${testCommunity._id}) for testing`);
    
    // Step 3: Add a test job to the queue
    console.log('Adding test job to the queue...');
    const job = await queueService.addJob(QUEUE_NAMES.PAYOUTS, {
      communityId: testCommunity._id.toString(),
      testMode: true
    });
    
    console.log(`Job added with ID: ${job.id}`);
    
    // Step 4: Wait for the job to be processed
    console.log('Waiting for job to be processed...');
    
    const completedJob = await job.finished();
    
    // Step 5: Output the result
    console.log('Job processing completed:');
    console.log('Result:', JSON.stringify(completedJob, null, 2));
    
    // Step 6: Get queue stats
    const stats = await queueService.getStats();
    console.log('Queue stats:', JSON.stringify(stats, null, 2));
    
    console.log('Test completed successfully');
    
    // Close connections
    await queueService.close();
    await mongoose.connection.close();
    
    process.exit(0);
  } catch (error) {
    console.error('Error during distributed scheduler test:', error);
    process.exit(1);
  }
}

// Run the test
testDistributedScheduler();
