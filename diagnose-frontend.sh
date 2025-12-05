#!/bin/bash

# Frontend Diagnostic Script
# Collects detailed information about the frontend container to diagnose crashes

CONTAINER_NAME="electricity-frontend"
OUTPUT_FILE="frontend-diagnostics-$(date +%Y%m%d-%H%M%S).log"

echo "🔍 Frontend Diagnostics Report" | tee $OUTPUT_FILE
echo "Generated: $(date)" | tee -a $OUTPUT_FILE
echo "========================================" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Container Status
echo "📦 Container Status:" | tee -a $OUTPUT_FILE
docker ps -a --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.State}}" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Container Stats
echo "📊 Resource Usage:" | tee -a $OUTPUT_FILE
docker stats $CONTAINER_NAME --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Container Inspect (relevant fields)
echo "🔧 Container Configuration:" | tee -a $OUTPUT_FILE
docker inspect $CONTAINER_NAME --format='
Memory Limit: {{.HostConfig.Memory}}
Memory Reservation: {{.HostConfig.MemoryReservation}}
Restart Policy: {{.HostConfig.RestartPolicy.Name}}
Restart Count: {{.RestartCount}}
Started At: {{.State.StartedAt}}
OOMKilled: {{.State.OOMKilled}}
Exit Code: {{.State.ExitCode}}
' | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Recent Logs
echo "📝 Recent Logs (last 50 lines):" | tee -a $OUTPUT_FILE
docker logs $CONTAINER_NAME --tail 50 2>&1 | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Check for OOM events in system logs (Linux)
if [ -f /var/log/syslog ]; then
    echo "💥 OOM Killer Events:" | tee -a $OUTPUT_FILE
    grep -i "out of memory" /var/log/syslog | grep -i $CONTAINER_NAME | tail -10 | tee -a $OUTPUT_FILE
    echo "" | tee -a $OUTPUT_FILE
fi

# Network connectivity
echo "🌐 Network Connectivity:" | tee -a $OUTPUT_FILE
echo "Frontend -> Backend:" | tee -a $OUTPUT_FILE
docker exec $CONTAINER_NAME sh -c "curl -s -o /dev/null -w 'HTTP Status: %{http_code}\nTime: %{time_total}s\n' http://backend:5000/health" 2>&1 | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Node.js process info (if accessible)
echo "⚙️  Node.js Process Info:" | tee -a $OUTPUT_FILE
docker exec $CONTAINER_NAME sh -c "node -v && npm -v" 2>&1 | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Check for common issues
echo "🔍 Common Issues Check:" | tee -a $OUTPUT_FILE
docker logs $CONTAINER_NAME 2>&1 | grep -i "error\|fatal\|crash\|killed\|out of memory" | tail -20 | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

echo "========================================" | tee -a $OUTPUT_FILE
echo "✅ Diagnostics saved to: $OUTPUT_FILE" | tee -a $OUTPUT_FILE
