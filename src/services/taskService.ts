// Task service - business logic for tasks

import { Transaction } from 'sequelize';
import { Task, Study, User, Project } from '@/lib/db/models';
import { TaskStatus, TaskPriority, UserRole } from '@/types/entities';
import { CreateTaskRequest, UpdateTaskRequest } from '@/types/api';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { progressService } from './progressService';

/**
 * Get all tasks (with RBAC filtering)
 */
export async function getAllTasks(user: UserContext): Promise<Task[]> {
  // Build query
  const where: any = {};

  // Researchers can only see assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    where.assignedToId = user.id;
  }

  return Task.findAll({
    where,
    include: [
      { model: User, as: 'assignedTo', attributes: ['id', 'email', 'firstName', 'lastName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
      {
        model: Study,
        as: 'study',
        attributes: ['id', 'name', 'projectId'],
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Get tasks for a study with optional filtering
 */
export async function getTasksByStudy(
  studyId: number,
  user: UserContext
): Promise<Task[]> {
  // Verify study exists
  const study = await Study.findByPk(studyId);
  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  // Build query
  const where: any = { studyId };

  // Researchers can only see assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    where.assignedToId = user.id;
  }

  return Task.findAll({
    where,
    include: [
      { model: User, as: 'assignedTo', attributes: ['id', 'email', 'firstName', 'lastName'] },
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    ],
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Get a single task by ID
 */
export async function getTaskById(
  taskId: number,
  user: UserContext
): Promise<Task> {
  const task = await Task.findByPk(taskId, {
    include: [
      { model: Study, as: 'study', include: [{ model: User, as: 'createdBy' }] },
      { model: User, as: 'assignedTo' },
      { model: User, as: 'createdBy' },
      { model: User, as: 'completedBy' },
    ],
  });

  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Researchers can only access assigned tasks
  if (user.role === UserRole.RESEARCHER && task.assignedToId !== user.id) {
    throw new PermissionError('You do not have access to this task');
  }

  return task;
}

/**
 * Create a new task
 */
export async function createTask(
  studyId: number,
  data: CreateTaskRequest,
  user: UserContext,
  transaction?: Transaction
): Promise<Task> {
  // Verify study exists
  const study = await Study.findByPk(studyId, { transaction });
  if (!study) {
    throw new NotFoundError(`Study ${studyId} not found`);
  }

  // Only managers can create tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can create tasks');
  }

  // Validate assigned user if provided
  if (data.assignedToId) {
    const assignedUser = await User.findByPk(data.assignedToId, { transaction });
    if (!assignedUser) {
      throw new NotFoundError(`User ${data.assignedToId} not found`);
    }
    if (assignedUser.role !== UserRole.RESEARCHER) {
      throw new ValidationError('Tasks can only be assigned to researchers');
    }
  }

  const task = await Task.create(
    {
      studyId,
      name: data.name,
      description: data.description,
      priority: data.priority || TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      assignedToId: data.assignedToId || null,
      createdById: user.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    { transaction }
  );

  // Update progress chain (uses same transaction if provided)
  await progressService.updateProgressChain(task.studyId, transaction);

  return task.reload({
    include: [
      { model: User, as: 'assignedTo' },
      { model: User, as: 'createdBy' },
    ],
    transaction,
  });
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: number,
  data: UpdateTaskRequest,
  user: UserContext
): Promise<Task> {
  const task = await Task.findByPk(taskId);
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Researchers can only update their assigned tasks (limited fields)
  if (user.role === UserRole.RESEARCHER) {
    if (task.assignedToId !== user.id) {
      throw new PermissionError('You do not have access to this task');
    }
    // Researchers cannot change status to completed, assign, or change priority
    if (data.status === TaskStatus.COMPLETED) {
      throw new PermissionError('Researchers cannot complete tasks');
    }
    if (data.assignedToId !== undefined) {
      throw new PermissionError('Researchers cannot assign tasks');
    }
  }

  // Validate assigned user if provided
  if (data.assignedToId !== undefined && data.assignedToId !== null) {
    const assignedUser = await User.findByPk(data.assignedToId);
    if (!assignedUser) {
      throw new NotFoundError(`User ${data.assignedToId} not found`);
    }
    if (assignedUser.role !== UserRole.RESEARCHER) {
      throw new ValidationError('Tasks can only be assigned to researchers');
    }
  }

  // Update task
  await task.update({
    name: data.name,
    description: data.description,
    status: data.status,
    priority: data.priority,
    assignedToId: data.assignedToId,
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
  });

  // Update progress chain if status changed
  if (data.status) {
    await progressService.updateProgressChain(task.studyId);
  }

  return task.reload({
    include: [
      { model: User, as: 'assignedTo' },
      { model: User, as: 'createdBy' },
      { model: User, as: 'completedBy' },
    ],
  });
}

/**
 * Complete a task (Manager only)
 * Uses transaction to ensure progress calculation is atomic
 */
export async function completeTask(
  taskId: number,
  user: UserContext,
  transaction?: Transaction
): Promise<Task> {
  // Only managers can complete tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can complete tasks');
  }

  const task = await Task.findByPk(taskId, { transaction });
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  if (task.status === TaskStatus.COMPLETED) {
    throw new ValidationError('Task is already completed');
  }

  if (task.status === TaskStatus.CANCELLED) {
    throw new ValidationError('Cannot complete a cancelled task');
  }

  // Update task
  await task.update(
    {
      status: TaskStatus.COMPLETED,
      completedAt: new Date(),
      completedById: user.id,
    },
    { transaction }
  );

  // Update progress chain (uses same transaction if provided)
  await progressService.updateProgressChain(task.studyId, transaction);

  return task.reload({
    include: [
      { model: User, as: 'assignedTo' },
      { model: User, as: 'createdBy' },
      { model: User, as: 'completedBy' },
    ],
    transaction,
  });
}

/**
 * Assign a task to a researcher (Manager only)
 */
export async function assignTask(
  taskId: number,
  assignedToId: number,
  user: UserContext
): Promise<Task> {
  // Only managers can assign tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can assign tasks');
  }

  const task = await Task.findByPk(taskId);
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Verify assigned user exists and is a researcher
  const assignedUser = await User.findByPk(assignedToId);
  if (!assignedUser) {
    throw new NotFoundError(`User ${assignedToId} not found`);
  }
  if (assignedUser.role !== UserRole.RESEARCHER) {
    throw new ValidationError('Tasks can only be assigned to researchers');
  }

  await task.update({ assignedToId });

  return task.reload({
    include: [
      { model: User, as: 'assignedTo' },
      { model: User, as: 'createdBy' },
    ],
  });
}

/**
 * Delete a task (Manager only)
 */
export async function deleteTask(
  taskId: number,
  user: UserContext,
  transaction?: Transaction
): Promise<void> {
  // Only managers can delete tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can delete tasks');
  }

  const task = await Task.findByPk(taskId, { transaction });
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  const studyId = task.studyId;

  await task.destroy({ transaction });

  // Update progress chain (uses same transaction if provided)
  await progressService.updateProgressChain(studyId, transaction);
}
