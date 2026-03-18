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

/** Returns true if the error is a network/unreachable error (external auth API not reachable). */
function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('fetch failed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('network')
  );
}

/**
 * Resolve user from our TokenSession by access token hash (fallback when external API is unreachable).
 * Only used when we've already stored this token (e.g. from login or refresh).
 */
async function attachUserFromSession(
  req: NextRequest,
  token: string
): Promise<AuthenticatedRequest | null> {
  const { TokenSession } = await import('@/lib/db/models');
  const { Op } = await import('sequelize');
  const { hashToken } = await import('@/lib/auth/tokenHash');

  const session = await TokenSession.findOne({
    where: {
      accessTokenHash: hashToken(token),
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  const data = session
    ? (session as { userData?: { email: string; firstName: string; lastName: string; apps?: Array<{ name: string; Roles?: { userType: string } }> } }).userData
    : undefined;
  if (!data) return null;

  const nttApp = data.apps?.find((app: { name: string }) => app.name === 'NTT');
  const userRole = nttApp?.Roles?.userType || 'Researcher';

  const localUser = await syncUserFromExternalApi({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    role: userRole as UserRole,
  });

  (req as AuthenticatedRequest).user = {
    id: localUser.id,
    email: localUser.email,
    role: localUser.role,
  };
  return req as AuthenticatedRequest;
}

/**
 * Attach user to request after token verification with external API
 * Syncs user to local database and uses local database ID for all queries
 */
async function attachUserToRequest(
  req: NextRequest,
  token: string
): Promise<AuthenticatedRequest> {
  const refreshToken = req.cookies.get('refreshToken')?.value;

  try {
    const authStatus = await externalIsAuthenticated(token, refreshToken);
    if (!authStatus.user) {
      throw new AuthenticationError('User data not available. Please login again.');
    }
    const nttApp = authStatus.user.apps?.find((app) => app.name === 'NTT');
    const userRole = nttApp?.Roles?.userType || 'Researcher';

    const localUser = await syncUserFromExternalApi({
      email: authStatus.user.email,
      firstName: authStatus.user.firstName,
      lastName: authStatus.user.lastName,
      role: userRole as UserRole,
    });

    (req as AuthenticatedRequest).user = {
      id: localUser.id,
      email: localUser.email,
      role: localUser.role,
    };
    return req as AuthenticatedRequest;
  } catch (error) {
    if (isNetworkError(error)) {
      const fallback = await attachUserFromSession(req, token);
      if (fallback) return fallback;
    }
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Attempt to refresh access token using refresh token via external API.
 * Looks up user id/role by refresh token hash in token_sessions (external API expects id, role in body).
 */
async function attemptTokenRefresh(refreshToken: string): Promise<string | null> {
  try {
    const { TokenSession } = await import('@/lib/db/models');
    const { Op } = await import('sequelize');
    const { hashToken } = await import('@/lib/auth/tokenHash');

    const refreshTokenHash = hashToken(refreshToken);
    const session = await TokenSession.findOne({
      where: {
        refreshTokenHash,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!session?.userData) {
      return null;
    }

    const userId = session.userData.id;
    const nttApp = session.userData.apps?.find((app: { name: string }) => app.name === 'NTT');
    const userRole = nttApp?.Roles?.userType || 'Researcher';

    const refreshResponse = await externalRefreshToken(refreshToken, userId, userRole);
    const newAccessToken = refreshResponse.token?.accessToken || refreshResponse.accessToken;
    return newAccessToken ?? null;
  } catch (error) {
    return null;
  }
}

