const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { monitorMongoConnection } = require('../utils/dbMonitor');

// Load the environment variables from the .env file
dotenv.config();

const connectDB = async () => {
  try {    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 120000,    // Increased from 45000 to 120000 (2 minutes)
      connectTimeoutMS: 60000,    // Added explicit connection timeout (1 minute)
      serverSelectionTimeoutMS: 90000, // Added server selection timeout (1.5 minutes)
      heartbeatFrequencyMS: 10000,     // Added more frequent heartbeats
      family: 4                        // Force IPv4 (can help with some connectivity issues)
    });
    console.log('MongoDB connected');
    
    // Add monitoring
    monitorMongoConnection();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error}`);
    process.exit(1); // Stop the app if the connection fails
  }
};

module.exports = connectDB;
