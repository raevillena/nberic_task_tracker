// Socket.IO event types

import { Task, Study, Project, User } from './entities';

// Message types for chat/messaging
export type MessageRoomType = 'project' | 'study' | 'task';
export type MessageType = 'text' | 'image' | 'file';

export interface Message {
  id: number;
  roomType: MessageRoomType;
  roomId: number;
  senderId: number;
  type: MessageType;
  content: string;
  fileId: number | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  replyToId: number | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations (optional, loaded via include)
  sender?: User;
  replyTo?: Message;
}

// Client → Server Events
export interface ClientToServerEvents {
  // Task events
  'task:update': (data: { taskId: number; updates: Partial<Task> }) => void;
  'task:complete': (data: { taskId: number }) => void;
  'task:assign': (data: { taskId: number; assignedToId: number }) => void;
  
  // Room management (existing + messaging)
  'room:join': (data: { type: 'project' | 'study' | 'task'; id: number }) => void;
  'room:leave': (data: { type: 'project' | 'study' | 'task'; id: number }) => void;
  
  // Messaging events
  'message:send': (data: {
    roomType: MessageRoomType;
    roomId: number;
    content: string;
    type: MessageType;
    fileId?: number;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    replyToId?: number;
  }) => void;
  
  'message:edit': (data: {
    messageId: number;
    content: string;
  }) => void;
  
  'message:delete': (data: {
    messageId: number;
  }) => void;
  
  'message:read': (data: {
    messageId: number;
  }) => void;
  
  // Typing indicators
  'typing:start': (data: {
    roomType: MessageRoomType;
    roomId: number;
  }) => void;
  
  'typing:stop': (data: {
    roomType: MessageRoomType;
    roomId: number;
  }) => void;
}

// Server → Client Events
export interface ServerToClientEvents {
  // Task events
  'task:updated': (data: { task: Task }) => void;
  'task:completed': (data: { task: Task }) => void;
  'task:assigned': (data: { task: Task }) => void;
  
  // Progress events
  'progress:task:updated': (data: {
    taskId: number;
    studyId: number;
    projectId: number;
    taskProgress: number;
  }) => void;
  'progress:study:updated': (data: {
    studyId: number;
    projectId: number;
    studyProgress: number;
  }) => void;
  'progress:project:updated': (data: {
    projectId: number;
    projectProgress: number;
  }) => void;
  
  // Authentication events
  'auth:success': (data: {
    userId: number;
    userRole: string;
  }) => void;
  
  'auth:failed': (data: {
    message: string;
  }) => void;
  
  // Room management events
  'room:joined': (data: {
    roomType: MessageRoomType;
    roomId: number;
    memberCount: number;
  }) => void;
  
  'room:left': (data: {
    roomType: MessageRoomType;
    roomId: number;
  }) => void;
  
  'room:error': (data: {
    message: string;
    roomType: MessageRoomType;
    roomId: number;
  }) => void;
  
  // Messaging events
  'message:new': (data: {
    message: Message;
  }) => void;
  
  'message:edited': (data: {
    message: Message;
  }) => void;
  
  'message:deleted': (data: {
    messageId: number;
    roomType: MessageRoomType;
    roomId: number;
  }) => void;
  
  'message:read': (data: {
    messageId: number;
    readBy: {
      userId: number;
      readAt: Date;
    };
  }) => void;
  
  'message:history': (data: {
    messages: Message[];
    roomType: MessageRoomType;
    roomId: number;
    hasMore: boolean;
    nextCursor?: number;
  }) => void;
  
  // Typing indicator events
  'typing:started': (data: {
    roomType: MessageRoomType;
    roomId: number;
    user: {
      id: number;
      firstName: string;
      lastName: string;
    };
  }) => void;
  
  'typing:stopped': (data: {
    roomType: MessageRoomType;
    roomId: number;
    userId: number;
  }) => void;
  
  // Error events
  'error': (data: { message: string; code?: string }) => void;
}

// Socket data
export interface SocketData {
  userId: number;
  userRole: string;
}

