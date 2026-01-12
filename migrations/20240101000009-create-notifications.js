'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
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
        comment: 'User who receives this notification',
      },
      type: {
        type: Sequelize.ENUM('message', 'task', 'system'),
        allowNull: false,
        comment: 'Type of notification',
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Notification title',
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Notification message content',
      },
      room_type: {
        type: Sequelize.ENUM('project', 'study', 'task'),
        allowNull: true,
        comment: 'Room type if notification is related to a chat room',
      },
      room_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Room ID if notification is related to a chat room',
      },
      task_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'tasks',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Task ID if notification is task-related',
      },
      project_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'projects',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Project ID if notification is project-related',
      },
      study_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'studies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Study ID if notification is study-related',
      },
      sender_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who triggered this notification',
      },
      sender_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Cached sender name for display',
      },
      read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the notification has been read',
      },
      action_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'URL to navigate when notification is clicked',
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

    // Add indexes
    await queryInterface.addIndex('notifications', ['user_id'], {
      name: 'idx_notifications_user',
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read'], {
      name: 'idx_notifications_user_read',
    });
    await queryInterface.addIndex('notifications', ['type'], {
      name: 'idx_notifications_type',
    });
    await queryInterface.addIndex('notifications', ['task_id'], {
      name: 'idx_notifications_task',
    });
    await queryInterface.addIndex('notifications', ['created_at'], {
      name: 'idx_notifications_created_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notifications');
  },
};
