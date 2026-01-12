// ComplianceFlag model

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

export enum ComplianceFlagStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ComplianceFlagSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface ComplianceFlagAttributes {
  id: number;
  taskId: number;
  flagType: string; // e.g., 'data_quality', 'protocol_violation', 'missing_documentation'
  severity: ComplianceFlagSeverity;
  status: ComplianceFlagStatus;
  description: string;
  raisedById: number;
  resolvedById: number | null;
  resolvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ComplianceFlagCreationAttributes
  extends Optional<
    ComplianceFlagAttributes,
    'id' | 'resolvedById' | 'resolvedAt' | 'notes' | 'createdAt' | 'updatedAt'
  > {}

export class ComplianceFlag
  extends Model<ComplianceFlagAttributes, ComplianceFlagCreationAttributes>
  implements ComplianceFlagAttributes
{
  declare id: number;
  declare taskId: number;
  declare flagType: string;
  declare severity: ComplianceFlagSeverity;
  declare status: ComplianceFlagStatus;
  declare description: string;
  declare raisedById: number;
  declare resolvedById: number | null;
  declare resolvedAt: Date | null;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ComplianceFlag.init(
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
    flagType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Type/category of compliance issue',
    },
    severity: {
      type: DataTypes.ENUM(...Object.values(ComplianceFlagSeverity)),
      allowNull: false,
      defaultValue: ComplianceFlagSeverity.MEDIUM,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ComplianceFlagStatus)),
      allowNull: false,
      defaultValue: ComplianceFlagStatus.OPEN,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    raisedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    resolvedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about resolution or dismissal',
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
    modelName: 'ComplianceFlag',
    tableName: 'compliance_flags',
    underscored: true,
    indexes: [
      {
        fields: ['task_id'],
        name: 'idx_compliance_flags_task',
      },
      {
        fields: ['status'],
        name: 'idx_compliance_flags_status',
      },
      {
        fields: ['severity'],
        name: 'idx_compliance_flags_severity',
      },
      {
        fields: ['raised_by_id'],
        name: 'idx_compliance_flags_raised_by',
      },
      {
        fields: ['task_id', 'status'],
        name: 'idx_compliance_flags_task_status',
      },
    ],
  }
);
