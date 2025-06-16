===============================================================================
                        KOLOCOLLECT DOCKER SETUP GUIDE
===============================================================================

PROJECT OVERVIEW
================

KoloCollect is a community-based financial application built with:
- Frontend: Angular 17 with TypeScript
- Backend: Node.js with Express
- Database: MongoDB 7.0
- Cache: Redis 7
- Web Server: Nginx (for frontend serving)

This Docker setup provides a complete containerized environment for development
and production deployment.

===============================================================================

PREREQUISITES
=============

Before starting, ensure you have the following installed:

1. Docker Desktop (Windows/Mac) or Docker Engine (Linux)
   - Minimum version: 20.10.0
   - Download: https://www.docker.com/products/docker-desktop

2. Docker Compose
   - Minimum version: 2.0.0
   - Usually included with Docker Desktop

3. System Requirements:
   - RAM: Minimum 4GB available
   - Storage: Minimum 2GB free space
   - CPU: 2+ cores recommended

4. Git (for cloning the repository)
   - Download: https://git-scm.com/downloads

===============================================================================

QUICK START GUIDE
=================

Step 1: Clone the Repository
----------------------------
If you haven't already, clone the KoloCollect repository:

   git clone <repository-url>
   cd Kolocollect

Step 2: Environment Configuration
---------------------------------
1. Copy the environment template:
   
   Windows (PowerShell):
   Copy-Item .env.example .env
   
   Linux/Mac:
   cp .env.example .env

2. Edit the .env file with your configuration:
   
   Required Variables:
   - JWT_SECRET: Strong secret key for JWT tokens
   - EMAIL_USER: Your email address for notifications
   - EMAIL_PASSWORD: Your email app password
   - MONGO_ROOT_PASSWORD: Strong password for MongoDB
   - REDIS_PASSWORD: Strong password for Redis

   Optional Variables (for production):
   - AWS_ACCESS_KEY_ID: AWS access key for S3 storage
   - AWS_SECRET_ACCESS_KEY: AWS secret key
   - AWS_S3_BUCKET: S3 bucket name
   - STRIPE_SECRET_KEY: Stripe payment processing key
   - STRIPE_WEBHOOK_SECRET: Stripe webhook secret

Step 3: Start the Services
--------------------------
Option A - Using Management Script (Recommended):
   Windows:
   .\docker-manage.ps1 start
   
   Linux/Mac:
   ./start-docker.sh

Option B - Using Docker Compose Directly:
   docker-compose up --build -d

Step 4: Verify Installation
---------------------------
1. Check service status:
   .\docker-manage.ps1 status

2. Run health check:
   .\health-check.ps1

3. Access the application:
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:9000
   - API Health Check: http://localhost:9000/api/health

===============================================================================

SERVICES ARCHITECTURE
=====================

The Docker setup includes the following services:

1. MongoDB Database (mongodb)
   - Container: kolocollect-mongo
   - Port: 27017
   - Volume: mongodb_data
   - Admin User: admin / password123 (change in production)
   - Application Database: kolocollect

2. Redis Cache (redis)
   - Container: kolocollect-redis
   - Port: 6379
   - Volume: redis_data
   - Password: redispassword123 (change in production)
   - Configuration: Append-only file enabled

3. Backend API (backend)
   - Container: kolocollect-backend
   - Port: 9000
   - Technology: Node.js 18 with Express
   - Environment: Production optimized
   - Health Check: /api/health endpoint
   - Volumes: logs/, uploads/

4. Frontend Application (frontend)
   - Container: kolocollect-frontend
   - Port: 4200 (mapped to 80 inside container)
   - Technology: Angular 17 with Nginx
   - Build: Multi-stage optimized build
   - Health Check: /health endpoint

Network Configuration:
- All services communicate via kolocollect-network
- Frontend proxies API calls to backend
- Database and cache are isolated from external access

===============================================================================

MANAGEMENT COMMANDS
==================

PowerShell Management Script (docker-manage.ps1):
-------------------------------------------------

