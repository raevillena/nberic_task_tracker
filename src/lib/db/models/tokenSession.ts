// TokenSession model
// Stores mapping of access/refresh tokens to user data for the external auth flow.
// - isAuthenticated: lookup by accessTokenHash to get user data (external API returns only "Session Valid.").
// - refresh: lookup by refreshTokenHash to get user id/role (external API requires id, role in body; cookie has refresh token).
// Session expiry is 14 days to match external refresh token lifetime.

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../connection';

interface TokenSessionAttributes {
  id: number;
  accessTokenHash: string;
  refreshTokenHash: string | null;
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

interface TokenSessionCreationAttributes extends Optional<TokenSessionAttributes, 'id' | 'createdAt' | 'updatedAt' | 'refreshTokenHash'> {}

export class TokenSession extends Model<TokenSessionAttributes, TokenSessionCreationAttributes> implements TokenSessionAttributes {
  declare id: number;
  declare accessTokenHash: string;
  declare refreshTokenHash: string | null;
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
    refreshTokenHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'refresh_token_hash',
      comment: 'Hash of the refresh token; used to look up user (id, role) when calling external /api/auth/refresh',
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
      comment: 'When this session expires; 14 days to match external refresh token lifetime',
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
        fields: ['refresh_token_hash'],
        name: 'idx_token_sessions_refresh_token_hash',
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
