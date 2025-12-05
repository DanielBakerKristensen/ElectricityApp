# Frontend Stability Guide

This document explains the solutions implemented to prevent and diagnose frontend container crashes.

## Problem

The React development server in Docker can silently crash, causing the frontend to become unresponsive with "empty response" errors in the browser.

## Root Causes

1. **Memory exhaustion** - React dev server with hot reloading can consume excessive memory
2. **Webpack crashes** - File watching and compilation can fail silently
3. **Signal handling** - Node.js in Docker doesn't always handle SIGTERM/SIGINT properly
4. **Resource limits** - Container memory limits too restrictive
5. **File watching issues** - Docker volume mounting can cause file watching problems

## Solutions Implemented

### 1. Enhanced Dockerfile

**Changes:**
- Added `dumb-init` for proper signal handling
- Increased Node.js memory limit to 4GB
- Disabled source maps to reduce memory usage
- Added error logging to `/app/logs/frontend.log`
- Fallback to keep container alive on crash for debugging

**Benefits:**
- Prevents zombie processes
- Better memory management
- Crash logs are preserved
- Container stays up for diagnostics

### 2. Improved docker-compose.yml

**Changes:**
- Increased memory limit to 4GB (from 2GB)
- Added healthcheck to detect unresponsive frontend
- Added logging configuration (10MB max, 3 files)
- Added environment variables for better stability
- Shared logs volume for persistent logging

**Benefits:**
- Docker can detect and restart unhealthy containers
- Logs are rotated to prevent disk space issues
- Better resource allocation

### 3. Environment Configuration

**File:** `frontend/.env.development`

**Settings:**
- `GENERATE_SOURCEMAP=false` - Reduces memory usage
- `NODE_OPTIONS=--max-old-space-size=4096` - Increases heap size
- `WATCHPACK_POLLING=true` - Better file watching in Docker
- `BROWSER=none` - Prevents browser auto-open

### 4. Monitoring Scripts

#### monitor-frontend.sh / monitor-frontend.bat

**Purpose:** Continuously monitor frontend health and auto-restart on failure

**Usage:**
```bash
# Linux/Mac
chmod +x monitor-frontend.sh
./monitor-frontend.sh

# Windows
monitor-frontend.bat
```

**Features:**
- Checks every 60 seconds
- Restarts after 3 consecutive failures
- Logs memory usage and container stats
- Shows recent log entries on failure

#### diagnose-frontend.sh / diagnose-frontend.bat

**Purpose:** Collect detailed diagnostics when issues occur

**Usage:**
```bash
# Linux/Mac
chmod +x diagnose-frontend.sh
./diagnose-frontend.sh

# Windows
diagnose-frontend.bat
```

**Collects:**
- Container status and restart count
- Resource usage (CPU, memory)
- Recent logs (last 50 lines)
- OOM killer events (Linux)
- Network connectivity
- Node.js version info
- Error patterns

## Quick Fixes

### Frontend Not Responding

```bash
# Quick restart
docker restart electricity-frontend

# Check if it's healthy
docker ps --filter name=electricity-frontend

# View recent logs
docker logs electricity-frontend --tail 50
```

### Persistent Crashes

```bash
# Run diagnostics
./diagnose-frontend.sh  # or .bat on Windows

# Rebuild with new configuration
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d

# Monitor for issues
./monitor-frontend.sh  # or .bat on Windows
```

### Out of Memory

If diagnostics show OOMKilled=true:

1. Increase memory limit in docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      memory: 6144M  # Increase to 6GB
```

2. Rebuild and restart:
```bash
docker-compose up -d --build frontend
```

## Prevention Best Practices

### 1. Regular Monitoring

Run the monitor script in the background:
```bash
# Linux/Mac (background)
nohup ./monitor-frontend.sh > monitor.log 2>&1 &

# Windows (separate window)
start monitor-frontend.bat
```

### 2. Log Rotation

Logs are automatically rotated (10MB max, 3 files). Check them regularly:
```bash
docker logs electricity-frontend --tail 100
```

### 3. Resource Monitoring

Check resource usage periodically:
```bash
docker stats electricity-frontend --no-stream
```

### 4. Healthcheck Status

Docker healthcheck runs every 30 seconds:
```bash
docker inspect electricity-frontend --format='{{.State.Health.Status}}'
```

## Debugging Tips

### Check if Container is OOM Killed

```bash
docker inspect electricity-frontend --format='{{.State.OOMKilled}}'
```

### View Full Container Configuration

```bash
docker inspect electricity-frontend
```

### Check System Resources

```bash
# Linux/Mac
free -h
df -h

# Windows
systeminfo | findstr Memory
```

### Access Container Shell

```bash
docker exec -it electricity-frontend sh
```

### View Real-time Logs

```bash
docker logs -f electricity-frontend
```

## When to Use Each Tool

| Scenario | Tool | Command |
|----------|------|---------|
| Frontend not loading | Quick restart | `docker restart electricity-frontend` |
| Frequent crashes | Monitor script | `./monitor-frontend.sh` |
| Need crash details | Diagnostic script | `./diagnose-frontend.sh` |
| After code changes | Rebuild | `docker-compose up -d --build frontend` |
| Persistent issues | Full rebuild | `docker-compose down && docker-compose up -d --build` |

## Configuration Files

- `frontend/Dockerfile` - Container build configuration
- `docker-compose.yml` - Service orchestration and resources
- `frontend/.env.development` - React dev server settings
- `monitor-frontend.sh/.bat` - Health monitoring
- `diagnose-frontend.sh/.bat` - Diagnostic collection

## Next Steps

If crashes persist after implementing these solutions:

1. Run diagnostics and save the output
2. Check for patterns in the logs
3. Consider switching to production build for stability
4. Review recent code changes that might cause memory leaks
5. Monitor system resources on the host machine

## Production Considerations

For production deployment:

1. Use production build instead of dev server
2. Serve with nginx or similar
3. Remove hot reloading and file watching
4. Reduce memory limits (production builds use less memory)
5. Implement proper logging and monitoring solutions

See `frontend/Dockerfile` for production build stage configuration.
