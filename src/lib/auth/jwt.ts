// JWT token utilities

import jwt from 'jsonwebtoken';
import { UserRole } from '@/types/entities';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY: string = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY: string = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface AccessTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: number;
  tokenVersion: number;
  iat: number;
  exp: number;
  type: 'refresh';
}

/**
 * Generate an access token
 */
export function generateAccessToken(userId: number, email: string, role: UserRole): string {
  const payload = {
    userId,
    email,
    role,
    type: 'access' as const,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'nberic-task-tracker',
    audience: 'nberic-client',
  } as jwt.SignOptions);
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(userId: number, tokenVersion: number): string {
  const payload = {
    userId,
    tokenVersion,
    type: 'refresh' as const,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'nberic-task-tracker',
    audience: 'nberic-client',
  } as jwt.SignOptions);
}

/**
 * Verify and decode an access token
 * @throws {Error} with specific message for different error types
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'nberic-task-tracker',
      audience: 'nberic-client',
    }) as AccessTokenPayload;

    if (payload.type !== 'access') {
      throw new Error('Invalid token type: expected access token');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid token: ${error.message}`);
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Token not active yet');
    }
    throw error;
  }
}

/**
 * Verify and decode a refresh token
 * @throws {Error} with specific message for different error types
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'nberic-task-tracker',
      audience: 'nberic-client',
    }) as RefreshTokenPayload;

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid token: ${error.message}`);
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Token not active yet');
    }
    throw error;
  }
}

/**
 * Decode a token without verification (for reading expiry, etc.)
 */
export function decodeToken(token: string): AccessTokenPayload | RefreshTokenPayload | null {
  return jwt.decode(token) as AccessTokenPayload | RefreshTokenPayload | null;
}

