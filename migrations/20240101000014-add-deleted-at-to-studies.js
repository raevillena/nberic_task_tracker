'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('studies', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Add index for deleted_at for better query performance
    await queryInterface.addIndex('studies', ['deleted_at'], {
      name: 'idx_studies_deleted_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('studies', 'idx_studies_deleted_at');
    await queryInterface.removeColumn('studies', 'deleted_at');
  },
};
