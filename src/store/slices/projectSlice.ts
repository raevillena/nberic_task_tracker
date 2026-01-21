// Project Redux slice with normalized state

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Project } from '@/types/entities';
import { apiRequest } from '@/lib/utils/api';

/**
 * Normalized state structure for projects
 * Uses entities pattern: { entities: { [id]: Project }, ids: number[] }
 * This allows O(1) lookups and prevents duplicate data
 */
interface ProjectState {
  // Normalized entities storage
  entities: Record<number, Project>;
  ids: number[];
  
  // Current selected project ID
  currentProjectId: number | null;
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Error state
  error: string | null;
}

const initialState: ProjectState = {
  entities: {},
  ids: [],
  currentProjectId: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
};

// Async thunks
export const fetchProjectsThunk = createAsyncThunk(
  'project/fetchProjects',
  async (_, { rejectWithValue }) => {
    try {
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest('/api/projects', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch projects');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchProjectByIdThunk = createAsyncThunk(
  'project/fetchProjectById',
  async (projectId: number, { rejectWithValue }) => {
    try {
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/projects/${projectId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch project');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const createProjectThunk = createAsyncThunk(
  'project/createProject',
  async (projectData: { name: string; description?: string }, { rejectWithValue }) => {
    try {
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to create project');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const updateProjectThunk = createAsyncThunk(
  'project/updateProject',
  async (
    { projectId, updates }: { projectId: number; updates: { name?: string; description?: string } },
    { rejectWithValue }
  ) => {
    try {
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to update project');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const deleteProjectThunk = createAsyncThunk(
  'project/deleteProject',
  async (projectId: number, { rejectWithValue }) => {
    try {
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to delete project');
      }

      return projectId;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<number | null>) => {
      state.currentProjectId = action.payload;
    },
    updateProjectInState: (state, action: PayloadAction<Project>) => {
      const project = action.payload;
      if (state.entities[project.id]) {
        state.entities[project.id] = project;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all projects
      .addCase(fetchProjectsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjectsThunk.fulfilled, (state, action) => {
        const projects = action.payload as Project[];
        // Normalize: store in entities and track IDs
        projects.forEach((project) => {
          state.entities[project.id] = project;
          if (!state.ids.includes(project.id)) {
            state.ids.push(project.id);
          }
        });
        state.isLoading = false;
      })
      .addCase(fetchProjectsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch single project
      .addCase(fetchProjectByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjectByIdThunk.fulfilled, (state, action) => {
        const project = action.payload as Project;
        state.entities[project.id] = project;
        if (!state.ids.includes(project.id)) {
          state.ids.push(project.id);
        }
        state.currentProjectId = project.id;
        state.isLoading = false;
      })
      .addCase(fetchProjectByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create project
      .addCase(createProjectThunk.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createProjectThunk.fulfilled, (state, action) => {
        const project = action.payload as Project;
        state.entities[project.id] = project;
        if (!state.ids.includes(project.id)) {
          state.ids.push(project.id);
        }
        state.currentProjectId = project.id;
        state.isCreating = false;
      })
      .addCase(createProjectThunk.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      })
      // Update project
      .addCase(updateProjectThunk.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateProjectThunk.fulfilled, (state, action) => {
        const project = action.payload as Project;
        state.entities[project.id] = project;
        state.isUpdating = false;
      })
      .addCase(updateProjectThunk.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      })
      // Delete project
      .addCase(deleteProjectThunk.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteProjectThunk.fulfilled, (state, action) => {
        const projectId = action.payload as number;
        delete state.entities[projectId];
        state.ids = state.ids.filter((id) => id !== projectId);
        if (state.currentProjectId === projectId) {
          state.currentProjectId = null;
        }
        state.isDeleting = false;
      })
      .addCase(deleteProjectThunk.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentProject, updateProjectInState, clearError } = projectSlice.actions;
export default projectSlice.reducer;

// Base selector
const selectProjectState = (state: { project: ProjectState }) => state.project;

// Memoized selectors for normalized state
export const selectAllProjects = createSelector(
  [selectProjectState],
  (projectState) => {
    // Safety check: ensure projectState and required properties exist
    if (!projectState || !projectState.ids || !projectState.entities) {
      return [];
    }
    return projectState.ids.map((id) => projectState.entities[id]).filter(Boolean);
  }
);

export const selectProjectById = (state: { project: ProjectState }, projectId: number): Project | undefined => {
  // Safety check: ensure state.project and entities exist
  if (!state?.project?.entities) {
    return undefined;
  }
  return state.project.entities[projectId];
};

export const selectCurrentProject = createSelector(
  [selectProjectState],
  (projectState) => {
    // Safety check: ensure projectState and entities exist
    if (!projectState || !projectState.entities || !projectState.currentProjectId) {
      return null;
    }
    return projectState.entities[projectState.currentProjectId] || null;
  }
);

// Loading state selectors with safety checks
export const selectProjectIsLoading = createSelector(
  [selectProjectState],
  (projectState) => projectState?.isLoading ?? false
);

export const selectProjectIsCreating = createSelector(
  [selectProjectState],
  (projectState) => projectState?.isCreating ?? false
);

export const selectProjectIsUpdating = createSelector(
  [selectProjectState],
  (projectState) => projectState?.isUpdating ?? false
);

export const selectProjectIsDeleting = createSelector(
  [selectProjectState],
  (projectState) => projectState?.isDeleting ?? false
);

