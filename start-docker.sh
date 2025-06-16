#!/bin/bash
# KoloCollect Docker Setup Script

echo "🐳 KoloCollect Docker Setup"
echo "=========================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit the .env file with your actual configuration before starting the services."
    echo "   Key variables to update:"
    echo "   - JWT_SECRET"
    echo "   - EMAIL_USER and EMAIL_PASSWORD"
    echo "   - AWS credentials (if using S3)"
    echo "   - Stripe keys"
    read -p "Press Enter to continue after editing .env file..."
fi

# Build and start services
echo "🚀 Building and starting KoloCollect services..."
echo "   This may take a few minutes on first run..."

docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "🔍 Checking service health..."

# Check MongoDB
if docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB is healthy"
else
    echo "❌ MongoDB is not responding"
fi

# Check Redis
if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is not responding"
fi

# Check Backend
if curl -f http://localhost:9000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding"
fi

# Check Frontend
if curl -f http://localhost:4200/health > /dev/null 2>&1; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend is not responding"
fi

echo ""
echo "🎉 KoloCollect is now running!"
echo ""
echo "📱 Frontend: http://localhost:4200"
echo "🔧 Backend API: http://localhost:9000"
echo "🗄️  MongoDB: localhost:27017"
echo "🔴 Redis: localhost:6379"
echo ""
echo "📊 To view logs: docker-compose logs -f"
echo "🛑 To stop services: docker-compose down"
echo "🔄 To restart services: docker-compose restart"
echo ""
echo "Happy coding! 🚀"
