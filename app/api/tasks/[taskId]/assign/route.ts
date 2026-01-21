// API route: POST /api/tasks/[taskId]/assign

import { NextRequest, NextResponse } from 'next/server';
import { assignTaskToMultiple } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../middleware';
import { sequelize } from '@/lib/db/connection';
import { emitTaskAssigned } from '@/lib/socket/taskRequestEvents';
import { createAndEmitNotification } from '@/services/notificationService';
import { Task, User, Project, Study } from '@/lib/db/models';

/**
 * POST /api/tasks/[taskId]/assign
 * Assign a task to researcher(s) (works for both research and admin tasks)
 * - Only Managers can assign tasks
 * - Supports single assignment (assignedToId) or multiple (userIds array)
 * 
 * IMPORTANT: This route awaits notification creation and socket emission
 * BEFORE returning the response to ensure real-time updates are instant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const transaction = await sequelize.transaction();

  try {
    const user = await getAuthenticatedUser(request);
    const { taskId: taskIdParam } = await params;
    const taskId = parseInt(taskIdParam, 10);

    if (isNaN(taskId)) {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid task ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Support both legacy single assignment and new multiple assignment
    if (body.userIds && Array.isArray(body.userIds)) {
      // Multiple assignment
      if (body.userIds.length === 0) {
        await transaction.rollback();
        return NextResponse.json(
          { error: 'ValidationError', message: 'userIds array cannot be empty' },
          { status: 400 }
        );
      }

      const userIds = body.userIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
      if (userIds.length !== body.userIds.length) {
        await transaction.rollback();
        return NextResponse.json(
          { error: 'ValidationError', message: 'All userIds must be valid numbers' },
          { status: 400 }
        );
      }

      const task = await assignTaskToMultiple(taskId, userIds, user, transaction);
      await transaction.commit();
      
      // AWAIT socket event and notification creation BEFORE returning response
      // This ensures real-time updates are instant for the researcher
      try {
        // Reload task with createdBy and project/study to include in notification
        const reloadedTask = await task.reload({
          include: [
            { model: User, as: 'createdBy' },
            {
              model: Project,
              as: 'project',
              attributes: ['id', 'name'],
              required: false,
            },
            {
              model: Study,
              as: 'study',
              attributes: ['id', 'projectId'],
              required: false,
              include: [
                {
                  model: Project,
                  as: 'project',
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        });
        
        const taskData = reloadedTask as any;
        // Use taskData to access included relations (createdBy is loaded via include)
        const creatorName = taskData.createdBy
          ? `${taskData.createdBy.firstName} ${taskData.createdBy.lastName}`
          : 'A manager';
        
        // Filter out users who already have a notification (e.g., if task was just created with assignedToId)
        const usersToNotify = userIds.filter((userId: number) => {
          const taskAge = Date.now() - new Date(reloadedTask.createdAt).getTime();
          const isRecentlyCreated = taskAge < 5000; // 5 seconds
          const isOriginalAssignee = reloadedTask.assignedToId === userId;
          return !(isRecentlyCreated && isOriginalAssignee);
        });
        
        // Create DB notifications for assigned researchers (await completion)
        if (usersToNotify.length > 0) {
          await Promise.all(
            usersToNotify.map((userId: number) =>
              createAndEmitNotification(userId, {
                type: 'task',
                title: 'New Task Assigned',
                message: `${creatorName} assigned you to task "${reloadedTask.name}"`,
                taskId: reloadedTask.id,
                projectId: reloadedTask.projectId ?? undefined,
                studyId: reloadedTask.studyId ?? undefined,
                senderId: reloadedTask.createdById,
                senderName: creatorName,
                actionUrl: reloadedTask.projectId
                  ? `/dashboard/projects/${reloadedTask.projectId}/tasks/${reloadedTask.id}`
                  : reloadedTask.studyId && taskData.study?.project?.id
                  ? `/dashboard/projects/${taskData.study.project.id}/studies/${reloadedTask.studyId}/tasks/${reloadedTask.id}`
                  : `/dashboard/tasks/${reloadedTask.id}`,
                timestamp: new Date(),
              }).catch((err) => {
                console.error(`Failed to create notification for user ${userId}:`, err);
              })
            )
          );
        }
        
        // Emit socket event AFTER notifications are created (await completion)
        await emitTaskAssigned(reloadedTask, usersToNotify.length > 0 ? usersToNotify : userIds);
      } catch (notifyError) {
        // Log error but don't fail the request - assignment was successful
        console.error('Failed to send notifications/socket event:', notifyError);
        // Still try to emit with basic task data
        try {
          await emitTaskAssigned(task, userIds);
        } catch (socketErr) {
          console.error('Failed to emit task:assigned event:', socketErr);
        }
      }
      
      return NextResponse.json({ data: task });
    } else if (body.assignedToId) {
      // Legacy single assignment (backward compatible)
      const assignedToId = parseInt(body.assignedToId, 10);
      if (isNaN(assignedToId)) {
        await transaction.rollback();
        return NextResponse.json(
          { error: 'ValidationError', message: 'assignedToId must be a valid number' },
          { status: 400 }
        );
      }

      // Use assignTaskToMultiple with the transaction for consistency
      const task = await assignTaskToMultiple(taskId, [assignedToId], user, transaction);
      await transaction.commit();
      
      // AWAIT socket event and notification creation BEFORE returning response
      try {
        const reloadedTask = await task.reload({
          include: [
            { model: User, as: 'createdBy' },
            {
              model: Project,
              as: 'project',
              attributes: ['id', 'name'],
              required: false,
            },
            {
              model: Study,
              as: 'study',
              attributes: ['id', 'projectId'],
              required: false,
              include: [
                {
                  model: Project,
                  as: 'project',
                  attributes: ['id', 'name'],
                },
              ],
            },
          ],
        });
        
        const taskData2 = reloadedTask as any;
        // Use taskData2 to access included relations (createdBy is loaded via include)
        const creatorName = taskData2.createdBy
          ? `${taskData2.createdBy.firstName} ${taskData2.createdBy.lastName}`
          : 'A manager';
        
        // Create DB notification for assigned researcher (await completion)
        await createAndEmitNotification(assignedToId, {
          type: 'task',
          title: 'New Task Assigned',
          message: `${creatorName} assigned you to task "${reloadedTask.name}"`,
          taskId: reloadedTask.id,
          projectId: reloadedTask.projectId ?? undefined,
          studyId: reloadedTask.studyId ?? undefined,
          senderId: reloadedTask.createdById,
          senderName: creatorName,
          actionUrl: reloadedTask.projectId
            ? `/dashboard/projects/${reloadedTask.projectId}/tasks/${reloadedTask.id}`
            : reloadedTask.studyId && taskData2.study?.project?.id
            ? `/dashboard/projects/${taskData2.study.project.id}/studies/${reloadedTask.studyId}/tasks/${reloadedTask.id}`
            : `/dashboard/tasks/${reloadedTask.id}`,
          timestamp: new Date(),
        }).catch((err) => {
          console.error(`Failed to create notification for user ${assignedToId}:`, err);
        });
        
        // Emit socket event (await completion)
        await emitTaskAssigned(reloadedTask, [assignedToId]);
      } catch (notifyError) {
        // Log error but don't fail the request - assignment was successful
        console.error('Failed to send notifications/socket event:', notifyError);
        try {
          await emitTaskAssigned(task, [assignedToId]);
        } catch (socketErr) {
          console.error('Failed to emit task:assigned event:', socketErr);
        }
      }
      
      return NextResponse.json({ data: task });
    } else {
      await transaction.rollback();
      return NextResponse.json(
        { error: 'ValidationError', message: 'Either assignedToId or userIds array is required' },
        { status: 400 }
      );
    }
  } catch (error) {
    await transaction.rollback();
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
