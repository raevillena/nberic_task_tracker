// Project service - business logic for projects

import { Project, Study, User, Task, ProjectRead, TaskAssignment } from '@/lib/db/models';
import { UserRole } from '@/types/entities';
import { CreateProjectRequest, UpdateProjectRequest } from '@/types/api';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError } from '@/lib/utils/errors';
import { Op } from 'sequelize';
import { sequelize } from '@/lib/db/connection';

/**
 * Project Service Class
 */
export class ProjectService {
  /**
   * Get all projects (filtered by role)
   */
  async getAllProjects(user: UserContext): Promise<Project[]> {
    const projects = await Project.findAll({
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Researchers can only see projects with assigned tasks
    if (user.role === UserRole.RESEARCHER) {
      // Get all studies for these projects
      const projectIds = projects.map((p) => p.id);
      const studies = await Study.findAll({
        where: { projectId: projectIds },
        attributes: ['id', 'projectId'],
      });

      const studyIds = studies.map((s) => s.id);
      
      // Get tasks assigned via assignedToId (legacy)
      const tasksByAssignedTo = await Task.findAll({
        where: {
          studyId: studyIds,
          assignedToId: user.id,
        },
        attributes: ['studyId'],
        include: [
          {
            model: Study,
            as: 'study',
            attributes: ['projectId'],
          },
        ],
      });

      // Get tasks assigned via TaskAssignment (many-to-many)
      let tasksByAssignment: Task[] = [];
      try {
        const assignedTaskIds = await TaskAssignment.findAll({
          where: { userId: user.id },
          attributes: ['taskId'],
          include: [
            {
              model: Task,
              as: 'task',
              attributes: ['studyId'],
              where: { studyId: studyIds },
              include: [
                {
                  model: Study,
                  as: 'study',
                  attributes: ['projectId'],
                },
              ],
            },
          ],
        }).then((assignments) => 
          assignments
            .map((a) => (a as any).task)
            .filter((t): t is Task => t !== null && t !== undefined)
        );
        tasksByAssignment = assignedTaskIds;
      } catch (error: any) {
        // If TaskAssignment table doesn't exist, just use assignedToId
        if (!error?.message?.includes('task_assignments')) {
          throw error;
        }
      }

      // Combine both assignment methods
      const allAssignedTasks = [...tasksByAssignedTo, ...tasksByAssignment];
      const assignedProjectIds = new Set(
        allAssignedTasks.map((t) => {
          // Type assertion needed because Sequelize relations aren't in the model type
          const taskData = t as any;
          return taskData.study?.projectId;
        }).filter(Boolean)
      );

      return projects.filter((project) => assignedProjectIds.has(project.id));
    }

    return projects;
  }

  /**
   * Get a single project by ID
   */
  async getProjectById(
    projectId: number,
    user: UserContext
  ): Promise<Project> {
    const project = await Project.findByPk(projectId, {
      include: [
        { model: User, as: 'createdBy' },
        {
          model: Study,
          as: 'studies',
          include: [{ model: User, as: 'createdBy' }],
        },
      ],
    });

    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    // Researchers can only access projects with assigned tasks
    if (user.role === UserRole.RESEARCHER) {
      // Type assertion needed because Sequelize relations aren't in the model type
      const projectData = project as any;
      const studyIds = projectData.studies?.map((s: any) => s.id) || [];
      if (studyIds.length === 0) {
        throw new PermissionError('You do not have access to this project');
      }

      const hasAssignedTasks = await Task.findOne({
        where: {
          studyId: studyIds,
          assignedToId: user.id,
        },
      });

      if (!hasAssignedTasks) {
        throw new PermissionError('You do not have access to this project');
      }
    }

    return project;
  }

  /**
   * Create a new project
   */
  async createProject(
    data: CreateProjectRequest,
    user: UserContext
  ): Promise<Project> {
    // Only managers can create projects
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only managers can create projects');
    }

    const project = await Project.create({
      name: data.name,
      description: data.description,
      createdById: user.id,
      progress: 0,
    });

    // Reload with associations to ensure all data is loaded
    const reloadedProject = await project.reload({
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] }],
    });

    // Ensure the project has an ID
    if (!reloadedProject.id) {
      throw new Error('Project was created but ID is missing');
    }

    return reloadedProject;
  }

  /**
   * Update a project
   */
  async updateProject(
    projectId: number,
    data: UpdateProjectRequest,
    user: UserContext
  ): Promise<Project> {
    // Only managers can update projects
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only managers can update projects');
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    await project.update({
      name: data.name,
      description: data.description,
    });

    return project.reload({
      include: [{ model: User, as: 'createdBy' }],
    });
  }

  /**
   * Delete a project (soft delete - moves to trash)
   */
  async deleteProject(
    projectId: number,
    user: UserContext
  ): Promise<void> {
    // Only managers can delete projects
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only managers can delete projects');
    }

    const project = await Project.scope('withDeleted').findByPk(projectId);
    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    const deletedAt = new Date();

    // Get all study IDs for this project before deleting them
    const studyIds = await Study.findAll({
      attributes: ['id'],
      where: { projectId: projectId },
      raw: true,
    }).then((studies: any[]) => studies.map((s) => s.id));

    // Soft delete - set deletedAt timestamp
    await project.update({ deletedAt });

    // Cascade: Soft delete all studies in this project
    if (studyIds.length > 0) {
      await Study.update(
        { deletedAt },
        {
          where: {
            projectId: projectId,
            deletedAt: null, // Only update studies that aren't already deleted
          },
        }
      );

      // Cascade: Soft delete all tasks in studies of this project
      await Task.update(
        { deletedAt },
        {
          where: {
            studyId: { [Op.in]: studyIds },
            deletedAt: null, // Only update tasks that aren't already deleted
          },
        }
      );
    }
  }

  /**
   * Restore a project from trash
   */
  async restoreProject(
    projectId: number,
    user: UserContext
  ): Promise<Project> {
    // Only managers can restore projects
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only managers can restore projects');
    }

    const project = await Project.scope('withDeleted').findByPk(projectId);
    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    if (!project.deletedAt) {
      throw new Error('Project is not in trash');
    }

    // Restore - clear deletedAt
    await project.update({ deletedAt: null });
    
    // Cascade: Restore all studies in this project (and their tasks)
    // Note: We restore studies/tasks even if they were individually deleted
    // This ensures consistency - if a project is restored, its children are restored too
    // Use 'withDeleted' scope to update deleted studies
    await Study.scope('withDeleted').update(
      { deletedAt: null },
      {
        where: {
          projectId: projectId,
        },
      }
    );

    // Cascade: Restore all tasks in studies of this project
    // Get study IDs using 'withDeleted' scope to include deleted studies
    const studyIds = await Study.scope('withDeleted').findAll({
      attributes: ['id'],
      where: { projectId: projectId },
      raw: true,
    }).then((studies: any[]) => studies.map((s) => s.id));

    if (studyIds.length > 0) {
      // Use 'withDeleted' scope to update deleted tasks
      await Task.scope('withDeleted').update(
        { deletedAt: null },
        {
          where: {
            studyId: { [Op.in]: studyIds },
          },
        }
      );
    }

    await project.reload({ include: [{ model: User, as: 'createdBy' }] });
    return project;
  }

  /**
   * Get all projects in trash (deleted projects)
   */
  async getTrashProjects(user: UserContext): Promise<Project[]> {
    // Only managers can view trash
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only managers can view trash');
    }

    const projects = await Project.scope('onlyDeleted').findAll({
      include: [
        { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
      order: [['deletedAt', 'DESC']],
    });

    return projects;
  }
}

