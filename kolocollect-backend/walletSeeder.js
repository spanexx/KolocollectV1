const mongoose = require('mongoose');
const Wallet = require('./models/Wallet');
const WalletController = require('./controllers/walletController');
require('dotenv').config();

const seedWallets = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Fetch all wallets
    const wallets = await Wallet.find({});
    console.log(`Found ${wallets.length} wallets.`);

    // Add €1000 to each wallet
    for (const wallet of wallets) {
      const req = {
        body: {
          userId: wallet.userId,
          amount: 10000,
        },
      };

      const res = {
        status: (code) => ({
          json: (data) => console.log(`User ${wallet.userId} - ${data.message}`),
        }),
      };

      // Call addFunds method from the controller
      await WalletController.addFunds(req, res);
    }

    console.log('Funds added successfully for all users.');
    process.exit();
  } catch (err) {
    console.error('Error adding funds:', err);
    process.exit(1);
  }
};

// Execute the seeder
seedWallets();
