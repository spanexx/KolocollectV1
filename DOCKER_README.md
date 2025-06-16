# KoloCollect Docker Setup

This guide will help you set up the KoloCollect application using Docker and Docker Compose.

## Prerequisites

- Docker Desktop or Docker Engine installed
- Docker Compose installed
- At least 4GB of available RAM
- At least 2GB of available disk space

## Quick Start

1. **Clone the repository** (if not already done)

   ```bash
   git clone <repository-url>
   cd Kolocollect
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file and fill in your actual values for:
   - JWT_SECRET
   - EMAIL_USER and EMAIL_PASSWORD
   - AWS credentials (if using S3)
   - Stripe keys
   - Other configuration as needed

3. **Build and start the services**

   ```bash
   docker-compose up --build -d
   ```

4. **Wait for services to be ready**
   The application will be available at:
   - Frontend: <http://localhost:4200>
   - Backend API: <http://localhost:9000>
   - MongoDB: localhost:27017
   - Redis: localhost:6379

## Services Overview

### Frontend (Angular)

- **Port**: 4200
- **Technology**: Angular 17 with nginx
- **Health Check**: <http://localhost:4200/health>

### Backend (Node.js)

- **Port**: 9000
- **Technology**: Node.js with Express
- **Health Check**: <http://localhost:9000/api/health>

### MongoDB

- **Port**: 27017
- **Username**: admin
- **Password**: password123 (change in production)
- **Database**: kolocollect

### Redis

- **Port**: 6379
- **Password**: redispassword123 (change in production)

## Development Mode

To run in development mode with live reloading:

```bash
# Start only the database services
docker-compose up mongodb redis -d

# Run backend in development mode
cd kolocollect-backend
npm install
npm run dev

# Run frontend in development mode (in another terminal)
cd kolocollect-frontend
npm install
npm start
```

## Useful Commands

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop services

```bash
docker-compose down
```

### Stop and remove volumes (WARNING: This will delete all data)

```bash
docker-compose down -v
```

### Rebuild services

```bash
docker-compose up --build
```

### Scale services

```bash
docker-compose up --scale backend=2
```

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key` |
| `EMAIL_USER` | Email account for sending emails | `your-email@gmail.com` |
| `EMAIL_PASSWORD` | Email account password/app password | `your-app-password` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `AWS_ACCESS_KEY_ID` | AWS access key (if using S3) | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (if using S3) | `...` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Backend port | `9000` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:4200` |

## Troubleshooting

### Common Issues

1. **Port conflicts**
   - If ports 4200, 9000, 27017, or 6379 are in use, modify the ports in `docker-compose.yml`

2. **Memory issues**
   - Ensure Docker has at least 4GB of RAM allocated
   - On Windows/Mac, check Docker Desktop settings

3. **Build failures**
   - Clear Docker cache: `docker system prune -a`
   - Rebuild: `docker-compose up --build --force-recreate`

4. **Database connection issues**
   - Wait for MongoDB to fully start (check logs: `docker-compose logs mongodb`)
   - Ensure the connection string in environment variables is correct

### Health Checks

Check if services are healthy:

```bash
docker-compose ps
```

### Accessing Database

Connect to MongoDB:

```bash
docker-compose exec mongodb mongosh -u admin -p password123 --authenticationDatabase admin
```

Connect to Redis:

```bash
docker-compose exec redis redis-cli -a redispassword123
```

## Production Deployment

For production deployment:

1. **Update environment variables** with production values
2. **Use secrets management** instead of plain text passwords
3. **Set up SSL/TLS** with a reverse proxy (nginx, Cloudflare, etc.)
4. **Configure backup strategies** for MongoDB and uploaded files
5. **Set up monitoring** and logging
6. **Use Docker Swarm or Kubernetes** for orchestration

## Backup and Restore

### Database Backup

```bash
docker-compose exec mongodb mongodump --uri="mongodb://admin:password123@localhost:27017/kolocollect?authSource=admin" --out=/backup
```

### Database Restore

```bash
docker-compose exec mongodb mongorestore --uri="mongodb://admin:password123@localhost:27017/kolocollect?authSource=admin" /backup/kolocollect
```

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify environment variables are set correctly
3. Ensure all required ports are available
4. Check Docker and Docker Compose versions

## Security Notes

- Change default passwords in production
- Use environment-specific secrets
- Enable firewall rules for production
- Regularly update Docker images
- Monitor for security vulnerabilities
