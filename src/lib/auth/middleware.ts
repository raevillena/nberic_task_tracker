// Authentication middleware for API routes - uses external authentication API

import { NextRequest } from 'next/server';
import { externalIsAuthenticated, externalRefreshToken } from '@/services/externalAuthService';
import { syncUserFromExternalApi } from '@/services/userService';
import { AuthenticationError } from '@/lib/utils/errors';
import { UserContext } from '@/types/rbac';
import { UserRole } from '@/types/entities';

export interface AuthenticatedRequest extends NextRequest {
  user?: UserContext;
}

/**
 * Authenticate request - verifies token with external API and attaches user to request
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
          return await attachUserToRequest(req, newAccessToken);
        }
      } catch (error) {
        // Refresh failed, continue to throw auth error
      }
    }
    throw new AuthenticationError('No valid authentication token');
  }

  // Verify access token with external API
  try {
    return await attachUserToRequest(req, accessToken);
  } catch (error) {
    // Token expired or invalid, try refresh
    const refreshToken = req.cookies.get('refreshToken')?.value;
    if (refreshToken) {
      try {
        const newAccessToken = await attemptTokenRefresh(refreshToken);
        if (newAccessToken) {
          return await attachUserToRequest(req, newAccessToken);
        }
      } catch (refreshError) {
        // Refresh failed
      }
    }
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Attach user to request after token verification with external API
 * Syncs user to local database and uses local database ID for all queries
 */
async function attachUserToRequest(
  req: NextRequest,
  token: string
): Promise<AuthenticatedRequest> {
  // Get refresh token from cookie (required by external API)
  const refreshToken = req.cookies.get('refreshToken')?.value;

  // Verify token with external API (requires both accessToken and refreshToken)
  let authStatus;
  try {
    authStatus = await externalIsAuthenticated(token, refreshToken);
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
  
  // Get user data from cache (stored during login)
  // The isAuthenticated endpoint doesn't return user data, so we use cached data
  if (!authStatus.user) {
    throw new AuthenticationError('User data not available. Please login again.');
  }

  // Extract role from apps array (find app with name "NTT")
  const nttApp = authStatus.user.apps?.find((app) => app.name === 'NTT');
  const userRole = nttApp?.Roles?.userType || 'Researcher'; // Default to Researcher if not found

  // Sync user to local database (creates if doesn't exist, updates if exists)
  // This ensures we have a local user record with the correct ID for database queries
  const localUser = await syncUserFromExternalApi({
    email: authStatus.user.email,
    firstName: authStatus.user.firstName,
    lastName: authStatus.user.lastName,
    role: userRole as UserRole, // Map to UserRole enum
  });

  // Attach user to request using LOCAL database ID (not external API ID)
  // This ensures all database queries work correctly
  (req as AuthenticatedRequest).user = {
    id: localUser.id, // Use local database ID, not external API ID
    email: localUser.email,
    role: localUser.role,
  };

  return req as AuthenticatedRequest;
}

/**
 * Attempt to refresh access token using refresh token via external API
 * Gets user info from token_sessions table to provide id and role to external API
 */
async function attemptTokenRefresh(refreshToken: string): Promise<string | null> {
  try {
    // Try to get user info from token_sessions table
    // Look up most recent non-expired session to get user id and role
    const { TokenSession } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');
    
    let userId: number | undefined;
    let userRole: string | undefined;
    
    try {
      const recentSession = await TokenSession.findOne({
        where: {
          expiresAt: {
            [Op.gt]: new Date(), // Not expired
          },
        },
        order: [['createdAt', 'DESC']], // Most recent first
        limit: 1,
      });

      if (recentSession?.userData) {
        userId = recentSession.userData.id;
        // Extract role from apps array
        const nttApp = recentSession.userData.apps?.find((app: any) => app.name === 'NTT');
        userRole = nttApp?.Roles?.userType || 'Researcher';
      }
    } catch (error) {
      // Error looking up user info
    }

    // If we don't have user info, we can't refresh
    if (!userId || !userRole) {
      return null;
    }

    const refreshResponse = await externalRefreshToken(refreshToken, userId, userRole);
    
    // Handle different response structures (token object or direct properties)
    const newAccessToken = refreshResponse.token?.accessToken || refreshResponse.accessToken;
    
    return newAccessToken || null;
  } catch (error) {
    return null;
  }
}

