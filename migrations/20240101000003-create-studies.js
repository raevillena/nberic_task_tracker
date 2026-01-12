'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('studies', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      project_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Parent project - cascades delete',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      progress: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Calculated progress percentage (0-100)',
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
    await queryInterface.addIndex('studies', ['project_id'], {
      name: 'idx_studies_project',
    });

    await queryInterface.addIndex('studies', ['created_by_id'], {
      name: 'idx_studies_created_by',
    });

    await queryInterface.addIndex('studies', ['progress'], {
      name: 'idx_studies_progress',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('studies');
  },
};

