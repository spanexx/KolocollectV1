require('dotenv').config();
const mongoose = require('mongoose');
const Community = require('./models/Community');
const User = require('.//models/User');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

const seedCommunity = async () => {
  try {
    await Community.deleteMany({});

    const john = await User.findOne({ email: 'john@example.com' });
    const jane = await User.findOne({ email: 'jane@example.com' });

    if (!john || !jane) {
      console.log('One or both of the admin users not found!');
      return;
    }

    const community = new Community({
      name: 'Sample Community',
      description: 'This is a test community for contributions.',
      maxMembers: 10,
      contributionFrequency: 'Weekly',
      cycleLockEnabled: false,
      backupFund: 0,
      totalContributions: 0,
      nextPayout: new Date(),
      isPrivate: false,
      contributionLimit: 1000,
      adminId: john._id,
      membersList: [
        {
          userId: john._id,
          name: john.name,
          email: john.email,
          position: 1,
          status: 'active', // Added status
        },
        {
          userId: jane._id,
          name: jane.name,
          email: jane.email,
          position: 2,
          status: 'active', // Added status
        },
      ],
      contributionList: [],
      currentCycle: 1,
      cycles: [{
        cycleNumber: 1,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        contributions: [],
      }],
    });

    await community.save();
    console.log('Sample community seeded successfully!');
  } catch (err) {
    console.error('Error seeding community:', err);
  } finally {
    mongoose.disconnect();
  }
};

seedCommunity();
