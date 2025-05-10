const mongoose = require('mongoose');
const MidCycle = require('./models/Midcycle');
const Contribution = require('./models/Contribution');
const User = require('./models/User');
const Member = require('./models/Member');
require('./config/db');

async function debugMidcycle() {
  try {
    // Find a midcycle
    const midcycle = await MidCycle.findOne()
      .populate('nextInLine.userId')
      .populate('nextInLine.memberReference')
      .populate({
        path: 'contributions',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'contributions', model: 'Contribution', select: 'amount date status' }
        ]
      });
    
    console.log('Sample midcycle ID:', midcycle ? midcycle._id : 'none found');
    console.log('nextInLine data:', JSON.stringify(midcycle && midcycle.nextInLine ? midcycle.nextInLine : null, null, 2));
    
    if (midcycle && midcycle.contributions && midcycle.contributions.length > 0) {
      console.log(`Found ${midcycle.contributions.length} contributions`);
      console.log('Sample contribution user:', JSON.stringify(midcycle.contributions[0].user, null, 2));
    } else {
      console.log('No contributions found');
    }
    
    // Find if any member is marked as nextInLine in any midcycle
    const midcyclesWithNextInLine = await MidCycle.find({ 'nextInLine.userId': { $exists: true, $ne: null } })
      .select('nextInLine');
      
    console.log(`Found ${midcyclesWithNextInLine.length} midcycles with nextInLine.userId set`);
    if (midcyclesWithNextInLine.length > 0) {
      console.log('Sample nextInLine reference:', midcyclesWithNextInLine[0].nextInLine);
    }
    
    // Look for a sample member to see if it matches with any nextInLine
    const member = await Member.findOne();
    console.log('Sample member:', member ? {
      id: member._id,
      name: member.name,
      userId: member.userId
    } : 'none found');
    
  } catch (err) {
    console.error('Error debugging midcycle:', err);
  } finally {
    mongoose.connection.close();
  }
}

debugMidcycle();
