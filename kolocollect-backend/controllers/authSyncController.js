const User = require('../models/User');
const Wallet = require('../models/Wallet');

/**
 * Synchronize user data from authentication service
 * This function receives user data after successful registration with the external auth service
 * and either creates a new user or updates an existing one in our application database
 */
const syncUserFromAuth = async (req, res) => {
  try {
    const { _id, email, username, firstName, lastName, createdAt } = req.body;

    if (!email || !username || !_id) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ authId: _id });
    if (existingUser) {
      return res.status(200).json({ message: 'User already exists', user: existingUser });
    }

    // Create new user using received data
    const newUser = new User({
      authId: _id,
      email,
      username,
      firstName,
      lastName,
      registeredAt: createdAt || new Date(),
    });    const savedUser = await newUser.save();

        const wallet = new Wallet({
          userId: savedUser._id,
          authId: savedUser.authId, // Add the authId field to match with User model
          availableBalance: 0,
          fixedBalance: 0,
          totalBalance: 0,
          transactions: [],
        });
        await wallet.save();

    res.status(201).json({ message: 'User created', user: savedUser });
  } catch (error) {
    console.error('Error syncing user from auth:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to synchronize user data',
      error: error.message
    });
  }
};

module.exports = {
  syncUserFromAuth
};
