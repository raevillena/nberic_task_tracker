// Session expired notification utility
// Separated from api.ts to avoid circular dependency with authSlice.ts

// Track if we've already shown session expired notification to prevent duplicates
let hasShownSessionExpiredNotification = false;

/**
 * Reset the session expired notification flag
 * Call this when user logs in or logs out to allow showing the notification again
 */
export function resetSessionExpiredNotificationFlag() {
  hasShownSessionExpiredNotification = false;
}

/**
 * Check if we've already shown the session expired notification
 */
export function hasShownSessionExpiredNotificationFlag(): boolean {
  return hasShownSessionExpiredNotification;
}

/**
 * Mark that we've shown the session expired notification
 */
export function setSessionExpiredNotificationShown() {
  hasShownSessionExpiredNotification = true;
}