// Export singleton instance
export const projectService = new ProjectService();

// Also export individual functions for backward compatibility
export const getProjects = (user: UserContext) => projectService.getAllProjects(user);
export const getProjectById = (projectId: number, user: UserContext) => projectService.getProjectById(projectId, user);
export const createProject = (data: CreateProjectRequest, user: UserContext) => projectService.createProject(data, user);
export const updateProject = (projectId: number, data: UpdateProjectRequest, user: UserContext) => projectService.updateProject(projectId, data, user);
export const deleteProject = (projectId: number, user: UserContext) => projectService.deleteProject(projectId, user);
export const restoreProject = (projectId: number, user: UserContext) => projectService.restoreProject(projectId, user);
export const getTrashProjects = (user: UserContext) => projectService.getTrashProjects(user);

/**
 * Mark a project as read for a user
 */
export async function markProjectAsRead(projectId: number, userId: number): Promise<void> {
  try {
    await ProjectRead.findOrCreate({
      where: {
        projectId,
        userId,
      },
      defaults: {
        projectId,
        userId,
        readAt: new Date(),
      },
    });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      await ProjectRead.update(
        { readAt: new Date() },
        {
          where: {
            projectId,
            userId,
          },
        }
      );
    } else {
      throw error;
    }
  }
}

