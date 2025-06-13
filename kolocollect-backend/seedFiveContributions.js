const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const ContributionController = require('./controllers/contributionController');
const CommunityController = require('./controllers/communityController');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
    console.log('Connected to MongoDB.');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
};

// Seed Contributions for All Communities - Limited to 5 Members per Community
const seedContributionsForAllCommunities = async () => {
  try {
    console.log('Starting contribution seeding process (5 members max)...');

    // Find all communities and populate midCycle and members
    const communities = await Community.find()
      .populate({
        path: 'midCycle',
        match: { isComplete: false }, // Only populate active midCycles
        populate: {
          path: 'contributions.user' // Populate user references in contributions
        }
      })
      .populate({
        path: 'members',
        select: 'userId status'
      });

    if (!communities.length) {
      console.log('No communities found in the database.');
      return;
    }

    console.log(`Found ${communities.length} communities.`);

    for (const community of communities) {
      console.log(`Processing community: "${community.name}"`);

      // midCycle is now populated with actual midCycle documents
      if (!community.midCycle || community.midCycle.length === 0) {
        console.log(`No active mid-cycles found for community: "${community.name}".`);
        continue;
      }

      console.log(`Found ${community.midCycle.length} active mid-cycles for community: "${community.name}".`);

      for (const midCycle of community.midCycle) {
        console.log(`Processing mid-cycle: Cycle ${midCycle.cycleNumber}`);

        // Get eligible members who haven't contributed to this midCycle yet
        const eligibleMembers = community.members.filter((member) => {
          // Check if this member has already contributed to this midCycle
          const hasContributed = midCycle.contributions && 
                               midCycle.contributions.some(c => 
                                  c.user && member.userId && 
                                  c.user.toString() === member.userId.toString());
          
          return member.status === 'active' && !hasContributed;
        });
        
        if (!eligibleMembers.length) {
          console.log(`No eligible members for mid-cycle: Cycle ${midCycle.cycleNumber}.`);
          continue;
        }

        // Limit to num(1,2,3,...) members per mid-cycle
        const limitedMembers = eligibleMembers.slice(0, 3);
        
        console.log(`Found ${eligibleMembers.length} eligible members, processing 5 max for mid-cycle ${midCycle.cycleNumber}`);
        console.log(`Processing contributions for: ${limitedMembers.map((m) => m.userId).join(', ')}`);

        for (const member of limitedMembers) {
          // Check if userId exists
          if (!member.userId) {
            console.error(`Member has no userId defined, skipping`);
            continue;
          }

          const wallet = await Wallet.findOne({ userId: member.userId });
          if (!wallet || wallet.availableBalance < community.settings.minContribution) {
            console.error(`User ${member.userId} has insufficient funds or wallet not found.`);
            continue;
          }

          console.log(`User Wallet Balance: €${wallet.availableBalance}`);

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
        
        console.log(`Completed processing 5 contributions for mid-cycle ${midCycle.cycleNumber}`);
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

    // First find all midCycles that are ready but not complete
    const readyMidCycles = await mongoose.model('MidCycle').find({
      isReady: true,
      isComplete: false
    });
    
    if (!readyMidCycles.length) {
      console.log('No ready mid-cycles found.');
      return;
    }
    
    console.log(`Found ${readyMidCycles.length} ready mid-cycles.`);
    
    // Get the communities containing these midCycles
    const communityIds = await mongoose.model('Community').distinct('_id', {
      midCycle: { $in: readyMidCycles.map(mc => mc._id) }
    });
    
    if (!communityIds.length) {
      console.error('No communities found with ready mid-cycles.');
      return;
    }
    
    const communities = await Community.find({
      _id: { $in: communityIds }
    }).populate('midCycle');

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
        await CommunityController.distributePayouts(req, res);
      } catch (err) {
        console.error(`Error during payout distribution for ${community.name}:`, err.message);
      }
    }

    console.log('Payout distribution process completed.');
  } catch (err) {
    console.error('Error during payout distribution:', err.message);
  }
};

// Main Function to Run Tasks
const main = async () => {
  await connectToDB();

  console.log('Starting the seeding process for 5 members per community...');
  await seedContributionsForAllCommunities();

  console.log('Starting payout distribution...');
  await distributePayoutsSeeder();

  console.log('All tasks completed.');
  process.exit();
};

main();
