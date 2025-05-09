const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Wallet = require('./models/Wallet'); // Include Wallet model

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected');
}).catch((err) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
});

const users = [
    {
        name: 'John Doe',
        email: 'john@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'user',
        dateJoined: new Date(),
        communities: [], 
        contributions: [
            {
                communityId: new mongoose.Types.ObjectId(),
                totalContributed: 100,
                positionInCycle: 1,
                contributionsPaid: [
                    {
                        amount: 100,
                        date: new Date(),
                        paymentMethod: 'Bank', // Added paymentMethod
                    },
                ],
            },
        ],
    },
    {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: bcrypt.hashSync('password123', 10),
        role: 'admin',
        dateJoined: new Date(),
        communities: [], 
        contributions: [
            {
                communityId: new mongoose.Types.ObjectId(),
                totalContributed: 300,
                positionInCycle: 2,
                contributionsPaid: [
                    {
                        amount: 100,
                        date: new Date(),
                        paymentMethod: 'Crypto', // Added paymentMethod
                    },
                    {
                        amount: 200,
                        date: new Date(),
                        paymentMethod: 'Cash', // Added paymentMethod
                    },
                ],
            },
        ],
    },
];

const seedUsers = async () => {
    try {
        await User.deleteMany();
        await Wallet.deleteMany();
        console.log('Existing users and wallets cleared');

        for (const userData of users) {
            const user = new User(userData);
            const savedUser = await user.save();

            const wallet = new Wallet({
                userId: savedUser._id,
                availableBalance: 0,
                totalBalance: 1000,
                fixedBalance: 0,
                transactions: [
                    { amount: 1000, type: 'deposit', description: 'Initial deposit' },
                    { amount: 500, type: 'withdrawal', description: 'Withdraw for savings goal' },
                ],
                fixedFunds: [
                    {
                        amount: 1000,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        isMatured: false,
                    },
                ],
            });

            await wallet.save();
        }

        console.log('Users and wallets successfully seeded');
        process.exit();
    } catch (err) {
        console.error('Error seeding users and wallets:', err);
        process.exit(1);
    }
};

seedUsers();
