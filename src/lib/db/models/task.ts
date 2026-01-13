// Task model

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { TaskStatus, TaskPriority } from '@/types/entities';
import { Op } from 'sequelize';

interface TaskAttributes {
  id: number;
  studyId: number;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: number | null;
  createdById: number;
  completedAt: Date | null;
  completedById: number | null;
  dueDate: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskCreationAttributes extends Optional<TaskAttributes, 'id' | 'description' | 'status' | 'priority' | 'assignedToId' | 'completedAt' | 'completedById' | 'dueDate' | 'createdAt' | 'updatedAt'> {}

export class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  declare id: number;
  declare studyId: number;
  declare name: string;
  declare description: string | null;
  declare status: TaskStatus;
  declare priority: TaskPriority;
  declare assignedToId: number | null;
  declare createdById: number;
  declare completedAt: Date | null;
  declare completedById: number | null;
  declare dueDate: Date | null;
  declare deletedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Task.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    studyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'studies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: TaskStatus.PENDING,
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(TaskPriority)),
      allowNull: false,
      defaultValue: TaskPriority.MEDIUM,
    },
    assignedToId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
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
    modelName: 'Task',
    tableName: 'tasks',
    underscored: true,
    indexes: [
      {
        fields: ['study_id'],
        name: 'idx_tasks_study',
      },
      {
        fields: ['assigned_to_id'],
        name: 'idx_tasks_assigned_to',
      },
      {
        fields: ['status'],
        name: 'idx_tasks_status',
      },
      {
        fields: ['priority'],
        name: 'idx_tasks_priority',
      },
      {
        fields: ['created_by_id'],
        name: 'idx_tasks_created_by',
      },
      {
        fields: ['due_date'],
        name: 'idx_tasks_due_date',
      },
      {
        fields: ['study_id', 'status'],
        name: 'idx_tasks_study_status',
      },
      {
        fields: ['deleted_at'],
        name: 'idx_tasks_deleted_at',
      },
    ],
    // Add default scope to exclude soft-deleted tasks
    defaultScope: {
      where: {
        deletedAt: null,
      },
    },
    // Add scopes for including deleted tasks
    scopes: {
      withDeleted: {
        where: {},
      },
      onlyDeleted: {
        where: {
          deletedAt: { [Op.ne]: null },
        },
      },
    },
  }
);

