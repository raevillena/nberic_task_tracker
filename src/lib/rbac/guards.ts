// RBAC guard functions

import { UserRole } from '@/types/entities';
import { RBACOptions, UserContext } from '@/types/rbac';
import { hasPermission } from './permissions';
import { PermissionError, NotFoundError } from '@/lib/utils/errors';
import { Task, Study, Project, TaskAssignment, User } from '@/lib/db/models';

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
      // Try to load task with assignedResearchers, fallback if table doesn't exist
      let task: Task | null;
      try {
        task = await Task.findByPk(resourceId, {
          include: [
            {
              model: User,
              as: 'assignedResearchers',
              through: { attributes: [] },
            },
          ],
        });
      } catch (findError: any) {
        // If error is about missing task_assignments table, retry without assignedResearchers include
        if (findError?.message?.includes('task_assignments') || findError?.name === 'SequelizeDatabaseError') {
          task = await Task.findByPk(resourceId);
        } else {
          throw findError;
        }
      }

      if (!task) {
        throw new NotFoundError(`Task ${resourceId} not found`);
      }

      // Check legacy assignedToId first
      if (task.assignedToId === userId) {
        return true;
      }

      // Check many-to-many assignments (if loaded)
      const taskWithResearchers = task as Task & { assignedResearchers?: Array<{ id: number }> };
      if (taskWithResearchers.assignedResearchers !== undefined) {
        // assignedResearchers was loaded (even if empty array)
        const researcherIds = taskWithResearchers.assignedResearchers.map(u => u.id);
        const hasAccess = researcherIds.includes(userId);
        // If found in assignedResearchers, return true immediately
        if (hasAccess) {
          return true;
        }
        // If not found but association was loaded, continue to check TaskAssignment as fallback
        // (in case of timing issues where assignment was just created but association not refreshed)
      }

      // If assignedResearchers wasn't loaded (table doesn't exist or wasn't included), also check TaskAssignment directly
      try {
        // Also check all assignments for this task to see what's in the table
        const allAssignments = await TaskAssignment.findAll({
          where: { taskId: resourceId },
        });
        const assignment = allAssignments.find(a => a.userId === userId);
        return assignment !== null;
      } catch (assignmentError: any) {
        // If table doesn't exist, just return false (only legacy assignedToId was checked)
        return false;
      }
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

