// Notification service for creating and managing notifications

import { Notification } from '@/lib/db/models';
import { Notification as NotificationType } from '@/store/slices/notificationSlice';

/**
 * Create a notification in the database
 */
export async function createNotification(
  userId: number,
  notification: Omit<NotificationType, 'id' | 'timestamp' | 'read'> & { timestamp?: Date; read?: boolean }
): Promise<Notification> {
  return await Notification.create({
    userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    roomType: notification.roomType || null,
    roomId: notification.roomId || null,
    taskId: notification.taskId || null,
    projectId: notification.projectId || null,
    studyId: notification.studyId || null,
    senderId: notification.senderId || null,
    senderName: notification.senderName || null,
    read: notification.read ?? false,
    actionUrl: notification.actionUrl || null,
    createdAt: notification.timestamp || new Date(),
  });
}

/**
 * Mark notification as read in database
 */
export async function markNotificationAsRead(
  notificationId: number,
  userId: number
): Promise<Notification | null> {
  const notification = await Notification.findOne({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    return null;
  }

  await notification.update({ read: true });
  return notification;
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(
  userId: number,
  limit: number = 50
): Promise<Notification[]> {
  return await Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit,
  });
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: number): Promise<number> {
  return await Notification.count({
    where: { userId, read: false },
  });
}
