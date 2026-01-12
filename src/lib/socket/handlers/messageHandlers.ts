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
import { Message as MessageModel } from '@/lib/db/models';

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

      // Broadcast to room (including sender)
      const roomKey = `${roomType}:${roomId}`;
      io.to(roomKey).emit('message:new', {
        message: message.toJSON() as MessageType,
      });
      
      // Also send directly to sender to ensure they see their message immediately
      socket.emit('message:new', {
        message: message.toJSON() as MessageType,
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
          message: 'Failed to send message',
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