Start Services:
   .\docker-manage.ps1 start
   
Stop Services:
   .\docker-manage.ps1 stop
   
Restart Services:
   .\docker-manage.ps1 restart
   
Build and Start (after code changes):
   .\docker-manage.ps1 build
   
View Logs (all services):
   .\docker-manage.ps1 logs
   
Check Service Status:
   .\docker-manage.ps1 status
   
Clean Up (WARNING: Removes all data):
   .\docker-manage.ps1 clean

Direct Docker Compose Commands:
-------------------------------

Start services:
   docker-compose up -d
   
Start with build (after code changes):
   docker-compose up --build -d
   
Stop services:
   docker-compose down
   
View logs:
   docker-compose logs -f
   
Check status:
   docker-compose ps
   
Remove volumes (WARNING: Deletes data):
   docker-compose down -v

Health Monitoring:
------------------

Basic health check:
   .\health-check.ps1
   
Detailed health check with timing:
   .\health-check.ps1 -Detailed
   
JSON output for automation:
   .\health-check.ps1 -Json

===============================================================================

DEVELOPMENT WORKFLOW
====================

Daily Development:
------------------
1. Start services: .\docker-manage.ps1 start
2. Make code changes in your IDE
3. For backend changes: .\docker-manage.ps1 restart
4. For frontend changes: .\docker-manage.ps1 build
5. Test your changes
6. View logs if needed: .\docker-manage.ps1 logs

Code Changes:
-------------
- Backend: Located in ./kolocollect-backend/
- Frontend: Located in ./kolocollect-frontend/
- Database scripts: ./mongo-init.js
- Configuration: .env file

Hot Reload:
-----------
To enable hot reload for development, add volume mounts to docker-compose.yml:

   backend:
     volumes:
       - ./kolocollect-backend:/app
       - /app/node_modules
   
   frontend:
     volumes:
       - ./kolocollect-frontend:/app
       - /app/node_modules

Testing:
--------
1. Unit tests can be run inside containers:
   docker-compose exec backend npm test
   docker-compose exec frontend npm test

2. Integration tests:
   Use the health check endpoints to verify service connectivity

===============================================================================

PRODUCTION DEPLOYMENT
=====================

For production deployment, use the production configuration:

1. Environment Setup:
   - Copy .env.prod.example to .env.prod
   - Update all production values
   - Use strong passwords and secrets
   - Configure SSL certificates

2. Production Start:
   docker-compose -f docker-compose.prod.yml up -d

3. Production Features:
   - SSL/TLS termination
   - Resource limits
   - Health checks
   - Logging configuration
   - Backup volumes
   - Security headers

4. SSL Configuration:
   - Place SSL certificates in ./nginx/ssl/
   - Update nginx configuration
   - Use HTTPS URLs in environment variables

5. Monitoring:
   - Set up log aggregation
   - Configure monitoring alerts
   - Use health check endpoints
   - Monitor resource usage

===============================================================================

TROUBLESHOOTING
===============

Common Issues and Solutions:

1. Services Won't Start:
   - Check Docker is running: docker info
   - Check ports aren't in use: netstat -an | findstr :4200
   - Review logs: docker-compose logs
   - Verify .env file exists and is configured

2. Database Connection Issues:
   - Check MongoDB container: docker-compose ps
   - Verify credentials in .env file
   - Check MongoDB logs: docker-compose logs mongodb
   - Test connection: docker-compose exec mongodb mongosh

3. Frontend Not Loading:
   - Check container status: docker-compose ps
   - Verify port mapping: http://localhost:4200
   - Check nginx logs: docker-compose logs frontend
   - Clear browser cache

4. API Calls Failing:
   - Check backend health: http://localhost:9000/api/health
   - Verify proxy configuration in nginx.conf
   - Check backend logs: docker-compose logs backend
   - Verify environment variables

5. Permission Issues:
   - On Windows: Ensure drive sharing is enabled in Docker Desktop
   - On Linux: Check file permissions: chmod +x scripts
   - For uploads: Verify volume mounts are correct

