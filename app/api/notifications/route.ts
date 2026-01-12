// API route: GET /api/notifications - Fetch user notifications

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../middleware';
import { Notification } from '@/lib/db/models';

/**
 * GET /api/notifications
 * Fetch all notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    const notifications = await Notification.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
      limit: 50, // Keep last 50 notifications
    });

    return NextResponse.json({
      data: notifications.map((n) => ({
        id: `db-${n.id}`,
        type: n.type,
        title: n.title,
        message: n.message,
        roomType: n.roomType,
        roomId: n.roomId,
        taskId: n.taskId,
        projectId: n.projectId,
        studyId: n.studyId,
        senderId: n.senderId,
        senderName: n.senderName,
        timestamp: n.createdAt,
        read: n.read,
        actionUrl: n.actionUrl,
      })),
    });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
