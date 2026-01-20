// API route: GET /api/projects/[id]/tasks, POST /api/projects/[id]/tasks
// Handles project-level tasks (admin tasks)

import { NextRequest, NextResponse } from 'next/server';
import { getTasksByProject, createTask, getTasksReadStatus } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';
import { CreateTaskRequest } from '@/types/api';
import { createAndEmitNotification } from '@/services/notificationService';
import { emitTaskAssigned } from '@/lib/socket/taskRequestEvents';
import { Task, User, Project } from '@/lib/db/models';
import { TaskType } from '@/types/entities';

/**
 * GET /api/projects/[id]/tasks
 * Get all tasks for a project (both research and admin tasks)
 * - Managers: See all tasks
 * - Researchers: See only assigned tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const projectId = parseInt(params.id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const tasks = await getTasksByProject(projectId, user);

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
 * POST /api/projects/[id]/tasks
 * Create a new admin task at the project level
 * - Only Managers can create tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const projectId = parseInt(params.id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const body: CreateTaskRequest = await request.json();
    
    // Ensure taskType is ADMIN for project-level tasks
    // projectId is optional - admin tasks can be standalone or tied to a project
    const taskData: CreateTaskRequest = {
      ...body,
      taskType: TaskType.ADMIN,
      projectId, // Set projectId from URL param (optional for admin tasks)
    };

    // Create admin task (studyId is null for admin tasks, projectId is optional)
    const task = await createTask(null, taskData, user);

    // If task was created with an initial assignment, create notification and emit socket event
    if (task.assignedToId) {
      // Reload task with createdBy and project for notification
      const reloadedTask = await task.reload({
        include: [
          { model: User, as: 'createdBy' },
          { model: User, as: 'assignedTo' },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
          },
        ],
      });

      const taskData = reloadedTask as any;
      // Use taskData to access included relations (createdBy is loaded via include)
      const creatorName = taskData.createdBy
        ? `${taskData.createdBy.firstName} ${taskData.createdBy.lastName}`
        : 'A manager';

      // Create DB notification for assigned researcher FIRST (await to ensure it's created)
      // assignedToId is guaranteed to be non-null here due to the check on line 89
      await createAndEmitNotification(reloadedTask.assignedToId!, {
        type: 'task',
        title: 'New Task Assigned',
        message: `${creatorName} assigned you to task "${reloadedTask.name}"`,
        taskId: reloadedTask.id,
        projectId: reloadedTask.projectId || projectId,
        studyId: undefined, // Admin tasks don't have studyId
        senderId: reloadedTask.createdById,
        senderName: creatorName,
        actionUrl: reloadedTask.projectId
          ? `/dashboard/projects/${reloadedTask.projectId}/tasks/${reloadedTask.id}`
          : `/dashboard/tasks/${reloadedTask.id}`,
        timestamp: new Date(),
      }).catch((err) => {
        console.error(`Failed to create notification for user ${reloadedTask.assignedToId}:`, err);
      });

      // Emit socket event AFTER notification is created (so client can refresh and see it)
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
