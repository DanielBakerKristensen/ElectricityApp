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
├── docker-compose.yml # Docker orchestration
└── README.md
```

## Getting Started

**📖 For detailed setup instructions, see [SETUP.md](SETUP.md)**

### Quick Start Options

**Local Development:**
```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Setup database and configure .env
cp .env.local.example .env
# Edit .env with your credentials

# 3. Start services
cd backend && npm start    # Terminal 1
cd frontend && npm start   # Terminal 2
```

**Docker Deployment:**
```bash
# 1. Configure environment
cp .env.docker.example .env
# Edit .env with your credentials

# 2. Start all services
docker-compose up -d
```

Access the app at `http://localhost:3000`

## Configuration

You'll need to obtain:
- Refresh token from eloverblik.dk portal
- Your metering point ID(s)

### Automated Data Sync

The application includes an automated daily sync feature that fetches electricity consumption data from the Eloverblik API and stores it locally in the database. This reduces dependency on the external API and improves performance.

**Environment Variables:**

- `SYNC_ENABLED` - Enable or disable automated sync (default: `true`)
  - Set to `false` to disable the scheduler
- `SYNC_SCHEDULE` - Cron expression for sync schedule (default: `0 14 * * *`)
  - Default runs daily at 2:00 PM
  - Examples:
    - `0 14 * * *` - Daily at 2:00 PM
    - `0 */6 * * *` - Every 6 hours
    - `0 3 * * 1` - Weekly on Monday at 3:00 AM
    - `0 1 1 * *` - Monthly on the 1st at 1:00 AM
- `SYNC_DAYS_BACK` - Number of days to sync (default: `1`)
  - Set to `1` to sync yesterday's data
  - Set to `7` to sync the last week of data
- `ADMIN_TOKEN` - Authentication token for admin endpoints (optional)
  - Leave empty to disable authentication (for local development)
  - Set a secure token for production environments

**Manual Sync Trigger:**

You can manually trigger a data sync using the API endpoint:

```bash
# Without authentication (if ADMIN_TOKEN is not set)
curl -X POST http://localhost:5000/api/sync/trigger

# With authentication (if ADMIN_TOKEN is set)
curl -X POST http://localhost:5000/api/sync/trigger \
  -H "Authorization: Bearer your_admin_token_here"
```

The endpoint returns:
```json
{
  "success": true,
  "recordsSynced": 24,
  "logId": 42,
  "message": "Sync completed successfully"
}
```

## API Rate Limits

- Token calls: 2 per minute per IP
- Total calls: 120 per minute per IP
- Global limit: 400 per minute for all users
- Max period: 730 days at a time

---

## Running with Docker

This project is fully containerized using Docker Compose. The setup includes three services: backend (Node.js), frontend (React served by Nginx), and a PostgreSQL database. All dependencies and build steps are handled within the containers.

### Requirements

- Docker and Docker Compose installed
- Node.js version used in containers: **22.13.1** (as specified in Dockerfiles)
- No need to install Node.js or dependencies locally

### Environment Variables

- Copy `.env.example` to `.env` and fill in the required values before starting the containers.
- The backend and frontend can be configured via their respective `.env` files if needed.
- The PostgreSQL service uses the following default credentials (set in `docker-compose.yml`):
  - `POSTGRES_USER=postgres`
  - `POSTGRES_PASSWORD=postgres`
  - `POSTGRES_DB=electricity`

### Build & Run

1. Ensure your `.env` file is configured.
2. Start all services:
   ```sh
   docker-compose up -d
   ```
3. The frontend will be available at [http://localhost:3000](http://localhost:3000)
4. The backend API will be available at [http://localhost:5000](http://localhost:5000)
5. PostgreSQL will be accessible on port `5432` (for development or admin tools)

### Ports

- **Frontend (Nginx):** `localhost:3000` → container port `80`
- **Backend (Node.js):** `localhost:5000` → container port `5000`
- **Database (PostgreSQL):** `localhost:5432` → container port `5432`

### Special Configuration

- The database is initialized with `./database/init.sql` on first run.
- Persistent database storage is handled via a Docker volume (`pgdata`).
- Healthchecks are configured for all services to ensure reliability.
- The backend and frontend run as non-root users inside their containers for improved security.

---
