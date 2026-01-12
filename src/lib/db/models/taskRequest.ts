// TaskRequest model for completion and reassignment requests

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { TaskRequestType, TaskRequestStatus } from '@/types/entities';

interface TaskRequestAttributes {
  id: number;
  taskId: number;
  requestedById: number;
  requestType: TaskRequestType;
  requestedAssignedToId: number | null;
  status: TaskRequestStatus;
  reviewedById: number | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskRequestCreationAttributes extends Optional<TaskRequestAttributes, 'id' | 'requestedAssignedToId' | 'reviewedById' | 'reviewedAt' | 'notes' | 'createdAt' | 'updatedAt'> {}

export class TaskRequest extends Model<TaskRequestAttributes, TaskRequestCreationAttributes> implements TaskRequestAttributes {
  declare id: number;
  declare taskId: number;
  declare requestedById: number;
  declare requestType: TaskRequestType;
  declare requestedAssignedToId: number | null;
  declare status: TaskRequestStatus;
  declare reviewedById: number | null;
  declare reviewedAt: Date | null;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TaskRequest.init(
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
    requestedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    requestType: {
      type: DataTypes.ENUM(...Object.values(TaskRequestType)),
      allowNull: false,
    },
    requestedAssignedToId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TaskRequestStatus)),
      allowNull: false,
      defaultValue: TaskRequestStatus.PENDING,
    },
    reviewedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
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
    modelName: 'TaskRequest',
    tableName: 'task_requests',
    underscored: true,
    indexes: [
      { fields: ['task_id'], name: 'idx_task_requests_task' },
      { fields: ['requested_by_id'], name: 'idx_task_requests_requested_by' },
      { fields: ['status'], name: 'idx_task_requests_status' },
      { fields: ['request_type'], name: 'idx_task_requests_type' },
      { fields: ['task_id', 'status'], name: 'idx_task_requests_task_status' },
    ],
  }
);
