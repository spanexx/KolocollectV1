const cron = require('node-cron');
const Community = require('../models/Community'); // Adjust path if needed

const retryOperation = async (operation, retries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
          return await operation();
      } catch (err) {
          console.error(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
          if (attempt === retries) throw err;
          await new Promise(resolve => setTimeout(resolve, delay));
      }
  }
};

const schedulePayouts = () => {
  cron.schedule('* * * * *', async () => {
      try {
          const now = new Date();

          await retryOperation(async () => {
              const communities = await Community.find({
                  nextPayout: { $lte: now },
                  'midCycle.isComplete': false,
              });

              for (const community of communities) {
                  console.log(`Processing payout for community: ${community.name}`);
                  try {
                      const result = await community.distributePayouts();
                      console.log(result.message);
                      await community.updatePayoutInfo();
                      await community.finalizeCycle();

                  } catch (err) {
                      console.error(`Error distributing payout for community ${community.name}:`, err);
                  }
              }
          });
      } catch (err) {
          console.error('Error in payout scheduler:', err);
      }
  });

  console.log('Scheduler initialized.');
};


module.exports = schedulePayouts;
