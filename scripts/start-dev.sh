#!/bin/bash

# AI-Integrated Development Environment Startup Script
# This script starts the complete ECEEE v4 development environment

set -e

echo "🚀 Starting ECEEE v4 AI-Integrated Development Environment"
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Error: docker-compose is not installed."
    exit 1
fi

echo "✅ Docker is running and available"

# Navigate to project root
cd "$(dirname "$0")/.."

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.template .env
    echo "⚠️  Please review and update the .env file with your specific configuration"
fi

echo "🏗️  Building and starting services..."

# Build and start all services
docker-compose up --build -d

echo "⏳ Waiting for services to be ready..."

# Wait for database to be ready
echo "Waiting for PostgreSQL..."
until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Wait for backend to be ready
echo "Waiting for Django backend..."
until curl -f http://localhost:8000/health/ > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Django backend is ready"

# Wait for frontend to be ready
echo "Waiting for React frontend..."
until curl -f http://localhost:3000/ > /dev/null 2>&1; do
    sleep 2
done
echo "✅ React frontend is ready"

echo ""
echo "🎉 Development environment is ready!"
echo "=================================================="
echo "📱 Frontend (React):          http://localhost:3000"
echo "🔧 Backend API (Django):      http://localhost:8000"
echo "📊 API Documentation:         http://localhost:8000/api/docs/"
echo "👤 Django Admin:              http://localhost:8000/admin/"
echo "🔥 HTMX Examples:             http://localhost:8000/htmx/"
echo "📈 Monitoring (Prometheus):   http://localhost:8000/metrics/"
echo "🗄️  Database (PostgreSQL):     localhost:5432"
echo "⚡ Redis Cache:               localhost:6379"
echo "=================================================="
echo ""
echo "📋 Useful commands:"
echo "  View logs:           docker-compose logs -f"
echo "  Stop services:       docker-compose down"
echo "  Django shell:        docker-compose exec backend python manage.py shell"
echo "  Run tests:           docker-compose exec backend python manage.py test"
echo "  Database migrations: docker-compose exec backend python manage.py migrate"
echo ""
echo "🔧 Development tools:"
echo "  Debug Toolbar:       http://localhost:8000/__debug__/"
echo "  Silk Profiling:      http://localhost:8000/silk/"
echo ""
echo "Happy coding! 🎯"