// API route: GET /api/projects/[id]/studies/[studyId]/tasks, POST /api/projects/[id]/studies/[studyId]/tasks

import { NextRequest, NextResponse } from 'next/server';
import { getTasksByStudy, createTask, getTasksReadStatus } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../middleware';
import { CreateTaskRequest } from '@/types/api';
import { createNotification } from '@/services/notificationService';
import { emitTaskAssigned } from '@/lib/socket/taskRequestEvents';
import { Task, User, Study } from '@/lib/db/models';

/**
 * GET /api/projects/[id]/studies/[studyId]/tasks
 * Get all tasks for a study
 * - Managers: See all tasks
 * - Researchers: See only assigned tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const studyId = parseInt(params.studyId, 10);

    if (isNaN(studyId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const tasks = await getTasksByStudy(studyId, user);

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
 * POST /api/projects/[id]/studies/[studyId]/tasks
 * Create a new task
 * - Only Managers can create tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const studyId = parseInt(params.studyId, 10);

    if (isNaN(studyId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const body: CreateTaskRequest = await request.json();
    const task = await createTask(studyId, body, user);

    // If task was created with an initial assignment, create notification and emit socket event
    if (task.assignedToId) {
      // Reload task with createdBy and study for notification
      const reloadedTask = await task.reload({
        include: [
          { model: User, as: 'createdBy' },
          { model: User, as: 'assignedTo' },
          {
            model: Study,
            as: 'study',
            attributes: ['id', 'projectId'],
          },
        ],
      });

      const taskData = reloadedTask as any;
      const creatorName = reloadedTask.createdBy
        ? `${reloadedTask.createdBy.firstName} ${reloadedTask.createdBy.lastName}`
        : 'A manager';

      // Create DB notification for assigned researcher FIRST (await to ensure it's created)
      await createNotification(reloadedTask.assignedToId, {
        type: 'task',
        title: 'New Task Assigned',
        message: `${creatorName} assigned you to task "${reloadedTask.name}"`,
        taskId: reloadedTask.id,
        projectId: taskData?.study?.projectId,
        studyId: reloadedTask.studyId,
        senderId: reloadedTask.createdById,
        senderName: creatorName,
        actionUrl: taskData?.study?.projectId
          ? `/dashboard/projects/${taskData.study.projectId}/studies/${reloadedTask.studyId}/tasks/${reloadedTask.id}`
          : `/dashboard/tasks?highlight=${reloadedTask.id}`,
        timestamp: new Date(),
      }).catch((err) => {
        console.error(`Failed to create notification for user ${reloadedTask.assignedToId}:`, err);
      });

      // Emit socket event AFTER notification is created (so client can refresh and see it)
      emitTaskAssigned(reloadedTask, [reloadedTask.assignedToId]).catch((err) => {
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

