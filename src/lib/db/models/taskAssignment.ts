// TaskAssignment model for many-to-many task assignments

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface TaskAssignmentAttributes {
  id: number;
  taskId: number;
  userId: number;
  assignedById: number | null;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskAssignmentCreationAttributes extends Optional<TaskAssignmentAttributes, 'id' | 'assignedById' | 'createdAt' | 'updatedAt'> {}

export class TaskAssignment extends Model<TaskAssignmentAttributes, TaskAssignmentCreationAttributes> implements TaskAssignmentAttributes {
  declare id: number;
  declare taskId: number;
  declare userId: number;
  declare assignedById: number | null;
  declare assignedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TaskAssignment.init(
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
    assignedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    assignedAt: {
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
    modelName: 'TaskAssignment',
    tableName: 'task_assignments',
    underscored: true,
    indexes: [
      { fields: ['task_id', 'user_id'], unique: true, name: 'idx_task_assignments_unique' },
      { fields: ['task_id'], name: 'idx_task_assignments_task' },
      { fields: ['user_id'], name: 'idx_task_assignments_user' },
    ],
  }
);
