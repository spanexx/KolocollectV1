const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const MidCycle = require('./models/Midcycle'); // Import MidCycle model
const Member = require('./models/Member'); // Import Member model
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

    console.log(`Found ${communities.length} communities.`);    for (const community of communities) {
      console.log(`Processing community: "${community.name}"`);

      // Get mid-cycle IDs from the community
      const activeMidCycleIds = community.midCycle || [];
      if (!activeMidCycleIds.length) {
        console.log(`No mid-cycles found for community: "${community.name}".`);
        continue;
      }

      // Fetch the actual mid-cycle documents
      const activeMidCycles = await MidCycle.find({
        _id: { $in: activeMidCycleIds },
        isComplete: false
      });

      if (!activeMidCycles.length) {
        console.log(`No active mid-cycles found for community: "${community.name}".`);
        continue;
      }

      console.log(`Found ${activeMidCycles.length} active mid-cycles for community: "${community.name}".`);      for (const midCycle of activeMidCycles) {
        console.log(`Processing mid-cycle: Cycle ${midCycle.cycleNumber}`);
        
        // Get member IDs from the community
        const memberIds = community.members || [];
        if (!memberIds.length) {
          console.log(`No members found in community: "${community.name}".`);
          continue;
        }
        
        // Fetch the actual Member documents that are active
        const activeMembers = await Member.find({
          _id: { $in: memberIds },
          status: 'active'
        });
        
        if (!activeMembers.length) {
          console.log(`No active members found in community: "${community.name}".`);
          continue;
        }
        
        // Filter eligible members who haven't contributed yet to this mid-cycle
        const eligibleMembers = [];
        for (const member of activeMembers) {
          // Check if this member has already contributed to this mid-cycle
          const hasContributed = midCycle.contributions && 
                                 midCycle.contributions.some(c => 
                                   c.user && c.user.toString() === member.userId.toString() && 
                                   c.contributions && c.contributions.length > 0);
          
          if (!hasContributed) {
            eligibleMembers.push(member);
          }
        }

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
    console.log('Starting payout distribution process...');    // First find all communities
    const allCommunities = await Community.find({});
    
    // Then filter the communities that have at least one ready, not complete mid-cycle
    const readyCommunities = [];
    for (const community of allCommunities) {
      // Fetch active mid-cycles for this community
      const activeMidCycles = await MidCycle.find({
        _id: { $in: community.midCycle },
        isReady: true,
        isComplete: false
      });
      
      if (activeMidCycles.length > 0) {
        readyCommunities.push(community);
      }
    }
    
    const communities = readyCommunities;

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
  try {
    await connectToDB();
    
    for (let i = 0; i < loops; i++) {
      console.log(`Starting iteration ${i + 1} of ${loops}...`);
      try {
        await seedContributionsForAllCommunities();
      } catch (err) {
        console.error(`Error in contribution seeding on iteration ${i + 1}:`, err);
      }
      
      try {
        await distributePayoutsSeeder();
      } catch (err) {
        console.error(`Error in payout distribution on iteration ${i + 1}:`, err);
      }
      
      console.log(`Iteration ${i + 1} completed.`);
    }
  } catch (err) {
    console.error('Fatal error in main process:', err);
  } finally {
    console.log('All tasks completed.');
    process.exit();
  }
};

const loops = parseInt(process.argv[2], 10) || 1;
main(loops);
