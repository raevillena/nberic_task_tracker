// Project service - business logic for projects

import { Project, Study, User } from '@/lib/db/models';
import { UserRole } from '@/types/entities';
import { CreateProjectRequest, UpdateProjectRequest } from '@/types/api';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError } from '@/lib/utils/errors';
import { Task } from '@/lib/db/models';

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
      const assignedTasks = await Task.findAll({
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

      const assignedProjectIds = new Set(
        assignedTasks.map((t) => (t.study as Study).projectId)
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
      const studyIds = project.studies?.map((s) => s.id) || [];
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
   * Delete a project
   */
  async deleteProject(
    projectId: number,
    user: UserContext
  ): Promise<void> {
    // Only managers can delete projects
    if (user.role !== UserRole.MANAGER) {
      throw new PermissionError('Only managers can delete projects');
    }

    const project = await Project.findByPk(projectId);
    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }

    await project.destroy();
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
