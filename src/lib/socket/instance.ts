// Socket.IO instance singleton for accessing from API routes

import { Server as SocketIOServer } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@/types/socket';

// Global socket instance (set by socket server initialization)
let socketInstance: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
> | null = null;

/**
 * Set the socket instance (called by socket server on initialization)
 * This allows API routes to emit events to connected clients
 */
export function setSocketInstance(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
): void {
  socketInstance = io;
}

/**
 * Get the socket instance
 * Returns null if socket server hasn't been initialized yet
 */
export function getSocketInstance(): SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
> | null {
  return socketInstance;
}
