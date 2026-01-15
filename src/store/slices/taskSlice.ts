// Task Redux slice with normalized state and socket integration

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Task, TaskStatus } from '@/types/entities';

/**
 * Normalized state structure for tasks
 * Uses entities pattern with grouping by studyId for efficient access
 */
interface TaskState {
  // Normalized entities storage
  entities: Record<number, Task>;
  ids: number[];
  
  // Tasks grouped by study ID for quick access
  byStudyId: Record<number, number[]>;
  
  // Current selected task ID
  currentTaskId: number | null;
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isCompleting: boolean;
  isAssigning: boolean;
  
  // Error state
  error: string | null;
}

const initialState: TaskState = {
  entities: {},
  ids: [],
  byStudyId: {},
  currentTaskId: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isCompleting: false,
  isAssigning: false,
  error: null,
};

// Async thunks
export const fetchAllTasksThunk = createAsyncThunk(
  'task/fetchAllTasks',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/tasks', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch tasks');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchTasksByStudyThunk = createAsyncThunk(
  'task/fetchTasksByStudy',
  async (studyId: number, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/studies/${studyId}/tasks`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch tasks');
      }

      const data = await response.json();
      return { studyId, tasks: Array.isArray(data) ? data : data.data || [] };
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchTaskByIdThunk = createAsyncThunk(
  'task/fetchTaskById',
  async (
    { projectId, studyId, taskId }: { projectId: number; studyId: number; taskId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch task');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

/**
 * Fetch task by ID without requiring project/study
 * Used for admin tasks that may not have a study or project
 */
export const fetchTaskByIdDirectThunk = createAsyncThunk(
  'task/fetchTaskByIdDirect',
  async (
    { taskId }: { taskId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch task');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const createTaskThunk = createAsyncThunk(
  'task/createTask',
  async (
    {
      studyId,
      projectId,
      taskData,
    }: {
      studyId?: number | null;
      projectId?: number;
      taskData: {
        taskType?: 'research' | 'admin';
        name: string;
        description?: string;
        priority?: string;
        assignedToId?: number;
        dueDate?: string;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      // Determine which endpoint to use based on task type
      const taskType = taskData.taskType || 'research';
      let url: string;
      
      if (taskType === 'admin') {
        if (projectId) {
          // Admin task with project - use project-level endpoint
          url = `/api/projects/${projectId}/tasks`;
        } else {
          // Standalone admin task - use general tasks endpoint
          url = `/api/tasks`;
        }
      } else if (studyId) {
        // Research task - use study-level endpoint
        // Need to get projectId from study - fetch it first
        try {
          const studyResponse = await fetch(`/api/studies/${studyId}`, {
            credentials: 'include',
          });
          if (!studyResponse.ok) {
            return rejectWithValue('Failed to fetch study information');
          }
          const studyData = await studyResponse.json();
          const studyProjectId = studyData.data?.projectId || studyData.projectId;
          if (!studyProjectId) {
            return rejectWithValue('Study does not have a project ID');
          }
          url = `/api/projects/${studyProjectId}/studies/${studyId}/tasks`;
        } catch (error) {
          return rejectWithValue('Failed to fetch study information');
        }
      } else {
        return rejectWithValue('Research tasks require a studyId');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to create task');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const updateTaskThunk = createAsyncThunk(
  'task/updateTask',
  async (
    {
      projectId,
      studyId,
      taskId,
      taskData,
    }: {
      projectId: number;
      studyId: number;
      taskId: number;
      taskData: {
        name?: string;
        description?: string;
        status?: TaskStatus;
        priority?: string;
        assignedToId?: number | null;
        dueDate?: string | null;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to update task');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const completeTaskThunk = createAsyncThunk(
  'task/completeTask',
  async (
    { projectId, studyId, taskId }: { projectId: number; studyId: number; taskId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to complete task');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const requestTaskCompletionThunk = createAsyncThunk(
  'task/requestTaskCompletion',
  async (
    { projectId, studyId, taskId, notes }: { projectId: number; studyId: number; taskId: number; notes?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/request-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to request completion');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const requestTaskReassignmentThunk = createAsyncThunk(
  'task/requestTaskReassignment',
  async (
    { projectId, studyId, taskId, requestedAssignedToId, notes }: { projectId: number; studyId: number; taskId: number; requestedAssignedToId: number; notes?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/request-reassignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestedAssignedToId, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to request reassignment');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const assignTaskThunk = createAsyncThunk(
  'task/assignTask',
  async (
    { projectId, studyId, taskId, assignedToId }: { projectId: number; studyId: number; taskId: number; assignedToId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedToId }),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to assign task');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const deleteTaskThunk = createAsyncThunk(
  'task/deleteTask',
  async (
    { projectId, studyId, taskId }: { projectId: number; studyId: number; taskId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to delete task');
      }

      return { taskId };
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    setCurrentTask: (state, action: PayloadAction<number | null>) => {
      state.currentTaskId = action.payload;
    },
    // Socket event handlers - update task from real-time events
    updateTaskFromSocket: (state, action: PayloadAction<Task>) => {
      const task = action.payload;
      if (state.entities[task.id]) {
        state.entities[task.id] = task;
      } else {
        // New task from socket
        state.entities[task.id] = task;
        if (!state.ids.includes(task.id)) {
          state.ids.push(task.id);
        }
        // Update byStudyId mapping (only for research tasks with studyId)
        if (task.studyId) {
          if (!state.byStudyId[task.studyId]) {
            state.byStudyId[task.studyId] = [];
          }
          if (!state.byStudyId[task.studyId].includes(task.id)) {
            state.byStudyId[task.studyId].push(task.id);
          }
        }
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all tasks
      .addCase(fetchAllTasksThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllTasksThunk.fulfilled, (state, action) => {
        const tasks = action.payload as Task[];
        
        tasks.forEach((task: Task) => {
          state.entities[task.id] = task;
          if (!state.ids.includes(task.id)) {
            state.ids.push(task.id);
          }
          // Update byStudyId mapping
          if (!state.byStudyId[task.studyId]) {
            state.byStudyId[task.studyId] = [];
          }
          if (!state.byStudyId[task.studyId].includes(task.id)) {
            state.byStudyId[task.studyId].push(task.id);
          }
        });
        
        state.isLoading = false;
      })
      .addCase(fetchAllTasksThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch tasks by study
      .addCase(fetchTasksByStudyThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTasksByStudyThunk.fulfilled, (state, action) => {
        const { studyId, tasks } = action.payload;
        const taskIds: number[] = [];
        
        tasks.forEach((task: Task) => {
          state.entities[task.id] = task;
          if (!state.ids.includes(task.id)) {
            state.ids.push(task.id);
          }
          taskIds.push(task.id);
        });
        
        // Update byStudyId mapping
        state.byStudyId[studyId] = taskIds;
        state.isLoading = false;
      })
      .addCase(fetchTasksByStudyThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch single task
      .addCase(fetchTaskByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTaskByIdThunk.fulfilled, (state, action) => {
        const task = action.payload as Task;
        state.entities[task.id] = task;
        if (!state.ids.includes(task.id)) {
          state.ids.push(task.id);
        }
        // Update byStudyId mapping (only for research tasks with studyId)
        if (task.studyId) {
          if (!state.byStudyId[task.studyId]) {
            state.byStudyId[task.studyId] = [];
          }
          if (!state.byStudyId[task.studyId].includes(task.id)) {
            state.byStudyId[task.studyId].push(task.id);
          }
        }
        state.currentTaskId = task.id;
        state.isLoading = false;
      })
      .addCase(fetchTaskByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch task by ID directly (for admin tasks)
      .addCase(fetchTaskByIdDirectThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTaskByIdDirectThunk.fulfilled, (state, action) => {
        const task = action.payload as Task;
        state.entities[task.id] = task;
        if (!state.ids.includes(task.id)) {
          state.ids.push(task.id);
        }
        // Update byStudyId mapping (only for research tasks with studyId)
        if (task.studyId) {
          if (!state.byStudyId[task.studyId]) {
            state.byStudyId[task.studyId] = [];
          }
          if (!state.byStudyId[task.studyId].includes(task.id)) {
            state.byStudyId[task.studyId].push(task.id);
          }
        }
        state.currentTaskId = task.id;
        state.isLoading = false;
      })
      .addCase(fetchTaskByIdDirectThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create task
      .addCase(createTaskThunk.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createTaskThunk.fulfilled, (state, action) => {
        const task = action.payload as Task;
        state.entities[task.id] = task;
        if (!state.ids.includes(task.id)) {
          state.ids.push(task.id);
        }
        // Update byStudyId mapping (only for research tasks with studyId)
        if (task.studyId) {
          if (!state.byStudyId[task.studyId]) {
            state.byStudyId[task.studyId] = [];
          }
          if (!state.byStudyId[task.studyId].includes(task.id)) {
            state.byStudyId[task.studyId].push(task.id);
          }
        }
        state.currentTaskId = task.id;
        state.isCreating = false;
      })
      .addCase(createTaskThunk.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      })
      // Update task
      .addCase(updateTaskThunk.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateTaskThunk.fulfilled, (state, action) => {
        const task = action.payload as Task;
        state.entities[task.id] = task;
        state.isUpdating = false;
      })
      .addCase(updateTaskThunk.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      })
      // Complete task
      .addCase(completeTaskThunk.pending, (state) => {
        state.isCompleting = true;
        state.error = null;
      })
      .addCase(completeTaskThunk.fulfilled, (state, action) => {
        const task = action.payload as Task;
        state.entities[task.id] = task;
        state.isCompleting = false;
      })
      .addCase(completeTaskThunk.rejected, (state, action) => {
        state.isCompleting = false;
        state.error = action.payload as string;
      })
      // Assign task
      .addCase(assignTaskThunk.pending, (state) => {
        state.isAssigning = true;
        state.error = null;
      })
      .addCase(assignTaskThunk.fulfilled, (state, action) => {
        const task = action.payload as Task;
        state.entities[task.id] = task;
        state.isAssigning = false;
      })
      .addCase(assignTaskThunk.rejected, (state, action) => {
        state.isAssigning = false;
        state.error = action.payload as string;
      })
      // Delete task
      .addCase(deleteTaskThunk.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteTaskThunk.fulfilled, (state, action) => {
        const { taskId } = action.payload;
        delete state.entities[taskId];
        state.ids = state.ids.filter((id) => id !== taskId);
        // Remove from byStudyId mapping
        Object.keys(state.byStudyId).forEach((studyId) => {
          state.byStudyId[parseInt(studyId)] = state.byStudyId[parseInt(studyId)].filter((id) => id !== taskId);
        });
        if (state.currentTaskId === taskId) {
          state.currentTaskId = null;
        }
        state.isDeleting = false;
      })
      .addCase(deleteTaskThunk.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      })
      // Request completion
      .addCase(requestTaskCompletionThunk.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(requestTaskCompletionThunk.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(requestTaskCompletionThunk.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      })
      // Request reassignment
      .addCase(requestTaskReassignmentThunk.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(requestTaskReassignmentThunk.fulfilled, (state) => {
        state.isUpdating = false;
      })
      .addCase(requestTaskReassignmentThunk.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentTask, updateTaskFromSocket, clearError } = taskSlice.actions;
export default taskSlice.reducer;

// Base selector
const selectTaskState = (state: { task: TaskState }) => state.task;

// Memoized selectors for normalized state
export const selectAllTasks = createSelector(
  [selectTaskState],
  (taskState) => taskState.ids.map((id) => taskState.entities[id])
);

export const selectTaskById = (state: { task: TaskState }, taskId: number): Task | undefined => {
  return state.task.entities[taskId];
};

export const selectTasksByStudyId = createSelector(
  [selectTaskState, (_state: { task: TaskState }, studyId: number) => studyId],
  (taskState, studyId) => {
    const taskIds = taskState.byStudyId[studyId] || [];
    return taskIds.map((id) => taskState.entities[id]).filter(Boolean);
  }
);

export const selectCurrentTask = createSelector(
  [selectTaskState],
  (taskState) => {
    if (!taskState.currentTaskId) return null;
    return taskState.entities[taskState.currentTaskId] || null;
  }
);

