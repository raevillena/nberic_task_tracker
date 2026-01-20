// Task service - business logic for tasks

import { Transaction, Op, QueryTypes } from 'sequelize';
import { Task, Study, User, Project, TaskRequest, TaskAssignment, TaskRead } from '@/lib/db/models';
import { createAndEmitNotification } from './notificationService';
import { TaskStatus, TaskPriority, UserRole, TaskRequestType, TaskRequestStatus, TaskType } from '@/types/entities';
import { CreateTaskRequest, UpdateTaskRequest } from '@/types/api';
import { UserContext } from '@/types/rbac';
import { PermissionError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { progressService } from './progressService';
import { sequelize } from '@/lib/db/connection';

/**
 * Get all tasks (with RBAC filtering)
 * Returns both research and admin tasks
 */
export async function getAllTasks(user: UserContext): Promise<Task[]> {
  // Build query
  const where: any = {};

  // Researchers can only see assigned tasks (check both legacy and many-to-many)
  if (user.role === UserRole.RESEARCHER) {
    try {
      // Get task IDs from task_assignments table
      const assignedTaskIds = await TaskAssignment.findAll({
        where: { userId: user.id },
        attributes: ['taskId'],
        raw: true,
      }).then((assignments) => assignments.map((a: any) => a.taskId));

      // Use Op.or to check both assignedToId and task_assignments
      where[Op.or] = [
        { assignedToId: user.id },
        ...(assignedTaskIds.length > 0 ? [{ id: { [Op.in]: assignedTaskIds } }] : []),
      ];
    } catch (taskAssignmentError) {
      // Fallback to legacy assignedToId only if TaskAssignment table doesn't exist
      where.assignedToId = user.id;
    }
  }
  
  // Build base includes (always include these)
  // Study is optional (admin tasks don't have studyId)
  // Project is optional (research tasks get project via study, admin tasks have direct project)
  const baseIncludes: any[] = [
    { model: User, as: 'assignedTo', attributes: ['id', 'email', 'firstName', 'lastName'] },
    { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    {
      model: Study,
      as: 'study',
      attributes: ['id', 'name', 'projectId'],
      required: false, // Optional for admin tasks
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name'],
        },
      ],
    },
    {
      model: Project,
      as: 'project',
      attributes: ['id', 'name'],
      required: false, // Optional - only for admin tasks
    },
  ];

  // Try to include assignedResearchers, but fallback if table doesn't exist
  try {
    const tasks = await Task.findAll({
      where,
      include: [
        ...baseIncludes,
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: ['assignedAt'] },
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return tasks;
  } catch (findAllError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (findAllError?.message?.includes('task_assignments') || findAllError?.name === 'SequelizeDatabaseError') {
      const tasks = await Task.findAll({
        where,
        include: baseIncludes,
        order: [['createdAt', 'DESC']],
      });
      return tasks;
    }
    throw findAllError;
  }
}

/**
 * Get tasks for a study with optional filtering
 * Only returns research tasks (admin tasks don't belong to studies)
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

  // Build query - only research tasks belong to studies
  const where: any = { 
    studyId,
    taskType: TaskType.RESEARCH, // Only research tasks
  };

  // Researchers can only see assigned tasks (check both legacy and many-to-many)
  if (user.role === UserRole.RESEARCHER) {
    try {
      // Get task IDs from task_assignments table for this study
      const assignedTaskIds = await TaskAssignment.findAll({
        where: { userId: user.id },
        attributes: ['taskId'],
        include: [
          {
            model: Task,
            as: 'task',
            attributes: [],
            where: { studyId },
          },
        ],
        raw: true,
      }).then((assignments) => assignments.map((a: any) => a.taskId));

      // Use Op.or to check both assignedToId and task_assignments
      where[Op.or] = [
        { assignedToId: user.id },
        ...(assignedTaskIds.length > 0 ? [{ id: { [Op.in]: assignedTaskIds } }] : []),
      ];
    } catch (taskAssignmentError) {
      // Fallback to legacy assignedToId only if TaskAssignment table doesn't exist
      where.assignedToId = user.id;
    }
  }
  
  // Build base includes (always include these)
  const baseIncludes: any[] = [
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
  ];

  // Try to include assignedResearchers, but fallback if table doesn't exist
  try {
    const tasks = await Task.findAll({
      where,
      include: [
        ...baseIncludes,
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: ['assignedAt'] },
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return tasks;
  } catch (findAllError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (findAllError?.message?.includes('task_assignments') || findAllError?.name === 'SequelizeDatabaseError') {
      const tasks = await Task.findAll({
        where,
        include: baseIncludes,
        order: [['createdAt', 'DESC']],
      });
      return tasks;
    }
    throw findAllError;
  }
}

/**
 * Get a single task by ID
 */
export async function getTaskById(
  taskId: number,
  user: UserContext
): Promise<Task> {
  // Build base includes (always include these)
  // Study is optional (nullable for admin tasks)
  const baseIncludes: any[] = [
    { 
      model: Study, 
      as: 'study',
      required: false, // Optional for admin tasks
      include: [
        { model: User, as: 'createdBy' },
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name'],
        },
      ],
    },
    {
      model: Project,
      as: 'project',
      attributes: ['id', 'name'],
      required: false, // Optional - only for admin tasks
    },
    { model: User, as: 'assignedTo' },
    { model: User, as: 'createdBy' },
    { model: User, as: 'completedBy' },
  ];

  // Try to include assignedResearchers, but fallback if table doesn't exist
  let task: Task | null;
  try {
    task = await Task.findByPk(taskId, {
      include: [
        ...baseIncludes,
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: ['assignedAt'] },
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
    });
  } catch (findError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (findError?.message?.includes('task_assignments') || findError?.name === 'SequelizeDatabaseError') {
      task = await Task.findByPk(taskId, {
        include: baseIncludes,
      });
    } else {
      throw findError;
    }
  }

  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Researchers can only access assigned tasks (check both legacy and new assignments)
  if (user.role === UserRole.RESEARCHER) {
    // Type assertion needed because Sequelize relations aren't in the model type
    const taskData = task as any;
    const isAssigned = 
      task.assignedToId === user.id ||
      (taskData.assignedResearchers && taskData.assignedResearchers.some((u: any) => u.id === user.id));
    
    if (!isAssigned) {
      throw new PermissionError('You do not have access to this task');
    }
  }

  return task;
}

/**
 * Create a new task
 * Supports both research tasks (with studyId) and admin tasks (with projectId, no studyId)
 */
export async function createTask(
  studyId: number | null,
  data: CreateTaskRequest,
  user: UserContext,
  transaction?: Transaction
): Promise<Task> {
  // Only managers can create tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can create tasks');
  }

  // Determine task type (default to RESEARCH for backward compatibility)
  const taskType = (data.taskType as TaskType) || TaskType.RESEARCH;

  // Validate task type rules
  if (taskType === TaskType.RESEARCH) {
    // Research tasks require studyId
    if (!studyId) {
      throw new ValidationError('Research tasks must have a studyId');
    }
    // Verify study exists
    const study = await Study.findByPk(studyId, { transaction });
    if (!study) {
      throw new NotFoundError(`Study ${studyId} not found`);
    }
  } else if (taskType === TaskType.ADMIN) {
    // Admin tasks are independent - they don't require studyId or projectId
    // If projectId is provided, verify it exists, but it's optional
    if (data.projectId) {
      const project = await Project.findByPk(data.projectId, { transaction });
      if (!project) {
        throw new NotFoundError(`Project ${data.projectId} not found`);
      }
    }
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
      taskType,
      studyId: taskType === TaskType.RESEARCH ? studyId : null,
      projectId: taskType === TaskType.ADMIN ? (data.projectId || null) : null,
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

  // Update progress chain only for research tasks (uses same transaction if provided)
  if (taskType === TaskType.RESEARCH && studyId) {
    await progressService.updateProgressChain(studyId, transaction);
  }

  // Try to reload with assignedResearchers, fallback if table doesn't exist
  try {
    return await task.reload({
      include: [
        { model: User, as: 'assignedTo' },
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: [] },
        },
        { model: User, as: 'createdBy' },
      ],
      transaction,
    });
  } catch (reloadError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (reloadError?.message?.includes('task_assignments') || reloadError?.name === 'SequelizeDatabaseError') {
      return await task.reload({
        include: [
          { model: User, as: 'assignedTo' },
          { model: User, as: 'createdBy' },
        ],
        transaction,
      });
    }
    throw reloadError;
  }
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
    // Check both legacy and many-to-many assignments
    let isAssigned = task.assignedToId === user.id;
    
    // Try to check task_assignments table, but fallback if it doesn't exist
    if (!isAssigned) {
      try {
        const assignment = await TaskAssignment.findOne({ where: { taskId: task.id, userId: user.id } });
        isAssigned = assignment !== null;
      } catch (assignmentError: any) {
        // If table doesn't exist, just use legacy assignedToId check
        // isAssigned already set above
      }
    }
    
    if (!isAssigned) {
      throw new PermissionError('You do not have access to this task');
    }
    // Researchers cannot assign tasks or change priority (but can complete via completeTask function)
    // Note: Researchers can update status to completed via the form, but it's better to use the complete button
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

  // Update progress chain if status changed (only for research tasks)
  if (data.status && task.taskType === TaskType.RESEARCH && task.studyId) {
    await progressService.updateProgressChain(task.studyId);
  }

  // Try to reload with assignedResearchers, fallback if table doesn't exist
  try {
    return await task.reload({
      include: [
        { model: User, as: 'assignedTo' },
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: [] },
        },
        { model: User, as: 'createdBy' },
        { model: User, as: 'completedBy' },
      ],
    });
  } catch (reloadError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (reloadError?.message?.includes('task_assignments') || reloadError?.name === 'SequelizeDatabaseError') {
      return await task.reload({
        include: [
          { model: User, as: 'assignedTo' },
          { model: User, as: 'createdBy' },
          { model: User, as: 'completedBy' },
        ],
      });
    }
    throw reloadError;
  }
}

