'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add task_type ENUM column with default 'research'
    await queryInterface.addColumn('tasks', 'task_type', {
      type: Sequelize.ENUM('research', 'admin'),
      allowNull: false,
      defaultValue: 'research',
    });

    // Step 2: Add project_id as nullable foreign key
    await queryInterface.addColumn('tasks', 'project_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Optional project reference for admin tasks',
    });

    // Step 3: Make study_id nullable (admin tasks don't require a study)
    // First, we need to remove the foreign key constraint, modify the column, then re-add the constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      DROP FOREIGN KEY tasks_ibfk_1;
    `).catch(() => {
      // Ignore if constraint doesn't exist or has different name
    });

    // Try alternative constraint names
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      DROP FOREIGN KEY tasks_study_id_foreign;
    `).catch(() => {
      // Ignore if constraint doesn't exist
    });

    // Modify study_id to be nullable
    await queryInterface.changeColumn('tasks', 'study_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'studies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      comment: 'Parent study - required for research tasks, null for admin tasks',
    });

    // Step 4: Add check constraint: RESEARCH tasks must have studyId, ADMIN tasks don't
    // Note: MySQL doesn't support CHECK constraints in older versions, so we'll use a trigger or application-level validation
    // For now, we'll rely on application-level validation in the model

    // Step 5: Update indexes to include task_type and project_id
    await queryInterface.addIndex('tasks', ['task_type'], {
      name: 'idx_tasks_task_type',
    });

    await queryInterface.addIndex('tasks', ['project_id'], {
      name: 'idx_tasks_project',
    });

    // Composite index for filtering by project and task type
    await queryInterface.addIndex('tasks', ['project_id', 'task_type'], {
      name: 'idx_tasks_project_type',
      comment: 'Composite index for filtering tasks by project and type',
    });

    // Composite index for filtering by study and task type (for research tasks)
    await queryInterface.addIndex('tasks', ['study_id', 'task_type'], {
      name: 'idx_tasks_study_type',
      comment: 'Composite index for filtering research tasks by study and type',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('tasks', 'idx_tasks_study_type');
    await queryInterface.removeIndex('tasks', 'idx_tasks_project_type');
    await queryInterface.removeIndex('tasks', 'idx_tasks_project');
    await queryInterface.removeIndex('tasks', 'idx_tasks_task_type');

    // Remove project_id column
    await queryInterface.removeColumn('tasks', 'project_id');

    // Make study_id required again
    // First remove foreign key constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      DROP FOREIGN KEY tasks_ibfk_1;
    `).catch(() => {});

    await queryInterface.sequelize.query(`
      ALTER TABLE tasks 
      DROP FOREIGN KEY tasks_study_id_foreign;
    `).catch(() => {});

    // Change study_id back to NOT NULL
    await queryInterface.changeColumn('tasks', 'study_id', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'studies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Remove task_type column
    await queryInterface.removeColumn('tasks', 'task_type');

    // Remove the ENUM type (MySQL doesn't automatically remove it)
    await queryInterface.sequelize.query(`
      ALTER TABLE tasks MODIFY task_type VARCHAR(255);
    `).catch(() => {});
  },
};
