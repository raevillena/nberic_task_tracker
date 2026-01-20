// Socket.IO message handlers

import { Socket, Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  Message as MessageType,
} from '@/types/socket';
import { UserRole } from '@/types/entities';
import {
  createMessage,
  editMessage,
  deleteMessage,
  getMessagesByRoom,
} from '@/services/messageService';
import { canAccessResource } from '@/lib/rbac/guards';
import { PermissionError, ValidationError, NotFoundError } from '@/lib/utils/errors';
import { Message as MessageModel, User, Task, Study, Project, TaskAssignment } from '@/lib/db/models';
import { createNotification } from '@/services/notificationService'; // Keep createNotification here since we emit separately
import { Op } from 'sequelize';

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

type TypedIO = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

/**
 * Get all users who should receive notifications for a room
 * Returns user IDs (excluding the sender)
 */
async function getUsersForRoomNotification(
  roomType: 'project' | 'study' | 'task',
  roomId: number,
  senderId: number
): Promise<number[]> {
  const userIds = new Set<number>();

  switch (roomType) {
    case 'task': {
      // Get task with assignments
      // Use unscoped() to bypass soft-delete default scope - we want to notify
      // even if task is soft-deleted (users may still have the chat open)
      const task = await Task.unscoped().findByPk(roomId, {
        include: [
          { model: User, as: 'createdBy', attributes: ['id'] },
          { model: User, as: 'assignedTo', attributes: ['id'] },
          {
            model: User,
            as: 'assignedResearchers',
            through: { attributes: [] },
            attributes: ['id'],
          },
          {
            model: Study.unscoped(),
            as: 'study',
            attributes: ['id', 'projectId'],
          },
        ],
      });

      if (!task) return [];

      // Add manager who created the task
      if (task.createdById) {
        userIds.add(task.createdById);
      }

      // Add assigned researcher (legacy)
      if (task.assignedToId) {
        userIds.add(task.assignedToId);
      }

      // Add assigned researchers (many-to-many)
      const taskWithResearchers = task as Task & { assignedResearchers?: Array<{ id: number }> };
      if (taskWithResearchers.assignedResearchers) {
        taskWithResearchers.assignedResearchers.forEach((r) => {
          userIds.add(r.id);
        });
      }

      // Also check TaskAssignment table directly as fallback
      try {
        const assignments = await TaskAssignment.findAll({
          where: { taskId: roomId },
          attributes: ['userId'],
        });
        assignments.forEach((a) => {
          userIds.add(a.userId);
        });
      } catch (error) {
        // Table might not exist, that's okay
      }

      break;
    }

    case 'study': {
      // Get all managers
      const managers = await User.findAll({
        where: { role: UserRole.MANAGER },
        attributes: ['id'],
      });
      managers.forEach((m) => userIds.add(m.id));

      // Get all researchers with assigned tasks in this study
      // Check legacy assignedToId
      const tasksByAssignedTo = await Task.findAll({
        where: { studyId: roomId, assignedToId: { [Op.ne]: null } },
        attributes: ['assignedToId'],
      });
      tasksByAssignedTo.forEach((t) => {
        if (t.assignedToId) userIds.add(t.assignedToId);
      });

      // Check many-to-many assignments
      try {
        const studyTasks = await Task.findAll({
          where: { studyId: roomId },
          attributes: ['id'],
        });
        const taskIds = studyTasks.map((t) => t.id);

        if (taskIds.length > 0) {
          const assignments = await TaskAssignment.findAll({
            where: { taskId: { [Op.in]: taskIds } },
            attributes: ['userId'],
          });
          assignments.forEach((a) => {
            userIds.add(a.userId);
          });
        }
      } catch (error) {
        // Table might not exist, that's okay
      }

      break;
    }

    case 'project': {
      // Get all managers
      const managers = await User.findAll({
        where: { role: UserRole.MANAGER },
        attributes: ['id'],
      });
      managers.forEach((m) => userIds.add(m.id));

      // Get all studies in this project
      const studies = await Study.findAll({
        where: { projectId: roomId },
        attributes: ['id'],
      });
      const studyIds = studies.map((s) => s.id);

      if (studyIds.length > 0) {
        // Get all researchers with assigned tasks in any study of this project
        // Check legacy assignedToId
        const tasksByAssignedTo = await Task.findAll({
          where: {
            studyId: { [Op.in]: studyIds },
            assignedToId: { [Op.ne]: null },
          },
          attributes: ['assignedToId'],
        });
        tasksByAssignedTo.forEach((t) => {
          if (t.assignedToId) userIds.add(t.assignedToId);
        });

        // Check many-to-many assignments
        try {
          const projectTasks = await Task.findAll({
            where: { studyId: { [Op.in]: studyIds } },
            attributes: ['id'],
          });
          const taskIds = projectTasks.map((t) => t.id);

          if (taskIds.length > 0) {
            const assignments = await TaskAssignment.findAll({
              where: { taskId: { [Op.in]: taskIds } },
              attributes: ['userId'],
            });
            assignments.forEach((a) => {
              userIds.add(a.userId);
            });
          }
        } catch (error) {
          // Table might not exist, that's okay
        }
      }

      break;
    }
  }

  // Remove sender from the list
  userIds.delete(senderId);

  return Array.from(userIds);
}

