// Project model

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { Op } from 'sequelize';

interface ProjectAttributes {
  id: number;
  name: string;
  description: string | null;
  progress: number; // 0-100
  createdById: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectCreationAttributes extends Optional<ProjectAttributes, 'id' | 'description' | 'progress' | 'createdAt' | 'updatedAt'> {}

export class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare progress: number;
  declare createdById: number;
  declare deletedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Project.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    progress: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100,
      },
      get() {
        const value = this.getDataValue('progress');
        return value ? parseFloat(value.toString()) : 0;
      },
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
    modelName: 'Project',
    tableName: 'projects',
    underscored: true,
    indexes: [
      {
        fields: ['created_by_id'],
        name: 'idx_projects_created_by',
      },
      {
        fields: ['progress'],
        name: 'idx_projects_progress',
      },
      {
        fields: ['created_at'],
        name: 'idx_projects_created_at',
      },
      {
        fields: ['deleted_at'],
        name: 'idx_projects_deleted_at',
      },
    ],
    // Add default scope to exclude soft-deleted projects
    defaultScope: {
      where: {
        deletedAt: null,
      },
    },
    // Add scopes for including deleted projects
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

