#!/bin/bash

# Frontend Health Monitor Script
# Monitors the frontend container and automatically restarts if it becomes unresponsive

CONTAINER_NAME="electricity-frontend"
CHECK_INTERVAL=60  # Check every 60 seconds
MAX_FAILURES=3
FAILURE_COUNT=0

echo "🔍 Starting frontend health monitor..."
echo "Container: $CONTAINER_NAME"
echo "Check interval: ${CHECK_INTERVAL}s"
echo "Max failures before restart: $MAX_FAILURES"
echo ""

while true; do
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "⚠️  [$(date)] Container $CONTAINER_NAME is not running!"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
    else
        # Check if frontend is responding
        if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:3000 > /dev/null 2>&1; then
            if [ $FAILURE_COUNT -gt 0 ]; then
                echo "✅ [$(date)] Frontend recovered (was failing $FAILURE_COUNT times)"
            fi
            FAILURE_COUNT=0
        else
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
            echo "❌ [$(date)] Frontend not responding (failure $FAILURE_COUNT/$MAX_FAILURES)"
            
            # Log container stats
            echo "   Memory usage:"
            docker stats $CONTAINER_NAME --no-stream --format "   {{.MemUsage}}"
            
            # Check last 10 lines of logs
            echo "   Last log entries:"
            docker logs $CONTAINER_NAME --tail 5 2>&1 | sed 's/^/   /'
        fi
    fi
    
    # Restart if max failures reached
    if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
        echo "🔄 [$(date)] Max failures reached. Restarting $CONTAINER_NAME..."
        docker restart $CONTAINER_NAME
        FAILURE_COUNT=0
        echo "⏳ Waiting 30s for container to start..."
        sleep 30
    fi
    
    sleep $CHECK_INTERVAL
done
