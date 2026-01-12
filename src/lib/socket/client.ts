// Socket.IO client setup and Redux integration example

/**
 * This file demonstrates how to set up Socket.IO client and integrate with Redux.
 * This is a reference implementation - adapt to your specific needs.
 */

import { io, Socket } from 'socket.io-client';
import { AppDispatch } from '@/store';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  MessageRoomType,
} from '@/types/socket';
import {
  setSocketConnected,
  setSocketAuthenticated,
  setSocketError,
  setActiveRoom,
  setMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  addTypingUser,
  removeTypingUser,
} from '@/store/slices/messagesSlice';
import { addNotification } from '@/store/slices/notificationSlice';
import { updateTaskFromSocket } from '@/store/slices/taskSlice';
import {
  updateProgressFromSocket,
  updateProgressChain,
} from '@/store/slices/progressSlice';

// Type-safe socket client
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

/**
 * Initialize Socket.IO client and set up event listeners
 */
export function initializeSocketClient(
  token: string,
  dispatch: AppDispatch,
  getState?: () => any
): TypedSocket {
  // Disconnect existing socket if any
  if (socket?.connected) {
    socket.disconnect();
  }

  // Create new socket connection
  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
    dispatch(setSocketConnected(true));
    dispatch(setSocketError(null));
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    dispatch(setSocketConnected(false));
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    dispatch(setSocketError(error.message));
  });

  // Authentication handlers
  socket.on('auth:success', (data) => {
    console.log('Socket authenticated:', data);
    dispatch(setSocketAuthenticated(data));
  });

  socket.on('auth:failed', (data) => {
    console.error('Socket authentication failed:', data);
    dispatch(setSocketError(data.message));
  });

  // Room management handlers
  socket.on('room:joined', (data) => {
    console.log('Joined room:', data);
    dispatch(
      setActiveRoom({
        type: data.roomType,
        id: data.roomId,
      })
    );
  });

  socket.on('room:left', (data) => {
    console.log('Left room:', data);
  });

  socket.on('room:error', (data) => {
    console.error('Room error:', data);
    dispatch(setSocketError(data.message));
  });

  // Message handlers
  socket.on('message:history', (data) => {
    console.log('Message history received:', data);
    const roomKey = `${data.roomType}:${data.roomId}`;
    dispatch(
      setMessages({
        roomKey,
        messages: data.messages,
        hasMore: data.hasMore,
        nextCursor: data.nextCursor,
      })
    );
  });

  socket.on('message:new', (data) => {
    console.log('New message received:', data);
    const roomKey = `${data.message.roomType}:${data.message.roomId}`;
    
    // Check if message already exists to avoid duplicates
    const state = getState?.();
    const existingMessages = state?.messages?.rooms?.[roomKey]?.messages || [];
    const messageExists = existingMessages.some((m: any) => m.id === data.message.id);
    
    if (!messageExists) {
      dispatch(
        addMessage({
          roomKey,
          message: data.message,
        })
      );
    }

    // Create notification if message is not from current user
    const currentUserId = state?.auth?.user?.id;

    if (currentUserId && data.message.senderId !== currentUserId) {
      // Build action URL based on room type
      // Note: For tasks, we need projectId and studyId which should be included in message context
      // For now, we'll use a hash-based navigation that the frontend can handle
      let actionUrl = '';
      if (data.message.roomType === 'task') {
        // Task URL requires projectId and studyId - these should come from task context
        // For now, use a hash that can be resolved on the frontend
        actionUrl = `#task-${data.message.roomId}`;
      } else if (data.message.roomType === 'study') {
        actionUrl = `/dashboard/projects/${data.message.roomId}/studies/${data.message.roomId}`;
      } else if (data.message.roomType === 'project') {
        actionUrl = `/dashboard/projects/${data.message.roomId}`;
      }

      dispatch(
        addNotification({
          id: `msg-${data.message.id}-${Date.now()}`,
          type: 'message',
          title:
            data.message.roomType === 'task'
              ? 'New message in task'
              : data.message.roomType === 'study'
              ? 'New message in study'
              : 'New message in project',
          message:
            data.message.type === 'text'
              ? data.message.content.substring(0, 100)
              : data.message.type === 'image'
              ? '📷 Image'
              : '📎 File',
          roomType: data.message.roomType,
          roomId: data.message.roomId,
          senderId: data.message.senderId,
          senderName: data.message.sender
            ? `${data.message.sender.firstName} ${data.message.sender.lastName}`
            : undefined,
          timestamp: new Date(data.message.createdAt),
          read: false,
          actionUrl,
        })
      );
    }
  });

  socket.on('message:edited', (data) => {
    console.log('Message edited:', data);
    const roomKey = `${data.message.roomType}:${data.message.roomId}`;
    dispatch(
      updateMessage({
        roomKey,
        message: data.message,
      })
    );
  });

  socket.on('message:deleted', (data) => {
    console.log('Message deleted:', data);
    const roomKey = `${data.roomType}:${data.roomId}`;
    dispatch(
      deleteMessage({
        roomKey,
        messageId: data.messageId,
      })
    );
  });

  socket.on('message:read', (data) => {
    console.log('Message read:', data);
    // Handle read receipts if needed
  });

  // Typing indicator handlers
  socket.on('typing:started', (data) => {
    const roomKey = `${data.roomType}:${data.roomId}`;
    dispatch(
      addTypingUser({
        roomKey,
        userId: data.user.id,
      })
    );
  });

  socket.on('typing:stopped', (data) => {
    const roomKey = `${data.roomType}:${data.roomId}`;
    dispatch(
      removeTypingUser({
        roomKey,
        userId: data.userId,
      })
    );
  });

  // Task event handlers - real-time task updates
  socket.on('task:updated', (data) => {
    console.log('Task updated via socket:', data);
    dispatch(updateTaskFromSocket(data.task));
  });

  socket.on('task:completed', (data) => {
    console.log('Task completed via socket:', data);
    dispatch(updateTaskFromSocket(data.task));
  });

  socket.on('task:assigned', (data) => {
    console.log('Task assigned via socket:', data);
    dispatch(updateTaskFromSocket(data.task));
  });

  // Progress event handlers - real-time progress updates
  socket.on('progress:task:updated', (data) => {
    console.log('Task progress updated via socket:', data);
    dispatch(
      updateProgressFromSocket({
        type: 'task',
        id: data.taskId,
        progress: data.taskProgress,
      })
    );
  });

  socket.on('progress:study:updated', (data) => {
    console.log('Study progress updated via socket:', data);
    dispatch(
      updateProgressFromSocket({
        type: 'study',
        id: data.studyId,
        progress: data.studyProgress,
      })
    );
  });

  socket.on('progress:project:updated', (data) => {
    console.log('Project progress updated via socket:', data);
    dispatch(
      updateProgressFromSocket({
        type: 'project',
        id: data.projectId,
        progress: data.projectProgress,
      })
    );
  });

  // Error handler
  socket.on('error', (data) => {
    console.error('Socket error:', data);
    dispatch(setSocketError(data.message));
  });

  return socket;
}

