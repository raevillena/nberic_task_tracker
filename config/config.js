// Sequelize CLI Configuration
// Reads from environment variables (from .env.local or system environment)
//
// Note: Next.js loads .env.local automatically, but Sequelize CLI runs outside
// Next.js context, so we need to manually parse .env.local files here.

const fs = require('fs');
const path = require('path');

// Simple .env file parser (no external dependencies needed)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip comments and empty lines
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Only set if not already in process.env (system env takes precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    return true;
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
    return false;
  }
}

// Load .env.local first (Next.js priority), then .env
const envLocalPath = path.resolve('.env.local');
const envPath = path.resolve('.env');

const envLocalLoaded = loadEnvFile(envLocalPath);
const envLoaded = !envLocalLoaded ? loadEnvFile(envPath) : false;

// Warn if no environment variables are found
if (!envLocalLoaded && !envLoaded && !process.env.DB_NAME && !process.env.DB_USER) {
  console.warn('\n⚠️  Warning: No database environment variables found.');
  console.warn('   Make sure .env.local exists with DB_* variables, or set them manually.\n');
}

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nberic_task_tracker',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mariadb',
    logging: console.log,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  },
  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME ? `${process.env.DB_NAME}_test` : 'nberic_task_tracker_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mariadb',
    logging: false,
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mariadb',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  },
};