/**
 * Send message history to socket
 */
export async function sendMessageHistory(
  socket: TypedSocket,
  roomType: 'project' | 'study' | 'task',
  roomId: number,
  limit: number = 50,
  cursor?: number
): Promise<void> {
  try {
    const user = {
      id: socket.data.userId,
      email: '', // Not needed for message service
      role: socket.data.userRole as UserRole,
    };

    const result = await getMessagesByRoom(roomType, roomId, user, limit, cursor);

    socket.emit('message:history', {
      messages: result.messages.map((m) => m.toJSON() as MessageType),
      roomType,
      roomId,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    console.error('Error in sendMessageHistory:', error);
    socket.emit('error', {
      message: 'Failed to load message history',
      code: 'HISTORY_LOAD_ERROR',
    });
  }
}

/**
 * Setup message send/edit/delete handlers
 */
export function setupMessageHandlers(socket: TypedSocket, io: TypedIO): void {
  const userId = socket.data.userId;
  const userRole = socket.data.userRole as UserRole;

  socket.on('message:send', async (data: Parameters<ClientToServerEvents['message:send']>[0]) => {
    try {
      const {
        roomType,
        roomId,
        content,
        type,
        fileId,
        fileName,
        fileSize,
        mimeType,
        replyToId,
      } = data;

      // Check room access
      const hasAccess = await canAccessResource(
        userId,
        userRole,
        roomType,
        roomId
      );

      if (!hasAccess) {
        socket.emit('error', {
          message: 'Access denied to send messages in this room',
          code: 'ACCESS_DENIED',
        });
        return;
      }

      // Create message using service
      const message = await createMessage(
        roomType,
        roomId,
        userId,
        content,
        type,
        fileId,
        fileName,
        fileSize,
        mimeType,
        replyToId
      );

      // Reload message with sender info for notifications
      const messageWithSender = await MessageModel.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      });

      // Get sender info - type cast to access included relation
      const messageWithSenderTyped = messageWithSender as MessageModel & { sender?: User };
      const sender = messageWithSenderTyped?.sender;
      const senderName = sender
        ? `${sender.firstName} ${sender.lastName}`
        : 'A user';

      // Get room context for action URL
      let projectId: number | undefined;
      let studyId: number | undefined;
      let taskId: number | undefined;

      if (roomType === 'task') {
        taskId = roomId;
        // Load task to get study and project (for both research and admin tasks)
        const task = await Task.findByPk(roomId, {
          include: [
            {
              model: Study,
              as: 'study',
              attributes: ['id', 'projectId'],
              required: false, // Optional for admin tasks
            },
            {
              model: Project,
              as: 'project',
              attributes: ['id'],
              required: false, // Optional - only for admin tasks
            },
          ],
        });
        // Type cast to access included relations
        const taskWithRelations = task as Task & { study?: Study; project?: Project };
        if (taskWithRelations?.study) {
          // Research task - get projectId from study
          studyId = taskWithRelations.study.id;
          projectId = taskWithRelations.study.projectId;
        } else if (taskWithRelations?.project) {
          // Admin task with project - use direct projectId
          projectId = taskWithRelations.project.id;
        } else if (taskWithRelations?.projectId) {
          // Admin task with projectId but project not loaded
          projectId = taskWithRelations.projectId;
        }
      } else if (roomType === 'study') {
        studyId = roomId;
        const study = await Study.findByPk(roomId, {
          attributes: ['projectId'],
        });
        if (study) {
          projectId = study.projectId;
        }
      } else if (roomType === 'project') {
        projectId = roomId;
      }

      // Build action URL
      let actionUrl = '';
      if (taskId && studyId && projectId) {
        // Research task
        actionUrl = `/dashboard/projects/${projectId}/studies/${studyId}/tasks/${taskId}`;
      } else if (taskId && projectId) {
        // Admin task with project
        actionUrl = `/dashboard/projects/${projectId}/tasks/${taskId}`;
      } else if (taskId) {
        // Standalone admin task
        actionUrl = `/dashboard/tasks/${taskId}`;
      } else if (studyId && projectId) {
        actionUrl = `/dashboard/projects/${projectId}/studies/${studyId}`;
      } else if (projectId) {
        actionUrl = `/dashboard/projects/${projectId}`;
      }

      // Get all users who should receive notifications (excluding sender)
      const userIdsToNotify = await getUsersForRoomNotification(
        roomType,
        roomId,
        userId
      );

      // Build notification data once for reuse
      const messagePreview =
        type === 'text'
          ? content.substring(0, 100)
          : type === 'image'
          ? '📷 Image'
          : '📎 File';
      
      const notificationTitle =
        roomType === 'task'
          ? 'New message in task'
          : roomType === 'study'
          ? 'New message in study'
          : 'New message in project';

      // Create database notifications for all users with room access (except sender)
      // This ensures notifications are created even if users aren't currently in the room
      const notificationPromises = userIdsToNotify.map((targetUserId) => {
        return createNotification(targetUserId, {
          type: 'message',
          title: notificationTitle,
          message: messagePreview,
          roomType,
          roomId,
          taskId: taskId,
          projectId: projectId,
          studyId: studyId,
          senderId: userId,
          senderName,
          actionUrl,
          timestamp: new Date(),
          read: false,
        }).catch((err) => {
          console.error(`Failed to create notification for user ${targetUserId}:`, err);
        });
      });

      // AWAIT notification creation so we can emit socket events after
      await Promise.all(notificationPromises);

      // Broadcast to room (including sender) - for real-time chat updates
      const roomKey = `${roomType}:${roomId}`;
      io.to(roomKey).emit('message:new', {
        message: message.toJSON() as MessageType,
      });
      
      // Also send directly to sender to ensure they see their message immediately
      socket.emit('message:new', {
        message: message.toJSON() as MessageType,
      });

      // CRITICAL: Emit notification:new to ALL target users (not just those in the room)
      // This ensures users on the dashboard who haven't opened the chat get toast notifications
      const notificationPayload = {
        id: `msg-${message.id}-${Date.now()}`,
        type: 'message' as const,
        title: notificationTitle,
        message: messagePreview,
        roomType,
        roomId,
        taskId,
        projectId,
        studyId,
        senderId: userId,
        senderName,
        actionUrl,
        timestamp: new Date().toISOString(),
      };

      // Emit to each target user individually
      // io.emit broadcasts to ALL clients, then clients filter by targetUserId
      userIdsToNotify.forEach((targetUserId) => {
        io.emit('notification:new', {
          notification: notificationPayload,
          targetUserId,
        });
      });
    } catch (error) {
      // Log the actual error for debugging
      console.error('Error in message:send handler:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.constructor.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      if (error instanceof ValidationError) {
        socket.emit('error', {
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
      } else if (error instanceof PermissionError) {
        socket.emit('error', {
          message: error.message,
          code: 'PERMISSION_ERROR',
        });
      } else {
        // Include more details about the error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('error', {
          message: `Failed to send message: ${errorMessage}`,
          code: 'MESSAGE_SEND_ERROR',
        });
      }
    }
  });

  socket.on('message:edit', async (data: Parameters<ClientToServerEvents['message:edit']>[0]) => {
    try {
      const { messageId, content } = data;

      const user = {
        id: userId,
        email: '', // Not needed
        role: userRole,
      };

      // Edit message using service
      const updatedMessage = await editMessage(messageId, content, user);

      // Broadcast to room
      const roomKey = `${updatedMessage.roomType}:${updatedMessage.roomId}`;
      io.to(roomKey).emit('message:edited', {
        message: updatedMessage.toJSON() as MessageType,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        socket.emit('error', {
          message: error.message,
          code: 'VALIDATION_ERROR',
        });
      } else if (error instanceof PermissionError) {
        socket.emit('error', {
          message: error.message,
          code: 'PERMISSION_ERROR',
        });
      } else {
        socket.emit('error', {
          message: 'Failed to edit message',
          code: 'MESSAGE_EDIT_ERROR',
        });
      }
    }
  });

  socket.on('message:delete', async (data: Parameters<ClientToServerEvents['message:delete']>[0]) => {
    try {
      const { messageId } = data;

      const user = {
        id: userId,
        email: '', // Not needed
        role: userRole,
      };

      // Load message to get room info before deletion
      const message = await MessageModel.findByPk(messageId);
      if (!message) {
        socket.emit('error', {
          message: 'Message not found',
          code: 'MESSAGE_NOT_FOUND',
        });
        return;
      }

      // Delete message using service
      await deleteMessage(messageId, user);

      // Broadcast to room
      const roomKey = `${message.roomType}:${message.roomId}`;
      io.to(roomKey).emit('message:deleted', {
        messageId,
        roomType: message.roomType,
        roomId: message.roomId,
      });
    } catch (error) {
      if (error instanceof PermissionError) {
        socket.emit('error', {
          message: error.message,
          code: 'PERMISSION_ERROR',
        });
      } else {
        socket.emit('error', {
          message: 'Failed to delete message',
          code: 'MESSAGE_DELETE_ERROR',
        });
      }
    }
  });

  socket.on('message:read', async (data: Parameters<ClientToServerEvents['message:read']>[0]) => {
    try {
      const { messageId } = data;

      // Load message
      const message = await MessageModel.findByPk(messageId);
      if (!message) {
        return;
      }

      // Check room access
      const hasAccess = await canAccessResource(
        userId,
        userRole,
        message.roomType,
        message.roomId
      );

      if (!hasAccess) {
        return;
      }

      // Broadcast read receipt (in a real implementation, you might want to store read receipts)
      const roomKey = `${message.roomType}:${message.roomId}`;
      io.to(roomKey).emit('message:read', {
        messageId,
        readBy: {
          userId,
          readAt: new Date(),
        },
      });
    } catch (error) {
      // Silently fail for read receipts
    }
  });
}

