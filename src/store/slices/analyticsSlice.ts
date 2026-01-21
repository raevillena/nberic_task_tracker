// Analytics Redux slice

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TaskPriority, TaskStatus } from '@/types/entities';
import { apiRequest } from '@/lib/utils/api';

// Analytics metric types
export interface ResearcherProductivity {
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  avgHoursToComplete: number;
  minHoursToComplete: number;
  maxHoursToComplete: number;
  completedCount: number;
  activeTaskCount: number;
  pendingCount: number;
  inProgressCount: number;
  totalWithDueDate: number;
  onTimeCount: number;
  onTimeRate: number;
}

export interface ProjectProgressMetrics {
  projectId: number;
  projectName: string;
  cachedProgress: number;
  calculatedProgress: number;
  studyCount: number;
  totalTasks: number;
  completedTasks: number;
}

export interface ProjectVelocity {
  projectId: number;
  projectName: string;
  velocity: Array<{ period: string; count: number }>;
}

export interface ProjectHealthScore {
  projectId: number;
  projectName: string;
  healthScore: number;
  breakdown: {
    progressScore: number;
    overdueScore: number;
    complianceScore: number;
  };
  metrics: {
    studyCount: number;
    totalTasks: number;
    overdueTasks: number;
    openComplianceFlags: number;
  };
}

export interface StudyProgressDistribution {
  progressRange: string;
  studyCount: number;
}

export interface StudyCompletionForecast {
  studyId: number;
  studyName: string;
  currentProgress: number;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  tasksPerDay: string;
  estimatedDaysToComplete: number | null;
  forecastedCompletionDate: Date | null;
}

export interface TaskPriorityDistribution {
  distribution: Record<TaskPriority, Record<TaskStatus, number>>;
  summary: {
    totalTasks: number;
    byPriority: Array<{
      priority: TaskPriority;
      total: number;
      byStatus: Record<TaskStatus, number>;
    }>;
  };
}

export interface HighPriorityBacklog {
  taskId: number;
  taskName: string;
  priority: TaskPriority;
  status: TaskStatus;
  ageInDays: number;
  dueDate: Date | null;
  daysUntilDue: number | null;
  assignedTo: {
    id: number;
    email: string;
    name: string;
  } | null;
  study: {
    id: number;
    name: string;
  };
  project: {
    id: number;
    name: string;
  };
}

export interface ComplianceFlagRate {
  totalTasks: number;
  tasksWithFlags: number;
  totalOpenFlags: number;
  flagRate: number;
}

export interface ComplianceFlagTrend {
  period: string;
  open: number;
  resolved: number;
  dismissed: number;
  bySeverity: Record<string, number>;
}

export interface ComplianceFlagResolutionTime {
  severity: string;
  avgHoursToResolve: number;
  minHoursToResolve: number;
  maxHoursToResolve: number;
  resolvedCount: number;
}

// Admin task metrics types
export interface AdminTaskMetrics {
  total: number;
  completed: number;
  completionRate: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
}

export interface AdminTaskCompletionTrend {
  period: string;
  total: number;
  completed: number;
}

export interface AdminTaskAssignmentMetrics {
  userId: number | null;
  user: {
    id: number;
    email: string;
    name: string;
  } | null;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export interface OverdueAdminTask {
  taskId: number;
  taskName: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  daysOverdue: number;
  assignedTo: {
    id: number;
    email: string;
    name: string;
  } | null;
  project: {
    id: number;
    name: string;
  } | null;
}

interface AnalyticsState {
  // Researcher productivity
  researcherProductivity: ResearcherProductivity[];
  researcherProductivityLoading: boolean;
  researcherProductivityError: string | null;
  
  // Project metrics
  projectProgress: ProjectProgressMetrics[];
  projectProgressLoading: boolean;
  projectProgressError: string | null;
  
  projectVelocity: ProjectVelocity[];
  projectVelocityLoading: boolean;
  projectVelocityError: string | null;
  
  projectHealthScores: ProjectHealthScore[];
  projectHealthScoresLoading: boolean;
  projectHealthScoresError: string | null;
  