/**
 * Complete a task (Managers and assigned Researchers)
 * Uses transaction to ensure progress calculation is atomic
 */
export async function completeTask(
  taskId: number,
  user: UserContext,
  transaction?: Transaction
): Promise<Task> {
  // Managers can complete any task, researchers can only complete assigned tasks
  if (user.role === UserRole.RESEARCHER) {
    // Try to load task with assignedResearchers, fallback if table doesn't exist
    let task: Task | null;
    try {
      task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: 'assignedTo' },
          {
            model: User,
            as: 'assignedResearchers',
            through: { attributes: [] },
          },
        ],
        transaction,
      });
    } catch (findError: any) {
      // If error is about missing task_assignments table, retry without assignedResearchers include
      if (findError?.message?.includes('task_assignments') || findError?.name === 'SequelizeDatabaseError') {
        task = await Task.findByPk(taskId, {
          include: [
            { model: User, as: 'assignedTo' },
          ],
          transaction,
        });
      } else {
        throw findError;
      }
    }

    if (!task) {
      throw new NotFoundError(`Task ${taskId} not found`);
    }

    // Check if user is assigned to this task
    // Type assertion needed because Sequelize relations aren't in the model type
    const taskData = task as any;
    const isAssigned =
      task.assignedToId === user.id ||
      (taskData.assignedResearchers && taskData.assignedResearchers.some((u: any) => u.id === user.id));
    
    if (!isAssigned) {
      throw new PermissionError('You can only complete tasks assigned to you');
    }
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

  // Update progress chain only for research tasks (uses same transaction if provided)
  if (task.taskType === TaskType.RESEARCH && task.studyId) {
    await progressService.updateProgressChain(task.studyId, transaction);
  }

  // Try to reload with assignedResearchers, fallback if table doesn't exist
  try {
    return await task.reload({
      include: [
        { model: User, as: 'assignedTo' },
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: [] },
        },
        { model: User, as: 'createdBy' },
        { model: User, as: 'completedBy' },
      ],
      transaction,
    });
  } catch (reloadError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (reloadError?.message?.includes('task_assignments') || reloadError?.name === 'SequelizeDatabaseError') {
      return await task.reload({
        include: [
          { model: User, as: 'assignedTo' },
          { model: User, as: 'createdBy' },
          { model: User, as: 'completedBy' },
        ],
        transaction,
      });
    }
    throw reloadError;
  }
}

