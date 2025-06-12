const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { monitorMongoConnection } = require('../utils/dbMonitor');

// Load the environment variables from the .env file
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
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
