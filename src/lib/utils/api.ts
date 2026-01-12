// API client utilities

import { store } from '@/store';
import { refreshTokenThunk } from '@/store/slices/authSlice';
import { decodeToken, AccessTokenPayload } from '@/lib/auth/jwt';

/**
 * API client with automatic token injection and refresh
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const state = store.getState();
  const accessToken = state.auth.accessToken;

  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  headers.set('Content-Type', 'application/json');

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies (refresh token)
  });

  // Handle token expiry
  if (response.status === 401) {
    // Token expired - try refresh using Redux thunk
    const refreshResult = await store.dispatch(refreshTokenThunk());

    if (refreshTokenThunk.fulfilled.match(refreshResult)) {
      // Refresh succeeded, get new token from store
      const newState = store.getState();
      const newToken = newState.auth.accessToken;

      if (newToken) {
        // Retry original request with new token
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
    }

    // Refresh failed, logout user
    const { logoutThunk } = await import('@/store/slices/authSlice');
    await store.dispatch(logoutThunk());
    throw new Error('Session expired. Please login again.');
  }

  return response;
}

