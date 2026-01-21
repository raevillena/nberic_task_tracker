// Socket.IO authentication middleware - uses database token sessions
// Note: Socket connections can't send cookies, so we can't use the external API's isAuthenticated
// endpoint (which requires both accessToken and refreshToken cookie).
// Instead, we validate tokens by checking our database token_sessions table.

import { Socket } from 'socket.io';
import { TokenSession } from '@/lib/db/models';
import { syncUserFromExternalApi } from '@/services/userService';
import { SocketData, ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { UserRole } from '@/types/entities';
import { Op } from 'sequelize';
import crypto from 'crypto';

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>;

/**
 * Socket authentication middleware
 * Verifies token with external API and attaches user data to socket
 * Syncs user to local database to get correct local user ID
 */
/**
 * Hash an access token for database lookup (same as in externalAuthService)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function authenticateSocket(
  socket: TypedSocket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[authenticateSocket] Verifying token:', {
        tokenLength: token.length,
        tokenPreview: `${token.substring(0, 20)}...`,
      });
    }

    // For socket connections, we can't use the external API's isAuthenticated endpoint
    // because it requires both accessToken (header) AND refreshToken (cookie).
    // Socket connections don't have cookies, so we validate tokens using our database instead.
    // We check if the token exists in token_sessions table (stored during login).
    
    const tokenHash = hashToken(token);
    const session = await TokenSession.findOne({
      where: {
        accessTokenHash: tokenHash,
        expiresAt: {
          [Op.gt]: new Date(), // Not expired
        },
      },
    });

    if (!session) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[authenticateSocket] Token session not found or expired in database. User may need to login again.');
      }
      return next(new Error('Invalid or expired token. Please login again.'));
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[authenticateSocket] Token session found:', {
        userId: session.userData.id,
        email: session.userData.email,
        expiresAt: session.expiresAt.toISOString(),
      });
    }

    // Extract role from apps array (find app with name "NTT")
    const nttApp = session.userData.apps?.find((app) => app.name === 'NTT');
    const userRole = nttApp?.Roles?.userType || 'Researcher'; // Default to Researcher if not found

    // Sync user to local database (creates if doesn't exist, updates if exists)
    // This ensures we have a local user record with the correct ID
    const localUser = await syncUserFromExternalApi({
      email: session.userData.email,
      firstName: session.userData.firstName,
      lastName: session.userData.lastName,
      role: userRole as UserRole, // Map to UserRole enum
    });

    // Attach user data to socket using LOCAL database ID (not external API ID)
    socket.data.userId = localUser.id; // Use local database ID
    socket.data.userRole = localUser.role;

    if (process.env.NODE_ENV === 'development') {
      console.log('[authenticateSocket] Socket authenticated successfully:', {
        localUserId: localUser.id,
        email: localUser.email,
        role: localUser.role,
      });
    }

    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
}