6. Performance Issues:
   - Increase Docker memory allocation (Docker Desktop settings)
   - Check system resources: docker system df
   - Monitor container resources: docker stats
   - Optimize image sizes

Reset Everything:
-----------------
If you need to completely reset the environment:

1. Stop all services:
   docker-compose down -v

2. Remove all containers and images:
   docker system prune -a

3. Remove volumes (WARNING: Deletes all data):
   docker volume prune

4. Rebuild from scratch:
   docker-compose up --build -d

===============================================================================

FILE STRUCTURE
==============

Project Directory Structure:
----------------------------
Kolocollect/
├── kolocollect-backend/
│   ├── Dockerfile                 # Backend container configuration
│   ├── .dockerignore             # Files to exclude from backend build
│   ├── package.json              # Backend dependencies
│   └── src/                      # Backend source code
├── kolocollect-frontend/
│   ├── Dockerfile                # Frontend container configuration
│   ├── .dockerignore            # Files to exclude from frontend build
│   ├── nginx.conf               # Nginx web server configuration
│   ├── package.json             # Frontend dependencies
│   └── src/                     # Frontend source code
├── docker-compose.yml           # Development environment
├── docker-compose.prod.yml      # Production environment
├── mongo-init.js               # MongoDB initialization script
├── .env.example                # Environment variables template
├── .env.prod.example           # Production environment template
├── docker-manage.ps1           # PowerShell management script
├── health-check.ps1            # Health monitoring script
├── start-docker.sh             # Bash startup script
└── README.txt                  # This documentation file

Container File Structure:
------------------------
Backend Container (/app):
├── package.json
├── src/
├── config/
├── logs/          # Mounted volume
├── uploads/       # Mounted volume
└── temp/

Frontend Container (/usr/share/nginx/html):
├── index.html
├── assets/
├── js/
└── css/

===============================================================================

ENVIRONMENT VARIABLES REFERENCE
===============================

Required Variables:
------------------
NODE_ENV=production
PORT=9000
MONGODB_URI=mongodb://admin:password@mongodb:27017/kolocollect?authSource=admin
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=your-jwt-secret-key
FRONTEND_URL=http://localhost:4200

Email Configuration:
-------------------
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@kolocollect.com

AWS Configuration (Optional):
-----------------------------
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

Payment Configuration (Optional):
---------------------------------
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

Security Configuration:
----------------------
CORS_ORIGIN=http://localhost:4200
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=your-session-secret
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_HTTP_ONLY=true

===============================================================================

SUPPORT AND RESOURCES
=====================

Documentation:
- Docker: https://docs.docker.com/
- Docker Compose: https://docs.docker.com/compose/
- Node.js: https://nodejs.org/docs/
- Angular: https://angular.io/docs
- MongoDB: https://docs.mongodb.com/
- Redis: https://redis.io/documentation

Getting Help:
- Check logs: docker-compose logs [service-name]
- Health checks: .\health-check.ps1 -Detailed
- Container status: docker-compose ps
- System resources: docker system df

Common Commands Quick Reference:
- Start: .\docker-manage.ps1 start
- Stop: .\docker-manage.ps1 stop  
- Logs: .\docker-manage.ps1 logs
- Status: .\docker-manage.ps1 status
- Health: .\health-check.ps1

===============================================================================

VERSION INFORMATION
===================

Application Versions:
- Node.js: 18.x
- Angular: 17.x
- MongoDB: 7.0
- Redis: 7.x
- Nginx: 1.21

Docker Configuration:
- Docker Compose Version: 3.8
- Network Driver: bridge
- Volume Driver: local

Build Information:
- Multi-stage builds: Enabled
- Security: Non-root users
- Health checks: Enabled
- Resource limits: Configured for production

===============================================================================

This completes the KoloCollect Docker Setup Guide. For additional support
or questions, please refer to the project documentation or contact the
development team.

Last Updated: June 16, 2025
===============================================================================
