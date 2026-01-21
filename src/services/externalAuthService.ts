// External authentication service - integrates with umans-api.nbericmmsu.com
// This service handles authentication through the external API
//
// NOTE: The endpoint paths and request/response structures below are placeholders.
// Please update them based on the actual Swagger API documentation at:
// https://umans-api.nbericmmsu.com/api-docs/#
//
// Common adjustments needed:
// 1. Update endpoint paths (e.g., /api/auth/login might be /auth/login or /login)
// 2. Adjust request payload structure (field names, required fields)
// 3. Adjust response structure (field names, nested objects)
// 4. Update authentication method (Bearer token, API key, etc.)

const EXTERNAL_API_BASE_URL = process.env.EXTERNAL_AUTH_API_URL || 'https://umans-api.nbericmmsu.com';
const APP_ID = parseInt(process.env.EXTERNAL_AUTH_APP_ID || '10', 10);

// Import crypto for hashing tokens (we store hash, not plain token for security)
import crypto from 'crypto';
import { Op } from 'sequelize';
import { TokenSession } from '@/lib/db/models';

/**
 * Hash an access token for storage (we don't store plain tokens)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Clean up expired token sessions from database
 * This runs periodically to keep the table clean
 */
async function cleanupExpiredSessions() {
  try {
    const deleted = await TokenSession.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
    });
    if (process.env.NODE_ENV === 'development' && deleted > 0) {
      console.log(`[tokenSession] Cleaned up ${deleted} expired token sessions`);
    }
  } catch (error) {
    console.error('[tokenSession] Error cleaning up expired sessions:', error);
  }
}

// Clean up expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

export interface ExternalLoginRequest {
  email: string;
  password: string;
  appId?: number;
}

export interface ExternalLoginResponse {
  msg: string;
  user: {
    id: number;
    email: string;
    mobileNo?: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    apps: Array<{
      name: string;
      Roles: {
        userType: string; // "Manager" or "Researcher"
      };
    }>;
  };
  token: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ExternalRefreshRequest {
  refreshToken: string;
  appId?: number;
}

export interface ExternalRefreshResponse {
  token?: {
    accessToken: string;
    refreshToken: string;
  };
  // Some APIs might return tokens directly
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface ExternalLogoutRequest {
  refreshToken?: string;
  appId?: number;
}

export interface ExternalIsAuthenticatedResponse {
  msg: string; // "Session Valid." on success
  // Note: The actual API only returns { msg: "Session Valid." } - it doesn't return user data
  // User data is retrieved from cache (stored during login) if available
  user?: {
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
}

/**
 * Make a request to the external auth API
 */
async function externalApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EXTERNAL_API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  
  // Add appId to request body if it's a POST/PUT request
  let body = options.body;
  if (body && (options.method === 'POST' || options.method === 'PUT')) {
    try {
      const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
      if (typeof bodyObj === 'object' && !bodyObj.appId) {
        bodyObj.appId = APP_ID;
        body = JSON.stringify(bodyObj);
      }
    } catch {
      // If body parsing fails, use as-is
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    let errorMessage = 'Authentication service error';
    
    try {
      const error = await response.json();
      errorMessage = error.message || error.msg || error.error || 'Authentication service error';
    } catch {
      // If we can't parse the error response, use status-based messages
      if (response.status === 401) {
        errorMessage = 'Invalid email or password';
      } else if (response.status === 400) {
        errorMessage = 'Invalid request';
      } else if (response.status >= 500) {
        errorMessage = 'Authentication service is temporarily unavailable';
      } else {
        errorMessage = `Authentication service error (${response.status})`;
      }
    }
    
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Login using external API
 * Also caches user data with the access token for later retrieval
 */
export async function externalLogin(
  email: string,
  password: string
): Promise<ExternalLoginResponse> {
  // Adjust endpoint and payload structure based on actual API
  // Common patterns: /api/auth/login, /api/login, /auth/login
  const response = await externalApiRequest<ExternalLoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      appId: APP_ID,
    }),
  });

