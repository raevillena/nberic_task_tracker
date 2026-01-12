// RBAC permission definitions

import { UserRole } from '@/types/entities';
import { PermissionMatrix, Resource, Action } from '@/types/rbac';

/**
 * Permission matrix defining which roles can perform which actions on which resources
 */
export const PERMISSIONS: PermissionMatrix = {
  project: {
    create: [UserRole.MANAGER],
    read: [UserRole.MANAGER, UserRole.RESEARCHER], // Researcher: assigned only
    update: [UserRole.MANAGER],
    delete: [UserRole.MANAGER],
  },
  study: {
    create: [UserRole.MANAGER],
    read: [UserRole.MANAGER, UserRole.RESEARCHER], // Researcher: assigned only
    update: [UserRole.MANAGER],
    delete: [UserRole.MANAGER],
  },
  task: {
    create: [UserRole.MANAGER],
    read: [UserRole.MANAGER, UserRole.RESEARCHER], // Researcher: assigned only
    update: [UserRole.MANAGER, UserRole.RESEARCHER], // Researcher: limited fields
    complete: [UserRole.MANAGER], // CRITICAL: Only Manager
    assign: [UserRole.MANAGER],
    delete: [UserRole.MANAGER],
  },
};

/**
 * Check if a user role has permission for a resource action
 */
export function hasPermission(
  userRole: UserRole,
  resource: Resource,
  action: Action
): boolean {
  const allowedRoles = PERMISSIONS[resource]?.[action];
  if (!allowedRoles) {
    return false;
  }
  return allowedRoles.includes(userRole);
}