/**
 * Assign a task to a researcher (Manager only)
 * This function maintains backward compatibility by updating both assignedToId and task_assignments
 */
export async function assignTask(
  taskId: number,
  assignedToId: number,
  user: UserContext
): Promise<Task> {
  // Use the multiple assignment function with a single user
  return assignTaskToMultiple(taskId, [assignedToId], user);
}

/**
 * Delete a task (soft delete - moves to trash) (Manager only)
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

  const task = await Task.scope('withDeleted').findByPk(taskId, { transaction });
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  const studyId = task.studyId;

  // Soft delete - set deletedAt timestamp
  await task.update({ deletedAt: new Date() }, { transaction });

  // Update progress chain only for research tasks (uses same transaction if provided)
  if (task.taskType === TaskType.RESEARCH && studyId) {
    await progressService.updateProgressChain(studyId, transaction);
  }
}

/**
 * Restore a task from trash
 */
export async function restoreTask(
  taskId: number,
  user: UserContext
): Promise<Task> {
  // Only managers can restore tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can restore tasks');
  }

  const task = await Task.scope('withDeleted').findByPk(taskId);
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  if (!task.deletedAt) {
    throw new Error('Task is not in trash');
  }

  // Restore - clear deletedAt
  await task.update({ deletedAt: null });
  await task.reload({ 
    include: [
      { model: Study, as: 'study', attributes: ['id', 'name', 'projectId'], required: false },
      { model: Project, as: 'project', attributes: ['id', 'name'], required: false },
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    ] 
  });
  
  // Update progress chain after restoration (only for research tasks)
  if (task.taskType === TaskType.RESEARCH && task.studyId) {
    await progressService.updateProgressChain(task.studyId);
  }
  
  return task;
}

/**
 * Get all tasks in trash (deleted tasks)
 */
export async function getTrashTasks(user: UserContext): Promise<Task[]> {
  // Only managers can view trash
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can view trash');
  }

  const tasks = await Task.scope('onlyDeleted').findAll({
    include: [
      { model: Study, as: 'study', attributes: ['id', 'name', 'projectId'], required: false, include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }] },
      { model: Project, as: 'project', attributes: ['id', 'name'], required: false },
      { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    ],
    order: [['deletedAt', 'DESC']],
  });

  return tasks;
}

/**
 * Get tasks for a project (both research and admin tasks)
 */
