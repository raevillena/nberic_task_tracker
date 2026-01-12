// Socket.IO server implementation for real-time messaging

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { authenticateSocket } from './middleware';
import { setupRoomHandlers } from './handlers/roomHandlers';
import { setupMessageHandlers } from './handlers/messageHandlers';
import { setupTypingHandlers, cleanupTypingIndicators } from './handlers/typingHandlers';
import { setSocketInstance } from './instance';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/types/socket';

// Type-safe socket instance
type TypedSocket = import('socket.io').Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

/**
 * Initialize Socket.IO server with authentication and event handlers
 * Follows the architecture pattern with separated handlers
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    {},
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection timeout
    connectTimeout: 10000,
  });

  // Authentication middleware
  io.use(authenticateSocket);

  // Store instance globally so API routes can access it
  setSocketInstance(io);

  // Connection handler
  io.on('connection', (socket: TypedSocket) => {
    const userId = socket.data.userId;
    const userRole = socket.data.userRole;

    // Emit authentication success
    socket.emit('auth:success', {
      userId,
      userRole,
    });

    // Setup event handlers (following architecture pattern)
    setupRoomHandlers(socket, io);
    setupMessageHandlers(socket, io);
    setupTypingHandlers(socket, io);

    // Disconnection handler
    socket.on('disconnect', () => {
      // Clean up typing indicators
      cleanupTypingIndicators(userId);
    });
  });

  return io;
}
