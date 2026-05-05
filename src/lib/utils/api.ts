// API client utilities

// Lazy import store to avoid circular dependency
// Store is imported dynamically to break the cycle: projectSlice -> api -> store -> projectSlice
let storeInstance: any = null;
function getStore() {
  if (!storeInstance) {
    // Dynamic import to break circular dependency
    // Using require() instead of import to avoid circular dependency at module level
    storeInstance = require('@/store').store;
  }
  return storeInstance;
}

import { refreshTokenThunk, selectAccessToken, selectIsAuthenticated } from '@/store/slices/authSlice';
import { decodeToken, AccessTokenPayload } from '@/lib/auth/jwt';
import { addNotification } from '@/store/slices/notificationSlice';

/**
 * Get access token from Redux store
 */
function getAccessToken(): string | null {
  const store = getStore();
  const state = store.getState();
  const token = selectAccessToken(state);
  return token;
}

// Track refresh attempts to prevent infinite loops
let isRefreshing = false;
/** Resolves to the new access token on success; rejects if refresh fails. */
let refreshPromise: Promise<string> | null = null;
// Match authSlice; allow time for app -> external auth round-trip
const REFRESH_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 1; // Only retry once after refresh
let refreshTimeoutRetryCount = 0; // One retry when refresh times out (transient)

import { 
  hasShownSessionExpiredNotificationFlag, 
  setSessionExpiredNotificationShown 
} from './sessionNotification';

/**
 * API client with automatic token injection and refresh
 * Use this for all API calls to ensure Authorization header is included
 * 
 * Includes safeguards against infinite refresh loops:
 * - Prevents multiple simultaneous refresh attempts
 * - Timeout protection for refresh calls
 * - Only retries once after refresh
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<Response> {
  const accessToken = getAccessToken();

  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  
  // Set Content-Type only for JSON bodies. For FormData, leave unset so the browser sets multipart boundary.
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies (refresh token)
  });

  // Handle token expiry
  if (response.status === 401) {
    const isRefreshEndpoint = url.includes('/api/auth/refresh');
    const shouldSkipRefresh = isRefreshEndpoint || retryCount >= MAX_RETRY_ATTEMPTS;
    // Background endpoints: refresh + retry on 401, but do not trigger logout on failure
    const noLogoutOn401Endpoints = ['/api/notifications', '/api/navigation/unread-counts'];
    const shouldNotLogout = noLogoutOn401Endpoints.some((endpoint) => url.includes(endpoint));

    if (shouldSkipRefresh) {
      // Don't logout here: we only logout when refresh returns a "must re-login" code (see catch below)
      throw new Error('Session expired. Please login again.');
    }

    // Prevent multiple simultaneous refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      
      // Single refresh promise so all concurrent 401s share one refresh and get the same new token
      refreshPromise = (async (): Promise<string> => {
        try {
          const refreshController = new AbortController();
          const timeoutId = setTimeout(() => refreshController.abort(), REFRESH_TIMEOUT);
          try {
            const refreshResult = await getStore().dispatch(refreshTokenThunk());
            clearTimeout(timeoutId);
            if (!refreshTokenThunk.fulfilled.match(refreshResult)) {
              const payload = (refreshResult as { payload?: { code?: string; message?: string } }).payload;
              const err = new Error(payload?.message ?? 'Token refresh failed') as Error & { payload?: { code?: string } };
              err.payload = payload;
              throw err;
            }
            const token = (refreshResult.payload as { accessToken: string })?.accessToken;
            if (!token) throw new Error('No access token in refresh response');
            return token;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();
    }

    /** Only logout when refresh endpoint says token is invalid/expired/missing (user must re-login). */
    const REFRESH_MUST_RELOGIN_CODES = ['REFRESH_TOKEN_MISSING', 'SESSION_NOT_FOUND', 'REFRESH_TOKEN_INVALID'];

    let newToken: string;
    try {
      newToken = (await refreshPromise) as string;
      refreshTimeoutRetryCount = 0;
    } catch (error: unknown) {
      const payload = (error as Error & { payload?: { code?: string; message?: string } })?.payload;
      const isTimeout = payload?.code === 'REFRESH_TIMEOUT';
      if (isTimeout && refreshTimeoutRetryCount < 1) {
        refreshTimeoutRetryCount++;
        return apiRequest(url, options, retryCount);
      }
      if (isTimeout) refreshTimeoutRetryCount = 0;
      const mustRelogin = payload?.code && REFRESH_MUST_RELOGIN_CODES.includes(payload.code);
      if (mustRelogin && !shouldNotLogout) {
        const { logoutThunk } = await import('@/store/slices/authSlice');
        const store = getStore();
        if (!hasShownSessionExpiredNotificationFlag()) {
          setSessionExpiredNotificationShown();
          store.dispatch(addNotification({
            id: `session-expired-${Date.now()}`,
            type: 'system',
            title: 'Session Expired',
            message: 'Your session has expired. Please log in again.',
            timestamp: new Date().toISOString(),
            read: false,
          }));
          setTimeout(() => store.dispatch(logoutThunk()), 2000);
        } else {
          await store.dispatch(logoutThunk());
        }
      }
      const message =
        isTimeout
          ? 'Request timed out. Please try again.'
          : payload?.message ?? 'Session expired. Please login again.';
      throw new Error(message);
    }

    const retryHeaders = new Headers(options.headers);
    retryHeaders.set('Authorization', `Bearer ${newToken}`);
    return apiRequest(url, { ...options, headers: retryHeaders }, retryCount + 1);
  }

  return response;
}

/**
 * Authenticated fetch wrapper - drop-in replacement for fetch()
 * Automatically adds Authorization header with access token
 * 
 * Usage:
 *   import { authFetch } from '@/lib/utils/api';
 *   const response = await authFetch('/api/endpoint', { method: 'POST', body: JSON.stringify(data) });
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return apiRequest(url, options);
}