export async function getTasksByProject(
  projectId: number,
  user: UserContext
): Promise<Task[]> {
  // Verify project exists
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw new NotFoundError(`Project ${projectId} not found`);
  }

  // Build query - tasks can belong to project via:
  // 1. Admin tasks with projectId
  // 2. Research tasks via study.projectId
  const where: any = {
    [Op.or]: [
      { projectId }, // Direct admin task relationship
      { 
        // Research tasks via study
        taskType: TaskType.RESEARCH,
        '$study.projectId$': projectId,
      },
    ],
  };

  // Researchers can only see assigned tasks (check both legacy and many-to-many)
  if (user.role === UserRole.RESEARCHER) {
    try {
      // Get task IDs from task_assignments table
      const assignedTaskIds = await TaskAssignment.findAll({
        where: { userId: user.id },
        attributes: ['taskId'],
        raw: true,
      }).then((assignments) => assignments.map((a: any) => a.taskId));

      // Use Op.and to combine project filter with assignment filter
      where[Op.and] = [
        where[Op.or],
        {
          [Op.or]: [
            { assignedToId: user.id },
            ...(assignedTaskIds.length > 0 ? [{ id: { [Op.in]: assignedTaskIds } }] : []),
          ],
        },
      ];
      delete where[Op.or];
    } catch (taskAssignmentError) {
      // Fallback to legacy assignedToId only if TaskAssignment table doesn't exist
      where[Op.and] = [
        where[Op.or],
        { assignedToId: user.id },
      ];
      delete where[Op.or];
    }
  }
  
  // Build base includes
  const baseIncludes: any[] = [
    { model: User, as: 'assignedTo', attributes: ['id', 'email', 'firstName', 'lastName'] },
    { model: User, as: 'createdBy', attributes: ['id', 'email', 'firstName', 'lastName'] },
    {
      model: Study,
      as: 'study',
      attributes: ['id', 'name', 'projectId'],
      required: false, // Optional for admin tasks
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name'],
        },
      ],
    },
    {
      model: Project,
      as: 'project',
      attributes: ['id', 'name'],
      required: false, // Optional - only for admin tasks
    },
  ];

  // Try to include assignedResearchers, but fallback if table doesn't exist
  try {
    const tasks = await Task.findAll({
      where,
      include: [
        ...baseIncludes,
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: ['assignedAt'] },
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return tasks;
  } catch (findAllError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (findAllError?.message?.includes('task_assignments') || findAllError?.name === 'SequelizeDatabaseError') {
      const tasks = await Task.findAll({
        where,
        include: baseIncludes,
        order: [['createdAt', 'DESC']],
      });
      return tasks;
    }
    throw findAllError;
  }
}


/**
 * Request task completion (Researcher only)
 * Researchers can request managers to mark tasks as completed
 */
export async function requestTaskCompletion(
  taskId: number,
  user: UserContext,
  notes?: string
): Promise<TaskRequest> {
  // Only researchers can request completion
  if (user.role !== UserRole.RESEARCHER) {
    throw new PermissionError('Only researchers can request task completion');
  }

  // Try to load task with assignedResearchers, fallback if table doesn't exist
  let task: Task | null;
  try {
    task = await Task.findByPk(taskId, {
      include: [
        { model: User, as: 'assignedTo' },
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
      task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: 'assignedTo' },
        ],
      });
    } else {
      throw findError;
    }
  }

  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Check if user is assigned to this task
  // Type assertion needed because Sequelize relations aren't in the model type
  const taskData = task as any;
  const isAssigned = 
    task.assignedToId === user.id ||
    (taskData.assignedResearchers && taskData.assignedResearchers.some((u: any) => u.id === user.id));

  if (!isAssigned) {
    throw new PermissionError('You can only request completion for tasks assigned to you');
  }

  if (task.status === TaskStatus.COMPLETED) {
    throw new ValidationError('Task is already completed');
  }

  // Check if there's already a pending completion request
  const existingRequest = await TaskRequest.findOne({
    where: {
      taskId,
      requestedById: user.id,
      requestType: TaskRequestType.COMPLETION,
      status: TaskRequestStatus.PENDING,
    },
  });

  if (existingRequest) {
    throw new ValidationError('You already have a pending completion request for this task');
  }

  // Create the request
  const request = await TaskRequest.create({
    taskId,
    requestedById: user.id,
    requestType: TaskRequestType.COMPLETION,
    status: TaskRequestStatus.PENDING,
    notes: notes || null,
  });

  // #region agent log
  const fs = require('fs');
  const path = require('path');
  const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
  try {
    fs.appendFileSync(logPath, `[REQUEST-COMPLETION] Request created: id=${request.id}, taskId=${taskId}, requestedById=${user.id}\n`);
  } catch {}
  // #endregion

  try {
    const reloadedRequest = await request.reload({
      include: [
        { 
          model: Task, 
          as: 'task',
          include: [
            { model: User, as: 'createdBy' }, // Include the manager who created the task
            {
              model: Study,
              as: 'study',
              attributes: ['id', 'projectId'], // Include study to get projectId
            },
          ],
        },
        { model: User, as: 'requestedBy' },
      ],
    });
    // #region agent log
    try {
      // Type assertion needed because Sequelize relations aren't in the model type
      const requestData = reloadedRequest as any;
      const taskData = requestData.task;
      fs.appendFileSync(logPath, `[REQUEST-COMPLETION] Request reloaded: task.createdById=${taskData?.createdById}, task.study.projectId=${taskData?.study?.projectId}\n`);
    } catch {}
    // #endregion
    
    // Create notification in database for the manager who created the task
    // Type assertion needed because Sequelize relations aren't in the model type
    const requestData2 = reloadedRequest as any;
    if (requestData2.task?.createdById) {
      const taskData = requestData2.task;
      const requesterName = requestData2.requestedBy
        ? `${requestData2.requestedBy.firstName} ${requestData2.requestedBy.lastName}`
        : 'A researcher';
      
      createAndEmitNotification(requestData2.task.createdById, {
        type: 'task',
        title: 'New completion request',
        message: `${requesterName} requested completion for task "${requestData2.task.name}"`,
        taskId: reloadedRequest.taskId,
        projectId: taskData?.study?.projectId,
        studyId: requestData2.task.studyId,
        senderId: reloadedRequest.requestedById,
        senderName: requesterName,
        actionUrl: '/dashboard/requests',
        timestamp: new Date(reloadedRequest.createdAt),
      }).catch((err) => {
        console.error('Failed to create notification for task request:', err);
      });
    }
    
    return reloadedRequest;
  } catch (reloadError: any) {
    // #region agent log
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
    try {
      fs.appendFileSync(logPath, `[REQUEST-COMPLETION] Reload error: ${reloadError?.message || reloadError}\nStack: ${reloadError?.stack || 'N/A'}\n`);
    } catch {}
    // #endregion
    // Fallback: reload without study include if it fails
    try {
      return await request.reload({
        include: [
          { 
            model: Task, 
            as: 'task',
            include: [
              { model: User, as: 'createdBy' },
            ],
          },
          { model: User, as: 'requestedBy' },
        ],
      });
    } catch (fallbackError: any) {
      // #region agent log
      try {
        fs.appendFileSync(logPath, `[REQUEST-COMPLETION] Fallback reload error: ${fallbackError?.message || fallbackError}\n`);
      } catch {}
      // #endregion
      throw reloadError; // Throw original error
    }
  }
}

