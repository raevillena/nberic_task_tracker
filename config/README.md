# Sequelize CLI Configuration

This directory contains the configuration file for Sequelize CLI commands (migrations, seeders).

## Configuration File

`config.js` reads database connection settings from environment variables:

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 3306)
- `DB_NAME` - Database name (default: nberic_task_tracker)
- `DB_USER` - Database username (default: root)
- `DB_PASSWORD` - Database password

## Environment Variables

The config file will try to load environment variables from:
1. `.env.local` (if exists and dotenv is installed)
2. `.env` (if exists and dotenv is installed)
3. System environment variables (fallback)

### Installing dotenv (Recommended)

For automatic loading of `.env.local`:

```bash
npm install dotenv
```

### Manual Environment Variables

If you don't want to use dotenv, you can set environment variables in your shell:

**Windows (PowerShell):**
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_NAME="nberic_task_tracker"
$env:DB_USER="root"
$env:DB_PASSWORD="your_password"
```

**Linux/Mac (Bash):**
```bash
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=nberic_task_tracker
export DB_USER=root
export DB_PASSWORD=your_password
```

## Environments

The config supports three environments:

- **development** - Uses `.env.local` or defaults
- **test** - Uses test database (appends `_test` to database name)
- **production** - Requires all environment variables to be set

Set the environment using:

```bash
NODE_ENV=development npm run db:migrate
```

Or in PowerShell:
```powershell
$env:NODE_ENV="development"; npm run db:migrate
```

## Usage

After setting up environment variables, you can run:

```bash
# Run migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Run seeders
npm run db:seed
```

