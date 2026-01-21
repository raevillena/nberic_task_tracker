// Domain entity types matching Sequelize models

export enum UserRole {
  MANAGER = 'Manager',
  RESEARCHER = 'Researcher',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskType {
  RESEARCH = 'research',
  ADMIN = 'admin',
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  progress: number; // 0-100
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  createdBy?: User;
  studies?: Study[];
}

export interface Study {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  progress: number; // 0-100
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  project?: Project;
  createdBy?: User;
  tasks?: Task[];
}

export interface Task {
  id: number;
  taskType: TaskType;
  studyId: number | null; // Nullable for admin tasks
  projectId: number | null; // Optional project reference for admin tasks
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: number | null; // Legacy field, kept for backward compatibility
  createdById: number;
  completedAt: Date | null;
  completedById: number | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  study?: Study | null; // Nullable for admin tasks
  project?: Project | null; // Optional project relation for admin tasks
  assignedTo?: User; // Legacy relation
  assignedResearchers?: User[]; // Many-to-many assignments
  createdBy?: User;
  completedBy?: User;
  complianceFlags?: ComplianceFlag[]; // Compliance flags for this task
}

export enum TaskRequestType {
  COMPLETION = 'completion',
  REASSIGNMENT = 'reassignment',
}

export enum TaskRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface TaskRequest {
  id: number;
  taskId: number;
  requestedById: number;
  requestType: TaskRequestType;
  requestedAssignedToId: number | null;
  status: TaskRequestStatus;
  reviewedById: number | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  task?: Task;
  requestedBy?: User;
  requestedAssignedTo?: User;
  reviewedBy?: User;
}

export enum ComplianceFlagStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export enum ComplianceFlagSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ComplianceFlag {
  id: number;
  taskId: number;
  flagType: string; // e.g., 'data_quality', 'protocol_violation', 'missing_documentation'
  severity: ComplianceFlagSeverity;
  status: ComplianceFlagStatus;
  description: string;
  raisedById: number;
  resolvedById: number | null;
  resolvedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  task?: Task;
  raisedBy?: User;
  resolvedBy?: User;
}

