/**
 * Simple Phase 4 Test
 * 
 * A minimal test script to verify the core functionality of Phase 4 components
 * without dependencies that might cause issues.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Redis = require('ioredis');

// Load environment variables
dotenv.config();

// Basic logging function
const log = (message, data = null) => {
  if (data) {
    console.log(`${message}:`, JSON.stringify(data, null, 2));
  } else {
    console.log(message);
  }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => log('MongoDB connected'))
  .catch(err => {
    log('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Redis client for verification
let redisClient;

// Test function
async function runSimpleTest() {
  try {
    log('Starting Phase 4 simple verification test...');
    log('==============================================');
    
    // Step 1: Verify Redis connection
    log('\n1. Verifying Redis connection...');
    try {
      redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redisClient.ping();
      log('✅ Redis connection successful');
    } catch (error) {
      log('❌ Redis connection failed:', error.message);
      process.exit(1);
    }
    
    // Step 2: Verify Redis is being used by checking keys
    log('\n2. Checking Redis keys...');
    try {
      const keys = await redisClient.keys('*');
      log('Redis keys found:', keys);
      
      const bullKeys = keys.filter(key => key.startsWith('bull:'));
      log(`Bull queue keys: ${bullKeys.length}`);
      
      const sessionKeys = keys.filter(key => key.startsWith('session:'));
      log(`Session keys: ${sessionKeys.length}`);
      
      if (bullKeys.length > 0) {
        log('✅ Bull queue keys found in Redis');
      } else {
        log('⚠️ No Bull queue keys found in Redis');
      }
    } catch (error) {
      log('❌ Redis key verification failed:', error.message);
    }
    
    // Step 3: Check environment variables
    log('\n3. Checking environment variables...');
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
        log(`✅ ${varName} is set to: ${process.env[varName]}`);
      } else {
        log(`❌ ${varName} is not set`);
        allVarsPresent = false;
      }
    }
    
    if (allVarsPresent) {
      log('✅ All required environment variables are present');
    } else {
      log('❌ Some required environment variables are missing');
    }
    
    // Step 4: Check package.json for required dependencies
    log('\n4. Checking for required packages...');
    const packageJson = require('./package.json');
    const requiredPackages = ['bull', 'ioredis', 'connect-redis', 'cookie-parser', 'uuid'];
    
    let allPackagesPresent = true;
    for (const pkg of requiredPackages) {
      if (packageJson.dependencies[pkg]) {
        log(`✅ ${pkg} is installed: ${packageJson.dependencies[pkg]}`);
      } else {
        log(`❌ ${pkg} is not installed`);
        allPackagesPresent = false;
      }
    }
    
    if (allPackagesPresent) {
      log('✅ All required packages are installed');
    } else {
      log('❌ Some required packages are missing');
    }
      // Final summary
    log('\n==============================================');
    log('Phase 4 Simple Verification Summary:');
    log('- Redis Connection: Working');
    log('- Redis Keys: ' + (keys && keys.filter(key => key.startsWith('bull:')).length > 0 ? 'Present' : 'Not Found'));
    log('- Environment Variables: ' + (allVarsPresent ? 'Complete' : 'Incomplete'));
    log('- Required Packages: ' + (allPackagesPresent ? 'All Installed' : 'Some Missing'));
    log('==============================================');
    
    // Clean up
    if (redisClient) {
      await redisClient.quit();
    }
    await mongoose.connection.close();
    
    log('Verification completed');
    process.exit(0);
  } catch (error) {
    log('Error during verification:', error.message);
    
    // Clean up
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }
    await mongoose.connection.close().catch(() => {});
    
    process.exit(1);
  }
}

// Run the verification
runSimpleTest();
