@echo off
REM Frontend Health Monitor Script for Windows
REM Monitors the frontend container and automatically restarts if it becomes unresponsive

set CONTAINER_NAME=electricity-frontend
set CHECK_INTERVAL=60
set MAX_FAILURES=3
set FAILURE_COUNT=0

echo Starting frontend health monitor...
echo Container: %CONTAINER_NAME%
echo Check interval: %CHECK_INTERVAL%s
echo Max failures before restart: %MAX_FAILURES%
echo.

:loop
    REM Check if container is running
    docker ps --format "{{.Names}}" | findstr /X "%CONTAINER_NAME%" >nul 2>&1
    if errorlevel 1 (
        echo [%date% %time%] Container %CONTAINER_NAME% is not running!
        set /a FAILURE_COUNT+=1
        goto check_restart
    )
    
    REM Check if frontend is responding
    curl -f -s -o nul http://localhost:3000 >nul 2>&1
    if errorlevel 1 (
        set /a FAILURE_COUNT+=1
        echo [%date% %time%] Frontend not responding ^(failure %FAILURE_COUNT%/%MAX_FAILURES%^)
        
        REM Log container stats
        echo    Memory usage:
        docker stats %CONTAINER_NAME% --no-stream --format "   {{.MemUsage}}"
        
        REM Check last log entries
        echo    Last log entries:
        docker logs %CONTAINER_NAME% --tail 5
    ) else (
        if %FAILURE_COUNT% gtr 0 (
            echo [%date% %time%] Frontend recovered ^(was failing %FAILURE_COUNT% times^)
        )
        set FAILURE_COUNT=0
    )
    
:check_restart
    if %FAILURE_COUNT% geq %MAX_FAILURES% (
        echo [%date% %time%] Max failures reached. Restarting %CONTAINER_NAME%...
        docker restart %CONTAINER_NAME%
        set FAILURE_COUNT=0
        echo Waiting 30s for container to start...
        timeout /t 30 /nobreak >nul
    )
    
    timeout /t %CHECK_INTERVAL% /nobreak >nul
    goto loop
