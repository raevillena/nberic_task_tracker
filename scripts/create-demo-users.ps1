# PowerShell script to create demo users
# Run with: .\scripts\create-demo-users.ps1

param(
    [string]$DbUser = "nberic",
    [string]$DbName = "nberic_task_tracker"
)

Write-Host "Creating demo users in database: $DbName" -ForegroundColor Cyan

# SQL to create demo users
$sql = @"
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, is_active, token_version, created_at, updated_at)
VALUES 
  ('manager@demo.com', '$2b$12$rBMovGmxWuWRZ/7rcSzzjubIphvcap32x623.iMu0iWIMe6j1/z7a', 'Demo', 'Manager', 'Manager', true, 0, NOW(), NOW()),
  ('researcher@demo.com', '$2b$12$1pDflzlVyzvLo6Ufw.Pe3erk8u9RMI91SmmxcdI8QSom0hCbkvsb2', 'Demo', 'Researcher', 'Researcher', true, 0, NOW(), NOW());
"@

# Write SQL to temporary file
$tempFile = [System.IO.Path]::GetTempFileName()
$sql | Out-File -FilePath $tempFile -Encoding utf8

try {
    # Use Get-Content to pipe SQL to mysql (same as command line < operator)
    # This will prompt for password interactively
    Write-Host "`nYou will be prompted for your database password..." -ForegroundColor Yellow
    Get-Content $tempFile | & mysql -u $DbUser -p $DbName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Demo users created successfully!" -ForegroundColor Green
        Write-Host "   Manager:    manager@demo.com / demo123" -ForegroundColor Yellow
        Write-Host "   Researcher: researcher@demo.com / demo123" -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ Error creating demo users. Check your database credentials." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clean up temp file
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
    }
}
