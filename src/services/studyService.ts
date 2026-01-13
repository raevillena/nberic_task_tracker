// Study service - business logic for studies

import { Study, Project, Task, User, StudyRead, TaskAssignment } from '@/lib/db/models';
import { UserRole } from '@/types/entities';
import { CreateStudyRequest, UpdateStudyRequest } from '@/types/api';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError } from '@/lib/utils/errors';
import { progressService } from './progressService';
import { Op } from 'sequelize';
import { sequelize } from '@/lib/db/connection';

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
    
    // Get tasks assigned via assignedToId (legacy)
    const tasksByAssignedTo = await Task.findAll({
      where: {
        studyId: studyIds,
        assignedToId: user.id,
      },
      attributes: ['studyId'],
      group: ['studyId'],
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
    const assignedStudyIds = new Set(allAssignedTasks.map((t) => t.studyId));
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
 * Delete a study (soft delete - moves to trash)
 */
export async function deleteStudy(
  studyId: number,
  user: UserContext
): Promise<void> {
  // Only managers can delete studies
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can delete studies');
  }

  const study = await Study.scope('withDeleted').findByPk(studyId);
  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  const deletedAt = new Date();

  // Soft delete - set deletedAt timestamp
  await study.update({ deletedAt });

  // Cascade: Soft delete all tasks in this study
  await Task.update(
    { deletedAt },
    {
      where: {
        studyId: studyId,
        deletedAt: null, // Only update tasks that aren't already deleted
      },
    }
  );

  // Update project progress (study deleted, recalculate)
  await progressService.recalculateProjectProgress(study.projectId);
}

/**
 * Restore a study from trash
 */
export async function restoreStudy(
  studyId: number,
  user: UserContext
): Promise<Study> {
  // Only managers can restore studies
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can restore studies');
  }

  const study = await Study.scope('withDeleted').findByPk(studyId);
  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  if (!study.deletedAt) {
    throw new Error('Study is not in trash');
  }

  // Restore - clear deletedAt
  await study.update({ deletedAt: null });
  
  // Cascade: Restore all tasks in this study
  // Note: We restore tasks even if they were individually deleted
  // This ensures consistency - if a study is restored, its tasks are restored too
  // Use 'withDeleted' scope to update deleted tasks
  await Task.scope('withDeleted').update(
    { deletedAt: null },
    {
      where: {
        studyId: studyId,
      },
    }
  );

  await study.reload({ include: [{ model: Project, as: 'project' }, { model: User, as: 'createdBy' }] });
  
  // Update project progress after restoration
  await progressService.recalculateProjectProgress(study.projectId);
  
  return study;
}

/**
 * Get all studies in trash (deleted studies)
 */
export async function getTrashStudies(user: UserContext): Promise<Study[]> {
  // Only managers can view trash
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can view trash');
  }

  const studies = await Study.scope('onlyDeleted').findAll({
    include: [
      { model: Project, as: 'project', attributes: ['id', 'name'] },
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    ],
    order: [['deletedAt', 'DESC']],
  });

  return studies;
}

/**
 * Mark a study as read for a user
 */
export async function markStudyAsRead(studyId: number, userId: number): Promise<void> {
  try {
    await StudyRead.findOrCreate({
      where: {
        studyId,
        userId,
      },
      defaults: {
        studyId,
        userId,
        readAt: new Date(),
      },
    });
  } catch (error: any) {
    if (error?.name === 'SequelizeUniqueConstraintError') {
      await StudyRead.update(
        { readAt: new Date() },
        {
          where: {
            studyId,
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
 * Get unread study count for a researcher
 * Counts studies with assigned tasks that haven't been read yet
 */
export async function getUnreadStudyCount(userId: number): Promise<number> {
  try {
    // IMPORTANT: This function must use the SAME logic as getStudiesByProject() for researchers
    // to ensure badge counts match what's actually visible in the dashboard
    
    // Get all non-deleted studies
    const studies = await Study.findAll({
      attributes: ['id'],
    });

    if (studies.length === 0) {
      return 0;
    }

    const studyIds = studies.map((s) => s.id);

    // Get tasks assigned via assignedToId (legacy) - matching getStudiesByProject logic
    const tasksByAssignedTo = await Task.findAll({
      where: {
        studyId: studyIds,
        assignedToId: userId,
      },
      attributes: ['studyId'],
      group: ['studyId'],
    });

    // Get tasks assigned via TaskAssignment (many-to-many) - matching getStudiesByProject logic
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

    // Combine both assignment methods - matching getStudiesByProject logic
    const allAssignedTasks = [...tasksByAssignedTo, ...tasksByAssignment];

    if (allAssignedTasks.length === 0) {
      return 0;
    }

    // Get study IDs from assigned tasks (matching getStudiesByProject logic exactly)
    const assignedStudyIds = new Set(allAssignedTasks.map((t) => t.studyId));

    // Filter to only studies that would appear in the dashboard (matching getStudiesByProject)
    const visibleStudyIds = studyIds.filter((id) => assignedStudyIds.has(id));

    if (visibleStudyIds.length === 0) {
      return 0;
    }

    // Get read study IDs
    const readStudies = await StudyRead.findAll({
      where: {
        userId,
        studyId: { [Op.in]: visibleStudyIds },
      },
      attributes: ['studyId'],
      raw: true,
    });
    const readStudyIds = new Set(readStudies.map((r: any) => r.studyId || r.study_id).filter(Boolean));

    // Count unread studies (only studies visible in dashboard)
    return visibleStudyIds.filter((id) => !readStudyIds.has(id)).length;
  } catch (error: any) {
    // If tables don't exist yet, return 0
    console.error('[getUnreadStudyCount] Error:', error?.message || error);
    return 0;
  }
}

/**
 * Get read status for multiple studies for a user
 * Returns a map of studyId -> boolean (true if read)
 */
export async function getStudiesReadStatus(studyIds: number[], userId: number): Promise<Record<number, boolean>> {
  try {
    const studyReads = await StudyRead.findAll({
      where: {
        studyId: { [Op.in]: studyIds },
        userId,
      },
      attributes: ['studyId'],
      raw: true,
    });

    const readStudyIds = new Set(studyReads.map((r: any) => r.studyId || r.study_id).filter(Boolean));
    const statusMap: Record<number, boolean> = {};
    
    studyIds.forEach((studyId) => {
      statusMap[studyId] = readStudyIds.has(studyId);
    });

    return statusMap;
  } catch (error) {
    // If StudyRead table doesn't exist yet, return all false
    const statusMap: Record<number, boolean> = {};
    studyIds.forEach((studyId) => {
      statusMap[studyId] = false;
    });
    return statusMap;
  }
}
