// Script to create demo users for quick login
// DEPRECATED: This script is no longer functional.
// This app now uses external API (umans-api.nbericmmsu.com) as the sole provider of users.
// Users are automatically synced to local database on first login via external API.
// Run with: node scripts/create-demo-users.js

// Load environment variables
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env.local');

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

async function createDemoUsers() {
  console.log('⚠️  DEPRECATED: This script is no longer functional.');
  console.log('   This app now uses external API (umans-api.nbericmmsu.com) as the sole provider of users.');
  console.log('   Users are automatically synced to local database on first login via external API.');
  console.log('   Please use the external API to create and manage users.');
  process.exit(0);
  
  // OLD CODE (kept for reference, but will never execute):
  /*
  // Import after env is loaded
  const { sequelize } = require('../src/lib/db/connection');
  const { User } = require('../src/lib/db/models');
  const { createUser } = require('../src/services/userService');
  const { UserRole } = require('../src/types/entities');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Check if demo users already exist
    const existingManager = await User.findOne({ where: { email: 'manager@demo.com' } });
    const existingResearcher = await User.findOne({ where: { email: 'researcher@demo.com' } });

    if (existingManager) {
      console.log('⚠️  Demo Manager already exists (manager@demo.com)');
    } else {
      await createUser({
        email: 'manager@demo.com',
        password: 'demo123',
        firstName: 'Demo',
        lastName: 'Manager',
        role: UserRole.MANAGER,
      });
      console.log('✅ Created Demo Manager (manager@demo.com / demo123)');
    }

    if (existingResearcher) {
      console.log('⚠️  Demo Researcher already exists (researcher@demo.com)');
    } else {
      await createUser({
        email: 'researcher@demo.com',
        password: 'demo123',
        firstName: 'Demo',
        lastName: 'Researcher',
        role: UserRole.RESEARCHER,
      });
      console.log('✅ Created Demo Researcher (researcher@demo.com / demo123)');
    }

    console.log('\n✅ Demo users ready!');
    console.log('   Manager:    manager@demo.com / demo123');
    console.log('   Researcher: researcher@demo.com / demo123');
  } catch (error) {
    console.error('❌ Error creating demo users:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
  */
}

createDemoUsers();
