# Database Setup Scripts

This directory contains scripts to automate the creation of the MariaDB database, user, and privileges.

## Available Scripts

### 1. Interactive PowerShell Script (Windows)
**File**: `setup-database.ps1`

Interactive script that prompts for all inputs and creates the database setup.

**Usage:**
```powershell
.\scripts\setup-database.ps1
```

**Features:**
- Prompts for MariaDB root password
- Prompts for database name (default: `nberic_task_tracker`)
- Prompts for database username (default: `nberic_user`)
- Prompts for database user password
- Prompts for host (default: `localhost`)
- Shows summary before proceeding
- Displays connection details after completion

### 2. Interactive Bash Script (Linux/Mac/Windows WSL)
**File**: `setup-database.sh`

Interactive script for Unix-like systems.

**Usage:**
```bash
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

**Features:**
- Same interactive prompts as PowerShell version
- Secure password input (hidden)
- Cross-platform compatible

### 3. SQL Script (Manual)
**File**: `setup-database.sql`

Direct SQL script that you can edit and run manually.

**Usage:**
```bash
# Edit the variables at the top of the file, then:
mysql -u root -p < scripts/setup-database.sql
```

**Or interactively:**
```bash
mysql -u root -p
# Then copy and paste the SQL commands
```

## What the Scripts Do

1. **Create Database**
   - Creates database with UTF8MB4 character set
   - Uses Unicode collation for full international character support
   - Uses `IF NOT EXISTS` to avoid errors if database already exists

2. **Create User**
   - Creates a new database user
   - Sets password for the user
   - Uses `IF NOT EXISTS` to avoid errors if user already exists

3. **Grant Privileges**
   - Grants ALL PRIVILEGES on the database to the user
   - Scoped to the specific database (not global)

4. **Flush Privileges**
   - Applies all privilege changes immediately
   - Required after creating users or granting privileges

5. **Verification**
   - Shows created database
   - Shows user privileges

## Prerequisites

- MariaDB or MySQL server installed and running
- Root access to MariaDB/MySQL
- `mysql` command-line client installed
- For PowerShell script: PowerShell 5.1+ or PowerShell Core
- For Bash script: Bash shell (Linux, Mac, or WSL on Windows)

## Example Usage

### Windows (PowerShell)
```powershell
# Navigate to project root
cd D:\Users\Raymart\Desktop\Code\nberic_task_tracker

# Run the script
.\scripts\setup-database.ps1

# Follow the prompts:
# Enter MariaDB root password: ********
# Enter database name (default: nberic_task_tracker): [Enter]
# Enter database username (default: nberic_user): [Enter]
# Enter password for database user 'nberic_user': ********
# Enter host for user privileges (default: localhost): [Enter]
# Proceed with database setup? (y/N): y
```

### Linux/Mac (Bash)
```bash
# Navigate to project root
cd /path/to/nberic_task_tracker

# Make script executable
chmod +x scripts/setup-database.sh

# Run the script
./scripts/setup-database.sh

# Follow the prompts (same as PowerShell)
```

## Security Notes

1. **Password Handling**
   - Scripts use secure password input (hidden in terminal)
   - Passwords are cleared from memory after use
   - Never commit passwords to version control

2. **User Privileges**
   - The created user has ALL PRIVILEGES on the specific database only
   - User cannot access other databases
   - For production, consider more restrictive privileges

3. **Host Restrictions**
   - Default is `localhost` (local connections only)
   - Use `%` for any host (less secure, use with caution)
   - For remote access, specify the exact host/IP

## Troubleshooting

### "Access denied for user 'root'"
- Verify root password is correct
- Check if MariaDB/MySQL is running
- Try: `mysql -u root -p` manually first

### "Database already exists"
- Script uses `IF NOT EXISTS`, so this shouldn't cause errors
- If you want to recreate, drop first: `DROP DATABASE nberic_task_tracker;`

### "User already exists"
- Script uses `IF NOT EXISTS`, so this shouldn't cause errors
- To recreate user: `DROP USER 'username'@'localhost';` then re-run script

### "Command not found: mysql"
- Install MariaDB/MySQL client
- Add MySQL bin directory to PATH
- On Windows, may need to use full path: `C:\Program Files\MariaDB\bin\mysql.exe`

### PowerShell Execution Policy Error
```powershell
# Allow script execution (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Next Steps

After running the setup script:

1. **Update `.env.local`** with the created credentials:
   ```env
   DB_NAME=nberic_task_tracker
   DB_USER=nberic_user
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=3306
   ```

2. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

3. **Seed database (optional):**
   ```bash
   npm run db:seed
   ```

## Production Considerations

For production environments:

1. **Use strong passwords** (minimum 16 characters, mixed case, numbers, symbols)
2. **Restrict host access** (use specific IP instead of `%`)
3. **Limit privileges** (grant only what's needed, not ALL PRIVILEGES)
4. **Use SSL connections** if possible
5. **Regular security audits** of database users and privileges

Example of more restrictive privileges:
```sql
-- Instead of ALL PRIVILEGES, grant specific ones:
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER 
ON `database_name`.* TO 'username'@'localhost';
```

