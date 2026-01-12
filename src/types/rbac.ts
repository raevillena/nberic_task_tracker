// RBAC types

import { UserRole } from './entities';

export type Resource = 'project' | 'study' | 'task';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'complete' | 'assign';

export interface PermissionMatrix {
  [resource: string]: {
    [action: string]: UserRole[];
  };
}

export interface RBACOptions {
  resource: Resource;
  action: Action;
  requireOwnership?: boolean; // Check resource assignment for Researchers
}

export interface UserContext {
  id: number;
  email: string;
  role: UserRole;
}

