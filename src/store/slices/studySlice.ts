// Study Redux slice with normalized state

import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Study } from '@/types/entities';

/**
 * Normalized state structure for studies
 * Uses entities pattern for efficient lookups and updates
 */
interface StudyState {
  // Normalized entities storage
  entities: Record<number, Study>;
  ids: number[];
  
  // Studies grouped by project ID for quick access
  byProjectId: Record<number, number[]>;
  
  // Current selected study ID
  currentStudyId: number | null;
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Error state
  error: string | null;
}

const initialState: StudyState = {
  entities: {},
  ids: [],
  byProjectId: {},
  currentStudyId: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
};

// Async thunks
export const fetchStudiesByProjectThunk = createAsyncThunk(
  'study/fetchStudiesByProject',
  async (projectId: number, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch studies');
      }

      const data = await response.json();
      return { projectId, studies: Array.isArray(data) ? data : data.data || [] };
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchStudyByIdThunk = createAsyncThunk(
  'study/fetchStudyById',
  async (
    { projectId, studyId }: { projectId: number; studyId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch study');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const createStudyThunk = createAsyncThunk(
  'study/createStudy',
  async (
    { projectId, studyData }: { projectId: number; studyData: { name: string; description?: string } },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(studyData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to create study');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const updateStudyThunk = createAsyncThunk(
  'study/updateStudy',
  async (
    {
      projectId,
      studyId,
      updates,
    }: {
      projectId: number;
      studyId: number;
      updates: { name?: string; description?: string };
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to update study');
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const deleteStudyThunk = createAsyncThunk(
  'study/deleteStudy',
  async (
    { projectId, studyId }: { projectId: number; studyId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/studies/${studyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to delete study');
      }

      return studyId;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

const studySlice = createSlice({
  name: 'study',
  initialState,
  reducers: {
    setCurrentStudy: (state, action: PayloadAction<number | null>) => {
      state.currentStudyId = action.payload;
    },
    updateStudyInState: (state, action: PayloadAction<Study>) => {
      const study = action.payload;
      if (state.entities[study.id]) {
        state.entities[study.id] = study;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch studies by project
      .addCase(fetchStudiesByProjectThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStudiesByProjectThunk.fulfilled, (state, action) => {
        const { projectId, studies } = action.payload;
        const studyIds: number[] = [];
        
        studies.forEach((study: Study) => {
          state.entities[study.id] = study;
          if (!state.ids.includes(study.id)) {
            state.ids.push(study.id);
          }
          studyIds.push(study.id);
        });
        
        // Update byProjectId mapping
        state.byProjectId[projectId] = studyIds;
        state.isLoading = false;
      })
      .addCase(fetchStudiesByProjectThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch single study
      .addCase(fetchStudyByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStudyByIdThunk.fulfilled, (state, action) => {
        const study = action.payload as Study;
        state.entities[study.id] = study;
        if (!state.ids.includes(study.id)) {
          state.ids.push(study.id);
        }
        // Update byProjectId mapping
        if (!state.byProjectId[study.projectId]) {
          state.byProjectId[study.projectId] = [];
        }
        if (!state.byProjectId[study.projectId].includes(study.id)) {
          state.byProjectId[study.projectId].push(study.id);
        }
        state.currentStudyId = study.id;
        state.isLoading = false;
      })
      .addCase(fetchStudyByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create study
      .addCase(createStudyThunk.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createStudyThunk.fulfilled, (state, action) => {
        const study = action.payload as Study;
        state.entities[study.id] = study;
        if (!state.ids.includes(study.id)) {
          state.ids.push(study.id);
        }
        // Update byProjectId mapping
        if (!state.byProjectId[study.projectId]) {
          state.byProjectId[study.projectId] = [];
        }
        if (!state.byProjectId[study.projectId].includes(study.id)) {
          state.byProjectId[study.projectId].push(study.id);
        }
        state.currentStudyId = study.id;
        state.isCreating = false;
      })
      .addCase(createStudyThunk.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      })
      // Update study
      .addCase(updateStudyThunk.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateStudyThunk.fulfilled, (state, action) => {
        const study = action.payload as Study;
        state.entities[study.id] = study;
        state.isUpdating = false;
      })
      .addCase(updateStudyThunk.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      })
      // Delete study
      .addCase(deleteStudyThunk.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteStudyThunk.fulfilled, (state, action) => {
        const studyId = action.payload as number;
        const study = state.entities[studyId];
        
        if (study) {
          // Remove from byProjectId mapping
          const projectId = study.projectId;
          if (state.byProjectId[projectId]) {
            state.byProjectId[projectId] = state.byProjectId[projectId].filter((id) => id !== studyId);
          }
        }
        
        delete state.entities[studyId];
        state.ids = state.ids.filter((id) => id !== studyId);
        if (state.currentStudyId === studyId) {
          state.currentStudyId = null;
        }
        state.isDeleting = false;
      })
      .addCase(deleteStudyThunk.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentStudy, updateStudyInState, clearError } = studySlice.actions;
export default studySlice.reducer;

// Base selector
const selectStudyState = (state: { study: StudyState }) => state.study;

// Memoized selectors for normalized state
export const selectAllStudies = createSelector(
  [selectStudyState],
  (studyState) => studyState.ids.map((id) => studyState.entities[id])
);

export const selectStudyById = (state: { study: StudyState }, studyId: number): Study | undefined => {
  return state.study.entities[studyId];
};

export const selectStudiesByProjectId = createSelector(
  [selectStudyState, (_state: { study: StudyState }, projectId: number) => projectId],
  (studyState, projectId) => {
    const studyIds = studyState.byProjectId[projectId] || [];
    return studyIds.map((id) => studyState.entities[id]).filter(Boolean);
  }
);

export const selectCurrentStudy = createSelector(
  [selectStudyState],
  (studyState) => {
    if (!studyState.currentStudyId) return null;
    return studyState.entities[studyState.currentStudyId] || null;
  }
);

