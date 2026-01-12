'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      room_type: {
        type: Sequelize.ENUM('project', 'study', 'task'),
        allowNull: false,
      },
      room_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'projectId, studyId, or taskId depending on roomType',
      },
      sender_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      type: {
        type: Sequelize.ENUM('text', 'image', 'file'),
        allowNull: false,
        defaultValue: 'text',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Reference to file storage system if implemented',
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      file_size: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'File size in bytes',
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      reply_to_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      edited_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
    await queryInterface.addIndex('messages', ['room_type', 'room_id'], {
      name: 'idx_messages_room',
    });

    await queryInterface.addIndex('messages', ['sender_id'], {
      name: 'idx_messages_sender',
    });

    await queryInterface.addIndex('messages', ['reply_to_id'], {
      name: 'idx_messages_reply_to',
    });

    await queryInterface.addIndex('messages', ['created_at'], {
      name: 'idx_messages_created_at',
    });

    await queryInterface.addIndex('messages', ['room_type', 'room_id', 'created_at'], {
      name: 'idx_messages_room_created',
    });

    await queryInterface.addIndex('messages', ['deleted_at'], {
      name: 'idx_messages_deleted_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('messages');
  },
};
