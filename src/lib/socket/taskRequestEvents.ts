// Helper functions to emit task request events via Socket.IO
// These can be called from API routes to notify clients about task request changes

import { getSocketInstance } from './instance';
import { TaskRequest, Task, User } from '@/types/entities';

/**
 * Emit event via HTTP request to socket server (fallback when singleton not available)
 */
async function emitViaHttp(event: string, payload: any): Promise<void> {
  const socketUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
  // #region agent log
  const fs = require('fs');
  const path = require('path');
  const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
  try {
    fs.appendFileSync(logPath, `[EMIT-VIA-HTTP] Attempting to emit ${event} to ${socketUrl}/emit\n`);
  } catch {}
  // #endregion
  try {
    const response = await fetch(`${socketUrl}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
    });
    // #region agent log
    try {
      fs.appendFileSync(logPath, `[EMIT-VIA-HTTP] Response status: ${response.status}, ok: ${response.ok}\n`);
    } catch {}
    // #endregion
    if (!response.ok) {
      const errorText = await response.text();
      // #region agent log
      try {
        fs.appendFileSync(logPath, `[EMIT-VIA-HTTP] Error response: ${errorText}\n`);
      } catch {}
      // #endregion
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  } catch (error: any) {
    // #region agent log
    try {
      fs.appendFileSync(logPath, `[EMIT-VIA-HTTP] Failed to emit ${event}: ${error?.message || error}\n`);
    } catch {}
    // #endregion
    console.error(`Failed to emit ${event} via HTTP:`, error);
  }
}

/**
 * Emit task request created event
 * Notifies managers that a researcher has created a completion or reassignment request
 */
export async function emitTaskRequestCreated(
  request: TaskRequest & { task?: Task; requestedBy?: User }
): Promise<void> {
  const io = getSocketInstance();
  
  const payload = {
    request: {
      id: request.id,
      taskId: request.taskId,
      requestedById: request.requestedById,
      requestType: request.requestType,
      requestedAssignedToId: request.requestedAssignedToId,
      status: request.status,
      reviewedById: request.reviewedById,
      reviewedAt: request.reviewedAt,
      notes: request.notes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
    task: request.task
      ? {
          id: request.task.id,
          taskType: request.task.taskType,
          name: request.task.name,
          description: request.task.description,
          status: request.task.status,
          priority: request.task.priority,
          dueDate: request.task.dueDate,
          assignedToId: request.task.assignedToId,
          createdById: request.task.createdById, // Include createdById to identify the manager
          completedAt: request.task.completedAt,
          completedById: request.task.completedById,
          studyId: request.task.studyId,
          projectId: (request.task as any).study?.projectId, // Get projectId from study relation
          createdAt: request.task.createdAt,
          updatedAt: request.task.updatedAt,
        } as Task
      : ({} as Task),
    requestedBy: request.requestedBy
      ? {
          id: request.requestedBy.id,
          email: request.requestedBy.email,
          firstName: request.requestedBy.firstName,
          lastName: request.requestedBy.lastName,
          role: request.requestedBy.role,
          isActive: request.requestedBy.isActive,
          lastLoginAt: request.requestedBy.lastLoginAt,
          createdAt: request.requestedBy.createdAt,
          updatedAt: request.requestedBy.updatedAt,
        } as User
      : ({} as User),
  };

  // #region agent log
  const fs = require('fs');
  const path = require('path');
  const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
  try {
    fs.appendFileSync(logPath, `[EMIT-TASK-REQUEST] Emitting task-request:created, io available: ${!!io}, task.createdById: ${request.task?.createdById}, payload: ${JSON.stringify(payload)}\n`);
  } catch {}
  // #endregion

  if (io) {
    // Emit directly if socket instance is available (same process)
    io.emit('task-request:created', payload);
    // #region agent log
    try {
      fs.appendFileSync(logPath, `[EMIT-TASK-REQUEST] Emitted via io.emit\n`);
    } catch {}
    // #endregion
  } else {
    // Fallback to HTTP request (separate process)
    await emitViaHttp('task-request:created', payload);
    // #region agent log
    try {
      fs.appendFileSync(logPath, `[EMIT-TASK-REQUEST] Emitted via HTTP fallback\n`);
    } catch {}
    // #endregion
  }
}


/**
 * Emit task request approved event
 * Notifies the researcher who made the request that it was approved
 */
export async function emitTaskRequestApproved(
  request: TaskRequest & { task?: Task; reviewedBy?: User }
): Promise<void> {
  const io = getSocketInstance();
  
  const payload = {
    request: {
      id: request.id,
      taskId: request.taskId,
      requestedById: request.requestedById,
      requestType: request.requestType,
      requestedAssignedToId: request.requestedAssignedToId,
      status: request.status,
      reviewedById: request.reviewedById,
      reviewedAt: request.reviewedAt,
      notes: request.notes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
    task: request.task
      ? {
          id: request.task.id,
          taskType: request.task.taskType,
          name: request.task.name,
          description: request.task.description,
          status: request.task.status,
          priority: request.task.priority,
          dueDate: request.task.dueDate,
          assignedToId: request.task.assignedToId,
          createdById: request.task.createdById, // Include createdById
          completedAt: request.task.completedAt,
          completedById: request.task.completedById,
          studyId: request.task.studyId,
          projectId: (request.task as any).study?.projectId, // Get projectId from study relation
          createdAt: request.task.createdAt,
          updatedAt: request.task.updatedAt,
        } as Task
      : ({} as Task),
    reviewedBy: request.reviewedBy
      ? {
          id: request.reviewedBy.id,
          email: request.reviewedBy.email,
          firstName: request.reviewedBy.firstName,
          lastName: request.reviewedBy.lastName,
          role: request.reviewedBy.role,
          isActive: request.reviewedBy.isActive,
          lastLoginAt: request.reviewedBy.lastLoginAt,
          createdAt: request.reviewedBy.createdAt,
          updatedAt: request.reviewedBy.updatedAt,
        } as User
      : ({} as User),
  };

  if (io) {
    io.emit('task-request:approved', payload);
  } else {
    await emitViaHttp('task-request:approved', payload);
  }
}

/**
 * Emit task request rejected event
 * Notifies the researcher who made the request that it was rejected
 */
export async function emitTaskRequestRejected(
  request: TaskRequest & { task?: Task; reviewedBy?: User }
): Promise<void> {
  const io = getSocketInstance();
  
  const payload = {
    request: {
      id: request.id,
      taskId: request.taskId,
      requestedById: request.requestedById,
      requestType: request.requestType,
      requestedAssignedToId: request.requestedAssignedToId,
      status: request.status,
      reviewedById: request.reviewedById,
      reviewedAt: request.reviewedAt,
      notes: request.notes,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    },
    task: request.task
      ? {
          id: request.task.id,
          taskType: request.task.taskType,
          name: request.task.name,
          description: request.task.description,
          status: request.task.status,
          priority: request.task.priority,
          dueDate: request.task.dueDate,
          assignedToId: request.task.assignedToId,
          createdById: request.task.createdById, // Include createdById
          completedAt: request.task.completedAt,
          completedById: request.task.completedById,
          studyId: request.task.studyId,
          projectId: (request.task as any).study?.projectId, // Get projectId from study relation
          createdAt: request.task.createdAt,
          updatedAt: request.task.updatedAt,
        } as Task
      : ({} as Task),
    reviewedBy: request.reviewedBy
      ? {
          id: request.reviewedBy.id,
          email: request.reviewedBy.email,
          firstName: request.reviewedBy.firstName,
          lastName: request.reviewedBy.lastName,
          role: request.reviewedBy.role,
          isActive: request.reviewedBy.isActive,
          lastLoginAt: request.reviewedBy.lastLoginAt,
          createdAt: request.reviewedBy.createdAt,
          updatedAt: request.reviewedBy.updatedAt,
        } as User
      : ({} as User),
  };

  if (io) {
    io.emit('task-request:rejected', payload);
  } else {
    await emitViaHttp('task-request:rejected', payload);
  }
}

/**
 * Emit task assigned event
 * Notifies researchers when they are assigned to a task
 */
export async function emitTaskAssigned(
  task: Task & { study?: { projectId?: number }; createdBy?: User },
  assignedUserIds: number[]
): Promise<void> {
  const io = getSocketInstance();
  
  const payload = {
    task: {
      id: task.id,
      taskType: task.taskType,
      name: task.name,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      assignedToId: task.assignedToId,
      studyId: task.studyId,
      projectId: (task as any).study?.projectId,
      createdById: task.createdById,
      completedAt: task.completedAt,
      completedById: task.completedById,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    } as Task,
    assignedUserIds,
    createdBy: task.createdBy
      ? {
          id: task.createdBy.id,
          email: task.createdBy.email,
          firstName: task.createdBy.firstName,
          lastName: task.createdBy.lastName,
          role: task.createdBy.role,
          isActive: task.createdBy.isActive,
          lastLoginAt: task.createdBy.lastLoginAt,
          createdAt: task.createdBy.createdAt,
          updatedAt: task.createdBy.updatedAt,
        } as User
      : undefined,
  };

  if (io) {
    // Broadcast to all clients - they will filter based on assignedUserIds
    io.emit('task:assigned', payload);
  } else {
    // Fallback: emit via HTTP
    await emitViaHttp('task:assigned', payload);
  }
}
