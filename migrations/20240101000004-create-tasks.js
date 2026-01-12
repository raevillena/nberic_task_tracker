'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      study_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'studies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Parent study - cascades delete',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      assigned_to_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Researcher assigned to task - set null if user deleted',
      },
      created_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Manager who created task',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when task was marked complete',
      },
      completed_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Manager who marked task complete',
      },
      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Optional due date for task',
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

    // Create indexes
    await queryInterface.addIndex('tasks', ['study_id'], {
      name: 'idx_tasks_study',
    });

    await queryInterface.addIndex('tasks', ['assigned_to_id'], {
      name: 'idx_tasks_assigned_to',
    });

    await queryInterface.addIndex('tasks', ['status'], {
      name: 'idx_tasks_status',
    });

    await queryInterface.addIndex('tasks', ['priority'], {
      name: 'idx_tasks_priority',
    });

    await queryInterface.addIndex('tasks', ['created_by_id'], {
      name: 'idx_tasks_created_by',
    });

    await queryInterface.addIndex('tasks', ['due_date'], {
      name: 'idx_tasks_due_date',
    });

    await queryInterface.addIndex('tasks', ['study_id', 'status'], {
      name: 'idx_tasks_study_status',
      comment: 'Composite index for filtering tasks by study and status',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('tasks');
  },
};

