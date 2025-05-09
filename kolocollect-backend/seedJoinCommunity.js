const mongoose = require('mongoose');
const Community = require('./models/Community');
const User = require('./models/User');
require('dotenv').config();

const seedJoins = async () => {
  try {
    // Connect to MongoDB with better error handling
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all communities and users with validation
    const communities = await Community.find().lean();
    if (!communities.length) {
      console.error('No communities found. Seed communities first.');
      process.exit(1);
    }

    const users = await User.find().lean();
    if (!users.length) {
      console.error('No users found. Seed users first.');
      process.exit(1);
    }

    for (const community of communities) {
      // Safely check admin ID with optional chaining and default value
      const adminId = community.admin?.toString() || '';
      if (!adminId) {
        console.error(`Skipping community ${community.name} - missing admin ID`);
        continue;
      }

      // Filter users with null checks and existence validation
      const availableUsers = users.filter(user => {
        const userId = user?._id?.toString();
        return userId &&
          !community.members.some(m => m?.toString() === userId) &&
          userId !== adminId;
      });

      // Select random users with error handling
      const selectedUsers = availableUsers
        .sort(() => 0.5 - Math.random())
        .slice(0, 5)
        .map(user => {
          if (!user?._id) {
            console.warn('Skipping user with invalid ID:', user);
            return null;
          }
          return user._id;
        })
        .filter(id => id !== null);

      console.log(`Processing ${community.name}: ${selectedUsers.length} valid users found`);

      // Update community members
      await Community.findByIdAndUpdate(
        community._id,
        { $addToSet: { members: { $each: selectedUsers } } },
        { new: true }
      );
      
      console.log(`Added ${selectedUsers.length} members to ${community.name}`);

      // Validate mid-cycle after adding members
      try {
        const validationResult = await community.validateMidCycleAndContributions();
        console.log(validationResult.message);
      } catch (err) {
        console.error('Error validating mid-cycle:', err.message);
      }
    }

    console.log('Community members seeding completed');
    await mongoose.connection.close();
    process.exit();
  } catch (error) {
    console.error('Error seeding members:', error);
    process.exit(1);
  }
};

seedJoins();
