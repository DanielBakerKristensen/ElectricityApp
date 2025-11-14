# Electricity App - Setup Guide

This guide covers both **local development** and **Docker deployment** setups.

---

## 📋 Prerequisites

### For Local Development
- **Node.js** v18+ and npm
- **PostgreSQL** 16+ installed and running
- Git

### For Docker Deployment
- **Docker** and **Docker Compose**
- Git

---

## 🚀 Quick Start

### Option A: Local Development (Recommended for Development)

**1. Clone and Install**
```bash
git clone <repository-url>
cd ElectricityApp

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

**2. Setup PostgreSQL Database**
```bash
# Create database (using psql or your preferred tool)
createdb electricity_app
createuser electricity_user

# Run initialization script
psql -U electricity_user -d electricity_app -f database/init.sql
```

**3. Configure Environment**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings:
# - Set DB_HOST=localhost
# - Set DB_PORT=5432
# - Set DB_NAME=electricity_app
# - Set DB_USER=electricity_user
# - Set DB_PASSWORD=<your-password>
# - Add your ELOVERBLIK_REFRESH_TOKEN
# - Add your ELOVERBLIK_METERING_POINTS
```

**4. Start Services**
```bash
# Terminal 1: Start Backend
cd backend
npm start
# Backend runs on http://localhost:5000

# Terminal 2: Start Frontend
cd frontend
npm start
# Frontend runs on http://localhost:3000
```

**5. Access Application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/api-docs

---

### Option B: Docker Deployment (Recommended for Production)

**1. Clone Repository**
```bash
git clone <repository-url>
cd ElectricityApp
```

**2. Configure Environment**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings:
# - Set DB_HOST=database (Docker hostname)
# - Set DB_PORT=5432
# - Set DB_NAME=electricity_app
# - Set DB_USER=electricity_user
# - Set DB_PASSWORD=<your-password>
# - Add your ELOVERBLIK_REFRESH_TOKEN
# - Add your ELOVERBLIK_METERING_POINTS
```

**3. Update Frontend Proxy (One-time setup)**
```bash
# Edit frontend/package.json
# Change: "proxy": "http://localhost:5000"
# To:     "proxy": "http://backend:5000"
```

**4. Start Docker Services**
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**5. Access Application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: localhost:5432

---

## 🔧 Configuration Details

### Environment Variables (.env)

```bash
# Database Configuration
DB_HOST=localhost              # Use 'database' for Docker
DB_PORT=5432
DB_NAME=electricity_app
DB_USER=electricity_user
DB_PASSWORD=your_password_here

# Eloverblik API Configuration
ELOVERBLIK_REFRESH_TOKEN=your_refresh_token_here
ELOVERBLIK_METERING_POINTS=your_metering_point_id

# Backend Configuration
NODE_ENV=development
BACKEND_PORT=5000
CORS_ORIGIN=http://localhost:3000

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend Proxy Configuration

**For Local Development:**
```json
// frontend/package.json
"proxy": "http://localhost:5000"
```

**For Docker:**
```json
// frontend/package.json
"proxy": "http://backend:5000"
```

---

## 🧪 Testing

### Run Frontend Tests
```bash
cd frontend
npm test
```

### Run Specific Test File
```bash
cd frontend
npm test -- ApiDemo.test.js --watchAll=false
```

---

## 📊 Database Management

### Local PostgreSQL

**Connect to Database:**
```bash
psql -U electricity_user -d electricity_app
```

**Reset Database:**
```bash
dropdb electricity_app
createdb electricity_app
psql -U electricity_user -d electricity_app -f database/init.sql
```

### Docker PostgreSQL

**Connect to Database:**
```bash
docker exec -it electricity-db psql -U electricity_user -d electricity_app
```

**View Database Logs:**
```bash
docker-compose logs database
```

**Reset Database:**
```bash
docker-compose down -v  # Removes volumes
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Local Development Issues

**Backend won't start - Database connection error**
- Ensure PostgreSQL is running: `pg_isready`
- Check DB_HOST is set to `localhost` in .env
- Verify database credentials
- Ensure database exists: `psql -l`

**Frontend proxy errors**
- Ensure backend is running on port 5000
- Check `proxy` in frontend/package.json is `http://localhost:5000`
- Clear browser cache and restart frontend

**Port already in use**
```bash
# Find process using port 5000
lsof -i :5000  # Mac/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or use different port
```

### Docker Issues

**Containers won't start**
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Database connection issues**
- Ensure DB_HOST is set to `database` in .env
- Wait for database health check: `docker-compose logs database`
- Check network: `docker network ls`

**Frontend can't reach backend**
- Ensure proxy in frontend/package.json is `http://backend:5000`
- Rebuild frontend container: `docker-compose build frontend`
- Check backend is healthy: `docker-compose ps`

---

## 🔄 Switching Between Local and Docker

### From Local to Docker
1. Update .env: `DB_HOST=database`
2. Update frontend/package.json: `"proxy": "http://backend:5000"`
3. Run: `docker-compose up -d`

### From Docker to Local
1. Update .env: `DB_HOST=localhost`
2. Update frontend/package.json: `"proxy": "http://localhost:5000"`
3. Stop Docker: `docker-compose down`
4. Start local services (backend and frontend in separate terminals)

---

## 📦 Project Structure

```
ElectricityApp/
├── backend/              # Node.js Express API
│   ├── config/          # Configuration files
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── server.js        # Entry point
│   └── package.json
├── frontend/            # React application
│   ├── public/          # Static files
│   ├── src/
│   │   ├── components/  # React components
│   │   └── App.js       # Main app component
│   └── package.json
├── database/            # Database setup
│   └── init.sql         # Database initialization
├── .kiro/              # IDE-specific files (ignored)
├── docker-compose.yml   # Docker orchestration
├── .env.example         # Environment template
├── .env                 # Your environment (not in git)
├── README.md            # Project overview
└── SETUP.md             # This file
```

---

## 🔐 Getting Eloverblik API Credentials

1. Visit https://eloverblik.dk
2. Log in with MitID
3. Navigate to "Datadeling" (Data Sharing)
4. Generate a refresh token (valid for 1 year)
5. Find your metering point ID in your account

---

## 📝 Development Workflow

### Making Changes

**Backend Changes:**
- Edit files in `backend/`
- Server auto-restarts (nodemon in dev mode)
- Check logs in terminal

**Frontend Changes:**
- Edit files in `frontend/src/`
- Hot reload updates browser automatically
- Check browser console for errors

**Database Changes:**
- Update `database/init.sql`
- Reset database (see Database Management section)

### Running Tests
```bash
# Frontend tests
cd frontend
npm test

# Backend tests (if implemented)
cd backend
npm test
```

---

## 🚢 Deployment

### Production Docker Build
```bash
# Set production environment
export NODE_ENV=production

# Build and start
docker-compose -f docker-compose.yml up -d --build

# Check status
docker-compose ps
```

### Environment Security
- Never commit `.env` file
- Use strong passwords in production
- Rotate JWT_SECRET regularly
- Keep ELOVERBLIK_REFRESH_TOKEN secure

---

## 📚 Additional Resources

- [Eloverblik API Documentation](https://api.eloverblik.dk/customerapi/index.html)
- [React Documentation](https://react.dev)
- [Express Documentation](https://expressjs.com)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com)

---

## 🆘 Getting Help

If you encounter issues:
1. Check the Troubleshooting section above
2. Review logs: `docker-compose logs` or terminal output
3. Verify environment configuration in `.env`
4. Check that all services are running
5. Ensure ports 3000, 5000, and 5432 are available

---

**Last Updated:** v0.1.1
