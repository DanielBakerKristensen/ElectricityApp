#!/bin/bash

echo "🚀 Setting up Electricity App for LOCAL development..."
echo ""

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Copy template
if [ -f ".env.local.example" ]; then
    cp .env.local.example .env.local
    echo "✅ Created .env.local from template"
else
    echo "❌ Error: .env.local.example not found!"
    exit 1
fi

echo ""
echo "📝 Please edit .env.local and add your:"
echo "   - Database credentials"
echo "   - ELOVERBLIK_REFRESH_TOKEN"
echo "   - ELOVERBLIK_METERING_POINTS"
echo ""
echo "📦 Installing dependencies..."

# Install backend dependencies
if [ -d "backend" ]; then
    cd backend
    npm install
    cd ..
    echo "✅ Backend dependencies installed"
else
    echo "⚠️  Backend directory not found"
fi

# Install frontend dependencies
if [ -d "frontend" ]; then
    cd frontend
    npm install
    cd ..
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Frontend directory not found"
fi

echo ""
echo "✅ Local development setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env.local with your credentials"
echo "   2. Setup PostgreSQL database (see SETUP.md)"
echo "   3. Start backend: cd backend && npm start"
echo "   4. Start frontend: cd frontend && npm start"
echo ""
