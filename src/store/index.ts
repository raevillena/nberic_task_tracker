// Redux store configuration

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import projectReducer from './slices/projectSlice';
import studyReducer from './slices/studySlice';
import taskReducer from './slices/taskSlice';
import progressReducer from './slices/progressSlice';
import messagesReducer from './slices/messagesSlice';
import notificationReducer from './slices/notificationSlice';
import analyticsReducer from './slices/analyticsSlice';

/**
 * Redux Toolkit Store Configuration
 * 
 * Store Structure:
 * - auth: Authentication state (user, tokens, session)
 * - project: Normalized project entities
 * - study: Normalized study entities (grouped by projectId)
 * - task: Normalized task entities (grouped by studyId)
 * - progress: Cached progress values for projects/studies/tasks
 * - messages: Socket.IO message state (room-based)
 * - analytics: Analytics metrics and cached data
 * 
 * State Normalization:
 * - Projects, Studies, and Tasks use entities pattern: { entities: { [id]: Entity }, ids: number[] }
 * - This allows O(1) lookups and prevents duplicate data
 * - Relationships maintained via byProjectId/byStudyId mappings
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    project: projectReducer,
    study: studyReducer,
    task: taskReducer,
    progress: progressReducer,
    messages: messagesReducer,
    notifications: notificationReducer,
    analytics: analyticsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST'],
        // Allow Date objects in payloads (from API responses and socket events)
        ignoredActionPaths: ['payload.createdAt', 'payload.updatedAt', 'payload.completedAt', 'payload.dueDate'],
        // Ignore notification timestamps (they should be strings, but allow Date objects during migration)
        ignoredPaths: ['notifications.notifications.0.timestamp'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

