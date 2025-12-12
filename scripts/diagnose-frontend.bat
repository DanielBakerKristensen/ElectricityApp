@echo off
cd /d "%~dp0.."

REM Frontend Diagnostic Script for Windows
REM Collects detailed information about the frontend container to diagnose crashes

set CONTAINER_NAME=electricity-frontend
if not exist "logs" mkdir logs
set OUTPUT_FILE=logs\frontend-diagnostics-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log
set OUTPUT_FILE=%OUTPUT_FILE: =0%

echo Frontend Diagnostics Report > %OUTPUT_FILE%
echo Generated: %date% %time% >> %OUTPUT_FILE%
echo ======================================== >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

echo Collecting diagnostics...

REM Container Status
echo Container Status: >> %OUTPUT_FILE%
docker ps -a --filter name=%CONTAINER_NAME% --format "table {{.Names}}\t{{.Status}}\t{{.State}}" >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

REM Container Stats
echo Resource Usage: >> %OUTPUT_FILE%
docker stats %CONTAINER_NAME% --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

REM Container Inspect
echo Container Configuration: >> %OUTPUT_FILE%
docker inspect %CONTAINER_NAME% --format="Memory Limit: {{.HostConfig.Memory}}" >> %OUTPUT_FILE%
docker inspect %CONTAINER_NAME% --format="Restart Policy: {{.HostConfig.RestartPolicy.Name}}" >> %OUTPUT_FILE%
docker inspect %CONTAINER_NAME% --format="Restart Count: {{.RestartCount}}" >> %OUTPUT_FILE%
docker inspect %CONTAINER_NAME% --format="Started At: {{.State.StartedAt}}" >> %OUTPUT_FILE%
docker inspect %CONTAINER_NAME% --format="OOMKilled: {{.State.OOMKilled}}" >> %OUTPUT_FILE%
docker inspect %CONTAINER_NAME% --format="Exit Code: {{.State.ExitCode}}" >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

REM Recent Logs
echo Recent Logs (last 50 lines): >> %OUTPUT_FILE%
docker logs %CONTAINER_NAME% --tail 50 >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Network connectivity
echo Network Connectivity: >> %OUTPUT_FILE%
echo Frontend -^> Backend: >> %OUTPUT_FILE%
docker exec %CONTAINER_NAME% sh -c "curl -s -o /dev/null -w 'HTTP Status: %%{http_code}\nTime: %%{time_total}s\n' http://backend:5000/health" >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Node.js process info
echo Node.js Process Info: >> %OUTPUT_FILE%
docker exec %CONTAINER_NAME% sh -c "node -v && npm -v" >> %OUTPUT_FILE% 2>&1
echo. >> %OUTPUT_FILE%

REM Check for common issues
echo Common Issues Check: >> %OUTPUT_FILE%
docker logs %CONTAINER_NAME% 2>&1 | findstr /I "error fatal crash killed memory" >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

echo ======================================== >> %OUTPUT_FILE%
echo Diagnostics saved to: %OUTPUT_FILE% >> %OUTPUT_FILE%

echo.
echo Diagnostics complete! Saved to: %OUTPUT_FILE%
type %OUTPUT_FILE%
