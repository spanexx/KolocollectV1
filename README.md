# KoloCollect - Community Savings Platform

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [System Architecture](#system-architecture)
4. [Prerequisites](#prerequisites)
5. [Installation Guide](#installation-guide)
6. [Docker Setup](#docker-setup)
7. [Configuration](#configuration)
8. [API Documentation](#api-documentation)
9. [Frontend Setup](#frontend-setup)
10. [Backend Setup](#backend-setup)
11. [Database Setup](#database-setup)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)
15. [License](#license)

## Overview

KoloCollect is a modern community savings platform that allows groups of people to pool their money together in a structured, transparent, and secure way. The platform digitizes traditional community savings practices (like "Tanda", "Susu", or "Rotating Savings and Credit Associations") with modern technology.

### Key Benefits

- **Transparency**: Real-time tracking of contributions and payouts
- **Security**: Encrypted transactions and secure user authentication
- **Flexibility**: Customizable contribution schedules and amounts
- **Community**: Built-in communication tools for group members
- **Mobile-First**: Responsive design for all devices

## Features

### For Community Members

- **Join Communities**: Browse and join existing savings groups
- **Create Communities**: Start your own savings group with custom rules
- **Track Contributions**: Real-time dashboard showing your savings progress
- **Automated Payments**: Set up recurring contributions
- **Payout Scheduling**: Transparent payout rotation system
- **Community Chat**: Communicate with group members
- **Transaction History**: Complete audit trail of all activities

### For Community Administrators

- **Member Management**: Add, remove, and manage community members
- **Contribution Tracking**: Monitor all member contributions
- **Payout Management**: Handle payout distributions
- **Community Settings**: Configure contribution amounts, schedules, and rules
- **Reporting**: Generate detailed financial reports
- **Notifications**: Automated reminders and alerts

### Technical Features

- **RESTful API**: Well-documented API for all operations
- **Real-time Updates**: WebSocket support for live updates
- **Mobile Responsive**: Works on all devices and screen sizes
- **Secure Authentication**: JWT-based authentication with role-based access
- **Data Encryption**: All sensitive data is encrypted
- **Backup & Recovery**: Automated database backups
- **Scalable Architecture**: Microservices-ready design

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Angular       │    │   Node.js       │    │   MongoDB       │
│   Frontend      │◄──►│   Backend       │◄──►│   Database      │
│   (Port 4200)   │    │   (Port 9000)   │    │   (Port 27017)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │     Redis       │    │   File Storage  │
│  (Reverse Proxy)│    │    (Cache)      │    │   (AWS S3)      │
│                 │    │   (Port 6379)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

**Frontend:**

- Angular 17+
- TypeScript
- Angular Material UI
- RxJS for reactive programming
- PWA support

**Backend:**

- Node.js with Express.js
- TypeScript
- JWT for authentication
- Mongoose for MongoDB integration
- Redis for caching and sessions
- Socket.io for real-time features

**Database:**

- MongoDB for primary data storage
- Redis for caching and session management

**DevOps:**

- Docker & Docker Compose
- Nginx for reverse proxy
- PM2 for process management
- GitHub Actions for CI/CD

## Prerequisites

Before installing KoloCollect, ensure you have the following installed:

### Required Software

- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher) or **yarn**
- **Docker** (v20.0.0 or higher)
- **Docker Compose** (v2.0.0 or higher)
- **Git** (v2.30.0 or higher)

### System Requirements

- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: Minimum 10GB free space
- **Network**: Stable internet connection for initial setup

### Optional (for production)

- **SSL Certificate** (for HTTPS)
- **Domain Name**
- **AWS Account** (for S3 file storage)
- **Stripe Account** (for payment processing)
- **SMTP Server** (for email notifications)

## Installation Guide

### Option 1: Docker Installation (Recommended)

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/kolocollect.git
   cd kolocollect
   ```

2. **Setup Environment Variables**

   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit with your configuration
   nano .env
   ```

3. **Start with Docker**

   ```bash
   # Start all services
   docker-compose up --build -d
   
   # Check service status
   docker-compose ps
   ```

4. **Access the Application**
   - Frontend: <http://localhost:4200>
   - Backend API: <http://localhost:9000>
   - API Documentation: <http://localhost:9000/api/docs>

### Option 2: Manual Installation

1. **Clone and Setup Backend**

   ```bash
   git clone https://github.com/yourusername/kolocollect.git
   cd kolocollect/kolocollect-backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

2. **Setup Frontend**

   ```bash
   cd ../kolocollect-frontend
   npm install
   ng serve
   ```

3. **Setup Database**

   ```bash
   # Install MongoDB locally or use MongoDB Atlas
   # Update connection string in .env file
   ```

## Docker Setup

### Development Environment

The Docker setup includes the following services:

- **MongoDB**: Primary database (port 27017)
- **Redis**: Caching and sessions (port 6379)
- **Backend**: Node.js API server (port 9000)
- **Frontend**: Angular app with Nginx (port 4200)

### Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up --build -d

# Check service health
docker-compose ps
```

### Using Management Scripts

**PowerShell (Windows):**

```powershell
# Start services
.\docker-manage.ps1 start

# Check health
.\health-check.ps1 -Detailed

# Stop services
.\docker-manage.ps1 stop
```

**Bash (Linux/Mac):**

```bash
# Make script executable
chmod +x start-docker.sh

# Start services
./start-docker.sh
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
MONGODB_URI=mongodb://admin:password123@localhost:27017/kolocollect?authSource=admin
REDIS_URL=redis://:redispassword123@localhost:6379

# Application Configuration
NODE_ENV=development
PORT=9000
FRONTEND_URL=http://localhost:4200

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# AWS Configuration (Optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Stripe Configuration (Optional)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

### Database Configuration

**MongoDB Atlas (Cloud):**

1. Create a MongoDB Atlas account
2. Create a new cluster
3. Get the connection string
4. Update `MONGODB_URI` in `.env`

**Local MongoDB:**

1. Install MongoDB locally
2. Start MongoDB service
3. Use local connection string

## API Documentation

### Authentication Endpoints

```
POST /api/auth/register     # Register new user
POST /api/auth/login        # User login
POST /api/auth/logout       # User logout
POST /api/auth/refresh      # Refresh token
GET  /api/auth/me          # Get current user
```

### Community Endpoints

```
GET    /api/communities           # List all communities
POST   /api/communities           # Create new community
GET    /api/communities/:id       # Get community details
PUT    /api/communities/:id       # Update community
DELETE /api/communities/:id       # Delete community
POST   /api/communities/:id/join  # Join community
```

### Contribution Endpoints

```
GET  /api/contributions              # List contributions
POST /api/contributions              # Make contribution
GET  /api/contributions/:id          # Get contribution details
PUT  /api/contributions/:id          # Update contribution
```

### User Management Endpoints

```
GET    /api/users              # List users (admin only)
GET    /api/users/:id          # Get user profile
PUT    /api/users/:id          # Update user profile
DELETE /api/users/:id          # Delete user (admin only)
```

### API Response Format

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Operation successful",
  "timestamp": "2025-06-16T10:30:00Z"
}
```

## Frontend Setup

### Development Server

```bash
cd kolocollect-frontend
npm install
ng serve
```

### Build for Production

```bash
# Build for production
ng build --prod

# Build with specific environment
ng build --configuration=production
```

### Key Frontend Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **PWA Support**: Can be installed as a mobile app
- **Real-time Updates**: WebSocket integration for live data
- **Offline Support**: Basic offline functionality
- **Material Design**: Modern, clean UI with Angular Material

### Frontend Structure

```structure
src/
├── app/
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── guards/            # Route guards
│   ├── interceptors/      # HTTP interceptors
│   ├── models/            # TypeScript interfaces
│   └── shared/            # Shared utilities
├── assets/                # Static assets
├── environments/          # Environment configurations
└── styles/               # Global styles
```

## Backend Setup

### Development Server

```bash
cd kolocollect-backend
npm install
npm run dev
```

### Production Server

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Backend Structure

```
kolocollect-backend/
├── src/
│   ├── controllers/       # Request handlers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── middleware/       # Custom middleware
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   └── config/           # Configuration files
├── uploads/              # File uploads
├── logs/                 # Application logs
└── tests/                # Test files
```

### Key Backend Features

- **RESTful API**: Clean, consistent API design
- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control
- **Validation**: Input validation with Joi
- **Error Handling**: Centralized error handling
- **Logging**: Comprehensive request/error logging
- **Rate Limiting**: API rate limiting for security
- **CORS**: Configurable CORS settings

## Database Setup

### MongoDB Schema

**Users Collection:**

```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (hashed),
  firstName: String,
  lastName: String,
  phone: String,
  role: String, // 'user' | 'admin'
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Communities Collection:**

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  contributionAmount: Number,
  contributionFrequency: String, // 'weekly' | 'monthly'
  maxMembers: Number,
  currentMembers: Number,
  status: String, // 'active' | 'inactive' | 'completed'
  createdBy: ObjectId,
  members: [ObjectId],
  payoutOrder: [ObjectId],
  startDate: Date,
  endDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Contributions Collection:**

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  communityId: ObjectId,
  amount: Number,
  contributionDate: Date,
  payoutDate: Date,
  status: String, // 'pending' | 'completed' | 'failed'
  transactionId: String,
  method: String, // 'card' | 'bank' | 'cash'
  createdAt: Date,
  updatedAt: Date
}
```

### Database Indexes

```javascript
// Users
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ username: 1 }, { unique: true })

// Communities
db.communities.createIndex({ name: 1 })
db.communities.createIndex({ createdBy: 1 })
db.communities.createIndex({ status: 1 })

// Contributions
db.contributions.createIndex({ userId: 1 })
db.contributions.createIndex({ communityId: 1 })
db.contributions.createIndex({ payoutDate: 1 })
db.contributions.createIndex({ status: 1 })
```

## Deployment

### Production Deployment with Docker

1. **Setup Production Environment**

   ```bash
   # Copy production environment template
   cp .env.prod.example .env.prod
   
   # Edit with production values
   nano .env.prod
   ```

2. **Deploy with Docker Compose**

   ```bash
   # Use production configuration
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Setup SSL Certificate**

   ```bash
   # Add SSL certificates to nginx/ssl/
   # Update nginx configuration for HTTPS
   ```

### Cloud Deployment Options

**AWS:**

- Use ECS or EKS for container orchestration
- RDS for MongoDB (or MongoDB Atlas)
- ElastiCache for Redis
- S3 for file storage
- CloudFront for CDN

**Google Cloud:**

- Google Kubernetes Engine (GKE)
- Cloud MongoDB or MongoDB Atlas
- Cloud Memorystore for Redis
- Cloud Storage for files

**Azure:**

- Azure Container Instances
- Azure Cosmos DB (MongoDB API)
- Azure Cache for Redis
- Azure Blob Storage

### Environment-Specific Configurations

**Development:**

- Hot reload enabled
- Debug logging
- Development database
- CORS enabled for localhost

**Staging:**

- Production-like environment
- Test data
- Limited external integrations
- SSL certificate (staging)

**Production:**

- Optimized builds
- Error logging only
- Production database
- All security features enabled
- SSL certificate (production)

## Troubleshooting

### Common Issues

**1. Docker Services Not Starting**

```bash
# Check Docker status
docker --version
docker-compose --version

# Check logs
docker-compose logs -f

# Restart services
docker-compose restart
```

**2. Database Connection Issues**

```bash
# Check MongoDB connection
docker-compose exec mongodb mongosh

# Verify environment variables
docker-compose exec backend env | grep MONGODB_URI
```

**3. Frontend Build Errors**

```bash
# Clear node modules and reinstall
cd kolocollect-frontend
rm -rf node_modules package-lock.json
npm install

# Check Angular CLI version
ng version
```

**4. API Endpoint Not Working**

```bash
# Check backend logs
docker-compose logs backend

# Test API directly
curl http://localhost:9000/api/health
```

**5. Permission Issues**

```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

### Health Check Commands

```bash
# Check all services
./health-check.ps1 -Detailed

# Check specific service
docker-compose exec backend curl http://localhost:9000/api/health
docker-compose exec frontend curl http://localhost/health
```

### Log Analysis

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# View logs with timestamps
docker-compose logs -f -t backend
```

## Contributing

We welcome contributions to KoloCollect! Please follow these guidelines:

### Development Workflow

1. **Fork the Repository**

   ```bash
   git fork https://github.com/yourusername/kolocollect.git
   ```

2. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow coding standards
   - Add tests for new features
   - Update documentation

4. **Run Tests**

   ```bash
   # Backend tests
   cd kolocollect-backend
   npm test
   
   # Frontend tests
   cd kolocollect-frontend
   ng test
   ```

5. **Submit Pull Request**
   - Write clear commit messages
   - Include description of changes
   - Reference any related issues

### Code Standards

**TypeScript/JavaScript:**

- Use TypeScript for all new code
- Follow ESLint configurations
- Use Prettier for code formatting
- Add JSDoc comments for functions

**Angular:**

- Follow Angular style guide
- Use OnPush change detection when possible
- Implement proper error handling
- Write unit tests for components

**Node.js:**

- Use async/await instead of callbacks
- Implement proper error handling
- Add input validation
- Write API documentation

### Testing

**Unit Tests:**

```bash
# Backend
npm test

# Frontend
ng test
```

**Integration Tests:**

```bash
# API tests
npm run test:integration

# E2E tests
ng e2e
```

**Load Testing:**

```bash
# Use tools like Artillery or k6
artillery run load-test.yml
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

- **Angular**: MIT License
- **Node.js**: MIT License
- **MongoDB**: Server Side Public License (SSPL)
- **Redis**: BSD License
- **Docker**: Apache License 2.0

## Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Email**: <support@kolocollect.com>

## Acknowledgments

- **Contributors**: Thanks to all developers who contributed to this project
- **Community**: Special thanks to the community savings groups that inspired this platform
- **Open Source**: Built on top of amazing open-source technologies

---

**Last Updated**: June 16, 2025
**Version**: 1.0.0
**Author**: KoloCollect Development Team
