'use strict';

'use strict';

// Note: This seeder uses queryInterface for direct database operations
// Enums are used as string literals to match database ENUM values

module.exports = {
  async up(queryInterface, Sequelize) {
    // Note: This seeder uses queryInterface for direct database operations
    // This is more efficient for bulk inserts and doesn't require model initialization
    
    const bcrypt = require('bcrypt');
    const SALT_ROUNDS = 12;

    // Helper function to hash passwords synchronously (needed for seeders)
    const hashPasswordSync = (password) => {
      return bcrypt.hashSync(password, SALT_ROUNDS);
    };

    console.log('🌱 Seeding database with demo data...');

    // Create Users
    console.log('Creating users...');
    const managerPassword = hashPasswordSync('Manager123!');
    const researcher1Password = hashPasswordSync('Researcher123!');
    const researcher2Password = hashPasswordSync('Researcher456!');
    
    // Demo user passwords (for quick login buttons)
    const demoManagerPassword = hashPasswordSync('demo123');
    const demoResearcherPassword = hashPasswordSync('demo123');

    // Helper function to get or create user using raw SQL
    const getOrCreateUser = async (email, userData) => {
      // First, try to get existing user
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = :email LIMIT 1`,
        {
          replacements: { email },
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      if (existing && existing.length > 0) {
        console.log(`   User ${email} already exists, using existing ID: ${existing[0].id}`);
        return existing[0].id;
      }

      // User doesn't exist, insert using raw SQL to avoid Sequelize validation issues
      try {
        const [result] = await queryInterface.sequelize.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, token_version, created_at, updated_at)
           VALUES (:email, :password_hash, :first_name, :last_name, :role, :is_active, :token_version, :created_at, :updated_at)`,
          {
            replacements: {
              email: userData.email,
              password_hash: userData.password_hash,
              first_name: userData.first_name,
              last_name: userData.last_name,
              role: userData.role,
              is_active: userData.is_active,
              token_version: userData.token_version,
              created_at: userData.created_at,
              updated_at: userData.updated_at,
            },
            type: Sequelize.QueryTypes.INSERT,
          }
        );
        return result;
      } catch (error) {
        // If insert fails due to duplicate, get the existing user
        if (error.message && error.message.includes('Duplicate entry')) {
          const [existing] = await queryInterface.sequelize.query(
            `SELECT id FROM users WHERE email = :email LIMIT 1`,
            {
              replacements: { email },
              type: Sequelize.QueryTypes.SELECT,
            }
          );
          if (existing && existing.length > 0) {
            console.log(`   User ${email} already exists (duplicate caught), using existing ID: ${existing[0].id}`);
            return existing[0].id;
          }
        }
        throw error;
      }
    };

    // Demo users (for quick login buttons)
    const demoManagerId = await getOrCreateUser('manager@demo.com', {
      email: 'manager@demo.com',
      password_hash: demoManagerPassword,
      first_name: 'Demo',
      last_name: 'Manager',
      role: 'Manager',
      is_active: true,
      token_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const demoResearcherId = await getOrCreateUser('researcher@demo.com', {
      email: 'researcher@demo.com',
      password_hash: demoResearcherPassword,
      first_name: 'Demo',
      last_name: 'Researcher',
      role: 'Researcher',
      is_active: true,
      token_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Original users (for full demo data)
    const managerId = await getOrCreateUser('manager@nberic.com', {
      email: 'manager@nberic.com',
      password_hash: managerPassword,
      first_name: 'John',
      last_name: 'Manager',
      role: 'Manager',
      is_active: true,
      token_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const researcher1Id = await getOrCreateUser('researcher1@nberic.com', {
      email: 'researcher1@nberic.com',
      password_hash: researcher1Password,
      first_name: 'Alice',
      last_name: 'Researcher',
      role: 'Researcher',
      is_active: true,
      token_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const researcher2Id = await getOrCreateUser('researcher2@nberic.com', {
      email: 'researcher2@nberic.com',
      password_hash: researcher2Password,
      first_name: 'Bob',
      last_name: 'Scientist',
      role: 'Researcher',
      is_active: true,
      token_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    console.log(`✅ Created demo users: Manager (${demoManagerId}), Researcher (${demoResearcherId})`);
    console.log(`✅ Created users: Manager (${managerId}), Researchers (${researcher1Id}, ${researcher2Id})`);

    // Create Projects
    console.log('Creating projects...');
    const project1Id = await queryInterface.bulkInsert('projects', [
      {
        name: 'Clinical Trial Phase I',
        description: 'Initial phase clinical trial for new drug compound',
        progress: 0,
        created_by_id: managerId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    const project2Id = await queryInterface.bulkInsert('projects', [
      {
        name: 'Epidemiology Study 2024',
        description: 'Population health study tracking disease patterns',
        progress: 0,
        created_by_id: managerId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    console.log(`✅ Created projects: ${project1Id}, ${project2Id}`);

    // Create Studies
    console.log('Creating studies...');
    const study1Id = await queryInterface.bulkInsert('studies', [
      {
        project_id: project1Id,
        name: 'Dosage Finding Study',
        description: 'Determine optimal dosage levels for Phase I trial',
        progress: 0,
        created_by_id: managerId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    const study2Id = await queryInterface.bulkInsert('studies', [
      {
        project_id: project1Id,
        name: 'Safety Assessment',
        description: 'Evaluate safety profile of the compound',
        progress: 0,
        created_by_id: managerId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    const study3Id = await queryInterface.bulkInsert('studies', [
      {
        project_id: project2Id,
        name: 'Regional Analysis',
        description: 'Analyze disease patterns by geographic region',
        progress: 0,
        created_by_id: managerId,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    console.log(`✅ Created studies: ${study1Id}, ${study2Id}, ${study3Id}`);

    // Create Tasks
    console.log('Creating tasks...');
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    await queryInterface.bulkInsert('tasks', [
      // Study 1 Tasks
      {
        study_id: study1Id,
        name: 'Review literature on dosage protocols',
        description: 'Compile and review existing research on similar compounds',
        status: 'completed',
        priority: 'high',
        assigned_to_id: researcher1Id,
        created_by_id: managerId,
        completed_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        completed_by_id: managerId,
        due_date: nextWeek.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        study_id: study1Id,
        name: 'Design dosage escalation protocol',
        description: 'Create detailed protocol for dose escalation study',
        status: 'in_progress',
        priority: 'urgent',
        assigned_to_id: researcher1Id,
        created_by_id: managerId,
        due_date: nextWeek.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        study_id: study1Id,
        name: 'Prepare IRB submission documents',
        description: 'Compile all necessary documents for IRB approval',
        status: 'pending',
        priority: 'high',
        assigned_to_id: researcher2Id,
        created_by_id: managerId,
        due_date: twoWeeks.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        study_id: study1Id,
        name: 'Recruit study participants',
        description: 'Begin participant recruitment process',
        status: 'pending',
        priority: 'medium',
        assigned_to_id: null,
        created_by_id: managerId,
        due_date: twoWeeks.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      // Study 2 Tasks
      {
        study_id: study2Id,
        name: 'Conduct initial safety screening',
        description: 'Perform baseline safety assessments',
        status: 'completed',
        priority: 'high',
        assigned_to_id: researcher2Id,
        created_by_id: managerId,
        completed_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        completed_by_id: managerId,
        due_date: nextWeek.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        study_id: study2Id,
        name: 'Monitor adverse events',
        description: 'Track and document any adverse events during study',
        status: 'in_progress',
        priority: 'urgent',
        assigned_to_id: researcher1Id,
        created_by_id: managerId,
        due_date: nextWeek.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      },
      {
        study_id: study2Id,
        name: 'Prepare safety report',
        description: 'Compile safety data for interim report',
        status: 'pending',
        priority: 'medium',
        assigned_to_id: researcher2Id,
        created_by_id: managerId,
        due_date: twoWeeks.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      },
      // Study 3 Tasks
      {
        study_id: study3Id,
        name: 'Collect regional health data',
        description: 'Gather health statistics from various regions',
        status: 'in_progress',
        priority: 'high',
        assigned_to_id: researcher1Id,
        created_by_id: managerId,
        due_date: twoWeeks.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      },
      {
        study_id: study3Id,
        name: 'Analyze demographic patterns',
        description: 'Perform statistical analysis on collected data',
        status: 'pending',
        priority: 'medium',
        assigned_to_id: researcher2Id,
        created_by_id: managerId,
        due_date: twoWeeks.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        study_id: study3Id,
        name: 'Create visualization dashboards',
        description: 'Build interactive dashboards for data visualization',
        status: 'pending',
        priority: 'low',
        assigned_to_id: null,
        created_by_id: managerId,
        due_date: twoWeeks.toISOString().split('T')[0],
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updated_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    ]);

    console.log('✅ Created 10 tasks across 3 studies');

    // Note: Progress will be calculated automatically by the progress service
    // when tasks are updated. For seeding, we start with 0% progress.

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📋 Quick Demo Login (for login page buttons):');
    console.log('   Manager:    manager@demo.com / demo123');
    console.log('   Researcher: researcher@demo.com / demo123');
    console.log('\n📋 Full Demo Login Credentials:');
    console.log('   Manager:    manager@nberic.com / Manager123!');
    console.log('   Researcher: researcher1@nberic.com / Researcher123!');
    console.log('   Researcher: researcher2@nberic.com / Researcher456!');
  },

  async down(queryInterface, Sequelize) {
    // Delete in reverse order to respect foreign key constraints
    console.log('🗑️  Removing seeded data...');
    
    await queryInterface.bulkDelete('tasks', null, {});
    await queryInterface.bulkDelete('studies', null, {});
    await queryInterface.bulkDelete('projects', null, {});
    await queryInterface.bulkDelete('users', {
      email: {
        [Sequelize.Op.in]: [
          'manager@demo.com',
          'researcher@demo.com',
          'manager@nberic.com',
          'researcher1@nberic.com',
          'researcher2@nberic.com',
        ],
      },
    }, {});

    console.log('✅ Seeded data removed');
  },
};

