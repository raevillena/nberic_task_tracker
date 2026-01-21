// TokenSession model
// Stores temporary mapping of access tokens to user data
// This is needed because the external API's isAuthenticated endpoint doesn't return user data
// Sessions expire after 1 hour and are cleaned up automatically

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface TokenSessionAttributes {
  id: number;
  accessTokenHash: string;
  userEmail: string;
  userData: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    apps: Array<{
      name: string;
      Roles: {
        userType: string;
      };
    }>;
  };
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TokenSessionCreationAttributes extends Optional<TokenSessionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class TokenSession extends Model<TokenSessionAttributes, TokenSessionCreationAttributes> implements TokenSessionAttributes {
  declare id: number;
  declare accessTokenHash: string;
  declare userEmail: string;
  declare userData: TokenSessionAttributes['userData'];
  declare expiresAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

TokenSession.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    accessTokenHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'access_token_hash',
      comment: 'Hash of the access token (for security, we store hash not plain token)',
    },
    userEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'user_email',
      comment: 'User email from external API (used to look up local user)',
    },
    userData: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'user_data',
      comment: 'Cached user data from external API login response',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
      comment: 'When this token session expires (typically 1 hour from login)',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    modelName: 'TokenSession',
    tableName: 'token_sessions',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['access_token_hash'],
        name: 'idx_token_sessions_access_token_hash',
      },
      {
        fields: ['user_email'],
        name: 'idx_token_sessions_user_email',
      },
      {
        fields: ['expires_at'],
        name: 'idx_token_sessions_expires_at',
      },
    ],
  }
);
