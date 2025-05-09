const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const ContributionController = require('./controllers/contributionController');

// Load environment variables
dotenv.config();

const seedContributionsForEligibleUsers = async (exemptUserId) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    console.log('Connected to MongoDB.');

    const communityId = '67b42762a5688b1b33bf02b1'; // Update with actual community ID
    const midCycleId = '67b430f0f5e3a0144b2178e3'; // Update with actual midCycle ID

    const community = await Community.findById(communityId);
    if (!community) {
      console.error('Community not found. Verify the community ID.');
      process.exit(1);
    }

    console.log(`Found community: "${community.name}"`);

    const activeMidCycle = community.midCycle.find((mc) => mc._id.toString() === midCycleId && !mc.isComplete);
    if (!activeMidCycle) {
      console.error('MidCycle not active or not found:', midCycleId);
      process.exit(1);
    }

    console.log(`Active mid-cycle found: Cycle ${activeMidCycle.cycleNumber}`);

    const eligibleMembers = community.members.filter((member) => {
      const userContribution = activeMidCycle.contributions.find(c => c.user.equals(member.userId));
      return member.status === 'active' && !userContribution && member.userId.toString() !== exemptUserId;
    });

    if (!eligibleMembers.length) {
      console.log('No eligible members found who have not contributed yet.');
      process.exit(0);
    }

    console.log(`Eligible members (excluding ${exemptUserId}): ${eligibleMembers.map((m) => m.userId).join(', ')}`);

    for (const member of eligibleMembers) {
      console.log(`Processing contribution for User ID: ${member.userId}`);

      const wallet = await Wallet.findOne({ userId: member.userId });
      if (!wallet || wallet.availableBalance < community.settings.minContribution) {
        console.error(`User ${member.userId} has insufficient funds or wallet not found.`);
        continue;
      }

      console.log(`User Wallet Balance: €${wallet.availableBalance}`);

      const req = {
        body: {
          userId: member.userId,
          communityId,
          amount: community.settings.minContribution,
          contributionDate: new Date(),
          cycleNumber: activeMidCycle.cycleNumber,
          midCycleId: activeMidCycle._id,
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

    console.log('Seeding process completed.');
    process.exit();
  } catch (err) {
    console.error('Error during contribution seeding:', err.message);
    process.exit(1);
  }
};

// Example usage: Pass the exempt user ID as an argument
const exemptUserId = process.argv[2]; // Example: node seedContributions.js 67abc12345
seedContributionsForEligibleUsers(exemptUserId);
