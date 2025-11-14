@echo off
echo 🚀 Setting up Electricity App for LOCAL development...
echo.

REM Check if .env.local already exists
if exist ".env.local" (
    echo ⚠️  .env.local already exists!
    set /p overwrite="Do you want to overwrite it? (y/N): "
    if /i not "%overwrite%"=="y" (
        echo ❌ Setup cancelled.
        exit /b 1
    )
)

REM Copy template
if exist ".env.local.example" (
    copy .env.local.example .env.local >nul
    echo ✅ Created .env.local from template
) else (
    echo ❌ Error: .env.local.example not found!
    exit /b 1
)

echo.
echo 📝 Please edit .env.local and add your:
echo    - Database credentials
echo    - ELOVERBLIK_REFRESH_TOKEN
echo    - ELOVERBLIK_METERING_POINTS
echo.
echo 📦 Installing dependencies...

REM Install backend dependencies
if exist "backend" (
    cd backend
    call npm install
    cd ..
    echo ✅ Backend dependencies installed
) else (
    echo ⚠️  Backend directory not found
)

REM Install frontend dependencies
if exist "frontend" (
    cd frontend
    call npm install
    cd ..
    echo ✅ Frontend dependencies installed
) else (
    echo ⚠️  Frontend directory not found
)

echo.
echo ✅ Local development setup complete!
echo.
echo 📋 Next steps:
echo    1. Edit .env.local with your credentials
echo    2. Setup PostgreSQL database (see SETUP.md)
echo    3. Start backend: cd backend ^&^& npm start
echo    4. Start frontend: cd frontend ^&^& npm start
echo.
pause
