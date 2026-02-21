# ZACC Integrity Nexus - Development Server Launcher (PowerShell)
# This script starts both Laravel and React dev servers

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " ZACC INTEGRITY NEXUS - DEV ENVIRONMENT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if npm and php are available
$npm = Get-Command npm -ErrorAction SilentlyContinue
$php = Get-Command php -ErrorAction SilentlyContinue

if (-not $npm) {
    Write-Host "ERROR: npm not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

if (-not $php) {
    Write-Host "ERROR: php not found. Please install PHP" -ForegroundColor Red
    exit 1
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check database
Write-Host "Checking database connection..." -ForegroundColor Yellow
$testDb = & php -r @"
    `$host = '127.0.0.1';
    `$user = 'root';
    `$pass = '';
    `$db = 'zacc';
    `$conn = @mysqli_connect(`$host, `$user, `$pass);
    if (!@mysqli_select_db(`$conn, `$db)) {
        echo 'WARNING: Database zacc not found. Run: php artisan migrate';
    } else {
        echo 'Database connection OK';
    }
"@
Write-Host $testDb -ForegroundColor Yellow

# Start Laravel and React servers
Write-Host "`nStarting Laravel server on http://localhost:8000..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k php artisan serve" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting React server on http://localhost:3000..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd zacc && npx vite" -WindowStyle Normal

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Both servers are starting..." -ForegroundColor Cyan
Write-Host " - Laravel: http://localhost:8000" -ForegroundColor Yellow
Write-Host " - React:   http://localhost:3000" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
