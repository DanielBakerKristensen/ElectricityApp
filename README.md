# Electricity Consumption Data App

A full-stack application for pulling and visualizing electricity consumption data from the eloverblik.dk API.

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Deployment**: Docker containers
- **Data Visualization**: ApexCharts
- **Excel Export**: xlsx library

## Features

- 🔐 Secure authentication with eloverblik.dk API
- 📊 Interactive data visualization (charts, graphs)
- 📅 Date range selection and filtering
- 📈 Multiple aggregation levels (Hour, Day, Month, Year)
- 📋 Export data to Excel
- 🏠 Self-hosted solution with Docker

## Project Structure

```
electricity-app/
├── frontend/          # React application
├── backend/           # Node.js API server
├── database/          # PostgreSQL setup
├── docs/              # Documentation
├── scripts/           # Helper scripts for maintenance
├── docker-compose.yml # Docker orchestration
└── README.md
```

## Getting Started

### Docker Deployment (Recommended)

This project is designed to run in Docker.

**1. Configure environment**
```bash
# Run the setup script to create .env.docker
./scripts/setup-docker.sh
# OR for Windows:
scripts\setup-docker.bat
```

**2. Start all services**
```bash
docker-compose up -d
```

**3. Access the app**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

### Admin & Maintenance

Helper scripts are located in the `scripts/` directory:

- **Setup**: `scripts/setup-docker.sh` (or `.bat`)
- **Monitor Health**: `scripts/monitor-frontend.sh` (or `.bat`) - Restarts frontend if it crashes.
- **Diagnose Problems**: `scripts/diagnose-frontend.sh` (or `.bat`) - Collects logs and diagnostics.

## Configuration

You'll need to obtain:
- Refresh token from eloverblik.dk portal
- Your metering point ID(s)
- Add these to `.env.docker`

### Automated Data Sync

The application includes an automated daily sync feature. Configure via environment variables in `.env.docker`:

- `SYNC_ENABLED=true`
- `SYNC_SCHEDULE="0 14 * * *"` (Cron format)
- `SYNC_DAYS_BACK=1`

## Documentation

- [Development Guide](DEVELOPMENT.md) - **Read this before contributing!** Includes Docker workflow details.
- [Frontend Stability Guide](docs/FRONTEND-STABILITY.md)

## Ports

- **Frontend (Nginx):** `localhost:3000` → container port `80`
- **Backend (Node.js):** `localhost:5000` → container port `5000`
- **Database (PostgreSQL):** `localhost:5432` → container port `5432`
