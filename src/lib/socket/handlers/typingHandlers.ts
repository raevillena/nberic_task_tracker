// Socket.IO typing indicator handlers

import { Socket, Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/types/socket';
import { User } from '@/lib/db/models';
import { canAccessResource } from '@/lib/rbac/guards';
import { UserRole } from '@/types/entities';

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

// Typing indicator tracking: Map<roomKey, Set<userId>>
const typingUsers = new Map<string, Set<number>>();

// Typing indicator timeout: Map<userId, NodeJS.Timeout>
const typingTimeouts = new Map<number, NodeJS.Timeout>();

/**
 * Setup typing indicator handlers
 */
export function setupTypingHandlers(socket: TypedSocket, io: TypedIO): void {
  const userId = socket.data.userId;
  const userRole = socket.data.userRole as UserRole;

  socket.on('typing:start', async (data: Parameters<ClientToServerEvents['typing:start']>[0]) => {
    try {
      const { roomType, roomId } = data;

      // Check room access
      const hasAccess = await canAccessResource(
        userId,
        userRole,
        roomType,
        roomId
      );

      if (!hasAccess) {
        return;
      }

      const roomKey = `${roomType}:${roomId}`;

      // Add user to typing set
      if (!typingUsers.has(roomKey)) {
        typingUsers.set(roomKey, new Set());
      }
      typingUsers.get(roomKey)!.add(userId);

      // Load user info
      const user = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName'],
      });

      if (!user) {
        return;
      }

      // Broadcast to room (excluding sender)
      socket.to(roomKey).emit('typing:started', {
        roomType,
        roomId,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });

      // Auto-stop typing after 3 seconds
      const existingTimeout = typingTimeouts.get(userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        handleTypingStop(userId, roomType, roomId, socket, io);
      }, 3000);

      typingTimeouts.set(userId, timeout);
    } catch (error) {
      // Silently fail for typing indicators
    }
  });

  socket.on('typing:stop', async (data: Parameters<ClientToServerEvents['typing:stop']>[0]) => {
    try {
      const { roomType, roomId } = data;
      await handleTypingStop(userId, roomType, roomId, socket, io);
    } catch (error) {
      // Silently fail for typing indicators
    }
  });
}

/**
 * Handle typing stop
 */
async function handleTypingStop(
  userId: number,
  roomType: 'project' | 'study' | 'task',
  roomId: number,
  socket: TypedSocket,
  io: TypedIO
): Promise<void> {
  const roomKey = `${roomType}:${roomId}`;

  // Remove user from typing set
  const typingSet = typingUsers.get(roomKey);
  if (typingSet) {
    typingSet.delete(userId);
    if (typingSet.size === 0) {
      typingUsers.delete(roomKey);
    }
  }

  // Clear timeout
  const timeout = typingTimeouts.get(userId);
  if (timeout) {
    clearTimeout(timeout);
    typingTimeouts.delete(userId);
  }

  // Broadcast to room
  socket.to(roomKey).emit('typing:stopped', {
    roomType,
    roomId,
    userId,
  });
}

/**
 * Clean up typing indicators for a user
 */
export function cleanupTypingIndicators(userId: number): void {
  // Remove user from all typing sets
  for (const [roomKey, typingSet] of typingUsers.entries()) {
    typingSet.delete(userId);
    if (typingSet.size === 0) {
      typingUsers.delete(roomKey);
    }
  }

  // Clear timeout
  const timeout = typingTimeouts.get(userId);
  if (timeout) {
    clearTimeout(timeout);
    typingTimeouts.delete(userId);
  }
}