/**
 * Request task reassignment (Researcher only)
 * Researchers can request managers to reassign tasks to other researchers
 */
export async function requestTaskReassignment(
  taskId: number,
  requestedAssignedToId: number,
  user: UserContext,
  notes?: string
): Promise<TaskRequest> {
  // Only researchers can request reassignment
  if (user.role !== UserRole.RESEARCHER) {
    throw new PermissionError('Only researchers can request task reassignment');
  }

  // Try to load task with assignedResearchers, fallback if table doesn't exist
  let task: Task | null;
  try {
    task = await Task.findByPk(taskId, {
      include: [
        { model: User, as: 'assignedTo' },
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
      task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: 'assignedTo' },
        ],
      });
    } else {
      throw findError;
    }
  }

  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Check if user is assigned to this task
  // Type assertion needed because Sequelize relations aren't in the model type
  const taskData2 = task as any;
  const isAssigned = 
    task.assignedToId === user.id ||
    (taskData2.assignedResearchers && taskData2.assignedResearchers.some((u: any) => u.id === user.id));

  if (!isAssigned) {
    throw new PermissionError('You can only request reassignment for tasks assigned to you');
  }

  // Verify requested user exists and is a researcher
  const requestedUser = await User.findByPk(requestedAssignedToId);
  if (!requestedUser) {
    throw new NotFoundError(`User ${requestedAssignedToId} not found`);
  }
  if (requestedUser.role !== UserRole.RESEARCHER) {
    throw new ValidationError('Tasks can only be reassigned to researchers');
  }

  if (requestedAssignedToId === user.id) {
    throw new ValidationError('Cannot request reassignment to yourself');
  }

  // Check if there's already a pending reassignment request
  const existingRequest = await TaskRequest.findOne({
    where: {
      taskId,
      requestedById: user.id,
      requestType: TaskRequestType.REASSIGNMENT,
      status: TaskRequestStatus.PENDING,
    },
  });

  if (existingRequest) {
    throw new ValidationError('You already have a pending reassignment request for this task');
  }

  // Create the request
  const request = await TaskRequest.create({
    taskId,
    requestedById: user.id,
    requestType: TaskRequestType.REASSIGNMENT,
    requestedAssignedToId,
    status: TaskRequestStatus.PENDING,
    notes: notes || null,
  });

  try {
    const reloadedRequest = await request.reload({
      include: [
        { 
          model: Task, 
          as: 'task',
          include: [
            { model: User, as: 'createdBy' }, // Include the manager who created the task
            {
              model: Study,
              as: 'study',
              attributes: ['id', 'projectId'], // Include study to get projectId
            },
          ],
        },
        { model: User, as: 'requestedBy' },
        { model: User, as: 'requestedAssignedTo' },
      ],
    });
    
    // Create notification in database for the manager who created the task
    // Type assertion needed because Sequelize relations aren't in the model type
    const requestData3 = reloadedRequest as any;
    if (requestData3.task?.createdById) {
      const taskData = requestData3.task;
      const requesterName = requestData3.requestedBy
        ? `${requestData3.requestedBy.firstName} ${requestData3.requestedBy.lastName}`
        : 'A researcher';
      
      createAndEmitNotification(requestData3.task.createdById, {
        type: 'task',
        title: 'New reassignment request',
        message: `${requesterName} requested reassignment for task "${requestData3.task.name}"`,
        taskId: reloadedRequest.taskId,
        projectId: taskData?.study?.projectId,
        studyId: requestData3.task.studyId,
        senderId: reloadedRequest.requestedById,
        senderName: requesterName,
        actionUrl: '/dashboard/requests',
        timestamp: new Date(reloadedRequest.createdAt),
      }).catch((err) => {
        console.error('Failed to create notification for task request:', err);
      });
    }
    
    return reloadedRequest;
  } catch (reloadError: any) {
    // #region agent log
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
    try {
      fs.appendFileSync(logPath, `[REQUEST-REASSIGNMENT] Reload error: ${reloadError?.message || reloadError}\nStack: ${reloadError?.stack || 'N/A'}\n`);
    } catch {}
    // #endregion
    // Fallback: reload without study include if it fails
    try {
      return await request.reload({
        include: [
          { 
            model: Task, 
            as: 'task',
            include: [
              { model: User, as: 'createdBy' },
            ],
          },
          { model: User, as: 'requestedBy' },
          { model: User, as: 'requestedAssignedTo' },
        ],
      });
    } catch (fallbackError: any) {
      // #region agent log
      try {
        fs.appendFileSync(logPath, `[REQUEST-REASSIGNMENT] Fallback reload error: ${fallbackError?.message || fallbackError}\n`);
      } catch {}
      // #endregion
      throw reloadError; // Throw original error
    }
  }
}

