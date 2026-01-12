// Notification model for user notifications

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

export type NotificationType = 'message' | 'task' | 'system';
export type MessageRoomType = 'project' | 'study' | 'task';

interface NotificationAttributes {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  roomType: MessageRoomType | null;
  roomId: number | null;
  taskId: number | null;
  projectId: number | null;
  studyId: number | null;
  senderId: number | null;
  senderName: string | null;
  read: boolean;
  actionUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationCreationAttributes
  extends Optional<NotificationAttributes, 'id' | 'roomType' | 'roomId' | 'taskId' | 'projectId' | 'studyId' | 'senderId' | 'senderName' | 'read' | 'actionUrl' | 'createdAt' | 'updatedAt'> {}

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  declare id: number;
  declare userId: number;
  declare type: NotificationType;
  declare title: string;
  declare message: string;
  declare roomType: MessageRoomType | null;
  declare roomId: number | null;
  declare taskId: number | null;
  declare projectId: number | null;
  declare studyId: number | null;
  declare senderId: number | null;
  declare senderName: string | null;
  declare read: boolean;
  declare actionUrl: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM('message', 'task', 'system'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    roomType: {
      type: DataTypes.ENUM('project', 'study', 'task'),
      allowNull: true,
    },
    roomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    taskId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    projectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    studyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'studies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    senderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    senderName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    actionUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    underscored: true,
    indexes: [
      { fields: ['user_id'], name: 'idx_notifications_user' },
      { fields: ['user_id', 'read'], name: 'idx_notifications_user_read' },
      { fields: ['type'], name: 'idx_notifications_type' },
      { fields: ['task_id'], name: 'idx_notifications_task' },
      { fields: ['created_at'], name: 'idx_notifications_created_at' },
    ],
  }
);
