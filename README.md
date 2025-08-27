# Electricity Consumption Data App

A full-stack application for pulling and visualizing electricity consumption data from the eloverblik.dk API.

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Deployment**: Docker containers
- **Data Visualization**: Chart.js/Recharts
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

1. Clone the repository
2. Copy `.env.example` to `.env` and configure your settings
3. Run with Docker: `docker-compose up -d`
4. Access the app at `http://localhost:3000`

## Configuration

You'll need to obtain:
- Refresh token from eloverblik.dk portal
- Your metering point ID(s)

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
