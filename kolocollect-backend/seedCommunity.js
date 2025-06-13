const mongoose = require('mongoose');
const UserController = require('./controllers/userController');
const CommunityController = require('./controllers/communityController');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

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
        // { name: 'Charlie Black', email: 'charlie@example.com', password: 'password123' },
        // { name: 'Diana Blue', email: 'diana@example.com', password: 'password123' },
        // { name: 'Eve White', email: 'eve@example.com', password: 'password123' },
        // { name: 'Frank Yellow', email: 'frank@example.com', password: 'password123' },
        // { name: 'George Gray', email: 'george@example.com', password: 'password123' },
        // { name: 'Hannah Violet', email: 'hannah@example.com', password: 'password123' },
        // { name: 'Ian Orange', email: 'ian@example.com', password: 'password123' },
        // { name: 'Jack Silver', email: 'jack@example.com', password: 'password123' },
        // { name: 'Kelly Gold', email: 'kelly@example.com', password: 'password123' },
        // { name: 'Leo Pink', email: 'leo@example.com', password: 'password123' },
        // { name: 'Mila Cyan', email: 'mila@example.com', password: 'password123' },
        // { name: 'Nathan Amber', email: 'nathan@example.com', password: 'password123' },
        // { name: 'Olivia Jade', email: 'olivia@example.com', password: 'password123' },
        // { name: 'Peter Aqua', email: 'peter@example.com', password: 'password123' },
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

    // Create 10 Communities
    const communityPayloads = [
      {
        name: 'Tech Savers Group',
        description: 'A community for tech enthusiasts to save together.',
        maxMembers: 5,
        contributionFrequency: 'Daily',
        backupFundPercentage: 1,
        adminId: users[0]._id, // Assign John Doe as admin
        settings: {
          isPrivate: false,
          minContribution: 100,
          penalty: 20,
          numMissContribution: 3,
          firstCycleMin: 5,
        },
      },
      // ...Array.from({ length: 30 }, (_, i) => ({
      //   name: `Community ${i + 2}`,
      //   description: `This is community number ${i + 2}`,
      //   maxMembers: 10 + i, // Increment max members for variety
      //   contributionFrequency: ['Hourly', 'Daily', 'Weekly'][i % 3], // Rotate contribution frequency
      //   backupFundPercentage: 3 + i, // Increment backup fund percentage
      //   adminId: users[(i + 1) % users.length]._id, // Assign admins cyclically
      //   settings: {
      //     isPrivate: i % 2 === 0, // Alternate between public and private
      //     minContribution: 50 + i * 10, // Increment min contribution
      //     penalty: 10 + i * 5, // Increment penalty
      //     numMissContribution: 3,
      //     firstCycleMin: 5 + i, // Increment first cycle min
      //   },
      // })),
    ];

    const createdCommunities = [];
    const maxRetries = 3;
    
    for (const payload of communityPayloads) {
      const session = await mongoose.startSession();
      session.startTransaction();
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          const req = {
            body: payload,
            session // Pass session to controller
          };
          
          const res = {
            status: (code) => ({
              json: (data) => {
                if (data.community) {
                  createdCommunities.push(data.community);
                } else {
                  console.error('Community creation failed:', data);
                }
              },
            }),
          };

          await CommunityController.createCommunity(req, res);
          await session.commitTransaction();
          break;
        } catch (error) {
          console.log(`Attempt ${retryCount + 1} failed:`, error.message);
          
          if (error.errorLabels && error.errorLabels.includes('TransientTransactionError') && retryCount < maxRetries) {
            await session.abortTransaction();
            retryCount++;
            continue;
          }
          
          console.error('Final community creation failure:', error);
          await session.abortTransaction();
          break;
        } finally {
          session.endSession();
        }
      }
    }

    console.log('Communities created:', createdCommunities);
    console.log('Database seeding completed successfully.');
    await mongoose.connection.close();
    process.exit();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
