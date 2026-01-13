// StudyRead model for tracking which studies users have read

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface StudyReadAttributes {
  id: number;
  studyId: number;
  userId: number;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface StudyReadCreationAttributes extends Optional<StudyReadAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class StudyRead extends Model<StudyReadAttributes, StudyReadCreationAttributes> implements StudyReadAttributes {
  declare id: number;
  declare studyId: number;
  declare userId: number;
  declare readAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

StudyRead.init(
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
    modelName: 'StudyRead',
    tableName: 'study_reads',
    underscored: true,
    indexes: [
      { fields: ['study_id', 'user_id'], unique: true, name: 'idx_study_reads_unique' },
      { fields: ['study_id'], name: 'idx_study_reads_study' },
      { fields: ['user_id'], name: 'idx_study_reads_user' },
      { fields: ['read_at'], name: 'idx_study_reads_read_at' },
    ],
  }
);