/**
 * Get current socket instance
 */
export function getSocket(): TypedSocket | null {
  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join a room
 */
export function joinRoom(type: MessageRoomType, id: number) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('room:join', { type, id });
}

/**
 * Leave a room
 */
export function leaveRoom(type: MessageRoomType, id: number) {
  if (!socket?.connected) {
    return;
  }

  socket.emit('room:leave', { type, id });
}

/**
 * Send a text message
 */
export function sendTextMessage(
  roomType: MessageRoomType,
  roomId: number,
  content: string,
  replyToId?: number
) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('message:send', {
    roomType,
    roomId,
    content,
    type: 'text',
    replyToId,
  });
}

/**
 * Send an image message
 */
export function sendImageMessage(
  roomType: MessageRoomType,
  roomId: number,
  content: string,
  fileId: number,
  fileName: string,
  fileSize: number,
  mimeType: string,
  replyToId?: number
) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('message:send', {
    roomType,
    roomId,
    content,
    type: 'image',
    fileId,
    fileName,
    fileSize,
    mimeType,
    replyToId,
  });
}

/**
 * Send a file message
 */
export function sendFileMessage(
  roomType: MessageRoomType,
  roomId: number,
  content: string,
  fileId: number,
  fileName: string,
  fileSize: number,
  mimeType: string,
  replyToId?: number
) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('message:send', {
    roomType,
    roomId,
    content,
    type: 'file',
    fileId,
    fileName,
    fileSize,
    mimeType,
    replyToId,
  });
}

/**
 * Edit a message
 */
export function editMessage(messageId: number, content: string) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('message:edit', {
    messageId,
    content,
  });
}

/**
 * Delete a message
 */
export function deleteMessageById(messageId: number) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  socket.emit('message:delete', {
    messageId,
  });
}

/**
 * Mark message as read
 */
export function markMessageAsRead(messageId: number) {
  if (!socket?.connected) {
    return;
  }

  socket.emit('message:read', {
    messageId,
  });
}

/**
 * Start typing indicator
 */
export function startTyping(roomType: MessageRoomType, roomId: number) {
  if (!socket?.connected) {
    return;
  }

  socket.emit('typing:start', {
    roomType,
    roomId,
  });
}

/**
 * Stop typing indicator
 */
export function stopTyping(roomType: MessageRoomType, roomId: number) {
  if (!socket?.connected) {
    return;
  }

  socket.emit('typing:stop', {
    roomType,
    roomId,
  });
}

