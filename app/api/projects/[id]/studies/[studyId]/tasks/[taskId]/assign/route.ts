// API route: POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/assign

import { NextRequest, NextResponse } from 'next/server';
import { assignTask, assignTaskToMultiple } from '@/services/taskService';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../../../../../../middleware';
import { sequelize } from '@/lib/db/connection';
import { emitTaskAssigned } from '@/lib/socket/taskRequestEvents';
import { createNotification } from '@/services/notificationService';
import { Task, User, Study } from '@/lib/db/models';

/**
 * POST /api/projects/[id]/studies/[studyId]/tasks/[taskId]/assign
 * Assign a task to researcher(s)
 * - Only Managers can assign tasks
 * - Supports single assignment (assignedToId) or multiple (userIds array)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; studyId: string; taskId: string } }
) {
  const transaction = await sequelize.transaction();

  try {
    const user = await getAuthenticatedUser(request);
    const taskId = parseInt(params.taskId, 10);

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
      
      // Emit socket event to notify assigned researchers
      // Don't await to avoid blocking the response
      // Reload task with createdBy and study to include in notification
      task.reload({
        include: [
          { model: User, as: 'createdBy' },
          {
            model: Study,
            as: 'study',
            attributes: ['id', 'projectId'],
          },
        ],
      }).then(async (reloadedTask) => {
        const taskData = reloadedTask as any;
        const creatorName = reloadedTask.createdBy
          ? `${reloadedTask.createdBy.firstName} ${reloadedTask.createdBy.lastName}`
          : 'A manager';
        
        // Filter out users who already have a notification (e.g., if task was just created with assignedToId)
        // This prevents duplicate notifications when a task is created with multiple researchers
        // The first researcher already got a notification during task creation
        const usersToNotify = userIds.filter((userId) => {
          // If this task was just created (within last 5 seconds) and this user is the assignedToId,
          // they already got a notification during creation, so skip them
          const taskAge = Date.now() - new Date(reloadedTask.createdAt).getTime();
          const isRecentlyCreated = taskAge < 5000; // 5 seconds
          const isOriginalAssignee = reloadedTask.assignedToId === userId;
          
          // Skip notification if task was recently created and this user is the original assignee
          return !(isRecentlyCreated && isOriginalAssignee);
        });
        
        // Create DB notifications for assigned researchers FIRST (await to ensure they're created)
        // Only notify users who didn't already get a notification during task creation
        if (usersToNotify.length > 0) {
          await Promise.all(
            usersToNotify.map((userId) =>
              createNotification(userId, {
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
                console.error(`Failed to create notification for user ${userId}:`, err);
              })
            )
          );
        }
        
        // Emit socket event AFTER notifications are created (so client can refresh and see them)
        // Only emit for users who actually got new notifications to avoid duplicate toasts
        emitTaskAssigned(reloadedTask, usersToNotify.length > 0 ? usersToNotify : userIds).catch((err) => {
          console.error('Failed to emit task:assigned event:', err);
        });
      }).catch(() => {
        // If reload fails, emit anyway with basic task data
        emitTaskAssigned(task, userIds).catch((err) => {
          console.error('Failed to emit task:assigned event:', err);
        });
      });
      
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

      const task = await assignTask(taskId, assignedToId, user);
      await transaction.commit();
      
      // Emit socket event to notify assigned researcher
      // Don't await to avoid blocking the response
      // Reload task with createdBy and study to include in notification
      task.reload({
        include: [
          { model: User, as: 'createdBy' },
          {
            model: Study,
            as: 'study',
            attributes: ['id', 'projectId'],
          },
        ],
      }).then((reloadedTask) => {
        emitTaskAssigned(reloadedTask, [assignedToId]).catch((err) => {
          console.error('Failed to emit task:assigned event:', err);
        });
        
        // Create DB notification for assigned researcher
        const taskData = reloadedTask as any;
        const creatorName = reloadedTask.createdBy
          ? `${reloadedTask.createdBy.firstName} ${reloadedTask.createdBy.lastName}`
          : 'A manager';
        
        createNotification(assignedToId, {
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
          console.error(`Failed to create notification for user ${assignedToId}:`, err);
        });
      }).catch(() => {
        // If reload fails, emit anyway with basic task data
        emitTaskAssigned(task, [assignedToId]).catch((err) => {
          console.error('Failed to emit task:assigned event:', err);
        });
      });
      
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

