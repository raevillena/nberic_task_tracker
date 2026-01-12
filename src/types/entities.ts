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
  studyId: number;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToId: number | null;
  createdById: number;
  completedAt: Date | null;
  completedById: number | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  study?: Study;
  assignedTo?: User;
  createdBy?: User;
  completedBy?: User;
}

