# Load Testing with K6

This directory contains a load testing setup using [K6](https://k6.io/). It's designed to simulate multiple users interacting with the Electricity App API to test its performance and stability under pressure.

## Prerequisites

- Docker and Docker Compose
- The main application must be running (`docker-compose up -d`)

## Files

- `k6-script.js`: The K6 test script that simulates user behavior (Health checks, fetching properties, and querying consumption data).
- `docker-compose.k6.yml`: A Docker Compose file to run the K6 container within the same network as the backend.

## How to Run

### 1. Run with Default Settings

You can run a simple load test using Docker Compose. If you have an `ADMIN_TOKEN` configured in your `.env`, you should pass it to the command:

```bash
# In the root or load-testing directory
docker-compose -f load-testing/docker-compose.k6.yml run --rm k6
```

### 2. Run with a specific Admin Token

If your backend requires an admin token (defined in `.env` as `ADMIN_TOKEN`):

```bash
# Windows (PowerShell)
$env:ADMIN_TOKEN="your_token_here"; docker-compose -f load-testing/docker-compose.k6.yml run --rm k6

# Linux/macOS
ADMIN_TOKEN="your_token_here" docker-compose -f load-testing/docker-compose.k6.yml run --rm k6
```

### 3. Running from Host (if K6 is installed locally)

If you have K6 installed on your machine, you can run it directly:

```bash
k6 run --env BASE_URL=http://localhost:5000 --env ADMIN_TOKEN=your_token load-testing/k6-script.js
```

## Understanding the Test

The current script (`k6-script.js`) performs the following stages:
1. **Ramp up**: 0 to 20 users over 1 minute.
2. **Expansion**: 20 to 100 users over 2 minutes.
3. **Recovery**: 100 back to 20 users over 2 minutes.

**Performance Thresholds:**
- 95% of requests must complete in less than **500ms**.
- Error rate must be less than **1%**.

If these thresholds are not met, K6 will exit with a non-zero status code, indicating a failed test.
