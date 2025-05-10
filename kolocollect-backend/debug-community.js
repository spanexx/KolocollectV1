const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const Community = require('./models/Community');
const MidCycle = require('./models/Midcycle');
const Cycle = require('./models/Cycle');

const logFile = fs.createWriteStream('./debug-output.txt', {flags: 'w'});
function log(message) {
  console.log(message);
  logFile.write(message + '\n');
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    // List all communities first
    const communities = await Community.find({}, 'name _id');
    log('All communities: ' + JSON.stringify(communities.map(c => ({ id: c._id.toString(), name: c.name }))));
    // Get the first community for detailed inspection
    const communityId = communities[0]._id;
    console.log('Inspecting community:', communityId);
    
    // Get detailed community info
    const community = await Community.findById(communityId)
      .populate('midCycle')
      .populate('cycles');
    
    console.log('Community found:', community ? 'Yes' : 'No');
    console.log('Mid-cycles count:', community.midCycle.length);
    const activeMidCycles = community.midCycle.filter(mc => !mc.isComplete);
    console.log('Active mid-cycles count:', activeMidCycles.length);
    
    // Check midcycles
    console.log('All mid-cycles:', community.midCycle.map(mc => ({ 
      id: mc._id.toString(), 
      isComplete: mc.isComplete,
      isReady: mc.isReady, 
      cycleNumber: mc.cycleNumber 
    })));
    
    // Check cycles
    console.log('Cycles:', community.cycles.map(c => ({ 
      id: c._id.toString(), 
      isComplete: c.isComplete, 
      cycleNumber: c.cycleNumber 
    })));
    
    // If there are no active midcycles, let's check if we can start a new one
    if (activeMidCycles.length === 0) {
      console.log('No active mid-cycles found - checking if we can start a new one');
      const activeCycle = community.cycles.find(c => !c.isComplete);
      console.log('Active cycle exists:', activeCycle ? 'Yes' : 'No');
      
      if (activeCycle) {
        console.log('Active cycle details:', {
          id: activeCycle._id.toString(),
          cycleNumber: activeCycle.cycleNumber,
          midCycles: activeCycle.midCycles?.length || 0
        });
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.connection.close();
  }
});
