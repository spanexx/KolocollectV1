const mongoose = require('mongoose');
const Cycle = require('./models/Cycle');
const db = require('./config/db');

async function debugCycles() {
  try {
    await db.connect();
    console.log('Connected to DB');
    
    // Get all cycles
    const allCycles = await Cycle.find().sort({ cycleNumber: 1 });
    console.log(`Total cycles in DB: ${allCycles.length}`);
    
    // Group by community ID
    const cyclesByCommuntiy = {};
    
    allCycles.forEach(cycle => {
      const communityId = cycle.communityId.toString();
      if (!cyclesByCommuntiy[communityId]) {
        cyclesByCommuntiy[communityId] = [];
      }
      cyclesByCommuntiy[communityId].push(cycle);
      
      console.log(`Cycle ID: ${cycle._id}, Number: ${cycle.cycleNumber}, Community: ${communityId}, isComplete: ${cycle.isComplete}`);
    });
    
    // Log each community's cycles
    console.log('\nCycles by Community:');
    for (const [communityId, cycles] of Object.entries(cyclesByCommuntiy)) {
      console.log(`Community ${communityId} has ${cycles.length} cycles:`);
      cycles.forEach(c => console.log(`  - Cycle ${c.cycleNumber} (isComplete: ${c.isComplete})`));
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from DB');
  }
}

debugCycles();
