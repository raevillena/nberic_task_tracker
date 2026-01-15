// Task model

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { TaskStatus, TaskPriority, TaskType } from '@/types/entities';
import { Op } from 'sequelize';

interface TaskAttributes {
  id: number;
  taskType: TaskType;
  studyId: number | null; // Nullable for admin tasks
  projectId: number | null; // Optional project reference for admin tasks
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

interface TaskCreationAttributes extends Optional<TaskAttributes, 'id' | 'taskType' | 'description' | 'status' | 'priority' | 'assignedToId' | 'completedAt' | 'completedById' | 'dueDate' | 'studyId' | 'projectId' | 'createdAt' | 'updatedAt'> {}

export class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  declare id: number;
  declare taskType: TaskType;
  declare studyId: number | null;
  declare projectId: number | null;
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
    taskType: {
      type: DataTypes.ENUM('research', 'admin'),
      allowNull: false,
      defaultValue: TaskType.RESEARCH,
    },
    studyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true, // Nullable for admin tasks
      references: {
        model: 'studies',
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
        fields: ['project_id'],
        name: 'idx_tasks_project',
      },
      {
        fields: ['task_type'],
        name: 'idx_tasks_task_type',
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
        fields: ['project_id', 'task_type'],
        name: 'idx_tasks_project_type',
      },
      {
        fields: ['study_id', 'task_type'],
        name: 'idx_tasks_study_type',
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

// Add model-level validation for task type rules
// RESEARCH tasks must have studyId, ADMIN tasks don't require it
Task.addHook('beforeValidate', (task: Task) => {
  // Default to RESEARCH if not specified (for backward compatibility)
  if (!task.taskType) {
    task.taskType = TaskType.RESEARCH;
  }

  // Validate task type rules
  if (task.taskType === TaskType.RESEARCH) {
    if (!task.studyId) {
      throw new Error('Research tasks must have a studyId');
    }
  } else if (task.taskType === TaskType.ADMIN) {
    // Admin tasks don't require studyId, but can optionally have projectId
    // No validation needed here - both can be null
  }
});