  // Study metrics
  studyProgressDistribution: StudyProgressDistribution[];
  studyProgressDistributionLoading: boolean;
  studyProgressDistributionError: string | null;
  
  studyCompletionForecast: StudyCompletionForecast[];
  studyCompletionForecastLoading: boolean;
  studyCompletionForecastError: string | null;
  
  // Task metrics
  taskPriorityDistribution: TaskPriorityDistribution | null;
  taskPriorityDistributionLoading: boolean;
  taskPriorityDistributionError: string | null;
  
  highPriorityBacklog: HighPriorityBacklog[];
  highPriorityBacklogLoading: boolean;
  highPriorityBacklogError: string | null;
  
  // Compliance metrics
  complianceFlagRate: ComplianceFlagRate | null;
  complianceFlagRateLoading: boolean;
  complianceFlagRateError: string | null;
  
  complianceFlagTrends: ComplianceFlagTrend[];
  complianceFlagTrendsLoading: boolean;
  complianceFlagTrendsError: string | null;
  
  complianceFlagResolutionTime: ComplianceFlagResolutionTime[];
  complianceFlagResolutionTimeLoading: boolean;
  complianceFlagResolutionTimeError: string | null;

  // Admin task metrics
  adminTaskMetrics: AdminTaskMetrics | null;
  adminTaskMetricsLoading: boolean;
  adminTaskMetricsError: string | null;

  adminTaskCompletionTrends: AdminTaskCompletionTrend[];
  adminTaskCompletionTrendsLoading: boolean;
  adminTaskCompletionTrendsError: string | null;

  adminTaskAssignmentMetrics: AdminTaskAssignmentMetrics[];
  adminTaskAssignmentMetricsLoading: boolean;
  adminTaskAssignmentMetricsError: string | null;

