// API route: PATCH /api/notifications/[notificationId] - Mark notification as read

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, createErrorResponse, getErrorStatusCode } from '../../middleware';
import { Notification } from '@/lib/db/models';

/**
 * PATCH /api/notifications/[notificationId]
 * Mark a notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    const notificationId = parseInt(params.notificationId.replace('db-', ''), 10);

    if (isNaN(notificationId)) {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Invalid notification ID' },
        { status: 400 }
      );
    }

    const notification = await Notification.findOne({
      where: { id: notificationId, userId: user.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'NotFoundError', message: 'Notification not found' },
        { status: 404 }
      );
    }

    await notification.update({ read: true });

    return NextResponse.json({ data: notification });
  } catch (error) {
    return createErrorResponse(
      error as Error,
      getErrorStatusCode(error as Error)
    );
  }
}
