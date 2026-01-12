// RBAC guard functions

import { UserRole } from '@/types/entities';
import { RBACOptions, UserContext } from '@/types/rbac';
import { hasPermission } from './permissions';
import { PermissionError, NotFoundError } from '@/lib/utils/errors';
import { Task, Study, Project } from '@/lib/db/models';

/**
 * Check if user can access a specific resource (ownership/assignment check)
 * Managers can access all resources, Researchers can only access assigned resources
 */
export async function canAccessResource(
  userId: number,
  userRole: UserRole,
  resourceType: 'project' | 'study' | 'task',
  resourceId: number
): Promise<boolean> {
  // Managers can access all resources
  if (userRole === UserRole.MANAGER) {
    return true;
  }

  // Researchers can only access assigned resources
  switch (resourceType) {
    case 'task': {
      const task = await Task.findByPk(resourceId);
      if (!task) {
        throw new NotFoundError(`Task ${resourceId} not found`);
      }
      return task.assignedToId === userId;
    }

    case 'study': {
      // Check if user has any assigned tasks in study
      const study = await Study.findByPk(resourceId, {
        include: [
          {
            model: Task,
            as: 'tasks',
            where: { assignedToId: userId },
            required: false,
          },
        ],
      });
      if (!study) {
        throw new NotFoundError(`Study ${resourceId} not found`);
      }
      // Check if any tasks are assigned to this user
      // Type assertion: tasks are included via the include option above
      const studyWithTasks = study as Study & { tasks?: Task[] };
      return (studyWithTasks.tasks?.length ?? 0) > 0;
    }

    case 'project': {
      // Check if user has any assigned tasks in project's studies
      const project = await Project.findByPk(resourceId, {
        include: [
          {
            model: Study,
            as: 'studies',
            include: [
              {
                model: Task,
                as: 'tasks',
                where: { assignedToId: userId },
                required: false,
              },
            ],
          },
        ],
      });
      if (!project) {
        throw new NotFoundError(`Project ${resourceId} not found`);
      }
      // Check if any tasks in any study are assigned to this user
      // Type assertion: studies and their tasks are included via the include option above
      const projectWithStudies = project as Project & {
        studies?: Array<Study & { tasks?: Task[] }>;
      };
      return (
        projectWithStudies.studies?.some(
          (study: Study & { tasks?: Task[] }) => (study.tasks?.length ?? 0) > 0
        ) ?? false
      );
    }

    default:
      return false;
  }
}

/**
 * RBAC guard - checks permission and optionally resource access
 * Throws PermissionError if user doesn't have permission
 */
export async function requirePermission(
  user: UserContext,
  options: RBACOptions & { resourceId?: number }
): Promise<void> {
  // Check role-based permission
  if (!hasPermission(user.role, options.resource, options.action)) {
    throw new PermissionError(
      `User role '${user.role}' cannot ${options.action} ${options.resource}`
    );
  }

  // If ownership/assignment check required (for Researchers)
  // This is automatically enabled for Researchers on read/update actions
  // Managers don't need ownership checks
  if (options.requireOwnership || (user.role === UserRole.RESEARCHER && (options.action === 'read' || options.action === 'update'))) {
    const resourceId = options.resourceId;
    if (!resourceId) {
      // If resource ID is not provided, skip ownership check
      // This allows listing endpoints to work
      return;
    }

    const canAccess = await canAccessResource(
      user.id,
      user.role,
      options.resource,
      resourceId
    );

    if (!canAccess) {
      throw new PermissionError(
        `User does not have access to ${options.resource} ${resourceId}`
      );
    }
  }
}

