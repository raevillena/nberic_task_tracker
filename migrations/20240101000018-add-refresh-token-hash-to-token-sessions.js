'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'token_sessions',
      'refresh_token_hash',
      {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Hash of the refresh token; used to look up user (id, role) when refreshing. External refresh token expires ~14 days.',
      }
    );
    await queryInterface.addIndex('token_sessions', ['refresh_token_hash'], {
      name: 'idx_token_sessions_refresh_token_hash',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('token_sessions', 'idx_token_sessions_refresh_token_hash');
    await queryInterface.removeColumn('token_sessions', 'refresh_token_hash');
  },
};
