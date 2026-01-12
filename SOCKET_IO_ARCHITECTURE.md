# Socket.IO Architecture for Task Tracker

## Overview

This document defines the Socket.IO architecture for real-time messaging and collaboration in the Task Tracker application. The system supports chat rooms scoped to Projects and Studies, with support for text, image, and file messages.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Room Scoping Strategy](#room-scoping-strategy)
3. [Event Definitions](#event-definitions)
4. [Message Types & Persistence](#message-types--persistence)
5. [Authentication & Authorization](#authentication--authorization)
6. [Event Flow Diagrams](#event-flow-diagrams)
7. [Redux State Integration](#redux-state-integration)
8. [Server Implementation](#server-implementation)

---

## Architecture Overview

### Core Principles

1. **Room-Based Messaging**: Messages are scoped to Project or Study rooms
2. **Persistent Storage**: All messages are stored in MariaDB via Sequelize
3. **Real-time Updates**: Socket.IO broadcasts updates to all connected clients in a room
4. **RBAC Enforcement**: Role-based access control enforced at socket connection and message send
5. **File Handling**: Images and files are uploaded via HTTP, metadata sent via Socket.IO

### Technology Stack

- **Socket.IO v4.7+**: Real-time bidirectional communication
- **Sequelize v7**: ORM for message persistence
- **MariaDB**: Database for message storage
- **JWT**: Authentication token validation
- **Redux Toolkit**: Client-side state management

---

## Room Scoping Strategy

### Room Naming Convention

Rooms are identified using a hierarchical naming pattern:

```
project:{projectId}     // Project-level chat room
study:{studyId}         // Study-level chat room
```

### Room Hierarchy

```
Project Room (project:1)
  └── Contains all messages for Project ID 1
  └── All users with access to Project 1 can join

Study Room (study:5)
  └── Contains all messages for Study ID 5
  └── All users with access to Study 5 can join
  └── Study belongs to a Project (inherits project access)
```

### Room Access Rules

1. **Project Room Access**:
   - Managers: Can access any project they created or have been granted access
   - Researchers: Can access projects where they have assigned tasks

2. **Study Room Access**:
   - Managers: Can access any study within accessible projects
   - Researchers: Can access studies where they have assigned tasks

3. **Auto-Join Behavior**:
   - Users automatically join relevant rooms when viewing a Project/Study
   - Users can manually join/leave rooms via socket events
   - Server validates access before allowing room join

### Room Management

- **Join**: Client emits `room:join` with `{ type: 'project' | 'study', id: number }`
- **Leave**: Client emits `room:leave` with same payload
- **Validation**: Server checks RBAC permissions before allowing join
- **Broadcast**: Messages sent to a room are broadcast to all members

---

## Event Definitions

### Client → Server Events

#### Connection & Authentication

```typescript
'connect'                    // Socket connection (with auth token)
'disconnect'                 // Socket disconnection
```

#### Room Management

```typescript
'room:join': (data: {
  type: 'project' | 'study';
  id: number;
}) => void

'room:leave': (data: {
  type: 'project' | 'study';
  id: number;
}) => void
```

#### Messaging

```typescript
'message:send': (data: {
  roomType: 'project' | 'study';
  roomId: number;
  content: string;              // Required for text messages
  type: 'text' | 'image' | 'file';
  fileId?: number;              // Optional: ID from file upload API
  fileName?: string;            // Optional: Original filename
  fileSize?: number;            // Optional: File size in bytes
  mimeType?: string;            // Optional: MIME type
  replyToId?: number;           // Optional: Reply to message ID
}) => void

'message:edit': (data: {
  messageId: number;
  content: string;              // New content
}) => void

'message:delete': (data: {
  messageId: number;
}) => void

'message:read': (data: {
  messageId: number;
}) => void
```

#### Typing Indicators

```typescript
'typing:start': (data: {
  roomType: 'project' | 'study';
  roomId: number;
}) => void

'typing:stop': (data: {
  roomType: 'project' | 'study';
  roomId: number;
}) => void
```

### Server → Client Events

#### Connection & Status

```typescript
'connect'                    // Socket connected successfully
'disconnect'                 // Socket disconnected
'error': (data: {
  message: string;
  code?: string;
}) => void

'auth:success': (data: {
  userId: number;
  userRole: string;
}) => void

'auth:failed': (data: {
  message: string;
}) => void
```

#### Room Management

```typescript
'room:joined': (data: {
  roomType: 'project' | 'study';
  roomId: number;
  memberCount: number;
}) => void

'room:left': (data: {
  roomType: 'project' | 'study';
  roomId: number;
}) => void

'room:error': (data: {
  message: string;
  roomType: 'project' | 'study';
  roomId: number;
}) => void
```

#### Messaging

```typescript
'message:new': (data: {
  message: Message;           // Full message object with relations
}) => void

'message:edited': (data: {
  message: Message;           // Updated message object
}) => void

'message:deleted': (data: {
  messageId: number;
  roomType: 'project' | 'study';
  roomId: number;
}) => void

'message:read': (data: {
  messageId: number;
  readBy: {
    userId: number;
    readAt: Date;
  };
}) => void
```

#### Typing Indicators

```typescript
'typing:started': (data: {
  roomType: 'project' | 'study';
  roomId: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
}) => void

'typing:stopped': (data: {
  roomType: 'project' | 'study';
  roomId: number;
  userId: number;
}) => void
```

#### History & Initialization

```typescript
'message:history': (data: {
  messages: Message[];
  roomType: 'project' | 'study';
  roomId: number;
  hasMore: boolean;
  nextCursor?: number;
}) => void
```

---

## Message Types & Persistence

### Message Model Schema

```typescript
interface Message {
  id: number;
  roomType: 'project' | 'study';
  roomId: number;              // projectId or studyId
  senderId: number;
  type: 'text' | 'image' | 'file';
  content: string;             // Text content or file description
  fileId: number | null;        // Reference to uploaded file
  fileName: string | null;     // Original filename
  fileSize: number | null;      // File size in bytes
  mimeType: string | null;     // MIME type
  replyToId: number | null;     // Parent message ID for replies
  editedAt: Date | null;       // Timestamp when edited
  deletedAt: Date | null;      // Soft delete timestamp
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  sender?: User;
  replyTo?: Message;
  file?: FileMetadata;         // If file storage system exists
}
```

### Message Type Handling

#### Text Messages
- **Content**: Plain text or markdown
- **Storage**: Stored directly in `content` field
- **Validation**: Max length 10,000 characters

#### Image Messages
- **Upload**: Image uploaded via HTTP POST to `/api/files/upload`
- **Response**: Returns `fileId`, `fileName`, `fileSize`, `mimeType`
- **Socket**: Client sends `message:send` with file metadata
- **Storage**: File metadata stored in message record
- **Validation**: Max file size 10MB, allowed types: jpg, png, gif, webp

#### File Messages
- **Upload**: File uploaded via HTTP POST to `/api/files/upload`
- **Response**: Returns `fileId`, `fileName`, `fileSize`, `mimeType`
- **Socket**: Client sends `message:send` with file metadata
- **Storage**: File metadata stored in message record
- **Validation**: Max file size 50MB, all file types allowed

### Message Persistence Flow

1. Client uploads file (if image/file) → HTTP API
2. Client emits `message:send` → Socket.IO
3. Server validates permissions
4. Server creates Message record → Sequelize
5. Server loads message with relations (sender, replyTo)
6. Server broadcasts `message:new` to room
7. All clients in room receive message
8. Clients update Redux state

---

## Authentication & Authorization

### Connection Authentication

Socket.IO connection uses JWT token passed in handshake:

```typescript
// Client connection
const socket = io(serverUrl, {
  auth: {
    token: jwtToken
  }
});

// Server validation
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  // Validate JWT and attach user data to socket
});
```

### Authorization Checks

1. **Room Join Authorization**:
   - Check if user has access to Project/Study
   - Managers: Check project ownership or access grants
   - Researchers: Check if user has assigned tasks in project/study

2. **Message Send Authorization**:
   - User must be in the room
   - User must have access to the room's resource
   - Content validation (length, file size, etc.)

3. **Message Edit/Delete Authorization**:
   - User must be the message sender
   - OR user must be a Manager with access to the room
   - Messages cannot be edited/deleted after 24 hours

---

## Event Flow Diagrams

### Connection & Authentication Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Client  │                    │ Server  │                    │   DB    │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                               │                               │
     │ 1. connect(auth: {token})    │                               │
     ├──────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. Validate JWT token        │
     │                               ├──────────────────────────────>│
     │                               │                               │
     │                               │ 3. Load user data            │
     │                               │<──────────────────────────────┤
     │                               │                               │
     │                               │ 4. Attach userId, role       │
     │                               │    to socket.data             │
     │                               │                               │
     │ 5. auth:success({userId, role})│                               │
     │<──────────────────────────────┤                               │
     │                               │                               │
```

### Room Join Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Client  │                    │ Server  │                    │   DB    │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                               │                               │
     │ 1. room:join({type, id})      │                               │
     ├──────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. Check RBAC permissions     │
     │                               ├──────────────────────────────>│
     │                               │                               │
     │                               │ 3. Permission result          │
     │                               │<──────────────────────────────┤
     │                               │                               │
     │                               │ 4. socket.join(room)          │
     │                               │    Get member count           │
     │                               │                               │
     │ 5. room:joined({roomType,     │                               │
     │    roomId, memberCount})      │                               │
     │<──────────────────────────────┤                               │
     │                               │                               │
     │ 6. message:history({messages}) │                               │
     │<──────────────────────────────┤                               │
     │                               │                               │
```

### Message Send Flow (Text)

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Client  │                    │ Server  │                    │   DB    │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                               │                               │
     │ 1. message:send({roomType,    │                               │
     │    roomId, content, type})     │                               │
     ├──────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. Validate permissions      │
     │                               │    Validate content           │
     │                               │                               │
     │                               │ 3. Create Message record     │
     │                               ├──────────────────────────────>│
     │                               │                               │
     │                               │ 4. Load message with          │
     │                               │    relations (sender)         │
     │                               │<──────────────────────────────┤
     │                               │                               │
     │                               │ 5. Broadcast to room:        │
     │                               │    message:new({message})     │
     │                               │                               │
     │ 6. message:new({message})     │                               │
     │<──────────────────────────────┤                               │
     │                               │                               │
```

### Message Send Flow (Image/File)

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Client  │                    │   API   │                    │ Server  │                    │   DB    │
└────┬────┘                    └────┬────┘                    └────┬────┘                    └────┬────┘
     │                               │                               │                               │
     │ 1. POST /api/files/upload     │                               │                               │
     │    (multipart/form-data)      │                               │                               │
     ├──────────────────────────────>│                               │                               │
     │                               │                               │                               │
     │                               │ 2. Save file, create record  │                               │
     │                               ├──────────────────────────────>│                               │
     │                               │                               │                               │
     │                               │                               │ 3. Store file metadata        │
     │                               │                               ├──────────────────────────────>│
     │                               │                               │                               │
     │                               │                               │ 4. File record with ID        │
     │                               │                               │<──────────────────────────────┤
     │                               │                               │                               │
     │                               │ 5. Return {fileId, fileName,  │                               │
     │                               │    fileSize, mimeType}        │                               │
     │                               │<──────────────────────────────┤                               │
     │                               │                               │                               │
     │ 6. Response: {fileId, ...}    │                               │                               │
     │<──────────────────────────────┤                               │                               │
     │                               │                               │                               │
     │ 7. message:send({roomType,    │                               │                               │
     │    roomId, type, fileId, ...})│                               │                               │
     ├──────────────────────────────────────────────────────────────>│                               │
     │                               │                               │                               │
     │                               │                               │ 8. Create Message record     │
     │                               │                               ├──────────────────────────────>│
     │                               │                               │                               │
     │                               │                               │ 9. Load message with          │
     │                               │                               │    relations                  │
     │                               │                               │<──────────────────────────────┤
     │                               │                               │                               │
     │                               │                               │ 10. Broadcast message:new     │
     │                               │                               │                               │
     │ 11. message:new({message})    │                               │                               │
     │<──────────────────────────────────────────────────────────────┤                               │
     │                               │                               │                               │
```

### Typing Indicator Flow

```
┌─────────┐                    ┌─────────┐                    ┌─────────┐
│ Client  │                    │ Server  │                    │ Others  │
└────┬────┘                    └────┬────┘                    └────┬────┘
     │                               │                               │
     │ 1. typing:start({roomType,    │                               │
     │    roomId})                   │                               │
     ├──────────────────────────────>│                               │
     │                               │                               │
     │                               │ 2. Broadcast to room:         │
     │                               │    typing:started({user})     │
     │                               ├──────────────────────────────>│
     │                               │                               │
     │                               │                               │
     │ 3. typing:stop({roomType,     │                               │
     │    roomId})                   │                               │
     ├──────────────────────────────>│                               │
     │                               │                               │
     │                               │ 4. Broadcast to room:         │
     │                               │    typing:stopped({userId})   │
     │                               ├──────────────────────────────>│
     │                               │                               │
```

---

## Redux State Integration

### Redux Slice Structure

```typescript
interface MessagesState {
  // Room-based message storage
  rooms: {
    [roomKey: string]: {  // roomKey = "project:1" or "study:5"
      messages: Message[];
      isLoading: boolean;
      hasMore: boolean;
      nextCursor?: number;
      typingUsers: number[];  // Array of userIds currently typing
    };
  };
  
  // Active room
  activeRoom: {
    type: 'project' | 'study' | null;
    id: number | null;
  };
  
  // Connection status
  socketConnected: boolean;
  socketError: string | null;
}
```

### Redux Actions (Socket Event Handlers)

#### Connection Actions

```typescript
// Socket connected
socket.on('connect', () => {
  dispatch(messagesSlice.actions.setSocketConnected(true));
});

// Socket disconnected
socket.on('disconnect', () => {
  dispatch(messagesSlice.actions.setSocketConnected(false));
});

// Authentication success
socket.on('auth:success', (data) => {
  dispatch(messagesSlice.actions.setSocketAuthenticated(data));
});
```

#### Room Actions

```typescript
// Room joined
socket.on('room:joined', (data) => {
  const roomKey = `${data.roomType}:${data.roomId}`;
  dispatch(messagesSlice.actions.setActiveRoom({
    type: data.roomType,
    id: data.roomId
  }));
});

// Message history received
socket.on('message:history', (data) => {
  const roomKey = `${data.roomType}:${data.roomId}`;
  dispatch(messagesSlice.actions.setMessages({
    roomKey,
    messages: data.messages,
    hasMore: data.hasMore,
    nextCursor: data.nextCursor
  }));
});
```

#### Message Actions

```typescript
// New message received
socket.on('message:new', (data) => {
  const roomKey = `${data.message.roomType}:${data.message.roomId}`;
  dispatch(messagesSlice.actions.addMessage({
    roomKey,
    message: data.message
  }));
});

// Message edited
socket.on('message:edited', (data) => {
  const roomKey = `${data.message.roomType}:${data.message.roomId}`;
  dispatch(messagesSlice.actions.updateMessage({
    roomKey,
    message: data.message
  }));
});

// Message deleted
socket.on('message:deleted', (data) => {
  const roomKey = `${data.roomType}:${data.roomId}`;
  dispatch(messagesSlice.actions.deleteMessage({
    roomKey,
    messageId: data.messageId
  }));
});
```

#### Typing Indicator Actions

```typescript
// User started typing
socket.on('typing:started', (data) => {
  const roomKey = `${data.roomType}:${data.roomId}`;
  dispatch(messagesSlice.actions.addTypingUser({
    roomKey,
    userId: data.user.id
  }));
});

// User stopped typing
socket.on('typing:stopped', (data) => {
  const roomKey = `${data.roomType}:${data.roomId}`;
  dispatch(messagesSlice.actions.removeTypingUser({
    roomKey,
    userId: data.userId
  }));
});
```

### Redux Thunks (Socket Emitters)

```typescript
// Join room
export const joinRoom = (type: 'project' | 'study', id: number) => 
  (dispatch: AppDispatch, getState: () => RootState) => {
    const socket = getState().socket.socket; // Assuming socket in state
    socket.emit('room:join', { type, id });
  };

// Send message
export const sendMessage = (
  roomType: 'project' | 'study',
  roomId: number,
  content: string,
  type: 'text' | 'image' | 'file' = 'text',
  fileMetadata?: FileMetadata
) => (dispatch: AppDispatch, getState: () => RootState) => {
  const socket = getState().socket.socket;
  socket.emit('message:send', {
    roomType,
    roomId,
    content,
    type,
    ...fileMetadata
  });
};

// Start typing
export const startTyping = (
  roomType: 'project' | 'study',
  roomId: number
) => (dispatch: AppDispatch, getState: () => RootState) => {
  const socket = getState().socket.socket;
  socket.emit('typing:start', { roomType, roomId });
};

// Stop typing
export const stopTyping = (
  roomType: 'project' | 'study',
  roomId: number
) => (dispatch: AppDispatch, getState: () => RootState) => {
  const socket = getState().socket.socket;
  socket.emit('typing:stop', { roomType, roomId });
};
```

---

## Server Implementation

See `src/lib/socket/server.ts` for complete server implementation with:
- Authentication middleware
- Room management handlers
- Message handlers (send, edit, delete)
- Typing indicator handlers
- RBAC validation
- Error handling

---

## Security Considerations

1. **Rate Limiting**: Implement rate limiting on message sends (e.g., 10 messages per minute)
2. **Content Validation**: Sanitize and validate all message content
3. **File Upload Limits**: Enforce file size and type restrictions
4. **RBAC Enforcement**: Always validate permissions before room join and message send
5. **Input Sanitization**: Sanitize user input to prevent XSS
6. **Token Validation**: Validate JWT on every connection attempt
7. **Room Isolation**: Ensure users can only access rooms they have permission for

---

## Performance Considerations

1. **Message Pagination**: Load messages in chunks (e.g., 50 per page)
2. **Room Member Tracking**: Use Redis or in-memory store for active room members
3. **Typing Indicator Timeout**: Auto-stop typing indicators after 3 seconds
4. **Message Caching**: Cache recent messages in Redis for faster access
5. **Connection Pooling**: Use connection pooling for database queries
6. **Broadcast Optimization**: Only broadcast to users actually in the room

---

## Error Handling

### Client-Side Error Handling

```typescript
socket.on('error', (error) => {
  // Handle socket errors
  console.error('Socket error:', error);
  // Dispatch error to Redux state
});

socket.on('room:error', (error) => {
  // Handle room-specific errors
  // Show user-friendly error message
});
```

### Server-Side Error Handling

- Always emit error events with descriptive messages
- Log errors for debugging
- Return appropriate error codes
- Validate all inputs before processing

---

## Testing Strategy

1. **Unit Tests**: Test message handlers, validation logic
2. **Integration Tests**: Test room join/leave, message send/receive
3. **E2E Tests**: Test full message flow with multiple clients
4. **Load Tests**: Test with multiple concurrent connections
5. **Security Tests**: Test RBAC enforcement, input validation

---

## Future Enhancements

1. **Message Reactions**: Add emoji reactions to messages
2. **Message Threading**: Enhanced reply/thread support
3. **Read Receipts**: Track who has read messages
4. **Message Search**: Full-text search across messages
5. **Push Notifications**: Notify users of new messages when offline
6. **Voice/Video**: Add voice and video message support
7. **Message Encryption**: End-to-end encryption for sensitive projects

