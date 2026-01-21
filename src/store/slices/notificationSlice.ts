// Redux slice for managing notifications

import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Message, MessageRoomType } from '@/types/socket';

export interface Notification {
  id: string;
  type: 'message' | 'task' | 'system';
  title: string;
  message: string;
  roomType?: MessageRoomType;
  roomId?: number;
  taskId?: number;
  projectId?: number;
  studyId?: number;
  senderId?: number;
  senderName?: string;
  // Store as string for Redux serialization (ISO format)
  timestamp: string;
  read: boolean;
  actionUrl?: string; // URL to navigate when clicked
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isBellOpen: boolean;
}

// Load notifications from localStorage on initialization
const loadNotificationsFromStorage = (): NotificationState => {
  if (typeof window === 'undefined') {
    return {
      notifications: [],
      unreadCount: 0,
      isBellOpen: false,
    };
  }

  try {
    const stored = localStorage.getItem('notifications');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Keep timestamps as strings for Redux serialization
      // Only ensure they're valid ISO strings
      const notifications = parsed.notifications.map((n: any) => ({
        ...n,
        timestamp: typeof n.timestamp === 'string' 
          ? n.timestamp 
          : n.timestamp instanceof Date 
          ? n.timestamp.toISOString() 
          : new Date(n.timestamp).toISOString(),
      }));
      return {
        notifications,
        unreadCount: parsed.unreadCount || 0,
        isBellOpen: false, // Don't persist bell open state
      };
    }
  } catch (error) {
    console.error('Failed to load notifications from localStorage:', error);
  }

  return {
    notifications: [],
    unreadCount: 0,
    isBellOpen: false,
  };
};

const initialState: NotificationState = loadNotificationsFromStorage();