  // Store user data with access token in database (expires in 1 hour)
  // This is needed because isAuthenticated endpoint doesn't return user data
  // We use database instead of in-memory cache because Next.js serverless functions
  // don't share memory across invocations
  if (response.token?.accessToken && response.user) {
    try {
      const tokenHash = hashToken(response.token.accessToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing session for this token (in case of re-login)
      await TokenSession.destroy({
        where: { accessTokenHash: tokenHash },
      });

      // Create new session
      await TokenSession.create({
        accessTokenHash: tokenHash,
        userEmail: response.user.email,
        userData: {
          id: response.user.id,
          email: response.user.email,
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          apps: response.user.apps || [],
        },
        expiresAt,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[externalLogin] Stored user data in database for token:', {
          tokenHash: `${tokenHash.substring(0, 20)}...`,
          userId: response.user.id,
          email: response.user.email,
          expiresAt: expiresAt.toISOString(),
        });
      }
    } catch (error) {
      console.error('[externalLogin] Error storing token session:', error);
      // Don't fail login if cache storage fails
    }
  }

  return response;
}

/**
 * Refresh token using external API
 * Includes timeout protection to prevent hanging requests
 * 
 * The external API expects:
 * - refreshToken in cookies (req.cookies?.refreshToken)
 * - id and role in request body (req.body)
 */
export async function externalRefreshToken(
  refreshToken: string,
  userId: number,
  userRole: string
): Promise<ExternalRefreshResponse> {
  const REFRESH_TIMEOUT = 10000; // 10 seconds timeout
  
  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('External refresh API timeout')), REFRESH_TIMEOUT);
  });

  const url = `${EXTERNAL_API_BASE_URL}/api/auth/refresh`;
  
  // Build headers with Cookie containing refresh token
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cookie': `refreshToken=${refreshToken}`, // Send refresh token in cookie
  };

  // Build body with id and role (as required by external API)
  const body = JSON.stringify({
    id: userId,
    role: userRole,
    appId: APP_ID,
  });

  const refreshRequest = fetch(url, {
    method: 'POST',
    headers,
    body,
  }).then(async (response) => {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `API request failed with status ${response.status}`);
    }

    return response.json() as Promise<ExternalRefreshResponse>;
  });

  // Race between request and timeout
  return Promise.race([refreshRequest, timeoutPromise]);
}

/**
 * Logout using external API
 */
export async function externalLogout(
  refreshToken?: string
): Promise<void> {
  // Adjust endpoint based on actual API
  // Common patterns: /api/auth/logout, /api/logout, /auth/logout
  await externalApiRequest('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken,
      appId: APP_ID,
    }),
  });
}

/**
 * Check if user is authenticated using external API
 * This is the primary method for validating tokens - calls /api/auth/isAuthenticated
 * 
 * NOTE: The external API requires BOTH accessToken (in Authorization header) AND refreshToken (in cookie)
 * The API only returns { msg: "Session Valid." } on success - it doesn't return user data
 */
export async function externalIsAuthenticated(
  accessToken: string,
  refreshToken?: string
): Promise<ExternalIsAuthenticatedResponse> {
  try {
    // Build headers with Authorization
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
    };

    // Build cookie string if refresh token is provided
    // The external API requires BOTH accessToken (header) AND refreshToken (cookie)
    if (refreshToken) {
      headers['Cookie'] = `refreshToken=${refreshToken}`;
    }

    // Calls external API's isAuthenticated endpoint to validate the token
    // The external API requires BOTH accessToken (header) AND refreshToken (cookie)
    const response = await fetch(`${EXTERNAL_API_BASE_URL}/api/auth/isAuthenticated`, {
      method: 'GET',
      headers,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[externalIsAuthenticated] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
    }

    // Check for status 200 (success)
    if (response.status !== 200) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();

    // If status is 200, treat as authenticated (regardless of message content)
    // The API returns { msg: "Session Valid." } on success
    // Note: The API doesn't return user data, so we need to get it from database
    const authResponse: ExternalIsAuthenticatedResponse = {
      msg: data.msg || 'Session Valid.',
    };

    // Try to get user data from database (stored during login)
    try {
      const tokenHash = hashToken(accessToken);

      const session = await TokenSession.findOne({
        where: {
          accessTokenHash: tokenHash,
          expiresAt: {
            [Op.gt]: new Date(), // Not expired
          },
        },
      });

      if (session) {
        // Add user data to response from database
        (authResponse as any).user = session.userData;
      }
    } catch (error) {
      console.error('[externalIsAuthenticated] Error retrieving token session:', error);
      // Continue without user data - authentication is still valid (status 200)
    }

    return authResponse;
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[externalIsAuthenticated] Error:', {
        message: error?.message,
        status: error?.status,
        response: error?.response,
      });
    }
    throw error;
  }
}
