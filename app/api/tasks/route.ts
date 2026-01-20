// API route: GET /api/tasks, POST /api/tasks - Get all tasks or create standalone admin task

import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, getTasksReadStatus, createTask } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../middleware';
import { CreateTaskRequest } from '@/types/api';
import { TaskType } from '@/types/entities';
import { createAndEmitNotification } from '@/services/notificationService';
import { emitTaskAssigned } from '@/lib/socket/taskRequestEvents';
import { Task, User } from '@/lib/db/models';

/**
 * GET /api/tasks
 * Get all tasks
 * - Managers: See all tasks
 * - Researchers: See only assigned tasks
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const tasks = await getAllTasks(user);

    // Get read status for all tasks
    const taskIds = tasks.map((t) => t.id);
    const readStatus = await getTasksReadStatus(taskIds, user.id);

    // Add isRead property to each task
    const tasksWithReadStatus = tasks.map((task) => ({
      ...task.toJSON(),
      isRead: readStatus[task.id] || false,
    }));

    return NextResponse.json({ data: tasksWithReadStatus });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}

/**
 * POST /api/tasks
 * Create a standalone admin task (no project or study required)
 * - Only Managers can create tasks
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const body: CreateTaskRequest = await request.json();
    
    // Ensure taskType is ADMIN for standalone tasks
    const taskData: CreateTaskRequest = {
      ...body,
      taskType: TaskType.ADMIN,
      // projectId is optional for admin tasks
    };

    // Create admin task (studyId is null, projectId is optional)
    const task = await createTask(null, taskData, user);

    // If task was created with an initial assignment, create notification and emit socket event
    if (task.assignedToId) {
      // Reload task with createdBy and assignedTo for notification
      const reloadedTask = await task.reload({
        include: [
          { model: User, as: 'createdBy' },
          { model: User, as: 'assignedTo' },
        ],
      });

      const taskData = reloadedTask as any;
      // Use taskData to access included relations (createdBy is loaded via include)
      const creatorName = taskData.createdBy
        ? `${taskData.createdBy.firstName} ${taskData.createdBy.lastName}`
        : 'A manager';

      // Create DB notification for assigned researcher and emit via socket for immediate delivery
      // assignedToId is guaranteed to be non-null here due to the check on line 63
      await createAndEmitNotification(reloadedTask.assignedToId!, {
        type: 'task',
        title: 'New Task Assigned',
        message: `${creatorName} assigned you to task "${reloadedTask.name}"`,
        taskId: reloadedTask.id,
        projectId: reloadedTask.projectId ?? undefined,
        studyId: undefined,
        senderId: reloadedTask.createdById,
        senderName: creatorName,
        actionUrl: reloadedTask.projectId
          ? `/dashboard/projects/${reloadedTask.projectId}/tasks/${reloadedTask.id}`
          : `/dashboard/tasks/${reloadedTask.id}`,
        timestamp: new Date(),
      }).catch((err) => {
        console.error(`Failed to create notification for user ${reloadedTask.assignedToId}:`, err);
      });

      // Emit socket event AFTER notification is created
      emitTaskAssigned(reloadedTask, [reloadedTask.assignedToId!]).catch((err) => {
        console.error('Failed to emit task:assigned event:', err);
      });
    }

    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
