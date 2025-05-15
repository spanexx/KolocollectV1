const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const ContributionController = require('./controllers/contributionController');
const CommunityController = require('./controllers/communityController'); // Import CommunityController

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
};

// Seed Contributions for All Communities
const seedContributionsForAllCommunities = async () => {
  try {
    console.log('Starting contribution seeding process...');

    const communities = await Community.find();
    if (!communities.length) {
      console.log('No communities found in the database.');
      return;
    }

    console.log(`Found ${communities.length} communities.`);

    for (const community of communities) {
      console.log(`Processing community: "${community.name}"`);

      const activeMidCycles = community.midCycle.filter((mc) => !mc.isComplete);
      if (!activeMidCycles.length) {
        console.log(`No active mid-cycles found for community: "${community.name}".`);
        continue;
      }

      console.log(`Found ${activeMidCycles.length} active mid-cycles for community: "${community.name}".`);

      for (const midCycle of activeMidCycles) {
        console.log(`Processing mid-cycle: Cycle ${midCycle.cycleNumber}`);

        const eligibleMembers = community.members.filter((member) => {
          const contributions = midCycle.contributions.find(c => c.user.equals(member.userId));
          return member.status === 'active' && (!contributions || contributions.length === 0);
        });

        if (!eligibleMembers.length) {
          console.log(`No eligible members for mid-cycle: Cycle ${midCycle.cycleNumber}.`);
          continue;
        }

        console.log(`Eligible members for mid-cycle: ${eligibleMembers.map((m) => m.userId).join(', ')}`);

        for (const member of eligibleMembers) {

          const wallet = await Wallet.findOne({ userId: member.userId });
          if (!wallet || wallet.availableBalance < community.settings.minContribution) {
            console.error(`User ${member.userId} has insufficient funds or wallet not found.`);
            continue;
          }


          const req = {
            body: {
              userId: member.userId,
              communityId: community._id,
              amount: community.settings.minContribution,
              contributionDate: new Date(),
              cycleNumber: midCycle.cycleNumber,
              midCycleId: midCycle._id,
            },
          };

          const res = {
            status: (code) => ({
              json: (data) => console.log(`Contribution Response for User ${member.userId}: ${data.message}`),
            }),
          };

          try {
            await ContributionController.createContribution(req, res);
            console.log(`Contribution successfully created for User ID: ${member.userId}`);
          } catch (err) {
            console.error(`Failed to create contribution for user ${member.userId}:`, err.message);
          }
        }
      }
    }

    console.log('Contribution seeding process completed.');
  } catch (err) {
    console.error('Error during contribution seeding:', err.message);
  }
};

// Distribute Payouts for Ready Communities
const distributePayoutsSeeder = async () => {
  try {
    console.log('Starting payout distribution process...');

    const communities = await Community.find({
      "midCycle.isReady": true,
      "midCycle.isComplete": false,
    });

    if (!communities.length) {
      console.error('No communities found with ready mid-cycles.');
      return;
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
        await CommunityController.distributePayouts(req, res); // Use CommunityController.distributePayouts
      } catch (err) {
        console.error(`Error during payout distribution for ${community.name}:`, err.message);
      }
    }

    console.log('Payout distribution process completed.');
  } catch (err) {
    console.error('Error during payout distribution:', err.message);
  }
};

// Main Function to Run Tasks in a Loop
const main = async (loops) => {
  await connectToDB();
  
  for (let i = 0; i < loops; i++) {
    console.log(`Starting iteration ${i + 1} of ${loops}...`);
    await seedContributionsForAllCommunities();
    await distributePayoutsSeeder();
    console.log(`Iteration ${i + 1} completed.`);
  }

  console.log('All tasks completed.');
  process.exit();
};

const loops = parseInt(process.argv[2], 10) || 1;
main(loops);
