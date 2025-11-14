@echo off
echo 🐳 Setting up Electricity App for DOCKER deployment...
echo.

REM Check if .env.docker already exists
if exist ".env.docker" (
    echo ⚠️  .env.docker already exists!
    set /p overwrite="Do you want to overwrite it? (y/N): "
    if /i not "%overwrite%"=="y" (
        echo ❌ Setup cancelled.
        exit /b 1
    )
)

REM Copy template
if exist ".env.docker.example" (
    copy .env.docker.example .env.docker >nul
    echo ✅ Created .env.docker from template
) else (
    echo ❌ Error: .env.docker.example not found!
    exit /b 1
)

echo.
echo 📝 Please edit .env.docker and add your:
echo    - Database password (DB_PASSWORD)
echo    - ELOVERBLIK_REFRESH_TOKEN
echo    - ELOVERBLIK_METERING_POINTS
echo    - JWT_SECRET (use a secure random string)
echo.
echo ✅ Docker setup complete!
echo.
echo 📋 Next steps:
echo    1. Edit .env.docker with your credentials
echo    2. Start services: docker-compose up -d
echo    3. View logs: docker-compose logs -f
echo    4. Access app at http://localhost:3000
echo.
pause
