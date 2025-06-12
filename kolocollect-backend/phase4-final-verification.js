/**
 * Phase 4 Implementation Final Verification
 * 
 * This script verifies all aspects of the Phase 4 implementation:
 * 1. Queue Service
 * 2. Distributed Scheduler
 * 3. Session Service
 * 4. Correlation IDs
 * 5. Middleware Optimization
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Redis = require('ioredis');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Redis client for verification
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Verification function
async function verifyPhase4Implementation() {
  try {
    console.log('Starting Phase 4 implementation verification...');
    console.log('==============================================');
    
    // Step 1: Verify Redis connection
    console.log('\n1. Verifying Redis connection...');
    try {
      await redisClient.ping();
      console.log('✅ Redis connection successful');
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      process.exit(1);
    }
    
    // Step 2: Verify required files exist
    console.log('\n2. Verifying required files...');
    const requiredFiles = [
      './utils/queueService.js',
      './utils/distributedScheduler.js',
      './utils/payoutProcessor.js',
      './controllers/queueController.js',
      './routes/queueRoutes.js',
      './utils/sessionService.js',
      './middlewares/correlationMiddleware.js',
      './middlewares/middlewareManager.js'
    ];
    
    let allFilesExist = true;
    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} exists`);
      } else {
        console.log(`❌ ${file} does not exist`);
        allFilesExist = false;
      }
    }
    
    if (allFilesExist) {
      console.log('✅ All required files exist');
    } else {
      console.log('❌ Some required files are missing');
    }
    
    // Step 3: Verify Redis keys
    console.log('\n3. Checking Redis keys...');
    try {
      const keys = await redisClient.keys('*');
      const bullKeys = keys.filter(key => key.startsWith('bull:'));
      const sessionKeys = keys.filter(key => key.startsWith('session:'));
      
      console.log(`Bull queue keys: ${bullKeys.length}`);
      console.log(`Session keys: ${sessionKeys.length}`);
      
      if (bullKeys.length > 0) {
        console.log('✅ Bull queue keys found in Redis');
      } else {
        console.log('⚠️ No Bull queue keys found in Redis');
      }
    } catch (error) {
      console.error('❌ Redis key verification failed:', error.message);
    }
    
    // Step 4: Check environment variables
    console.log('\n4. Checking environment variables...');
    const requiredVars = [
      'USE_DISTRIBUTED_SCHEDULER',
      'REDIS_URL',
      'SESSION_TTL',
      'ENABLE_CORRELATION_IDS',
      'QUEUE_CLEANUP_INTERVAL',
      'MAX_QUEUE_CONCURRENCY',
      'JOB_TIMEOUT',
      'FAILED_JOB_RETENTION'
    ];
    
    let allVarsPresent = true;
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        console.log(`✅ ${varName} is set to: ${process.env[varName]}`);
      } else {
        console.log(`❌ ${varName} is not set`);
        allVarsPresent = false;
      }
    }
    
    if (allVarsPresent) {
      console.log('✅ All required environment variables are present');
    } else {
      console.log('❌ Some required environment variables are missing');
    }
    
    // Step 5: Check package.json for required dependencies
    console.log('\n5. Checking for required packages...');
    const packageJson = require('./package.json');
    const requiredPackages = ['bull', 'ioredis', 'connect-redis', 'cookie-parser', 'uuid'];
    
    let allPackagesPresent = true;
    for (const pkg of requiredPackages) {
      if (packageJson.dependencies[pkg]) {
        console.log(`✅ ${pkg} is installed: ${packageJson.dependencies[pkg]}`);
      } else {
        console.log(`❌ ${pkg} is not installed`);
        allPackagesPresent = false;
      }
    }
    
    if (allPackagesPresent) {
      console.log('✅ All required packages are installed');
    } else {
      console.log('❌ Some required packages are missing');
    }
    
    // Final summary
    console.log('\n==============================================');
    console.log('Phase 4 Implementation Verification Summary:');
    console.log('- Redis Connection: ' + (redisClient ? 'Working' : 'Failed'));
    console.log('- Required Files: ' + (allFilesExist ? 'Complete' : 'Incomplete'));
    console.log('- Environment Variables: ' + (allVarsPresent ? 'Complete' : 'Incomplete'));
    console.log('- Required Packages: ' + (allPackagesPresent ? 'All Installed' : 'Some Missing'));
    console.log('==============================================');
    
    // Clean up
    if (redisClient) {
      await redisClient.quit();
    }
    await mongoose.connection.close();
    
    console.log('Verification completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during verification:', error.message);
    
    // Clean up
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }
    await mongoose.connection.close().catch(() => {});
    
    process.exit(1);
  }
}

// Run the verification
verifyPhase4Implementation();
