// API request and response types

import { User, Project, Study, Task, UserRole, TaskStatus, TaskPriority } from './entities';

// Auth API Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
}

// Project API Types
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

export interface ProjectResponse extends Project {}

// Study API Types
export interface CreateStudyRequest {
  name: string;
  description?: string;
}

export interface UpdateStudyRequest {
  name?: string;
  description?: string;
}

export interface StudyResponse extends Study {}

// Task API Types
export interface CreateTaskRequest {
  taskType?: 'research' | 'admin'; // Optional, defaults to 'research' for backward compatibility
  projectId?: number; // Required for admin tasks, optional for research tasks
  name: string;
  description?: string;
  priority?: TaskPriority;
  assignedToId?: number;
  dueDate?: string; // ISO date string
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: number | null;
  dueDate?: string | null;
}

export interface TaskResponse extends Task {}

// Progress API Types
export interface ProgressResponse {
  taskId?: number;
  studyId: number;
  projectId: number;
  taskProgress?: number;
  studyProgress: number;
  projectProgress: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Analytics API Types
export interface ResearcherProductivityResponse {
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

export interface ResearcherWorkloadResponse {
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  activeTaskCount: number;
  pendingCount: number;
  inProgressCount: number;
}

export interface ProjectProgressResponse {
  projectId: number;
  projectName: string;
  cachedProgress: number;
  calculatedProgress: number;
  studyCount: number;
  totalTasks: number;
  completedTasks: number;
}

export interface TaskPriorityDistributionResponse {
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

export interface HighPriorityBacklogResponse {
  taskId: number;
  taskName: string;
  priority: TaskPriority;
  status: TaskStatus;
  ageInDays: number;
  dueDate: Date | null;
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

export interface StudyProgressDistributionResponse {
  progressRange: string;
  studyCount: number;
}

export interface ComplianceFlagRateResponse {
  totalTasks: number;
  tasksWithFlags: number;
  totalOpenFlags: number;
  flagRate: number;
}

export interface AverageCompletionTimeResponse {
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  avgHoursToComplete: number;
  minHoursToComplete: number;
  maxHoursToComplete: number;
  completedCount: number;
}

export interface OnTimeCompletionRateResponse {
  researcherId: number;
  researcher: {
    id: number;
    email: string;
    name: string;
  };
  totalWithDueDate: number;
  onTimeCount: number;
  onTimeRate: number;
}

export interface ProjectVelocityResponse {
  projectId: number;
  projectName: string;
  velocity: Array<{ period: string; count: number }>;
}

export interface ProjectHealthScoreResponse {
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

export interface StudyCompletionForecastResponse {
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

export interface ComplianceFlagTrendsResponse {
  period: string;
  flagCount: number;
}

export interface ComplianceFlagResolutionTimeResponse {
  avgHoursToResolve: number;
  minHoursToResolve: number;
  maxHoursToResolve: number;
  resolvedCount: number;
}
