# Database Setup Guide

## Environment Configuration

### .env.example File

Create a `.env.local` file in the root directory with the following configuration:

```env
# ============================================
# NBERIC Task Tracker - Environment Variables
# ============================================
# Copy this file to .env.local and fill in your values
# DO NOT commit .env.local to version control

# Database Configuration (MariaDB)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nberic_task_tracker
DB_USER=root
DB_PASSWORD=your_password_here

# Application Environment
NODE_ENV=development

# JWT Configuration (for authentication)
# Generate strong random strings (minimum 32 characters)
# You can use: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_minimum_32_characters
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Socket.IO Configuration (if using)
SOCKET_PORT=3001
```

### Required Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | MariaDB server hostname | `localhost` | Yes |
| `DB_PORT` | MariaDB server port | `3306` | Yes |
| `DB_NAME` | Database name | `nberic_task_tracker` | Yes |
| `DB_USER` | Database username | `root` | Yes |
| `DB_PASSWORD` | Database password | `your_password` | Yes |
| `JWT_SECRET` | Secret key for access tokens | Random 32+ char string | Yes |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | Random 32+ char string | Yes |
| `NODE_ENV` | Application environment | `development` or `production` | Yes |

## Database Setup Steps

### 1. Create MariaDB Database

```sql
CREATE DATABASE nberic_task_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or using command line:

```bash
mysql -u root -p -e "CREATE DATABASE nberic_task_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and update:
   - Database credentials (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
   - JWT secrets (generate strong random strings)

### 3. Run Migrations

Create database tables:

```bash
npm run db:migrate
```

This will create all tables defined in the migrations directory.

### 4. Seed Database (Optional)

Populate database with demo data:

```bash
npm run db:seed
```

This creates:
- 3 users (1 manager, 2 researchers)
- 2 projects
- 3 studies
- 10 tasks with various statuses

See `seeders/README.md` for more details.

## Database Connection

The database connection is configured in `src/lib/db/connection.ts`:

```typescript
export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mariadb',
  // ... connection pool settings
});
```

### Connection Pool Settings

- **max**: 10 connections
- **min**: 2 connections
- **acquire**: 30 seconds timeout
- **idle**: 10 seconds before closing idle connections

## Testing Database Connection

You can test the connection programmatically:

```typescript
import { testConnection } from '@/lib/db/connection';

const connected = await testConnection();
if (connected) {
  console.log('Database connection successful!');
}
```

## Seeder Information

### Demo Data Seeder

The seeder (`seeders/20240101000000-demo-data.js`) creates:

**Users:**
- Manager: `manager@nberic.com` / `Manager123!`
- Researcher 1: `researcher1@nberic.com` / `Researcher123!`
- Researcher 2: `researcher2@nberic.com` / `Researcher456!`

**Projects:**
- Clinical Trial Phase I
- Epidemiology Study 2024

**Studies:**
- Dosage Finding Study
- Safety Assessment
- Regional Analysis

**Tasks:**
- Mix of completed, in-progress, and pending tasks
- Various priorities (low, medium, high, urgent)
- Assigned and unassigned tasks
- Tasks with due dates

### Undoing Seeders

To remove seeded data:

```bash
npx sequelize-cli db:seed:undo:all
```

## Troubleshooting

### Connection Issues

1. **Check MariaDB is running:**
   ```bash
   # Windows
   net start mariadb
   
   # Linux/Mac
   sudo systemctl status mariadb
   ```

2. **Verify credentials in `.env.local`**

3. **Check firewall/port access** (default port 3306)

4. **Test connection manually:**
   ```bash
   mysql -h localhost -P 3306 -u root -p
   ```

### Migration Issues

1. **Check migration status:**
   ```bash
   npx sequelize-cli db:migrate:status
   ```

2. **Rollback last migration:**
   ```bash
   npm run db:migrate:undo
   ```

3. **Reset database (WARNING: Deletes all data):**
   ```bash
   npx sequelize-cli db:migrate:undo:all
   npm run db:migrate
   ```

### Seeder Issues

1. **Check seeder ran successfully:**
   ```bash
   npx sequelize-cli db:seed:status
   ```

2. **Re-run specific seeder:**
   ```bash
   npx sequelize-cli db:seed:undo --seed 20240101000000-demo-data.js
   npx sequelize-cli db:seed --seed 20240101000000-demo-data.js
   ```

## Production Considerations

1. **Use strong JWT secrets** (minimum 32 characters, random)
2. **Use environment-specific database credentials**
3. **Enable SSL for database connections** (if supported)
4. **Set appropriate connection pool limits** based on server capacity
5. **Regular database backups**
6. **Monitor connection pool usage**

## Additional Resources

- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [MariaDB Documentation](https://mariadb.com/kb/en/documentation/)
- [Sequelize CLI Documentation](https://github.com/sequelize/cli)

