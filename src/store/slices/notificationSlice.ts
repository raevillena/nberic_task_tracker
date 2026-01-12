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
  timestamp: Date;
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
      // Convert timestamp strings back to Date objects
      const notifications = parsed.notifications.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
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
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/notifications', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch notifications');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
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
      const response = await fetch(`/api/notifications/${notificationId}`, {
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
    const toStore = {
      notifications: state.notifications.map((n) => ({
        ...n,
        timestamp: n.timestamp.toISOString(),
      })),
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
      // Check if notification already exists (avoid duplicates)
      const exists = state.notifications.some(
        (n) =>
          n.type === action.payload.type &&
          n.roomType === action.payload.roomType &&
          n.roomId === action.payload.roomId &&
          n.timestamp.getTime() === action.payload.timestamp.getTime()
      );

      if (!exists) {
        state.notifications.unshift(action.payload);
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
        // Merge DB notifications with existing ones (avoid duplicates)
        const dbNotifications = action.payload;
        const existingIds = new Set(state.notifications.map((n) => n.id));
        
        // Add new DB notifications that don't exist locally
        dbNotifications.forEach((dbNotif: Notification) => {
          if (!existingIds.has(dbNotif.id)) {
            state.notifications.unshift(dbNotif);
            if (!dbNotif.read) {
              state.unreadCount += 1;
            }
          }
        });

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

export const selectUnreadCount = (state: { notifications: NotificationState }) =>
  state.notifications.unreadCount;

export const selectIsBellOpen = (state: { notifications: NotificationState }) =>
  state.notifications.isBellOpen;

export const selectUnreadNotifications = (state: { notifications: NotificationState }) =>
  state.notifications.notifications.filter((n) => !n.read);
