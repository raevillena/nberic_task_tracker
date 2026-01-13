// Study model

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';
import { Op } from 'sequelize';

interface StudyAttributes {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  progress: number; // 0-100
  createdById: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StudyCreationAttributes extends Optional<StudyAttributes, 'id' | 'description' | 'progress' | 'createdAt' | 'updatedAt'> {}

export class Study extends Model<StudyAttributes, StudyCreationAttributes> implements StudyAttributes {
  declare id: number;
  declare projectId: number;
  declare name: string;
  declare description: string | null;
  declare progress: number;
  declare createdById: number;
  declare deletedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Study.init(
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
    modelName: 'Study',
    tableName: 'studies',
    underscored: true,
    indexes: [
      {
        fields: ['project_id'],
        name: 'idx_studies_project',
      },
      {
        fields: ['created_by_id'],
        name: 'idx_studies_created_by',
      },
      {
        fields: ['progress'],
        name: 'idx_studies_progress',
      },
      {
        fields: ['deleted_at'],
        name: 'idx_studies_deleted_at',
      },
    ],
    // Add default scope to exclude soft-deleted studies
    defaultScope: {
      where: {
        deletedAt: null,
      },
    },
    // Add scopes for including deleted studies
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