/**
 * Approve a task request (Manager only)
 */
export async function approveTaskRequest(
  requestId: number,
  user: UserContext,
  transaction?: Transaction
): Promise<{ request: TaskRequest; task: Task }> {
  // Only managers can approve requests
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can approve task requests');
  }

  const request = await TaskRequest.findByPk(requestId, {
    include: [
      { model: Task, as: 'task' },
      { model: User, as: 'requestedBy' },
      { model: User, as: 'requestedAssignedTo' },
    ],
    transaction,
  });

  if (!request) {
    throw new NotFoundError(`Request ${requestId} not found`);
  }

  if (request.status !== TaskRequestStatus.PENDING) {
    throw new ValidationError('Request has already been processed');
  }

  // Type assertion needed because Sequelize relations aren't in the model type
  const requestData = request as any;
  const task = requestData.task!;

  // Process the request based on type
  if (request.requestType === TaskRequestType.COMPLETION) {
    // Update request status first
    await request.update(
      {
        status: TaskRequestStatus.APPROVED,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      { transaction }
    );
    
    // Check if task is already completed
    if (task.status === TaskStatus.COMPLETED) {
      // Task is already completed - skip task update but still approve the request
      // This handles the edge case where task was completed through another flow
      // Add a note to the request indicating the task was already completed
      const existingNotes = request.notes || '';
      const completionNote = 'Note: Task was already completed when this request was approved.';
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n${completionNote}`
        : completionNote;
      
      await request.update(
        {
          notes: updatedNotes,
        },
        { transaction }
      );
      
      // Reload task to get latest state with all associations
      let reloadedTask: Task;
      try {
        reloadedTask = await task.reload({
          include: [
            { model: User, as: 'assignedTo' },
            {
              model: User,
              as: 'assignedResearchers',
              through: { attributes: [] },
            },
            { model: User, as: 'createdBy' },
            { model: User, as: 'completedBy' },
          ],
          transaction,
        });
      } catch (reloadError: any) {
        // If error is about missing task_assignments table, retry without assignedResearchers include
        if (reloadError?.message?.includes('task_assignments') || reloadError?.name === 'SequelizeDatabaseError') {
          reloadedTask = await task.reload({
            include: [
              { model: User, as: 'assignedTo' },
              { model: User, as: 'createdBy' },
              { model: User, as: 'completedBy' },
            ],
            transaction,
          });
        } else {
          throw reloadError;
        }
      }
      
      return {
        request: await request.reload({ transaction }),
        task: reloadedTask,
      };
    }
    
    // Check if task is in a state that prevents completion
    if (task.status === TaskStatus.CANCELLED) {
      throw new ValidationError('Cannot complete a cancelled task');
    }
    
    // Task is not completed - proceed with normal completion flow
    // Complete the task
    const updateResult = await task.update(
      {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedById: user.id,
      },
      { transaction }
    );
    
    // Verify the update succeeded
    if (!updateResult) {
      throw new Error('Failed to update task status to completed');
    }
    
    // Update progress chain only for research tasks
    if (task.taskType === TaskType.RESEARCH && task.studyId) {
      await progressService.updateProgressChain(task.studyId, transaction);
    }
  } else if (request.requestType === TaskRequestType.REASSIGNMENT) {
    // Update request status first
    await request.update(
      {
        status: TaskRequestStatus.APPROVED,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      { transaction }
    );
    // Reassign the task
    if (!request.requestedAssignedToId) {
      throw new ValidationError('Reassignment request missing target user');
    }

    // Remove old assignments and add new one (only if table exists)
    try {
      await TaskAssignment.destroy({
        where: { taskId: task.id },
        transaction,
      });

      await TaskAssignment.create(
        {
          taskId: task.id,
          userId: request.requestedAssignedToId,
          assignedById: user.id,
        },
        { transaction }
      );
    } catch (assignmentError: any) {
      // If table doesn't exist, just update legacy assignedToId
      // This is fine - the migration will handle creating the table later
      if (!assignmentError?.message?.includes('task_assignments')) {
        throw assignmentError;
      }
    }

    // Update legacy assignedToId for backward compatibility
    await task.update(
      {
        assignedToId: request.requestedAssignedToId,
        status: task.status === TaskStatus.PENDING ? TaskStatus.IN_PROGRESS : task.status,
      },
      { transaction }
    );
  }

  // Try to reload task with assignedResearchers, fallback if table doesn't exist
  let reloadedTask: Task;
  try {
    reloadedTask = await task.reload({
      include: [
        { model: User, as: 'assignedTo' },
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: [] },
        },
        { model: User, as: 'createdBy' },
        { model: User, as: 'completedBy' },
      ],
      transaction,
    });
  } catch (reloadError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (reloadError?.message?.includes('task_assignments') || reloadError?.name === 'SequelizeDatabaseError') {
      reloadedTask = await task.reload({
        include: [
          { model: User, as: 'assignedTo' },
          { model: User, as: 'createdBy' },
          { model: User, as: 'completedBy' },
        ],
        transaction,
      });
    } else {
      throw reloadError;
    }
  }

  // Verify task status was updated correctly for completion requests
  if (request.requestType === TaskRequestType.COMPLETION) {
    if (reloadedTask.status !== TaskStatus.COMPLETED) {
      throw new Error(`Task status update failed. Expected COMPLETED, got ${reloadedTask.status}`);
    }
  }

  return {
    request: await request.reload({ transaction }),
    task: reloadedTask,
  };
}

/**
 * Reject a task request (Manager only)
 */
export async function rejectTaskRequest(
  requestId: number,
  user: UserContext,
  notes?: string
): Promise<TaskRequest> {
  // Only managers can reject requests
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can reject task requests');
  }

  const request = await TaskRequest.findByPk(requestId);

  if (!request) {
    throw new NotFoundError(`Request ${requestId} not found`);
  }

  if (request.status !== TaskRequestStatus.PENDING) {
    throw new ValidationError('Request has already been processed');
  }

  // Update request status
  await request.update({
    status: TaskRequestStatus.REJECTED,
    reviewedById: user.id,
    reviewedAt: new Date(),
    notes: notes || request.notes,
  });

  return request.reload({
    include: [
      { model: Task, as: 'task' },
      { model: User, as: 'requestedBy' },
      { model: User, as: 'requestedAssignedTo' },
      { model: User, as: 'reviewedBy' },
    ],
  });
}

/**
 * Assign a task to multiple researchers (Manager only)
 */
export async function assignTaskToMultiple(
  taskId: number,
  userIds: number[],
  user: UserContext,
  transaction?: Transaction
): Promise<Task> {
  // Only managers can assign tasks
  if (user.role !== UserRole.MANAGER) {
    throw new PermissionError('Only managers can assign tasks');
  }

  const task = await Task.findByPk(taskId, { transaction });
  if (!task) {
    throw new NotFoundError(`Task ${taskId} not found`);
  }

  // Verify all users exist and are researchers
  const users = await User.findAll({
    where: { id: userIds },
    transaction,
  });

  if (users.length !== userIds.length) {
    throw new NotFoundError('One or more users not found');
  }

  const nonResearchers = users.filter((u) => u.role !== UserRole.RESEARCHER);
  if (nonResearchers.length > 0) {
    throw new ValidationError('Tasks can only be assigned to researchers');
  }

  // Remove existing assignments and create new ones (only if table exists)
  try {
    await TaskAssignment.destroy({
      where: { taskId },
      transaction,
    });

    // Create new assignments
    if (userIds.length > 0) {
      await TaskAssignment.bulkCreate(
        userIds.map((userId) => ({
          taskId,
          userId,
          assignedById: user.id,
        })),
        { transaction }
      );
    }
  } catch (assignmentError: any) {
    // If table doesn't exist, just update legacy assignedToId
    // This is fine - the migration will handle creating the table later
    if (!assignmentError?.message?.includes('task_assignments')) {
      throw assignmentError;
    }
  }

  // Update legacy assignedToId for backward compatibility (always do this)
  if (userIds.length > 0) {
    await task.update(
      {
        assignedToId: userIds[0],
        status: task.status === TaskStatus.PENDING ? TaskStatus.IN_PROGRESS : task.status,
      },
      { transaction }
    );
  } else {
    // If no assignments, clear assignedToId
    await task.update({ assignedToId: null }, { transaction });
  }

  // Try to reload with assignedResearchers, fallback if table doesn't exist
  try {
    return await task.reload({
      include: [
        { model: User, as: 'assignedTo' },
        {
          model: User,
          as: 'assignedResearchers',
          through: { attributes: [] },
        },
        { model: User, as: 'createdBy' },
        {
          model: Study,
          as: 'study',
          attributes: ['id', 'projectId'],
        },
      ],
      transaction,
    });
  } catch (reloadError: any) {
    // If error is about missing task_assignments table, retry without assignedResearchers include
    if (reloadError?.message?.includes('task_assignments') || reloadError?.name === 'SequelizeDatabaseError') {
      return await task.reload({
        include: [
          { model: User, as: 'assignedTo' },
          { model: User, as: 'createdBy' },
          {
            model: Study,
            as: 'study',
            attributes: ['id', 'projectId'],
          },
        ],
        transaction,
      });
    }
    throw reloadError;
  }
}

/**
 * Mark a task as read for a user
 */
export async function markTaskAsRead(taskId: number, userId: number): Promise<void> {
  try {
    // Use findOrCreate to avoid duplicates (unique constraint handles this, but we check first)
    await TaskRead.findOrCreate({
      where: {
        taskId,
        userId,
      },
      defaults: {
        taskId,
        userId,
        readAt: new Date(),
      },
    });
  } catch (error: any) {
    // If record already exists, update readAt timestamp
    if (error?.name === 'SequelizeUniqueConstraintError') {
      await TaskRead.update(
        { readAt: new Date() },
        {
          where: {
            taskId,
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
 * Check if a task is read for a user
 */
export async function isTaskRead(taskId: number, userId: number): Promise<boolean> {
  try {
    const taskRead = await TaskRead.findOne({
      where: {
        taskId,
        userId,
      },
    });
    return !!taskRead;
  } catch (error) {
    // If table doesn't exist yet, return false (task is unread)
    return false;
  }
}

/**
 * Get unread task count for a user
 * This counts tasks assigned to the user that haven't been read yet
 */
export async function getUnreadTaskCount(userId: number, userRole: UserRole): Promise<number> {
  try {
    // Use a single optimized query with JOINs to get all data at once
    // Explicitly filter out deleted projects, studies, and tasks
    const query = `
      SELECT DISTINCT t.id as task_id
      FROM tasks t
      INNER JOIN studies s ON s.id = t.study_id AND s.deleted_at IS NULL
      INNER JOIN projects p ON p.id = s.project_id AND p.deleted_at IS NULL
      LEFT JOIN task_assignments ta ON ta.task_id = t.id AND ta.user_id = :userId
      WHERE t.deleted_at IS NULL
        AND s.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
          t.assigned_to_id = :userId
          OR ta.user_id = :userId
        )
    `;

    const results = await sequelize.query(query, {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }) as any[];

    const assignedTaskIds = results.map((r: any) => r.task_id || r.taskId).filter(Boolean);

    if (assignedTaskIds.length === 0) {
      return 0;
    }

    // Double-check: Verify that all task IDs are from non-deleted tasks
    // This is an extra safety check to ensure deleted tasks are not counted
    const validTasks = await Task.findAll({
      where: {
        id: { [Op.in]: assignedTaskIds },
        deletedAt: null,
      },
      attributes: ['id'],
      raw: true,
    });
    const validTaskIds = new Set(validTasks.map((t: any) => t.id || t.task_id).filter(Boolean));

    // Filter taskIds to only include valid (non-deleted) tasks
    const validTaskIdsArray = assignedTaskIds.filter((id) => validTaskIds.has(id));

    if (validTaskIdsArray.length === 0) {
      return 0;
    }

    // Get read task IDs for this user
    const readTaskIds = await TaskRead.findAll({
      where: {
        userId,
        taskId: { [Op.in]: validTaskIdsArray },
      },
      attributes: ['taskId'],
      raw: true,
    }).then((reads) => reads.map((r: any) => r.taskId || r.task_id).filter(Boolean));

    // Count unread tasks (only from valid, non-deleted tasks)
    const unreadTaskIds = validTaskIdsArray.filter((id) => !readTaskIds.includes(id));
    return unreadTaskIds.length;
  } catch (error: any) {
    // If TaskRead table doesn't exist yet, return 0
    console.error('[getUnreadTaskCount] Error:', error?.message || error);
    return 0;
  }
}

/**
 * Get read status for multiple tasks for a user
 * Returns a map of taskId -> boolean (true if read)
 */
export async function getTasksReadStatus(taskIds: number[], userId: number): Promise<Record<number, boolean>> {
  try {
    const taskReads = await TaskRead.findAll({
      where: {
        taskId: { [Op.in]: taskIds },
        userId,
      },
      attributes: ['taskId'],
      raw: true,
    });

    const readTaskIds = new Set(taskReads.map((r: any) => r.taskId));
    const statusMap: Record<number, boolean> = {};
    
    taskIds.forEach((taskId) => {
      statusMap[taskId] = readTaskIds.has(taskId);
    });

    return statusMap;
  } catch (error) {
    // If TaskRead table doesn't exist yet, return all false
    const statusMap: Record<number, boolean> = {};
    taskIds.forEach((taskId) => {
      statusMap[taskId] = false;
    });
    return statusMap;
  }
}
