// Proactive token refresh utility

import { AppStore } from '@/store';
import { refreshTokenThunk } from '@/store/slices/authSlice';

const CHECK_INTERVAL = 60000; // Check every minute
const REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh if less than 5 minutes remaining

let refreshInterval: NodeJS.Timeout | null = null;

/**
 * Setup proactive token refresh
 * Automatically refreshes access token before it expires
 * Should be called once when the app initializes
 */
export function setupTokenRefresh(store: AppStore): void {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  // Check token expiry periodically
  refreshInterval = setInterval(() => {
    const state = store.getState();
    const { accessToken, tokenExpiry, isRefreshing } = state.auth;

    // Skip if no token, no expiry, or already refreshing
    if (!accessToken || !tokenExpiry || isRefreshing) {
      return;
    }

    const timeUntilExpiry = tokenExpiry - Date.now();

    // Refresh if less than threshold remaining and not already expired
    if (timeUntilExpiry < REFRESH_THRESHOLD && timeUntilExpiry > 0) {
      // Dispatch refresh token thunk
      store.dispatch(refreshTokenThunk());
    }
  }, CHECK_INTERVAL);
}

/**
 * Stop proactive token refresh
 * Should be called when app unmounts or user logs out
 */
export function stopTokenRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

