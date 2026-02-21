@echo off
REM ZACC Integrity Nexus - Development Server Launcher
REM This script starts both Laravel and React dev servers

echo.
echo ========================================
echo  ZACC INTEGRITY NEXUS - DEV ENVIRONMENT
echo ========================================
echo.

REM Check if npm and php are available
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm not found. Please install Node.js
    pause
    exit /b 1
)

where php >nul 2>nul
if errorlevel 1 (
    echo ERROR: php not found. Please install PHP
    pause
    exit /b 1
)

REM Navigate to Laravel directory
cd /d "%~dp0"

REM Check if database exists
echo.
echo Checking database connection...
php -r "
    \$host = '127.0.0.1';
    \$user = 'root';
    \$pass = '';
    \$db = 'zacc';
    \$conn = @mysqli_connect(\$host, \$user, \$pass);
    if (!@mysqli_select_db(\$conn, \$db)) {
        echo 'WARNING: Database zacc not found. Run: php artisan migrate' . PHP_EOL;
    } else {
        echo 'Database connection OK' . PHP_EOL;
    }
"

REM Start Laravel and React in separate windows
echo.
echo Starting Laravel server on http://localhost:8000...
start "Laravel Server" cmd /k php artisan serve

timeout /t 2 /nobreak

echo Starting React server on http://localhost:3000...
start "React Server" cmd /k cd zacc && npx vite

echo.
echo ========================================
echo  Both servers are starting...
echo  - Laravel: http://localhost:8000
echo  - React:   http://localhost:3000
echo ========================================
echo.
pause
