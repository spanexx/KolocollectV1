const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const testUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kolocollect');
    
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({}).limit(3);
    
    console.log('Available users:');
    users.forEach(u => {
      console.log(`- ID: ${u._id}, Email: ${u.email || 'No email'}, Name: ${u.name || 'No name'}`);
    });
    
    // Find the admin user for the community
    const adminUser = users.find(u => u._id.toString() === '684c56a3a7a4dd05d1cc4603');
    
    if (adminUser) {
      console.log('\nAdmin user found:', adminUser.email || adminUser.name);
      
      // Generate a valid JWT token
      const token = jwt.sign(
        { userId: adminUser._id.toString() },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );
      
      console.log('\nGenerated JWT token:');
      console.log(token);
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testUser();
