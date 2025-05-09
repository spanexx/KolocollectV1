const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Community = require('./models/Community');
const Wallet = require('./models/Wallet');
const ContributionController = require('./controllers/contributionController');

// Load environment variables
dotenv.config();

const seedContributionsForAllEligibleUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });

    console.log('Connected to MongoDB.');

    // Replace these IDs with the ones you want to use
    const communityId = '67aba5752985f1c720e6297f'; // Update with actual community ID
    const midCycleId = '67b383b265237b349ccd79d0'; // Update with actual midCycle ID

    // Fetch the target community
    const community = await Community.findById(communityId);

    if (!community) {
      console.error('Community not found. Verify the community ID.');
      process.exit(1);
    }

    console.log(`Found community: "${community.name}"`);

    // Verify that the midCycleId exists in the community
    const activeMidCycle = community.midCycle.find((mc) => mc._id.toString() === midCycleId && !mc.isComplete);

    if (!activeMidCycle) {
      console.error('MidCycle not active or not found:', midCycleId);
      console.log('Available MidCycles:', community.midCycle.map((mc) => ({
        id: mc._id.toString(),
        isComplete: mc.isComplete,
        isReady: mc.isReady,
      })));
      process.exit(1);
    }

    console.log(`Active mid-cycle found: Cycle ${activeMidCycle.cycleNumber}`);

    // Filter eligible members (active status and no prior contributions in this mid-cycle)
    const eligibleMembers = community.members.filter((member) => {
      const userContribution = activeMidCycle.contributions.find(c => c.user.equals(member.userId));
      return member.status === 'active' && !userContribution && member.userId.toString() !== exemptedUserId;
    });

    if (!eligibleMembers.length) {
      console.log('No eligible members found who have not contributed yet.');
      process.exit(0);
    }

    console.log(`Eligible members: ${eligibleMembers.map((m) => m.userId).join(', ')}`);

    // Process contributions for all eligible members
    for (const member of eligibleMembers) {
      console.log(`Processing contribution for User ID: ${member.userId}`);

      // Find the member's wallet
      const wallet = await Wallet.findOne({ userId: member.userId });

      if (!wallet || wallet.availableBalance < community.settings.minContribution) {
        console.error(`User ${member.userId} has insufficient funds or wallet not found.`);
        continue; // Skip this member and move to the next
      }

      console.log(`User Wallet Balance: €${wallet.availableBalance}`);

      // Prepare request and response mocks for ContributionController
      const req = {
        body: {
          userId: member.userId,
          communityId,
          amount: community.settings.minContribution, // Minimum contribution
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
        // Call the createContribution method
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

seedContributionsForAllEligibleUsers();