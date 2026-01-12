// Redux slice for managing notifications

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
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

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isBellOpen: false,
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
      }
    },

    markAsRead(state, action: PayloadAction<string>) {
      const notification = state.notifications.find(
        (n) => n.id === action.payload
      );
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },

    markAllAsRead(state) {
      state.notifications.forEach((n) => {
        n.read = true;
      });
      state.unreadCount = 0;
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
      }
    },

    clearAllNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
    },

    toggleBell(state) {
      state.isBellOpen = !state.isBellOpen;
    },

    setBellOpen(state, action: PayloadAction<boolean>) {
      state.isBellOpen = action.payload;
    },
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
