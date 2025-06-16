const mongoose = require('mongoose');
require('dotenv').config();

const testDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kolocollect');
    
    const Community = mongoose.model('Community', new mongoose.Schema({}, { strict: false }));
    const communities = await Community.find({}).limit(5);
    
    console.log('Available communities:');
    communities.forEach(c => {
      console.log(`- ID: ${c._id}, Name: ${c.name}, Admin: ${c.admin}`);
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
};

testDB();