// Async thunk to fetch notifications from database
export const fetchNotificationsThunk = createAsyncThunk(
  'notifications/fetchNotifications',
  async (_, { rejectWithValue, getState }) => {
    // Check if user is authenticated before making request
    const state = getState() as any;
    const isAuthenticated = state.auth?.isAuthenticated;
    const accessToken = state.auth?.accessToken;

    if (!isAuthenticated || !accessToken) {
      // Silently skip if not authenticated (don't trigger refresh loop)
      return rejectWithValue('Not authenticated');
    }

    try {
      // Use apiRequest to automatically include Authorization header
      const { apiRequest } = await import('@/lib/utils/api');
      const response = await apiRequest('/api/notifications', {
        credentials: 'include',
      });

      if (!response.ok) {
        // If 401, don't trigger refresh - just silently fail
        if (response.status === 401) {
          return rejectWithValue('Not authenticated');
        }
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch notifications');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error: any) {
      // Don't trigger refresh loop on network errors
      if (error.message?.includes('Session expired') || error.message?.includes('Not authenticated')) {
        return rejectWithValue('Not authenticated');
      }
      return rejectWithValue('Network error');
    }
  }
);

// Async thunk to mark notification as read in database
export const markNotificationAsReadThunk = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string, { rejectWithValue }) => {
    // Extract DB ID if it's a DB notification
    const dbId = notificationId.replace('db-', '');
    if (!dbId || dbId === notificationId) {
      // Not a DB notification, just resolve
      return notificationId;
    }

    try {
      // Use apiRequest to automatically include Authorization header
      const { apiRequest } = await import('@/lib/utils/api');
      const response = await apiRequest(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to mark notification as read');
      }

      return notificationId;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

// Helper to save notifications to localStorage
const saveNotificationsToStorage = (state: NotificationState) => {
  if (typeof window === 'undefined') return;
  
  try {
    // Convert Date objects to ISO strings for storage
    // Handle both Date objects and ISO strings (from DB)
    const toStore = {
      notifications: state.notifications.map((n) => {
        // Type assertion needed because timestamp might be Date at runtime despite being typed as string
        const timestamp = n.timestamp as any;
        return {
          ...n,
          timestamp: timestamp instanceof Date 
            ? timestamp.toISOString() 
            : typeof timestamp === 'string' 
            ? timestamp 
            : new Date(timestamp).toISOString(),
        };
      }),
      unreadCount: state.unreadCount,
    };
    localStorage.setItem('notifications', JSON.stringify(toStore));
  } catch (error) {
    console.error('Failed to save notifications to localStorage:', error);
  }
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Notification>) {
      // Ensure timestamp is a string for Redux serialization
      const notification = {
        ...action.payload,
        timestamp: (() => {
          // Type assertion needed because timestamp might be Date at runtime despite being typed as string
          const timestamp = action.payload.timestamp as any;
          return typeof timestamp === 'string'
            ? timestamp
            : timestamp instanceof Date
            ? timestamp.toISOString()
            : new Date(timestamp).toISOString();
        })(),
      };

      // Check if notification already exists (avoid duplicates)
      // Compare timestamps as strings or convert both to Date for comparison
      const exists = state.notifications.some(
        (n) =>
          n.type === notification.type &&
          n.roomType === notification.roomType &&
          n.roomId === notification.roomId &&
          (typeof n.timestamp === 'string' && typeof notification.timestamp === 'string'
            ? n.timestamp === notification.timestamp
            : new Date(n.timestamp).getTime() === new Date(notification.timestamp).getTime())
      );

      if (!exists) {
        state.notifications.unshift(notification);
        state.unreadCount += 1;
        
        // Keep only last 50 notifications
        if (state.notifications.length > 50) {
          const removed = state.notifications.pop();
          if (removed && !removed.read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
        
        // Persist to localStorage
        saveNotificationsToStorage(state);
      }
    },

    markAsRead(state, action: PayloadAction<string>) {
      const notification = state.notifications.find(
        (n) => n.id === action.payload
      );
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        // Persist to localStorage
        saveNotificationsToStorage(state);
        // Also update in DB if it's a DB notification
        if (action.payload.startsWith('db-')) {
          // Dispatch async thunk (will be handled by extraReducers)
          // Note: We can't dispatch here, so we'll handle it in the component
        }
      }
    },

    markAllAsRead(state) {
      state.notifications.forEach((n) => {
        n.read = true;
      });
      state.unreadCount = 0;
      // Persist to localStorage
      saveNotificationsToStorage(state);
    },

    removeNotification(state, action: PayloadAction<string>) {
      const index = state.notifications.findIndex(
        (n) => n.id === action.payload
      );
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
        // Persist to localStorage
        saveNotificationsToStorage(state);
      }
    },

    clearAllNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
      // Persist to localStorage
      saveNotificationsToStorage(state);
    },

    toggleBell(state) {
      state.isBellOpen = !state.isBellOpen;
    },

    setBellOpen(state, action: PayloadAction<boolean>) {
      state.isBellOpen = action.payload;
    },

    setNotifications(state, action: PayloadAction<Notification[]>) {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter((n) => !n.read).length;
      saveNotificationsToStorage(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationsThunk.fulfilled, (state, action) => {
        // Replace local notifications with DB notifications to ensure consistency
        // DB is the source of truth for persisted notifications
        const dbNotifications = action.payload;
        
        // Ensure all timestamps are strings (not Date objects) for Redux serialization
        const serializedNotifications = dbNotifications.map((n: any) => ({
          ...n,
          timestamp: typeof n.timestamp === 'string' 
            ? n.timestamp 
            : n.timestamp instanceof Date 
            ? n.timestamp.toISOString() 
            : new Date(n.timestamp).toISOString(),
        }));
        
        // Calculate unread count from DB notifications
        const unreadCount = serializedNotifications.filter((n: Notification) => !n.read).length;
        
        // Update state with DB notifications
        state.notifications = serializedNotifications;
        state.unreadCount = unreadCount;

        // Sort by timestamp (newest first)
        state.notifications.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Keep only last 50
        if (state.notifications.length > 50) {
          const removed = state.notifications.splice(50);
          removed.forEach((n) => {
            if (!n.read) {
              state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
          });
        }

        saveNotificationsToStorage(state);
      })
      .addCase(markNotificationAsReadThunk.fulfilled, (state, action) => {
        // Already handled by markAsRead reducer if called directly
        // This is for DB sync
      });
  },
});

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  toggleBell,
  setBellOpen,
} = notificationSlice.actions;

export default notificationSlice.reducer;

// Selectors
export const selectNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.notifications;

// Only count DB notifications (those with id starting with 'db-') for the badge
// This ensures temporary toast notifications don't affect the badge count
export const selectUnreadCount = (state: { notifications: NotificationState }) => {
  const dbNotifications = state.notifications.notifications.filter(
    (n) => n.id.startsWith('db-')
  );
  return dbNotifications.filter((n) => !n.read).length;
};

export const selectIsBellOpen = (state: { notifications: NotificationState }) =>
  state.notifications.isBellOpen;

export const selectUnreadNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.notifications.filter((n) => !n.read);
