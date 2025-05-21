const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const contributionRoutes = require('./routes/contributionRoutes');
const communityRoutes = require('./routes/communityRoutes');
const payoutRoutes = require('./routes/payoutRoutes');
const walletRoutes = require('./routes/walletRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const memberRoutes = require('./routes/memberRoutes');
const midcycleRoutes = require('./routes/midcycleRoutes');
const sharingRoutes = require('./routes/sharingRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const webhookMiddleware = require('./middlewares/webhookMiddleware');

// Import all separated models
const Community = require('./models/Community');
const CommunityVote = require('./models/CommunityVote');
const CommunityActivityLog = require('./models/CommunityActivityLog');
const Cycle = require('./models/Cycle');
const MidcycleModel = require('./models/Midcycle');
const Member = require('./models/Member');
const schedulePayouts = require('./utils/scheduler');

dotenv.config();

// Initialize express app
const app = express();

// Connect to the databases
connectDB();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/communities', communityRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/midcycles', midcycleRoutes);
app.use('/api/sharing', sharingRoutes);

app.use(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  webhookMiddleware,
  (req, res) => {
    const event = req.stripeEvent;
    console.log(event.type);
    res.sendStatus(200);
  }
);

// Function to start payout monitors for all communities
// const startPayoutMonitoringForAllCommunities = async () => {
//   try {
//     // Fetch all communities with populated references
//     const communities = await Community.find()
//       .populate({
//         path: 'midCycle',
//         match: { isComplete: false }
//       })
//       .populate('cycles')
//       .populate('members');

//     if (communities.length === 0) {
//       console.log('No communities found to monitor payouts.');
//       return;
//     }

//     communities.forEach((community) => {
//       community.startPayoutMonitor();
      
      // Find active mid-cycle (should already be filtered by the populate match)
//       const activeMidCycle = community.midCycle && community.midCycle.length > 0 
        // ? community.midCycle[0] 
//         : null;
      
      // Calculate countdown with type checking
//       const countdown = activeMidCycle && activeMidCycle.payoutDate 
//         ? Math.max(0, new Date(activeMidCycle.payoutDate) - new Date()) 
//         : 'N/A';
//       const countdownMinutes = countdown !== 'N/A' ? Math.floor(countdown / 60000) : 'N/A';
      
//       console.log(`Payout monitor started for community: ${community.name} CountDown: ${countdownMinutes} mins`);
//     });
//   } catch (err) {
//     console.error('Error starting payout monitors:', err);
//   }
// };

// Start the scheduler if enabled
if (process.env.ENABLE_SCHEDULER === 'true') {
  console.log('Starting centralized scheduler for payouts...');
  // Since schedulePayouts is now async, we need to call it properly
  schedulePayouts().catch(err => {
    console.error('Error initializing payout scheduler:', err);
  });
} else {
  console.log('Starting individual payout monitors for communities...');
  // This function is commented out in the file, you may need to uncomment it
  // startPayoutMonitoringForAllCommunities();
  console.log('Individual payout monitors are currently disabled. Please set ENABLE_SCHEDULER=true.');
}

// Server listen with error handling
const PORT = process.env.PORT || 6000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    console.log('Try:');
    console.log('1. Closing other running instances');
    console.log(`2. Using a different port: PORT=6001 npm start`);
    process.exit(1);
  }
  throw error;
});
