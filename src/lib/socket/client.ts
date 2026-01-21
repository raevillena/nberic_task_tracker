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
import { UserRole } from '@/types/entities';
import { updateTaskFromSocket } from '@/store/slices/taskSlice';
import {
  updateProgressFromSocket,
  updateProgressChain,
} from '@/store/slices/progressSlice';

// Type-safe socket client
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let isInitialized = false;

// Track socket offline notification state
let hasShownSocketOfflineNotification = false;
let hasShownSocketReconnectedNotification = false;
let reconnectAttempts = 0;

/**
 * Initialize Socket.IO client and set up event listeners
 * This function is idempotent - calling it multiple times with the same token won't create duplicate connections
 */
export function initializeSocketClient(
  token: string,
  dispatch: AppDispatch,
  getState?: () => any
): TypedSocket {
  // If socket already exists and is connected with the same token, reuse it
  if (socket?.connected && isInitialized) {
    // Check if token changed - if so, we need to reconnect
    const currentToken = (socket as any).auth?.token;
    if (currentToken === token) {
      // Same token, socket already connected and initialized - just return existing socket
      // Event handlers are already set up, so we're good
      if (process.env.NODE_ENV === 'development') {
        console.log('[initializeSocketClient] Reusing existing socket connection');
      }
      return socket;
    }
    // Token changed, disconnect old socket
    if (process.env.NODE_ENV === 'development') {
      console.log('[initializeSocketClient] Token changed, reconnecting socket');
    }
    socket.disconnect();
    isInitialized = false;
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
    timeout: 20000, // 20 seconds timeout
  });

  // Reset notification flags when creating new connection
  reconnectAttempts = 0;
  hasShownSocketReconnectedNotification = false;

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected');
    dispatch(setSocketConnected(true));
    dispatch(setSocketError(null));
    
    // Show reconnected notification if we were previously offline
    if (hasShownSocketOfflineNotification && !hasShownSocketReconnectedNotification) {
      hasShownSocketReconnectedNotification = true;
      hasShownSocketOfflineNotification = false;
      dispatch(
        addNotification({
          id: `socket-reconnected-${Date.now()}`,
          type: 'system',
          title: 'Connection Restored',
          message: 'Chat service connection restored. Real-time features are now available.',
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    }
    reconnectAttempts = 0;
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    dispatch(setSocketConnected(false));
    
    // Only show offline notification if it's not a manual disconnect
    // and if we haven't shown it recently
    if (reason !== 'io client disconnect' && !hasShownSocketOfflineNotification) {
      hasShownSocketOfflineNotification = true;
      hasShownSocketReconnectedNotification = false;
      dispatch(
        addNotification({
          id: `socket-offline-${Date.now()}`,
          type: 'system',
          title: 'Connection Lost',
          message: 'Chat service connection lost. Real-time features are temporarily unavailable. Attempting to reconnect...',
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    dispatch(setSocketError(error.message));
    
    reconnectAttempts++;
    
    // Show offline notification on first connection error
    if (!hasShownSocketOfflineNotification) {
      hasShownSocketOfflineNotification = true;
      hasShownSocketReconnectedNotification = false;
      dispatch(
        addNotification({
          id: `socket-offline-${Date.now()}`,
          type: 'system',
          title: 'Chat Service Offline',
          message: 'Unable to connect to chat service. Some features may be limited. Attempting to reconnect...',
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    }
  });

  // Handle reconnection attempts exhausted
  // Note: These are internal Socket.IO events, so we use 'any' type for the socket
  (socket as any).on('reconnect_attempt', (attemptNumber: number) => {
    reconnectAttempts = attemptNumber;
  });

  (socket as any).on('reconnect_failed', () => {
    console.error('Socket reconnection failed after all attempts');
    if (hasShownSocketOfflineNotification) {
      // Update the notification to indicate reconnection failed
      dispatch(
        addNotification({
          id: `socket-offline-failed-${Date.now()}`,
          type: 'system',
          title: 'Connection Failed',
          message: 'Unable to connect to chat service. Please refresh the page or check your connection.',
          timestamp: new Date().toISOString(),
          read: false,
        })
      );
    }
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
    if (process.env.NODE_ENV === 'development') {
      console.log('[message:new] New message received:', {
        messageId: data.message.id,
        roomType: data.message.roomType,
        roomId: data.message.roomId,
        senderId: data.message.senderId,
        content: data.message.content?.substring(0, 50),
      });
    }
    const roomKey = `${data.message.roomType}:${data.message.roomId}`;
    
    // Check if message already exists to avoid duplicates
    const state = getState?.();
    const existingMessages = state?.messages?.rooms?.[roomKey]?.messages || [];
    const messageExists = existingMessages.some((m: any) => m.id === data.message.id);
    
    if (!messageExists) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[message:new] Adding message to Redux:', {
          roomKey,
          messageId: data.message.id,
          currentMessageCount: existingMessages.length,
        });
      }
      dispatch(
        addMessage({
          roomKey,
          message: data.message,
        })
      );
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[message:new] Message already exists, skipping:', {
          roomKey,
          messageId: data.message.id,
        });
      }
    }
    
    // NOTE: Toast notifications are now handled by the 'notification:new' event
    // which is sent to ALL users who should receive the notification, regardless
    // of whether they're in the room. This avoids duplicate toasts.
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
    const state = getState?.();
    const currentUserId = state?.auth?.user?.id;
    
    // Only notify if current user is in the assignedUserIds list
    if (currentUserId && data.assignedUserIds?.includes(currentUserId)) {
      // The DB notification was already created by the API route BEFORE the socket emit
      // Refresh notifications immediately - no delay needed since server awaits notification creation
      import('@/store/slices/notificationSlice').then(({ fetchNotificationsThunk }) => {
        dispatch(fetchNotificationsThunk());
      });
    }
    
    // Update task in Redux store
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

  // Task request event handlers
  socket.on('task-request:created', (data) => {
    console.log('Task request created via socket:', data);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e852ecc4-6e60-4763-9b73-f1b441565d96',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:292',message:'task-request:created received',data:{requestId:data.request?.id,taskId:data.request?.taskId,taskCreatedById:data.task?.createdById},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const state = getState?.();
    const currentUserId = state?.auth?.user?.id;
    const currentUserRole = state?.auth?.user?.role;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e852ecc4-6e60-4763-9b73-f1b441565d96',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:298',message:'Checking manager match',data:{currentUserId,currentUserRole,taskCreatedById:data.task?.createdById,isMatch:currentUserRole === UserRole.MANAGER && currentUserId && data.task?.createdById === currentUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Only notify the manager who created the task (task.createdById)
    // Check if current user is a manager AND is the creator of the task
    const isTaskManager = 
      currentUserRole === UserRole.MANAGER && 
      currentUserId && 
      data.task?.createdById === currentUserId;

    if (isTaskManager) {
      const requestTypeLabel =
        data.request.requestType === 'completion'
          ? 'completion'
          : 'reassignment';
      const taskName = data.task?.name || 'Task';
      const requesterName = data.requestedBy
        ? `${data.requestedBy.firstName} ${data.requestedBy.lastName}`
        : 'A researcher';

      // Build action URL to task requests page
      const actionUrl = '/dashboard/requests';

      dispatch(
        addNotification({
          id: `task-request-created-${data.request.id}-${Date.now()}`,
          type: 'task',
          title: `New ${requestTypeLabel} request`,
          message: `${requesterName} requested ${requestTypeLabel} for task "${taskName}"`,
          taskId: data.request.taskId,
          projectId: data.task?.projectId ?? undefined,
          studyId: data.task?.studyId ?? undefined,
          senderId: data.request.requestedById,
          senderName: requesterName,
          timestamp: new Date(data.request.createdAt).toISOString(),
          read: false,
          actionUrl,
        })
      );
    }
  });

  socket.on('task-request:approved', (data) => {
    console.log('Task request approved via socket:', data);
    const state = getState?.();
    const currentUserId = state?.auth?.user?.id;

    // Only notify the researcher who made the request
    if (currentUserId === data.request.requestedById) {
      const requestTypeLabel =
        data.request.requestType === 'completion'
          ? 'completion'
          : 'reassignment';
      const taskName = data.task?.name || 'Task';
      const reviewerName = data.reviewedBy
        ? `${data.reviewedBy.firstName} ${data.reviewedBy.lastName}`
        : 'Manager';

      // Build action URL to the task
      const actionUrl =
        data.task?.projectId && data.task?.studyId
          ? `/dashboard/projects/${data.task.projectId}/studies/${data.task.studyId}/tasks/${data.request.taskId}`
          : `/dashboard/tasks?highlight=${data.request.taskId}`;

      dispatch(
        addNotification({
          id: `task-request-approved-${data.request.id}-${Date.now()}`,
          type: 'task',
          title: `${requestTypeLabel} request approved`,
          message: `${reviewerName} approved your ${requestTypeLabel} request for task "${taskName}"`,
          taskId: data.request.taskId,
          projectId: data.task?.projectId ?? undefined,
          studyId: data.task?.studyId ?? undefined,
          senderId: data.reviewedBy?.id,
          senderName: reviewerName,
          timestamp: new Date(data.request.reviewedAt || data.request.updatedAt).toISOString(),
          read: false,
          actionUrl,
        })
      );
    }
  });

  socket.on('task-request:rejected', (data) => {
    console.log('Task request rejected via socket:', data);
    const state = getState?.();
    const currentUserId = state?.auth?.user?.id;

    // Only notify the researcher who made the request
    if (currentUserId === data.request.requestedById) {
      const requestTypeLabel =
        data.request.requestType === 'completion'
          ? 'completion'
          : 'reassignment';
      const taskName = data.task?.name || 'Task';
      const reviewerName = data.reviewedBy
        ? `${data.reviewedBy.firstName} ${data.reviewedBy.lastName}`
        : 'Manager';

      // Build action URL to the task
      const actionUrl =
        data.task?.projectId && data.task?.studyId
          ? `/dashboard/projects/${data.task.projectId}/studies/${data.task.studyId}/tasks/${data.request.taskId}`
          : `/dashboard/tasks?highlight=${data.request.taskId}`;

      dispatch(
        addNotification({
          id: `task-request-rejected-${data.request.id}-${Date.now()}`,
          type: 'task',
          title: `${requestTypeLabel} request rejected`,
          message: `${reviewerName} rejected your ${requestTypeLabel} request for task "${taskName}"`,
          taskId: data.request.taskId,
          projectId: data.task?.projectId ?? undefined,
          studyId: data.task?.studyId ?? undefined,
          senderId: data.reviewedBy?.id,
          senderName: reviewerName,
          timestamp: new Date(data.request.reviewedAt || data.request.updatedAt).toISOString(),
          read: false,
          actionUrl,
        })
      );
    }
  });

  // Real-time notification handler - for notifications sent directly to user
  // This handles notifications for users who are NOT in the chat room
  socket.on('notification:new', (data) => {
    console.log('Real-time notification received:', data);
    const state = getState?.();
    const currentUserId = state?.auth?.user?.id;

    // Only process if this notification is for the current user
    if (currentUserId && data.targetUserId === currentUserId) {
      // Add the notification to Redux store (shows toast)
      dispatch(
        addNotification({
          id: data.notification.id,
          type: data.notification.type,
          title: data.notification.title,
          message: data.notification.message,
          roomType: data.notification.roomType,
          roomId: data.notification.roomId,
          taskId: data.notification.taskId,
          projectId: data.notification.projectId,
          studyId: data.notification.studyId,
          senderId: data.notification.senderId,
          senderName: data.notification.senderName,
          actionUrl: data.notification.actionUrl,
          timestamp: data.notification.timestamp,
          read: false,
        })
      );
      
      // Also refresh notifications from DB to update the badge count
      // Only if user is still authenticated
      const state = getState?.();
      if (state?.auth?.isAuthenticated && state?.auth?.accessToken) {
        import('@/store/slices/notificationSlice').then(({ fetchNotificationsThunk }) => {
          dispatch(fetchNotificationsThunk());
        });
      }
    }
  });

  // Error handler
  socket.on('error', (data) => {
    console.error('Socket error:', data);
    dispatch(setSocketError(data.message));
  });

  isInitialized = true;
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
  if (socket) {
    socket.disconnect();
    socket = null;
    isInitialized = false;
    // Reset notification flags on manual disconnect
    hasShownSocketOfflineNotification = false;
    hasShownSocketReconnectedNotification = false;
    reconnectAttempts = 0;
  }
}

/**
 * Join a room
 * Will automatically join when socket connects if called before connection
 */
export function joinRoom(type: MessageRoomType, id: number) {
  if (!socket) {
    console.warn('Socket not initialized yet');
    return;
  }

  if (socket.connected) {
    socket.emit('room:join', { type, id });
  } else {
    // Queue the join request for when socket connects
    // Use once to avoid memory leaks
    socket.once('connect', () => {
      // Socket is guaranteed to be non-null here since we checked above
      if (socket) {
        socket.emit('room:join', { type, id });
      }
    });
  }
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
  fileId: number | string | undefined,
  fileName: string,
  fileSize: number,
  mimeType: string,
  replyToId?: number
) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  // Convert fileId to number if it's a string, or use undefined if not a valid number
  // Since we don't have a file storage table, fileId is optional
  const numericFileId = typeof fileId === 'string' ? undefined : fileId;

  socket.emit('message:send', {
    roomType,
    roomId,
    content,
    type: 'image',
    fileId: numericFileId,
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
  fileId: number | string | undefined,
  fileName: string,
  fileSize: number,
  mimeType: string,
  replyToId?: number
) {
  if (!socket?.connected) {
    console.error('Socket not connected');
    return;
  }

  // Convert fileId to number if it's a string, or use undefined if not a valid number
  // Since we don't have a file storage table, fileId is optional
  const numericFileId = typeof fileId === 'string' ? undefined : fileId;

  socket.emit('message:send', {
    roomType,
    roomId,
    content,
    type: 'file',
    fileId: numericFileId,
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

