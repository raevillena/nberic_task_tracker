'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('token_sessions', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      access_token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Hash of the access token (for security, we store hash not plain token)',
      },
      user_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'User email from external API (used to look up local user)',
      },
      user_data: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Cached user data from external API login response',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this token session expires (typically 1 hour from login)',
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
    }, {
      indexes: [
        {
          unique: true,
          fields: ['access_token_hash'],
          name: 'idx_token_sessions_access_token_hash',
        },
        {
          fields: ['user_email'],
          name: 'idx_token_sessions_user_email',
        },
        {
          fields: ['expires_at'],
          name: 'idx_token_sessions_expires_at',
        },
      ],
      comment: 'Temporary storage for access token to user data mapping. Needed because external API isAuthenticated endpoint does not return user data.',
    });

    // Clean up expired sessions periodically (via application logic, not DB trigger)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('token_sessions');
  },
};
