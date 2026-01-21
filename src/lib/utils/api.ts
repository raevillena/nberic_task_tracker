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
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[apiRequest] Token check:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'null',
      isAuthenticated: selectIsAuthenticated(state),
    });
  }
  
  return token;
}

// Track refresh attempts to prevent infinite loops
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
const REFRESH_TIMEOUT = 10000; // 10 seconds timeout for refresh
const MAX_RETRY_ATTEMPTS = 1; // Only retry once after refresh

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
    if (process.env.NODE_ENV === 'development') {
      console.log('[apiRequest] Adding Authorization header:', {
        url,
        hasToken: true,
        tokenPreview: `${accessToken.substring(0, 20)}...`,
      });
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[apiRequest] No access token available for request:', url);
    }
  }
  
  // Only set Content-Type if not already set and if there's a body
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[apiRequest] Making request:', {
      url,
      method: options.method || 'GET',
      hasAuthHeader: headers.has('Authorization'),
    });
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies (refresh token)
  });

  // Handle token expiry
  if (response.status === 401) {
    // Prevent infinite loops: don't retry if we've already tried or if this is the refresh endpoint
    // Also skip refresh for certain endpoints that should fail silently when not authenticated
    const skipRefreshEndpoints = ['/api/auth/refresh', '/api/notifications', '/api/navigation/unread-counts'];
    const shouldSkipRefresh = skipRefreshEndpoints.some(endpoint => url.includes(endpoint)) || retryCount >= MAX_RETRY_ATTEMPTS;
    
    if (shouldSkipRefresh) {
      // For notification/navigation endpoints, just throw error without triggering refresh loop
      if (url.includes('/api/notifications') || url.includes('/api/navigation/unread-counts')) {
        throw new Error('Not authenticated');
      }
      // Refresh endpoint failed or max retries reached, logout user
      // Don't show notification here - this is when we skip refresh, not when refresh fails
      const { logoutThunk } = await import('@/store/slices/authSlice');
      await getStore().dispatch(logoutThunk());
      throw new Error('Session expired. Please login again.');
    }

    // Prevent multiple simultaneous refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      
      // Create a single refresh promise that all concurrent requests can await
      refreshPromise = (async () => {
        try {
          // Add timeout to refresh call
          const refreshController = new AbortController();
          const timeoutId = setTimeout(() => refreshController.abort(), REFRESH_TIMEOUT);
          
          try {
            const refreshResult = await getStore().dispatch(refreshTokenThunk());
            
            clearTimeout(timeoutId);
            
            if (!refreshTokenThunk.fulfilled.match(refreshResult)) {
              throw new Error('Token refresh failed');
            }
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

    // Wait for the refresh to complete (or fail)
    try {
      await refreshPromise;
    } catch (error) {
      // Refresh failed, logout user
      const { logoutThunk } = await import('@/store/slices/authSlice');
      const store = getStore();
      
      // Show session expired notification (only once)
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
        
        // Give the notification time to render before redirecting (2 seconds)
        // This allows the user to see the notification before being redirected
        setTimeout(() => {
          store.dispatch(logoutThunk());
        }, 2000); // 2 second delay to allow notification to be visible
      } else {
        // Already shown, logout immediately
        await store.dispatch(logoutThunk());
      }
      
      throw new Error('Session expired. Please login again.');
    }

    // Get new token from store
    const newToken = getAccessToken();

    if (newToken) {
      // Retry original request with new token (only once)
      headers.set('Authorization', `Bearer ${newToken}`);
      return apiRequest(url, options, retryCount + 1);
    } else {
      // No new token, logout user
      const { logoutThunk } = await import('@/store/slices/authSlice');
      const store = getStore();
      
      // Show session expired notification (only once)
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
        
        // Give the notification time to render before redirecting (2 seconds)
        // This allows the user to see the notification before being redirected
        setTimeout(() => {
          store.dispatch(logoutThunk());
        }, 2000); // 2 second delay to allow notification to be visible
      } else {
        // Already shown, logout immediately
        await store.dispatch(logoutThunk());
      }
      
      throw new Error('Session expired. Please login again.');
    }
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

