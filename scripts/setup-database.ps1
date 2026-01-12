# MariaDB Database Setup Script (PowerShell)
# This script creates a database, user, and grants privileges

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MariaDB Database Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Prompt for MariaDB root password
$rootPassword = Read-Host "Enter MariaDB root password" -AsSecureString
$rootPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($rootPassword)
)

# Prompt for database name
$dbName = Read-Host "Enter database name (default: nberic_task_tracker)"
if ([string]::IsNullOrWhiteSpace($dbName)) {
    $dbName = "nberic_task_tracker"
}

# Prompt for database user
$dbUser = Read-Host "Enter database username (default: nberic_user)"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "nberic_user"
}

# Prompt for database user password
$dbPassword = Read-Host "Enter password for database user '$dbUser'" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
)

# Prompt for host (for privileges)
$dbHost = Read-Host "Enter host for user privileges (default: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) {
    $dbHost = "localhost"
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Database Name: $dbName"
Write-Host "  Database User: $dbUser"
Write-Host "  Database Host: $dbHost"
Write-Host ""

$confirm = Read-Host "Proceed with database setup? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Setup cancelled." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Creating database and user..." -ForegroundColor Green

# Create SQL commands with proper variable expansion
# Note: Use `` (double backtick) for SQL backticks in PowerShell here-strings
$sqlCommands = @"
-- Create database
CREATE DATABASE IF NOT EXISTS ``$dbName`` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER IF NOT EXISTS '$dbUser'@'$dbHost' IDENTIFIED BY '$dbPasswordPlain';

-- Grant privileges
GRANT ALL PRIVILEGES ON ``$dbName``.* TO '$dbUser'@'$dbHost';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Show created database
SHOW DATABASES LIKE '$dbName';

-- Show user privileges
SHOW GRANTS FOR '$dbUser'@'$dbHost';
"@

# Execute SQL commands
try {
    $sqlCommands | mysql -u root -p"$rootPasswordPlain" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Database setup completed successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Connection details for .env.local:" -ForegroundColor Cyan
        Write-Host "  DB_NAME=$dbName"
        Write-Host "  DB_USER=$dbUser"
        Write-Host "  DB_PASSWORD=<your_password>"
        Write-Host "  DB_HOST=$dbHost"
        Write-Host "  DB_PORT=3306"
        Write-Host ""
    } else {
        Write-Host "Error: Database setup failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error executing SQL commands: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear sensitive variables
    $rootPasswordPlain = $null
    $dbPasswordPlain = $null
    [System.GC]::Collect()
}