/**
 * Get unread project count for a researcher
 * Counts projects with assigned tasks that haven't been read yet
 */
export async function getUnreadProjectCount(userId: number): Promise<number> {
  try {
    // IMPORTANT: This function must use the SAME logic as getAllProjects() for researchers
    // to ensure badge counts match what's actually visible in the dashboard
    
    // Get all non-deleted projects (matching getAllProjects)
    const projects = await Project.findAll({
      attributes: ['id'],
    });

    if (projects.length === 0) {
      return 0;
    }

    const projectIds = projects.map((p) => p.id);

    // Get all studies for these projects (matching getAllProjects)
    const studies = await Study.findAll({
      where: { projectId: projectIds },
      attributes: ['id', 'projectId'],
    });

    if (studies.length === 0) {
      return 0;
    }

    const studyIds = studies.map((s) => s.id);

    // Get tasks assigned via assignedToId (legacy) - matching getAllProjects logic
    const tasksByAssignedTo = await Task.findAll({
      where: {
        studyId: studyIds,
        assignedToId: userId,
      },
      attributes: ['studyId'],
      include: [
        {
          model: Study,
          as: 'study',
          attributes: ['projectId'],
        },
      ],
    });

    // Get tasks assigned via TaskAssignment (many-to-many) - matching getAllProjects logic
    let tasksByAssignment: Task[] = [];
    try {
      const assignedTaskIds = await TaskAssignment.findAll({
        where: { userId },
        attributes: ['taskId'],
        include: [
          {
            model: Task,
            as: 'task',
            attributes: ['studyId'],
            where: { studyId: studyIds },
            include: [
              {
                model: Study,
                as: 'study',
                attributes: ['projectId'],
              },
            ],
          },
        ],
      }).then((assignments) => 
        assignments
          .map((a) => (a as any).task)
          .filter((t): t is Task => t !== null && t !== undefined)
      );
      tasksByAssignment = assignedTaskIds;
    } catch (error: any) {
      // If TaskAssignment table doesn't exist, just use assignedToId
      if (!error?.message?.includes('task_assignments')) {
        throw error;
      }
    }

    // Combine both assignment methods - matching getAllProjects logic
    const allAssignedTasks = [...tasksByAssignedTo, ...tasksByAssignment];

    if (allAssignedTasks.length === 0) {
      return 0;
    }

    // Get project IDs from assigned tasks (matching getAllProjects logic exactly)
    const assignedProjectIds = new Set(
      allAssignedTasks.map((t) => {
        // Type assertion needed because Sequelize relations aren't in the model type
        const taskData = t as any;
        return taskData.study?.projectId;
      }).filter(Boolean)
    );

    // Filter to only projects that would appear in the dashboard (matching getAllProjects)
    const visibleProjectIds = projectIds.filter((id) => assignedProjectIds.has(id));

    if (visibleProjectIds.length === 0) {
      return 0;
    }

    // Get read project IDs
    const readProjects = await ProjectRead.findAll({
      where: {
        userId,
        projectId: { [Op.in]: visibleProjectIds },
      },
      attributes: ['projectId'],
      raw: true,
    });
    const readProjectIds = new Set(readProjects.map((r: any) => r.projectId || r.project_id).filter(Boolean));

    // Count unread projects (only projects visible in dashboard)
    const unreadCount = visibleProjectIds.filter((id) => !readProjectIds.has(id)).length;
    
    return unreadCount;
  } catch (error: any) {
    // If tables don't exist yet, return 0
    console.error('[getUnreadProjectCount] Error:', error?.message || error);
    return 0;
  }
}

/**
 * Get read status for multiple projects for a user
 * Returns a map of projectId -> boolean (true if read)
 */
export async function getProjectsReadStatus(projectIds: number[], userId: number): Promise<Record<number, boolean>> {
  try {
    const projectReads = await ProjectRead.findAll({
      where: {
        projectId: { [Op.in]: projectIds },
        userId,
      },
      attributes: ['projectId'],
      raw: true,
    });

    const readProjectIds = new Set(projectReads.map((r: any) => r.projectId || r.project_id).filter(Boolean));
    const statusMap: Record<number, boolean> = {};
    
    projectIds.forEach((projectId) => {
      statusMap[projectId] = readProjectIds.has(projectId);
    });

    return statusMap;
  } catch (error) {
    // If ProjectRead table doesn't exist yet, return all false
    const statusMap: Record<number, boolean> = {};
    projectIds.forEach((projectId) => {
      statusMap[projectId] = false;
    });
    return statusMap;
  }
}
