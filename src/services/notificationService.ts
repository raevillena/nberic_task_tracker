// Notification service for creating and managing notifications

import { Notification } from '@/lib/db/models';
import { Notification as NotificationType } from '@/store/slices/notificationSlice';
import { getSocketInstance } from '@/lib/socket/instance';

/**
 * Emit notification via Socket.IO for immediate delivery
 * Falls back to HTTP if socket instance is not available
 */
async function emitNotificationViaSocket(
  userId: number,
  notification: Notification
): Promise<void> {
  const io = getSocketInstance();
  
  const socketNotification = {
    id: `db-${notification.id}`, // Prefix with 'db-' to identify as database notification
    type: notification.type,
    title: notification.title,
    message: notification.message,
    roomType: notification.roomType || undefined,
    roomId: notification.roomId || undefined,
    taskId: notification.taskId || undefined,
    projectId: notification.projectId || undefined,
    studyId: notification.studyId || undefined,
    senderId: notification.senderId || undefined,
    senderName: notification.senderName || undefined,
    actionUrl: notification.actionUrl || undefined,
    timestamp: notification.createdAt.toISOString(),
  };

  if (io) {
    // Emit directly via socket instance
    io.emit('notification:new', {
      notification: socketNotification,
      targetUserId: userId,
    });
  } else {
    // Fallback: emit via HTTP request to socket server
    const socketUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
    try {
      await fetch(`${socketUrl}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'notification:new',
          payload: {
            notification: socketNotification,
            targetUserId: userId,
          },
        }),
      }).catch((err) => {
        console.error('Failed to emit notification via HTTP:', err);
      });
    } catch (error) {
      console.error('Failed to emit notification via HTTP:', error);
    }
  }
}

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
 * Create a notification in the database AND emit it via Socket.IO for immediate delivery
 * This ensures users receive notifications instantly via socket, with DB as persistence
 * 
 * @param userId - The user ID to notify
 * @param notification - The notification data
 * @param emitViaSocket - Whether to emit via socket (default: true)
 * @returns The created notification
 */
export async function createAndEmitNotification(
  userId: number,
  notification: Omit<NotificationType, 'id' | 'timestamp' | 'read'> & { timestamp?: Date; read?: boolean },
  emitViaSocket: boolean = true
): Promise<Notification> {
  // Create notification in database first
  const dbNotification = await createNotification(userId, notification);
  
  // Emit via socket for immediate delivery (if enabled)
  if (emitViaSocket) {
    emitNotificationViaSocket(userId, dbNotification).catch((err) => {
      console.error(`Failed to emit notification ${dbNotification.id} via socket:`, err);
      // Don't throw - notification was created in DB, socket is just for real-time delivery
    });
  }
  
  return dbNotification;
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
