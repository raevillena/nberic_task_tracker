// Progress Redux slice with socket integration

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Progress state stores cached progress values for projects, studies, and tasks
 * Updated via Socket.IO events for real-time updates
 */
interface ProgressState {
  // Progress values: entityId -> progress (0-100)
  projectProgress: Record<number, number>;
  studyProgress: Record<number, number>;
  taskProgress: Record<number, number>;
  
  // Last update timestamps for cache invalidation
  lastUpdated: {
    projects: Record<number, number>;
    studies: Record<number, number>;
    tasks: Record<number, number>;
  };
}

const initialState: ProgressState = {
  projectProgress: {},
  studyProgress: {},
  taskProgress: {},
  lastUpdated: {
    projects: {},
    studies: {},
    tasks: {},
  },
};

const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    // Regular updates (from API calls)
    updateProjectProgress: (state, action: PayloadAction<{ projectId: number; progress: number }>) => {
      const { projectId, progress } = action.payload;
      state.projectProgress[projectId] = progress;
      state.lastUpdated.projects[projectId] = Date.now();
    },
    updateStudyProgress: (state, action: PayloadAction<{ studyId: number; progress: number }>) => {
      const { studyId, progress } = action.payload;
      state.studyProgress[studyId] = progress;
      state.lastUpdated.studies[studyId] = Date.now();
    },
    updateTaskProgress: (state, action: PayloadAction<{ taskId: number; progress: number }>) => {
      const { taskId, progress } = action.payload;
      state.taskProgress[taskId] = progress;
      state.lastUpdated.tasks[taskId] = Date.now();
    },
    
    // Socket event handlers for real-time progress updates
    // These are called when socket events are received
    updateProgressFromSocket: (
      state,
      action: PayloadAction<{
        type: 'task' | 'study' | 'project';
        id: number;
        progress: number;
      }>
    ) => {
      const { type, id, progress } = action.payload;
      const now = Date.now();
      
      switch (type) {
        case 'project':
          state.projectProgress[id] = progress;
          state.lastUpdated.projects[id] = now;
          break;
        case 'study':
          state.studyProgress[id] = progress;
          state.lastUpdated.studies[id] = now;
          break;
        case 'task':
          state.taskProgress[id] = progress;
          state.lastUpdated.tasks[id] = now;
          break;
      }
    },
    
    // Batch update for progress chain (task -> study -> project)
    updateProgressChain: (
      state,
      action: PayloadAction<{
        taskId?: number;
        taskProgress?: number;
        studyId?: number;
        studyProgress?: number;
        projectId?: number;
        projectProgress?: number;
      }>
    ) => {
      const now = Date.now();
      
      if (action.payload.taskId !== undefined && action.payload.taskProgress !== undefined) {
        state.taskProgress[action.payload.taskId] = action.payload.taskProgress;
        state.lastUpdated.tasks[action.payload.taskId] = now;
      }
      
      if (action.payload.studyId !== undefined && action.payload.studyProgress !== undefined) {
        state.studyProgress[action.payload.studyId] = action.payload.studyProgress;
        state.lastUpdated.studies[action.payload.studyId] = now;
      }
      
      if (action.payload.projectId !== undefined && action.payload.projectProgress !== undefined) {
        state.projectProgress[action.payload.projectId] = action.payload.projectProgress;
        state.lastUpdated.projects[action.payload.projectId] = now;
      }
    },
    
    // Clear progress cache
    clearProgress: (state, action: PayloadAction<{ type?: 'task' | 'study' | 'project'; id?: number }>) => {
      const { type, id } = action.payload;
      
      if (!type) {
        // Clear all
        state.projectProgress = {};
        state.studyProgress = {};
        state.taskProgress = {};
        state.lastUpdated = { projects: {}, studies: {}, tasks: {} };
      } else if (id !== undefined) {
        // Clear specific entity
        switch (type) {
          case 'project':
            delete state.projectProgress[id];
            delete state.lastUpdated.projects[id];
            break;
          case 'study':
            delete state.studyProgress[id];
            delete state.lastUpdated.studies[id];
            break;
          case 'task':
            delete state.taskProgress[id];
            delete state.lastUpdated.tasks[id];
            break;
        }
      }
    },
  },
});

export const {
  updateProjectProgress,
  updateStudyProgress,
  updateTaskProgress,
  updateProgressFromSocket,
  updateProgressChain,
  clearProgress,
} = progressSlice.actions;
export default progressSlice.reducer;

// Selectors
export const selectProjectProgress = (state: { progress: ProgressState }, projectId: number): number => {
  return state.progress.projectProgress[projectId] ?? 0;
};

export const selectStudyProgress = (state: { progress: ProgressState }, studyId: number): number => {
  return state.progress.studyProgress[studyId] ?? 0;
};

export const selectTaskProgress = (state: { progress: ProgressState }, taskId: number): number => {
  return state.progress.taskProgress[taskId] ?? 0;
};

