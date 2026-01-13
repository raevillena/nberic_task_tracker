'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('study_reads', {
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
      },
      read_at: {
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
      },
    });

    // Add unique index to prevent duplicate reads
    await queryInterface.addIndex('study_reads', ['study_id', 'user_id'], {
      unique: true,
      name: 'idx_study_reads_unique',
    });

    // Add indexes for performance
    await queryInterface.addIndex('study_reads', ['study_id'], {
      name: 'idx_study_reads_study',
    });

    await queryInterface.addIndex('study_reads', ['user_id'], {
      name: 'idx_study_reads_user',
    });

    await queryInterface.addIndex('study_reads', ['read_at'], {
      name: 'idx_study_reads_read_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('study_reads');
  },
};
