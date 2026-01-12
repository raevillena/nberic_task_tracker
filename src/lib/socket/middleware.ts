// Socket.IO authentication middleware

import { Socket } from 'socket.io';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { User } from '@/lib/db/models';
import { SocketData, ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { AuthenticationError } from '@/lib/utils/errors';

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

/**
 * Socket authentication middleware
 * Verifies JWT token and attaches user data to socket
 */
export async function authenticateSocket(
  socket: TypedSocket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = verifyAccessToken(token);

    // Load user from database
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'role', 'isActive'],
    });

    if (!user || !user.isActive) {
      return next(new Error('User not found or inactive'));
    }

    // Attach user data to socket
    socket.data.userId = user.id;
    socket.data.userRole = user.role;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return next(new Error('Authentication failed'));
    }
    next(new Error('Authentication failed'));
  }
}

