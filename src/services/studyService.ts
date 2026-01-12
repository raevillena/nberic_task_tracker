// Study service - business logic for studies

import { Study, Project, Task, User } from '@/lib/db/models';
import { UserRole } from '@/types/entities';
import { CreateStudyRequest, UpdateStudyRequest } from '@/types/api';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError } from '@/lib/utils/errors';
import { progressService } from './progressService';

/**
 * Get studies for a project
 */
export async function getStudiesByProject(
  projectId: number,
  user: UserContext
): Promise<Study[]> {
  // Verify project exists
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  const studies = await Study.findAll({
    where: { projectId },
    include: [
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  // Researchers can only see studies with assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    const studyIds = studies.map((s) => s.id);
    const assignedTasks = await Task.findAll({
      where: {
        studyId: studyIds,
        assignedToId: user.id,
      },
      attributes: ['studyId'],
      group: ['studyId'],
    });

    const assignedStudyIds = new Set(assignedTasks.map((t) => t.studyId));
    return studies.filter((study) => assignedStudyIds.has(study.id));
  }

  return studies;
}

/**
 * Get a single study by ID
 */
export async function getStudyById(
  studyId: number,
  user: UserContext
): Promise<Study> {
  const study = await Study.findByPk(studyId, {
    include: [
      { model: Project, as: 'project' },
      { model: User, as: 'createdBy' },
    ],
  });

  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  // Researchers can only access studies with assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    const hasAssignedTasks = await Task.findOne({
      where: {
        studyId: study.id,
        assignedToId: user.id,
      },
    });

    if (!hasAssignedTasks) {
      throw new PermissionError('You do not have access to this study');
    }
  }

  return study;
}

/**
 * Create a new study
 */
export async function createStudy(
  projectId: number,
  data: CreateStudyRequest,
  user: UserContext
): Promise<Study> {
  // Only managers can create studies
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can create studies');
  }

  // Verify project exists
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  const study = await Study.create({
    projectId,
    name: data.name,
    description: data.description,
    createdById: user.id,
    progress: 0,
  });

  // Update project progress (new study with 0 progress)
  await progressService.updateProgressChain(study.id);

  // Reload with associations to ensure all data is loaded
  const reloadedStudy = await study.reload({
    include: [
      { model: Project, as: 'project' },
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    ],
  });

  // Ensure the study has an ID and projectId
  if (!reloadedStudy.id) {
    throw new Error('Study was created but ID is missing');
  }
  if (!reloadedStudy.projectId) {
    throw new Error('Study was created but projectId is missing');
  }

  return reloadedStudy;
}

/**
 * Update a study
 */
export async function updateStudy(
  studyId: number,
  data: UpdateStudyRequest,
  user: UserContext
): Promise<Study> {
  // Only managers can update studies
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can update studies');
  }

  const study = await Study.findByPk(studyId);
  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  await study.update({
    name: data.name,
    description: data.description,
  });

  return study.reload({
    include: [
      { model: Project, as: 'project' },
      { model: User, as: 'createdBy' },
    ],
  });
}

/**
 * Delete a study
 */
export async function deleteStudy(
  studyId: number,
  user: UserContext
): Promise<void> {
  // Only managers can delete studies
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can delete studies');
  }

  const study = await Study.findByPk(studyId);
  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  const projectId = study.projectId;

  await study.destroy();

  // Update project progress (study deleted, recalculate)
  await progressService.recalculateProjectProgress(projectId);
}
