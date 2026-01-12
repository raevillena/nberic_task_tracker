// Authentication middleware for API routes

import { NextRequest } from 'next/server';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken } from './jwt';
import { AuthenticationError } from '@/lib/utils/errors';
import { User } from '@/lib/db/models';
import { UserContext } from '@/types/rbac';

export interface AuthenticatedRequest extends NextRequest {
  user?: UserContext;
}

/**
 * Authenticate request - verifies JWT token and attaches user to request
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthenticatedRequest> {
  // Extract token from Authorization header
  const authHeader = req.headers.get('Authorization');
  const accessToken = authHeader?.replace('Bearer ', '');

  if (!accessToken) {
    // Try refresh token from cookie
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (refreshToken) {
      try {
        const newAccessToken = await attemptTokenRefresh(refreshToken);
        if (newAccessToken) {
          return attachUserToRequest(req, newAccessToken);
        }
      } catch (error) {
        // Refresh failed, continue to throw auth error
      }
    }
    throw new AuthenticationError('No valid authentication token');
  }

  // Verify access token
  try {
    const payload = verifyAccessToken(accessToken);
    return await attachUserToRequest(req, accessToken);
  } catch (error) {
    // Token expired or invalid, try refresh
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (refreshToken) {
      try {
        const newAccessToken = await attemptTokenRefresh(refreshToken);
        if (newAccessToken) {
          return attachUserToRequest(req, newAccessToken);
        }
      } catch (refreshError) {
        // Refresh failed
      }
    }
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Attach user to request after token verification
 */
async function attachUserToRequest(
  req: NextRequest,
  token: string
): Promise<AuthenticatedRequest> {
  const payload = verifyAccessToken(token);
  
  // Verify user still exists and is active
  const user = await User.findByPk(payload.userId);
  if (!user || !user.isActive) {
    throw new AuthenticationError('User account is inactive');
  }

  // Attach user to request
  (req as AuthenticatedRequest).user = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return req as AuthenticatedRequest;
}

/**
 * Attempt to refresh access token using refresh token
 */
async function attemptTokenRefresh(refreshToken: string): Promise<string | null> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    
    // Verify user exists and is active
    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
      return null;
    }

    // Verify token version matches (for token invalidation)
    if (payload.tokenVersion !== user.tokenVersion) {
      return null;
    }

    // Generate new access token
    return generateAccessToken(user.id, user.email, user.role);
  } catch (error) {
    return null;
  }
}

