// Socket.IO room management handlers

import { Socket, Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/types/socket';
import { canAccessResource } from '@/lib/rbac/guards';
import { UserRole } from '@/types/entities';
import { sendMessageHistory } from './messageHandlers';

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
 * Setup room join/leave handlers with RBAC validation
 */
export function setupRoomHandlers(socket: TypedSocket, io: TypedIO): void {
  const userId = socket.data.userId;
  const userRole = socket.data.userRole as UserRole;

  socket.on('room:join', async (data: Parameters<ClientToServerEvents['room:join']>[0]) => {
    try {
      const { type, id } = data;

      // Validate room type for messaging (project, study, or task)
      if (type !== 'project' && type !== 'study' && type !== 'task') {
        socket.emit('room:error', {
          message: 'Invalid room type for messaging',
          roomType: type as 'project' | 'study' | 'task',
          roomId: id,
        });
        return;
      }

      // Check RBAC permissions using existing guard
      const hasAccess = await canAccessResource(
        userId,
        userRole,
        type,
        id
      );

      if (!hasAccess) {
        socket.emit('room:error', {
          message: 'Access denied to this room',
          roomType: type,
          roomId: id,
        });
        return;
      }

      // Join the room
      const roomKey = `${type}:${id}`;
      await socket.join(roomKey);

      // Get member count
      const room = io.sockets.adapter.rooms.get(roomKey);
      const memberCount = room ? room.size : 0;

      // Emit success
      socket.emit('room:joined', {
        roomType: type,
        roomId: id,
        memberCount,
      });

      // Load and send message history
      await sendMessageHistory(socket, type, id);
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to join room',
        code: 'ROOM_JOIN_ERROR',
      });
    }
  });

      socket.on('room:leave', async (data: Parameters<ClientToServerEvents['room:leave']>[0]) => {
    try {
      const { type, id } = data;

      if (type !== 'project' && type !== 'study' && type !== 'task') {
        return;
      }

      const roomKey = `${type}:${id}`;
      await socket.leave(roomKey);

      socket.emit('room:left', {
        roomType: type,
        roomId: id,
      });
    } catch (error) {
      socket.emit('error', {
        message: 'Failed to leave room',
        code: 'ROOM_LEAVE_ERROR',
      });
    }
  });
}

