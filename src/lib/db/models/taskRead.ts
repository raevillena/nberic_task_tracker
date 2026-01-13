// TaskRead model for tracking which tasks users have read

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface TaskReadAttributes {
  id: number;
  taskId: number;
  userId: number;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskReadCreationAttributes extends Optional<TaskReadAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class TaskRead extends Model<TaskReadAttributes, TaskReadCreationAttributes> implements TaskReadAttributes {
  declare id: number;
  declare taskId: number;
  declare userId: number;
  declare readAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TaskRead.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tasks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
    readAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    modelName: 'TaskRead',
    tableName: 'task_reads',
    underscored: true,
    indexes: [
      { fields: ['task_id', 'user_id'], unique: true, name: 'idx_task_reads_unique' },
      { fields: ['task_id'], name: 'idx_task_reads_task' },
      { fields: ['user_id'], name: 'idx_task_reads_user' },
      { fields: ['read_at'], name: 'idx_task_reads_read_at' },
    ],
  }
);
