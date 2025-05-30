const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load the environment variables from the .env file
dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection failed: ${error}`);
    process.exit(1); // Stop the app if the connection fails
  }
};

module.exports = connectDB;
