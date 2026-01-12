'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('task_assignments', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      task_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'tasks',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Researcher assigned to the task',
      },
      assigned_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Manager who assigned the task',
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: 'CURRENT_TIMESTAMP',
      },
    });

    // Add unique constraint to prevent duplicate assignments
    await queryInterface.addIndex('task_assignments', ['task_id', 'user_id'], {
      unique: true,
      name: 'idx_task_assignments_unique',
    });

    // Add indexes for performance
    await queryInterface.addIndex('task_assignments', ['task_id'], {
      name: 'idx_task_assignments_task',
    });

    await queryInterface.addIndex('task_assignments', ['user_id'], {
      name: 'idx_task_assignments_user',
    });

    // Migrate existing assigned_to_id to task_assignments
    await queryInterface.sequelize.query(`
      INSERT INTO task_assignments (task_id, user_id, assigned_at, created_at, updated_at)
      SELECT id, assigned_to_id, created_at, created_at, updated_at
      FROM tasks
      WHERE assigned_to_id IS NOT NULL
      ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);
    `);
  },

  async down(queryInterface, Sequelize) {
    // Before dropping, migrate back to assigned_to_id (use first assignment)
    await queryInterface.sequelize.query(`
      UPDATE tasks t
      INNER JOIN (
        SELECT task_id, user_id, 
               ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY assigned_at ASC) as rn
        FROM task_assignments
      ) ta ON t.id = ta.task_id AND ta.rn = 1
      SET t.assigned_to_id = ta.user_id;
    `);

    await queryInterface.dropTable('task_assignments');
  },
};
