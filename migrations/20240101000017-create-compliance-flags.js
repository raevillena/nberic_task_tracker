'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('compliance_flags', {
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
      flag_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Type/category of compliance issue',
      },
      severity: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium',
      },
      status: {
        type: Sequelize.ENUM('open', 'resolved', 'dismissed'),
        allowNull: false,
        defaultValue: 'open',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      raised_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      resolved_by_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about resolution or dismissal',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Create indexes
    await queryInterface.addIndex('compliance_flags', ['task_id'], {
      name: 'idx_compliance_flags_task',
    });

    await queryInterface.addIndex('compliance_flags', ['status'], {
      name: 'idx_compliance_flags_status',
    });

    await queryInterface.addIndex('compliance_flags', ['severity'], {
      name: 'idx_compliance_flags_severity',
    });

    await queryInterface.addIndex('compliance_flags', ['raised_by_id'], {
      name: 'idx_compliance_flags_raised_by',
    });

    await queryInterface.addIndex('compliance_flags', ['task_id', 'status'], {
      name: 'idx_compliance_flags_task_status',
      comment: 'Composite index for filtering open flags by task',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('compliance_flags');
  },
};
