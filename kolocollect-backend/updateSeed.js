const mongoose = require('mongoose');
const Wallet = require('./models/Wallet'); // Adjust the path to your Wallet model

// Replace this with your MongoDB connection string
const MONGO_URI = 'mongodb://localhost:27017/your-database-name';

mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB.');

    // Find wallets with transactions missing the `type` field
    const wallets = await Wallet.find({ 'transactions.type': { $exists: false } });
    console.log(`Found ${wallets.length} wallets with invalid transactions.`);

    for (const wallet of wallets) {
      wallet.transactions.forEach((transaction) => {
        if (!transaction.type) {
          transaction.type = 'unknown'; // Set a default type; adjust if needed
        }
      });

      await wallet.save();
      console.log(`Updated wallet ID: ${wallet._id}`);
    }

    console.log('Seed process completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB or updating wallets:', err);
    process.exit(1);
  });
