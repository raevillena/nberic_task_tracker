'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Add index for deleted_at for better query performance
    await queryInterface.addIndex('tasks', ['deleted_at'], {
      name: 'idx_tasks_deleted_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('tasks', 'idx_tasks_deleted_at');
    await queryInterface.removeColumn('tasks', 'deleted_at');
  },
};
