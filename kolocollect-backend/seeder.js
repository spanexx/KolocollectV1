const mongoose = require('mongoose');
const UserController = require('./controllers/userController');
const CommunityController = require('./controllers/communityController');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing data
    await mongoose.connection.db.dropDatabase();
    console.log('Cleared existing database');

    // Create Users via registerUser
    const userPayloads = [
      { name: 'John Doe', email: 'john@example.com', password: 'password123' },
      { name: 'Jane Smith', email: 'jane@example.com', password: 'password123' },
      { name: 'Bob Brown', email: 'bob@example.com', password: 'password123' },
      { name: 'Vic', email: 'vic@example.com', password: 'password123' },
      { name: 'Magda', email: 'magda@example.com', password: 'password123' },
      { name: 'Alice Green', email: 'alice@example.com', password: 'password123' },
      { name: 'Charlie Black', email: 'charlie@example.com', password: 'password123' },
      { name: 'Diana Blue', email: 'diana@example.com', password: 'password123' },
      { name: 'Eve White', email: 'eve@example.com', password: 'password123' },
      { name: 'Frank Yellow', email: 'frank@example.com', password: 'password123' },
    ];

    const users = [];
    for (const userPayload of userPayloads) {
      const req = { body: userPayload };
      const res = {
        status: () => ({
          json: (data) => {
            if (data.user) {
              users.push({ ...data.user, _id: data.user._id || data.user.id });
            }
          },
        }),
      };
      await UserController.registerUser(req, res);
    }

    console.log('Users seeded via registerUser');

    // Create Community via createCommunity
    const communityPayload = {
      name: 'Tech Savers Group',
      description: 'A community for tech enthusiasts to save together.',
      maxMembers: 10,
      contributionFrequency: 'Hourly',
      backupFundPercentage: 10,
      adminId: users[0]._id, // Assign John Doe as admin
      settings: {
        isPrivate: false,
        minContribution: 100,
        penalty: 20,
        numMissContribution: 3,
        firstCycleMin: 5,
      },
    };

    let createdCommunity = null;
    const req = { body: communityPayload };
    const res = {
      status: (code) => ({
        json: (data) => {
          if (data.community){
            createdCommunity = data.community; // Capture the created community
          }else{
        console.error('Community creation failed:', data);
          }
        },
      }),
    };
    await CommunityController.createCommunity(req, res);

    console.log('Community created:', createdCommunity);
    console.log('Community seeded via createCommunity');
    console.log('Database seeding completed');

    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
