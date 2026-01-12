'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('task_requests', {
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
      requested_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Researcher who made the request',
      },
      request_type: {
        type: Sequelize.ENUM('completion', 'reassignment'),
        allowNull: false,
        comment: 'Type of request: completion or reassignment',
      },
      requested_assigned_to_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'For reassignment requests: the researcher to reassign to',
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewed_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Manager who reviewed the request',
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional notes from requester or reviewer',
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

    // Add indexes
    await queryInterface.addIndex('task_requests', ['task_id'], {
      name: 'idx_task_requests_task',
    });

    await queryInterface.addIndex('task_requests', ['requested_by_id'], {
      name: 'idx_task_requests_requested_by',
    });

    await queryInterface.addIndex('task_requests', ['status'], {
      name: 'idx_task_requests_status',
    });

    await queryInterface.addIndex('task_requests', ['request_type'], {
      name: 'idx_task_requests_type',
    });

    await queryInterface.addIndex('task_requests', ['task_id', 'status'], {
      name: 'idx_task_requests_task_status',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('task_requests');
  },
};
