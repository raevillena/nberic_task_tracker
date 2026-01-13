'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('projects', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Add index for deleted_at for better query performance
    await queryInterface.addIndex('projects', ['deleted_at'], {
      name: 'idx_projects_deleted_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('projects', 'idx_projects_deleted_at');
    await queryInterface.removeColumn('projects', 'deleted_at');
  },
};
