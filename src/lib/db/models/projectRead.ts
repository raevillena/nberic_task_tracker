// ProjectRead model for tracking which projects users have read

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface ProjectReadAttributes {
  id: number;
  projectId: number;
  userId: number;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectReadCreationAttributes extends Optional<ProjectReadAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class ProjectRead extends Model<ProjectReadAttributes, ProjectReadCreationAttributes> implements ProjectReadAttributes {
  declare id: number;
  declare projectId: number;
  declare userId: number;
  declare readAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ProjectRead.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'projects',
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
    modelName: 'ProjectRead',
    tableName: 'project_reads',
    underscored: true,
    indexes: [
      { fields: ['project_id', 'user_id'], unique: true, name: 'idx_project_reads_unique' },
      { fields: ['project_id'], name: 'idx_project_reads_project' },
      { fields: ['user_id'], name: 'idx_project_reads_user' },
      { fields: ['read_at'], name: 'idx_project_reads_read_at' },
    ],
  }
);
