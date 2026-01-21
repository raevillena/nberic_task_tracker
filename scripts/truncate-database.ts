// Script to truncate all database tables
// WARNING: This will delete ALL data from all tables!
// Use with caution - this is for development/testing only
//
// Run with: npm run db:truncate
// Or: npx ts-node -r tsconfig-paths/register --project tsconfig.server.json scripts/truncate-database.ts

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { sequelize } from '../src/lib/db/connection';
// Import models to ensure they're initialized
import '../src/lib/db/models';

// List of all table names in dependency order (child tables first, parent tables last)
// This ensures foreign key constraints are respected
const tableNames = [
  // Child tables (depend on others)
  'task_reads',
  'project_reads',
  'study_reads',
  'notifications',
  'task_assignments',
  'task_requests',
  'compliance_flags',
  'messages',
  'tasks',
  'studies',
  'projects',
  'token_sessions',
  // Parent tables (no dependencies)
  'users',
];

async function truncateDatabase() {
  try {
    console.log('========================================');
    console.log('Database Truncate Script');
    console.log('========================================');
    console.log('⚠️  WARNING: This will delete ALL data from all tables!');
    console.log('');

    // Test database connection
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✓ Database connection established.\n');

    // Disable foreign key checks to allow truncation in any order
    console.log('Disabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✓ Foreign key checks disabled.\n');

    // Truncate all tables
    console.log('Truncating tables...');
    let truncatedCount = 0;
    const errors: string[] = [];

    for (const tableName of tableNames) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${tableName}\``);
        console.log(`  ✓ Truncated: ${tableName}`);
        truncatedCount++;
      } catch (error: any) {
        const errorMsg = `Failed to truncate ${tableName}: ${error.message}`;
        console.error(`  ✗ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Re-enable foreign key checks
    console.log('\nRe-enabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Foreign key checks re-enabled.\n');

    console.log('========================================');
    if (errors.length === 0) {
      console.log(`✓ Successfully truncated ${truncatedCount} table(s)`);
    } else {
      console.log(`⚠️  Truncated ${truncatedCount} table(s) with ${errors.length} error(s)`);
      console.log('\nErrors:');
      errors.forEach((err) => console.log(`  - ${err}`));
    }
    console.log('========================================');

    // Close database connection
    await sequelize.close();
    process.exit(errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n✗ Error truncating database:', error);
    
    // Try to re-enable foreign key checks even if there was an error
    try {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch {
      // Ignore errors when re-enabling
    }
    
    await sequelize.close();
    process.exit(1);
  }
}

// Run the script
truncateDatabase();