  overdueAdminTasks: OverdueAdminTask[];
  overdueAdminTasksLoading: boolean;
  overdueAdminTasksError: string | null;
}

const initialState: AnalyticsState = {
  researcherProductivity: [],
  researcherProductivityLoading: false,
  researcherProductivityError: null,
  
  projectProgress: [],
  projectProgressLoading: false,
  projectProgressError: null,
  
  projectVelocity: [],
  projectVelocityLoading: false,
  projectVelocityError: null,
  
  projectHealthScores: [],
  projectHealthScoresLoading: false,
  projectHealthScoresError: null,
  
  studyProgressDistribution: [],
  studyProgressDistributionLoading: false,
  studyProgressDistributionError: null,
  
  studyCompletionForecast: [],
  studyCompletionForecastLoading: false,
  studyCompletionForecastError: null,
  
  taskPriorityDistribution: null,
  taskPriorityDistributionLoading: false,
  taskPriorityDistributionError: null,
  
  highPriorityBacklog: [],
  highPriorityBacklogLoading: false,
  highPriorityBacklogError: null,
  
  complianceFlagRate: null,
  complianceFlagRateLoading: false,
  complianceFlagRateError: null,
  
  complianceFlagTrends: [],
  complianceFlagTrendsLoading: false,
  complianceFlagTrendsError: null,
  
  complianceFlagResolutionTime: [],
  complianceFlagResolutionTimeLoading: false,
  complianceFlagResolutionTimeError: null,

  // Admin task metrics
  adminTaskMetrics: null,
  adminTaskMetricsLoading: false,
  adminTaskMetricsError: null,

  adminTaskCompletionTrends: [],
  adminTaskCompletionTrendsLoading: false,
  adminTaskCompletionTrendsError: null,

  adminTaskAssignmentMetrics: [],
  adminTaskAssignmentMetricsLoading: false,
  adminTaskAssignmentMetricsError: null,

  overdueAdminTasks: [],
  overdueAdminTasksLoading: false,
  overdueAdminTasksError: null,
};

// Helper function to build query string
function buildQueryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

// Async thunks for researcher productivity
export const fetchResearcherProductivityThunk = createAsyncThunk(
  'analytics/fetchResearcherProductivity',
  async (
    params: {
      researcherId?: number;
      startDate?: string;
      endDate?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/productivity?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch researcher productivity');
      }

      const data = await response.json();
      return data.data as ResearcherProductivity[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

// Async thunks for project metrics
export const fetchProjectProgressThunk = createAsyncThunk(
  'analytics/fetchProjectProgress',
  async (projectId: number | null, { rejectWithValue }) => {
    try {
      const queryString = projectId ? `?projectId=${projectId}` : '';
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/projects/progress${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch project progress');
      }

      const data = await response.json();
      return data.data as ProjectProgressMetrics[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchProjectVelocityThunk = createAsyncThunk(
  'analytics/fetchProjectVelocity',
  async (
    params: {
      projectId?: number;
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month';
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/projects/velocity?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch project velocity');
      }

      const data = await response.json();
      return data.data as ProjectVelocity[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchProjectHealthScoresThunk = createAsyncThunk(
  'analytics/fetchProjectHealthScores',
  async (projectId: number | null, { rejectWithValue }) => {
    try {
      const queryString = projectId ? `?projectId=${projectId}` : '';
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/projects/health${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch project health scores');
      }

      const data = await response.json();
      return data.data as ProjectHealthScore[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

// Async thunks for study metrics
export const fetchStudyProgressDistributionThunk = createAsyncThunk(
  'analytics/fetchStudyProgressDistribution',
  async (projectId: number | null, { rejectWithValue }) => {
    try {
      const queryString = projectId ? `?projectId=${projectId}` : '';
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/studies/distribution${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch study progress distribution');
      }

      const data = await response.json();
      return data.data as StudyProgressDistribution[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchStudyCompletionForecastThunk = createAsyncThunk(
  'analytics/fetchStudyCompletionForecast',
  async (studyId: number | null, { rejectWithValue }) => {
    try {
      const queryString = studyId ? `?studyId=${studyId}` : '';
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/studies/forecast${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch study completion forecast');
      }

      const data = await response.json();
      return data.data as StudyCompletionForecast[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

// Async thunks for task metrics
export const fetchTaskPriorityDistributionThunk = createAsyncThunk(
  'analytics/fetchTaskPriorityDistribution',
  async (
    params: {
      projectId?: number;
      studyId?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/tasks/priority?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch task priority distribution');
      }

      const data = await response.json();
      return data.data as TaskPriorityDistribution;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchHighPriorityBacklogThunk = createAsyncThunk(
  'analytics/fetchHighPriorityBacklog',
  async (_, { rejectWithValue }) => {
    try {
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest('/api/analytics/tasks/backlog', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch high priority backlog');
      }

      const data = await response.json();
      return data.data as HighPriorityBacklog[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

// Async thunks for compliance metrics
export const fetchComplianceFlagRateThunk = createAsyncThunk(
  'analytics/fetchComplianceFlagRate',
  async (
    params: {
      projectId?: number;
      studyId?: number;
      severity?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/compliance/rate?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch compliance flag rate');
      }

      const data = await response.json();
      return data.data as ComplianceFlagRate;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchComplianceFlagTrendsThunk = createAsyncThunk(
  'analytics/fetchComplianceFlagTrends',
  async (
    params: {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month';
      severity?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/compliance/trends?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch compliance flag trends');
      }

      const data = await response.json();
      return data.data as ComplianceFlagTrend[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchComplianceFlagResolutionTimeThunk = createAsyncThunk(
  'analytics/fetchComplianceFlagResolutionTime',
  async (
    params: {
      startDate?: string;
      endDate?: string;
      severity?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      // Use apiRequest to automatically include Authorization header
      const response = await apiRequest(`/api/analytics/compliance/resolution-time?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch compliance flag resolution time');
      }

      const data = await response.json();
      return data.data as ComplianceFlagResolutionTime[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

// Admin task metrics thunks
export const fetchAdminTaskMetricsThunk = createAsyncThunk(
  'analytics/fetchAdminTaskMetrics',
  async (projectId: number | null, { rejectWithValue }) => {
    try {
      const queryString = projectId ? `?projectId=${projectId}` : '';
      const response = await apiRequest(`/api/analytics/admin-tasks/metrics${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch admin task metrics');
      }

      const data = await response.json();
      return data.data as AdminTaskMetrics;
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchAdminTaskCompletionTrendsThunk = createAsyncThunk(
  'analytics/fetchAdminTaskCompletionTrends',
  async (
    params: {
      projectId?: number;
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month';
    },
    { rejectWithValue }
  ) => {
    try {
      const queryString = buildQueryString(params);
      const response = await apiRequest(`/api/analytics/admin-tasks/completion-trends?${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch admin task completion trends');
      }

      const data = await response.json();
      return data.data as AdminTaskCompletionTrend[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchAdminTaskAssignmentMetricsThunk = createAsyncThunk(
  'analytics/fetchAdminTaskAssignmentMetrics',
  async (projectId: number | null, { rejectWithValue }) => {
    try {
      const queryString = projectId ? `?projectId=${projectId}` : '';
      const response = await apiRequest(`/api/analytics/admin-tasks/assignments${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch admin task assignment metrics');
      }

      const data = await response.json();
      return data.data as AdminTaskAssignmentMetrics[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

export const fetchOverdueAdminTasksThunk = createAsyncThunk(
  'analytics/fetchOverdueAdminTasks',
  async (projectId: number | null, { rejectWithValue }) => {
    try {
      const queryString = projectId ? `?projectId=${projectId}` : '';
      const response = await apiRequest(`/api/analytics/admin-tasks/overdue${queryString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch overdue admin tasks');
      }

      const data = await response.json();
      return data.data as OverdueAdminTask[];
    } catch (error) {
      return rejectWithValue('Network error');
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    clearError: (state, action: PayloadAction<keyof AnalyticsState>) => {
      const errorKey = `${action.payload}Error` as keyof AnalyticsState;
      if (typeof state[errorKey] === 'string') {
        (state[errorKey] as string | null) = null;
      }
    },
    clearAllErrors: (state) => {
      state.researcherProductivityError = null;
      state.projectProgressError = null;
      state.projectVelocityError = null;
      state.projectHealthScoresError = null;
      state.studyProgressDistributionError = null;
      state.studyCompletionForecastError = null;
      state.taskPriorityDistributionError = null;
      state.highPriorityBacklogError = null;
      state.complianceFlagRateError = null;
      state.complianceFlagTrendsError = null;
      state.complianceFlagResolutionTimeError = null;
      state.adminTaskMetricsError = null;
      state.adminTaskCompletionTrendsError = null;
      state.adminTaskAssignmentMetricsError = null;
      state.overdueAdminTasksError = null;
    },
  },
  extraReducers: (builder) => {
    // Researcher productivity
    builder
      .addCase(fetchResearcherProductivityThunk.pending, (state) => {
        state.researcherProductivityLoading = true;
        state.researcherProductivityError = null;
      })
      .addCase(fetchResearcherProductivityThunk.fulfilled, (state, action) => {
        state.researcherProductivity = action.payload;
        state.researcherProductivityLoading = false;
      })
      .addCase(fetchResearcherProductivityThunk.rejected, (state, action) => {
        state.researcherProductivityLoading = false;
        state.researcherProductivityError = action.payload as string;
      });

    // Project progress
    builder
      .addCase(fetchProjectProgressThunk.pending, (state) => {
        state.projectProgressLoading = true;
        state.projectProgressError = null;
      })
      .addCase(fetchProjectProgressThunk.fulfilled, (state, action) => {
        state.projectProgress = action.payload;
        state.projectProgressLoading = false;
      })
      .addCase(fetchProjectProgressThunk.rejected, (state, action) => {
        state.projectProgressLoading = false;
        state.projectProgressError = action.payload as string;
      });

    // Project velocity
    builder
      .addCase(fetchProjectVelocityThunk.pending, (state) => {
        state.projectVelocityLoading = true;
        state.projectVelocityError = null;
      })
      .addCase(fetchProjectVelocityThunk.fulfilled, (state, action) => {
        state.projectVelocity = action.payload;
        state.projectVelocityLoading = false;
      })
      .addCase(fetchProjectVelocityThunk.rejected, (state, action) => {
        state.projectVelocityLoading = false;
        state.projectVelocityError = action.payload as string;
      });

    // Project health scores
    builder
      .addCase(fetchProjectHealthScoresThunk.pending, (state) => {
        state.projectHealthScoresLoading = true;
        state.projectHealthScoresError = null;
      })
      .addCase(fetchProjectHealthScoresThunk.fulfilled, (state, action) => {
        state.projectHealthScores = action.payload;
        state.projectHealthScoresLoading = false;
      })
      .addCase(fetchProjectHealthScoresThunk.rejected, (state, action) => {
        state.projectHealthScoresLoading = false;
        state.projectHealthScoresError = action.payload as string;
      });

    // Study progress distribution
    builder
      .addCase(fetchStudyProgressDistributionThunk.pending, (state) => {
        state.studyProgressDistributionLoading = true;
        state.studyProgressDistributionError = null;
      })
      .addCase(fetchStudyProgressDistributionThunk.fulfilled, (state, action) => {
        state.studyProgressDistribution = action.payload;
        state.studyProgressDistributionLoading = false;
      })
      .addCase(fetchStudyProgressDistributionThunk.rejected, (state, action) => {
        state.studyProgressDistributionLoading = false;
        state.studyProgressDistributionError = action.payload as string;
      });

    // Study completion forecast
    builder
      .addCase(fetchStudyCompletionForecastThunk.pending, (state) => {
        state.studyCompletionForecastLoading = true;
        state.studyCompletionForecastError = null;
      })
      .addCase(fetchStudyCompletionForecastThunk.fulfilled, (state, action) => {
        state.studyCompletionForecast = action.payload;
        state.studyCompletionForecastLoading = false;
      })
      .addCase(fetchStudyCompletionForecastThunk.rejected, (state, action) => {
        state.studyCompletionForecastLoading = false;
        state.studyCompletionForecastError = null;
      });

    // Task priority distribution
    builder
      .addCase(fetchTaskPriorityDistributionThunk.pending, (state) => {
        state.taskPriorityDistributionLoading = true;
        state.taskPriorityDistributionError = null;
      })
      .addCase(fetchTaskPriorityDistributionThunk.fulfilled, (state, action) => {
        state.taskPriorityDistribution = action.payload;
        state.taskPriorityDistributionLoading = false;
      })
      .addCase(fetchTaskPriorityDistributionThunk.rejected, (state, action) => {
        state.taskPriorityDistributionLoading = false;
        state.taskPriorityDistributionError = action.payload as string;
      });

    // High priority backlog
    builder
      .addCase(fetchHighPriorityBacklogThunk.pending, (state) => {
        state.highPriorityBacklogLoading = true;
        state.highPriorityBacklogError = null;
      })
      .addCase(fetchHighPriorityBacklogThunk.fulfilled, (state, action) => {
        state.highPriorityBacklog = action.payload;
        state.highPriorityBacklogLoading = false;
      })
      .addCase(fetchHighPriorityBacklogThunk.rejected, (state, action) => {
        state.highPriorityBacklogLoading = false;
        state.highPriorityBacklogError = action.payload as string;
      });

    // Compliance flag rate
    builder
      .addCase(fetchComplianceFlagRateThunk.pending, (state) => {
        state.complianceFlagRateLoading = true;
        state.complianceFlagRateError = null;
      })
      .addCase(fetchComplianceFlagRateThunk.fulfilled, (state, action) => {
        state.complianceFlagRate = action.payload;
        state.complianceFlagRateLoading = false;
      })
      .addCase(fetchComplianceFlagRateThunk.rejected, (state, action) => {
        state.complianceFlagRateLoading = false;
        state.complianceFlagRateError = action.payload as string;
      });

    // Compliance flag trends
    builder
      .addCase(fetchComplianceFlagTrendsThunk.pending, (state) => {
        state.complianceFlagTrendsLoading = true;
        state.complianceFlagTrendsError = null;
      })
      .addCase(fetchComplianceFlagTrendsThunk.fulfilled, (state, action) => {
        state.complianceFlagTrends = action.payload;
        state.complianceFlagTrendsLoading = false;
      })
      .addCase(fetchComplianceFlagTrendsThunk.rejected, (state, action) => {
        state.complianceFlagTrendsLoading = false;
        state.complianceFlagTrendsError = action.payload as string;
      });

    // Compliance flag resolution time
    builder
      .addCase(fetchComplianceFlagResolutionTimeThunk.pending, (state) => {
        state.complianceFlagResolutionTimeLoading = true;
        state.complianceFlagResolutionTimeError = null;
      })
      .addCase(fetchComplianceFlagResolutionTimeThunk.fulfilled, (state, action) => {
        state.complianceFlagResolutionTime = action.payload;
        state.complianceFlagResolutionTimeLoading = false;
      })
      .addCase(fetchComplianceFlagResolutionTimeThunk.rejected, (state, action) => {
        state.complianceFlagResolutionTimeLoading = false;
        state.complianceFlagResolutionTimeError = action.payload as string;
      });

    // Admin task metrics
    builder
      .addCase(fetchAdminTaskMetricsThunk.pending, (state) => {
        state.adminTaskMetricsLoading = true;
        state.adminTaskMetricsError = null;
      })
      .addCase(fetchAdminTaskMetricsThunk.fulfilled, (state, action) => {
        state.adminTaskMetrics = action.payload;
        state.adminTaskMetricsLoading = false;
      })
      .addCase(fetchAdminTaskMetricsThunk.rejected, (state, action) => {
        state.adminTaskMetricsLoading = false;
        state.adminTaskMetricsError = action.payload as string;
      });

    // Admin task completion trends
    builder
      .addCase(fetchAdminTaskCompletionTrendsThunk.pending, (state) => {
        state.adminTaskCompletionTrendsLoading = true;
        state.adminTaskCompletionTrendsError = null;
      })
      .addCase(fetchAdminTaskCompletionTrendsThunk.fulfilled, (state, action) => {
        state.adminTaskCompletionTrends = action.payload;
        state.adminTaskCompletionTrendsLoading = false;
      })
      .addCase(fetchAdminTaskCompletionTrendsThunk.rejected, (state, action) => {
        state.adminTaskCompletionTrendsLoading = false;
        state.adminTaskCompletionTrendsError = action.payload as string;
      });

    // Admin task assignment metrics
    builder
      .addCase(fetchAdminTaskAssignmentMetricsThunk.pending, (state) => {
        state.adminTaskAssignmentMetricsLoading = true;
        state.adminTaskAssignmentMetricsError = null;
      })
      .addCase(fetchAdminTaskAssignmentMetricsThunk.fulfilled, (state, action) => {
        state.adminTaskAssignmentMetrics = action.payload;
        state.adminTaskAssignmentMetricsLoading = false;
      })
      .addCase(fetchAdminTaskAssignmentMetricsThunk.rejected, (state, action) => {
        state.adminTaskAssignmentMetricsLoading = false;
        state.adminTaskAssignmentMetricsError = action.payload as string;
      });

    // Overdue admin tasks
    builder
      .addCase(fetchOverdueAdminTasksThunk.pending, (state) => {
        state.overdueAdminTasksLoading = true;
        state.overdueAdminTasksError = null;
      })
      .addCase(fetchOverdueAdminTasksThunk.fulfilled, (state, action) => {
        state.overdueAdminTasks = action.payload;
        state.overdueAdminTasksLoading = false;
      })
      .addCase(fetchOverdueAdminTasksThunk.rejected, (state, action) => {
        state.overdueAdminTasksLoading = false;
        state.overdueAdminTasksError = action.payload as string;
      });
  },
});

export const { clearError, clearAllErrors } = analyticsSlice.actions;
export default analyticsSlice.reducer;

