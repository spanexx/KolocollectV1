// Seeder for testing distributePayouts in Community schema

const mongoose = require('mongoose');
const Community = require('./models/Community'); // Ensure the Community model is correctly imported
const communityController = require('./controllers/communityController'); // Import communityController
require('dotenv').config();

const distributePayoutsSeeder = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Fetch all communities with an active mid-cycle that is ready for distribution
    const communities = await Community.find({
      "midCycle.isReady": true,
      "midCycle.isComplete": false,
    });

    if (!communities.length) {
      console.error('No communities found with ready mid-cycles.');
      process.exit(1);
    }

    console.log(`Found ${communities.length} community/communities ready for payout distribution.`);

    for (const community of communities) {
      console.log(`Processing payouts for Community: ${community.name}`);
      try {
        const req = {
          params: {
            communityId: community._id
          }
        };
        const res = {
          status: (code) => ({
            json: (data) => console.log(`Payout Distribution for ${community.name}: ${data.message}`)
          })
        };
        await communityController.distributePayouts(req, res); // Use communityController.distributePayouts
      } catch (err) {
        console.error(`Error distributing payouts for Community: ${community.name}`, err.message);
      }
    }

    process.exit();
  } catch (err) {
    console.error('Error during distributePayoutsSeeder execution:', err.message);
    process.exit(1);
  }
};

distributePayoutsSeeder();
