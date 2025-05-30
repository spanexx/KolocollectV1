const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
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
const schedulerRoutes = require('./routes/schedulerRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const webhookMiddleware = require('./middlewares/webhookMiddleware');

// Import performance monitoring middleware
const metricsMiddleware = require('./middlewares/prometheusMiddleware');
const httpLogger = require('./middlewares/loggingMiddleware');
const responseTimeMiddleware = require('./middlewares/responseTimeMiddleware');
const { initMemoryMonitoring } = require('./utils/memoryMonitor');

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
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available to other parts of the application
app.set('io', io);

// Connect to the databases
connectDB();

// Performance Monitoring Middleware (Add before other middleware)
app.use(metricsMiddleware);
app.use(httpLogger);
app.use(responseTimeMiddleware);

// Standard Middleware
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
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/metrics', metricsRoutes);

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


// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to real-time performance monitoring');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from performance monitoring');
  });
});

// Real-time performance monitoring function
function initRealTimeMonitoring(io) {
  setInterval(async () => {
    try {
      // Get real-time performance metrics
      const performanceData = await generateRealTimeMetrics();
      
      // Emit to all connected clients
      io.emit('performance-update', performanceData);
    } catch (error) {
      console.error('Error generating real-time metrics:', error);
    }
  }, 5000); // Update every 5 seconds
}

// Function to generate real-time metrics
async function generateRealTimeMetrics() {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Get basic system metrics
  const systemMetrics = {
    name: 'Server Uptime',
    value: Math.floor(uptime),
    unit: 'seconds',
    status: uptime > 3600 ? 'healthy' : 'warning'
  };

  const memoryMetrics = {
    name: 'Memory Usage',
    value: Math.round(memUsage.heapUsed / 1024 / 1024),
    unit: 'MB',
    status: memUsage.heapUsed < 100 * 1024 * 1024 ? 'healthy' : 'warning'
  };

  const responseTimeMetrics = {
    name: 'Response Time',
    value: Math.floor(Math.random() * 100) + 50, // Simulated for now
    unit: 'ms',
    status: 'healthy'
  };

  // API Performance metrics (simulated for demo)
  const apiMetrics = [
    {
      name: 'Average Response Time',
      value: Math.floor(Math.random() * 200) + 150,
      unit: 'ms',
      status: 'healthy'
    },
    {
      name: 'Requests per Minute',
      value: Math.floor(Math.random() * 30) + 30,
      unit: 'req/min',
      status: 'healthy'
    },
    {
      name: 'Error Rate',
      value: (Math.random() * 5).toFixed(1),
      unit: '%',
      status: 'healthy'
    }
  ];

  // Frontend Performance metrics (simulated)
  const frontendMetrics = [
    {
      name: 'Largest Contentful Paint',
      value: (Math.random() * 1 + 1.5).toFixed(1),
      unit: 's',
      status: 'healthy'
    },
    {
      name: 'First Input Delay',
      value: Math.floor(Math.random() * 50) + 50,
      unit: 'ms',
      status: 'healthy'
    },
    {
      name: 'Cumulative Layout Shift',
      value: (Math.random() * 0.1).toFixed(2),
      unit: '',
      status: 'healthy'
    }
  ];

  return {
    title: 'Kolocollect Performance Dashboard',
    timestamp: new Date().toISOString(),
    sections: [
      {
        title: 'System Health',
        metrics: [systemMetrics, memoryMetrics, responseTimeMetrics]
      },
      {
        title: 'API Performance',
        metrics: apiMetrics
      },
      {
        title: 'Frontend Performance',
        metrics: frontendMetrics
      }
    ]
  };
}

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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize memory monitoring after server starts
  initMemoryMonitoring();
  
  // Initialize real-time performance monitoring
  initRealTimeMonitoring(io);
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
