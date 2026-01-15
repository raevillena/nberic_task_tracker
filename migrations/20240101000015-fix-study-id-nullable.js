'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints on study_id (try common constraint names)
    const constraintNames = [
      'tasks_ibfk_1',
      'tasks_study_id_foreign',
      'tasks_study_id_fk',
    ];

    for (const constraintName of constraintNames) {
      await queryInterface.sequelize.query(`
        ALTER TABLE tasks 
        DROP FOREIGN KEY ${constraintName};
      `).catch(() => {
        // Ignore if constraint doesn't exist
      });
    }

    // Now modify study_id to be nullable using raw SQL
    // This ensures it works even if changeColumn has issues
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      MODIFY COLUMN study_id INT UNSIGNED NULL;
    `);

    // Re-add the foreign key constraint (now nullable)
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      ADD CONSTRAINT tasks_study_id_foreign 
      FOREIGN KEY (study_id) 
      REFERENCES studies(id) 
      ON DELETE CASCADE 
      ON UPDATE CASCADE;
    `).catch((err) => {
      // If constraint already exists, that's fine
      if (!err.message.includes('Duplicate key name') && !err.message.includes('already exists')) {
        console.warn('Could not add foreign key constraint:', err.message);
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Make study_id NOT NULL again
    // First drop foreign key
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      DROP FOREIGN KEY tasks_study_id_foreign;
    `).catch(() => {});

    // Set all NULL study_id values to a default (we can't have NULLs when making it NOT NULL)
    // For admin tasks, we'll need to handle this differently
    // For now, just make it NOT NULL (this will fail if there are NULL values)
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      MODIFY COLUMN study_id INT UNSIGNED NOT NULL;
    `).catch((err) => {
      console.warn('Could not make study_id NOT NULL (may have NULL values):', err.message);
    });

    // Re-add foreign key
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      ADD CONSTRAINT tasks_study_id_foreign 
      FOREIGN KEY (study_id) 
      REFERENCES studies(id) 
      ON DELETE CASCADE 
      ON UPDATE CASCADE;
    `).catch(() => {});
  },
};
