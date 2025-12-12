#!/bin/bash

# Navigate to project root
cd "$(dirname "$0")/.."

echo "🐳 Setting up Electricity App for DOCKER deployment..."
echo ""

# Check if .env.docker already exists
if [ -f ".env.docker" ]; then
    echo "⚠️  .env.docker already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Copy template
if [ -f ".env.docker.example" ]; then
    cp .env.docker.example .env.docker
    echo "✅ Created .env.docker from template"
else
    echo "❌ Error: .env.docker.example not found in project root!"
    exit 1
fi

echo ""
echo "📝 Please edit .env.docker and add your:"
echo "   - Database password (DB_PASSWORD)"
echo "   - ELOVERBLIK_REFRESH_TOKEN"
echo "   - ELOVERBLIK_METERING_POINTS"
echo "   - JWT_SECRET (use a secure random string)"
echo ""
echo "✅ Docker setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env.docker with your credentials"
echo "   2. Start services: docker-compose up -d"
echo "   3. View logs: docker-compose logs -f"
echo "   4. Access app at http://localhost:3000"
echo ""
