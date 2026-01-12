// Message model for chat/messaging

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

export type MessageRoomType = 'project' | 'study' | 'task';
export type MessageType = 'text' | 'image' | 'file';

interface MessageAttributes {
  id: number;
  roomType: MessageRoomType;
  roomId: number; // projectId or studyId
  senderId: number;
  type: MessageType;
  content: string; // Text content or file description
  fileId: number | null; // Reference to uploaded file (if file storage system exists)
  fileName: string | null; // Original filename
  fileSize: number | null; // File size in bytes
  mimeType: string | null; // MIME type
  replyToId: number | null; // Parent message ID for replies
  editedAt: Date | null; // Timestamp when edited
  deletedAt: Date | null; // Soft delete timestamp
  createdAt: Date;
  updatedAt: Date;
}

interface MessageCreationAttributes
  extends Optional<
    MessageAttributes,
    | 'id'
    | 'fileId'
    | 'fileName'
    | 'fileSize'
    | 'mimeType'
    | 'replyToId'
    | 'editedAt'
    | 'deletedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

export class Message extends Model<MessageAttributes, MessageCreationAttributes>
  implements MessageAttributes {
  declare id: number;
  declare roomType: MessageRoomType;
  declare roomId: number;
  declare senderId: number;
  declare type: MessageType;
  declare content: string;
  declare fileId: number | null;
  declare fileName: string | null;
  declare fileSize: number | null;
  declare mimeType: string | null;
  declare replyToId: number | null;
  declare editedAt: Date | null;
  declare deletedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    roomType: {
      type: DataTypes.ENUM('project', 'study', 'task'),
      allowNull: false,
    },
    roomId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'projectId, studyId, or taskId depending on roomType',
    },
    senderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    type: {
      type: DataTypes.ENUM('text', 'image', 'file'),
      allowNull: false,
      defaultValue: 'text',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 10000], // Max 10,000 characters
      },
    },
    fileId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'Reference to file storage system if implemented',
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: 'File size in bytes',
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    replyToId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
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
    modelName: 'Message',
    tableName: 'messages',
    underscored: true,
    paranoid: true, // Enable soft deletes using deletedAt
    indexes: [
      {
        fields: ['room_type', 'room_id'],
        name: 'idx_messages_room',
      },
      {
        fields: ['sender_id'],
        name: 'idx_messages_sender',
      },
      {
        fields: ['reply_to_id'],
        name: 'idx_messages_reply_to',
      },
      {
        fields: ['created_at'],
        name: 'idx_messages_created_at',
      },
      {
        fields: ['room_type', 'room_id', 'created_at'],
        name: 'idx_messages_room_created',
      },
      {
        fields: ['deleted_at'],
        name: 'idx_messages_deleted_at',
      },
    ],
  }
);

