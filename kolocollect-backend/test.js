const Community = require('./models/NewCommunitySchema');
const User = require('./models/User');

require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
              useNewUrlParser: true,
              useUnifiedTopology: true,
            });
        // Create a test community
        const adminId = '64ce12f1b91a3f9d8b65f001'; // Replace with a valid User ID
        const community = new Community({
            name: 'Test 1',
            admin: adminId,
            settings: { minContribution: 50, firstCycleMin: 5 },
        });
        await community.save();

        console.log('Community created:', community);

        // Add members
        const members = [
            { userId: '64ce12f1b91a3f9d8b65f001', name: 'John Doe', email: 'john@example.com' },
            { userId: '64ce12f1b91a3f9d8b65f002', name: 'Jane Smith', email: 'jane@example.com' },
            { userId: '64ce12f1b91a3f9d8b65f003', name: 'Alice Brown', email: 'alice@example.com' },
            { userId: '64ce12f1b91a3f9d8b65f004', name: 'Bob Green', email: 'bob@example.com' },
            { userId: '64ce12f1b91a3f9d8b65f005', name: 'Ken Tyga', email: 'ken@example.com' },
        ];
        for (const member of members) {
            await community.joinCommunity(member.userId, member.name, member.email);
        }
        console.log('Members added:', community.members);

        // Start the first cycle
        const startCycleResult = await community.startFirstCycle();
        console.log(startCycleResult.message);

        // Record contributions for all members
        for (const member of members) {
            const recipient = members.find((m) => m.userId !== member.userId); // Select a recipient
            const recordResult = await community.record({
                contributorId: member.userId, // Include the contributor's ID
                recipientId: recipient.userId, // Include the recipient's ID
                amount: 50, // Contribution amount
            });
            console.log(`Contribution recorded for ${member.name}:`, recordResult.message);
        }
        

        // Validate contributions
        const validateResult = await community.validateContributions();
        console.log(validateResult.message);

        // Distribute payouts
        const payoutResult = await community.distributePayouts();
        console.log(payoutResult.message);

        // Finalize the cycle
        const finalizeResult = await community.finalizeCycle();
        console.log(finalizeResult.message);

        // Prepare for the next cycle
        const prepareResult = await community.prepareForNextCycle();
        console.log(prepareResult.message);
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        mongoose.connection.close();
    }
})();
