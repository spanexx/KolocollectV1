const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
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
const queueRoutes = require('./routes/queueRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const cacheRoutes = require('./routes/cacheRoutes');
const cacheDebugRoutes = require('./routes/cacheDebugRoutes');
const webhookMiddleware = require('./middlewares/webhookMiddleware');

// Import performance monitoring middleware
const metricsMiddleware = require('./middlewares/prometheusMiddleware');
const httpLogger = require('./middlewares/loggingMiddleware');
const responseTimeMiddleware = require('./middlewares/responseTimeMiddleware');
const { setupOptimizedMiddleware } = require('./middlewares/middlewareManager');
const { correlationMiddleware, logger } = require('./middlewares/correlationMiddleware');
const { initMemoryMonitoring } = require('./utils/memoryMonitor');

// Import cache service
const { initializeCacheService } = require('./utils/centralCacheService');

// Import session service for horizontal scaling
const { initializeSessionService } = require('./utils/sessionService');

// Import all separated models
const Community = require('./models/Community');
const CommunityVote = require('./models/CommunityVote');
const CommunityActivityLog = require('./models/CommunityActivityLog');
const Cycle = require('./models/Cycle');
const MidcycleModel = require('./models/Midcycle');
const Member = require('./models/Member');

// Import schedulers - both original and distributed
const schedulePayouts = require('./utils/scheduler');
const initializeDistributedScheduler = require('./utils/distributedScheduler');

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

// Setup optimized middleware management
setupOptimizedMiddleware(app);

// Add correlation IDs for distributed tracing
app.use(correlationMiddleware);

// Performance Monitoring Middleware (Add before other middleware)
app.use(metricsMiddleware);
app.use(httpLogger);
app.use(responseTimeMiddleware);

// Standard Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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
app.use('/api/queues', queueRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/cache-debug', cacheDebugRoutes);

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
  if (process.env.USE_DISTRIBUTED_SCHEDULER === 'true') {
    console.log('Starting distributed scheduler system for payouts...');
    // Initialize the distributed scheduler
    initializeDistributedScheduler().catch(err => {
      console.error('Error initializing distributed payout scheduler:', err);
    });
  } else {
    console.log('Starting centralized scheduler for payouts...');
    // Since schedulePayouts is now async, we need to call it properly
    schedulePayouts().catch(err => {
      console.error('Error initializing payout scheduler:', err);
    });
  }
} else {
  console.log('Starting individual payout monitors for communities...');
  // This function is commented out in the file, you may need to uncomment it
  // startPayoutMonitoringForAllCommunities();
  console.log('Individual payout monitors are currently disabled. Please set ENABLE_SCHEDULER=true.');
}

// Server startup with cache initialization
const PORT = process.env.PORT || 6000;

async function startServer() {
  try {
    // Connect to database
    await connectDB();
    
    // Initialize cache service
    console.log('Initializing cache service...');
    const cacheService = await initializeCacheService({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600,
      enableMetrics: process.env.NODE_ENV === 'production',
      maxMemoryCacheSize: parseInt(process.env.MEMORY_CACHE_SIZE) || 1000
    });
    
    // Add cache middleware to app
    app.use(cacheService.createCacheHeadersMiddleware());
    app.use(cacheService.createMonitoringMiddleware());
    
    console.log('Cache service initialized successfully');
    
    // Initialize session service for horizontal scaling
    console.log('Initializing session service...');
    const sessionService = initializeSessionService({
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: parseInt(process.env.SESSION_TTL) || 86400 // 24 hours in seconds
    });
    
    // Add session middleware to app
    app.use(sessionService.middleware());
    
    console.log('Session service initialized successfully');
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, { port: PORT });
      
      // Initialize memory monitoring after server starts
      initMemoryMonitoring();
      
      // Initialize real-time performance monitoring
      initRealTimeMonitoring(io);
      
      logger.info('All services initialized successfully');
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

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
