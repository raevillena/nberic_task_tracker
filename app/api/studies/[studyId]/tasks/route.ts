// Tasks API route

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandler } from '@/lib/api/routeWrapper';
import { getTasksByStudy, createTask } from '@/services/taskService';
import { CreateTaskRequest } from '@/types/api';
import { createAndEmitNotification } from '@/services/notificationService';
import { emitTaskAssigned } from '@/lib/socket/taskRequestEvents';
import { Task, User, Study } from '@/lib/db/models';

// GET /api/studies/[studyId]/tasks - Get tasks for a study
export const GET = createRouteHandler(
  async (req, context) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params if it's a Promise (Next.js 16+)
    const params = context?.params instanceof Promise 
      ? await context.params 
      : context?.params || {};
    
    const studyId = parseInt(params.studyId || '0', 10);
    if (!studyId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const tasks = await getTasksByStudy(studyId, req.user);
    return NextResponse.json(tasks);
  },
  {
    requireAuth: true,
    requirePermission: {
      resource: 'task',
      action: 'read',
    },
  }
);

// POST /api/studies/[studyId]/tasks - Create a new task
export const POST = createRouteHandler(
  async (req, context) => {
    if (!req.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Await params if it's a Promise (Next.js 16+)
    const params = context?.params instanceof Promise 
      ? await context.params 
      : context?.params || {};
    
    const studyId = parseInt(params.studyId || '0', 10);
    if (!studyId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const body: CreateTaskRequest = await req.json();
    const task = await createTask(studyId, body, req.user);

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
      // Use taskData to access included relations (createdBy is loaded via include)
      const creatorName = taskData.createdBy
        ? `${taskData.createdBy.firstName} ${taskData.createdBy.lastName}`
        : 'A manager';

      // Create DB notification for assigned researcher FIRST (await to ensure it's created)
      // assignedToId is guaranteed to be non-null here due to the check on line 63
      await createAndEmitNotification(reloadedTask.assignedToId!, {
        type: 'task',
        title: 'New Task Assigned',
        message: `${creatorName} assigned you to task "${reloadedTask.name}"`,
        taskId: reloadedTask.id,
        projectId: taskData?.study?.projectId,
        studyId: reloadedTask.studyId ?? undefined,
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
      emitTaskAssigned(reloadedTask, [reloadedTask.assignedToId!]).catch((err) => {
        console.error('Failed to emit task:assigned event:', err);
      });
    }

    return NextResponse.json(task, { status: 201 });
  },
  {
    requireAuth: true,
    requirePermission: {
      resource: 'task',
      action: 'create',
    },
  }
);

