# Socket.IO Integration Guide

This guide explains how to integrate the Socket.IO messaging system into your Next.js application.

## Quick Start

### 1. Server Setup (Next.js API Route)

Create a custom server or use Next.js API routes to initialize Socket.IO. Here's an example using a custom server:

```typescript
// server.js or custom-server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketIO } from './src/lib/socket/server';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO
  const io = initializeSocketIO(server);

  server.listen(3000, () => {
    console.log('> Ready on http://localhost:3000');
  });
});
```

### 2. Client Setup (React Component/Hook)

Create a custom hook to initialize the socket client:

```typescript
// hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initializeSocketClient, disconnectSocket } from '@/lib/socket/client';
import { selectAuthToken } from '@/store/slices/authSlice';

export function useSocket() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const socketInitialized = useRef(false);

  useEffect(() => {
    if (!token || socketInitialized.current) {
      return;
    }

    // Initialize socket
    const socket = initializeSocketClient(token, dispatch);
    socketInitialized.current = true;

    // Cleanup on unmount
    return () => {
      disconnectSocket();
      socketInitialized.current = false;
    };
  }, [token, dispatch]);
}
```

### 3. Using in Components

```typescript
// components/ChatRoom.tsx
'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useSocket } from '@/hooks/useSocket';
import { joinRoom, sendTextMessage, startTyping, stopTyping } from '@/lib/socket/client';
import { selectRoomMessages, selectActiveRoom } from '@/store/slices/messagesSlice';

export function ChatRoom({ roomType, roomId }: { roomType: 'project' | 'study'; roomId: number }) {
  useSocket(); // Initialize socket connection
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => selectRoomMessages(state, roomType, roomId));
  const activeRoom = useAppSelector(selectActiveRoom);

  useEffect(() => {
    // Join room when component mounts
    joinRoom(roomType, roomId);

    // Leave room when component unmounts
    return () => {
      leaveRoom(roomType, roomId);
    };
  }, [roomType, roomId]);

  const handleSendMessage = (content: string) => {
    sendTextMessage(roomType, roomId, content);
  };

  return (
    <div>
      {/* Render messages */}
      {messages.map((message) => (
        <div key={message.id}>
          <strong>{message.sender?.firstName}</strong>: {message.content}
        </div>
      ))}
      
      {/* Message input */}
      <input
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        onFocus={() => startTyping(roomType, roomId)}
        onBlur={() => stopTyping(roomType, roomId)}
      />
    </div>
  );
}
```

## File Upload Integration

For image and file messages, you'll need to create a file upload API route:

```typescript
// app/api/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    const maxSize = file.type.startsWith('image/') ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for files
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Save file (in production, use cloud storage like S3)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${uuidv4()}-${file.name}`;
    const filePath = join(process.cwd(), 'public', 'uploads', fileName);
    
    await writeFile(filePath, buffer);

    // In a real implementation, save file metadata to database
    // For now, return file info
    return NextResponse.json({
      fileId: 1, // Replace with actual file ID from database
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      url: `/uploads/${fileName}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

Then use it in your component:

```typescript
async function handleFileUpload(file: File, roomType: 'project' | 'study', roomId: number) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  });

  const fileData = await response.json();

  // Send message with file metadata
  if (file.type.startsWith('image/')) {
    sendImageMessage(
      roomType,
      roomId,
      file.name, // Description
      fileData.fileId,
      fileData.fileName,
      fileData.fileSize,
      fileData.mimeType
    );
  } else {
    sendFileMessage(
      roomType,
      roomId,
      file.name, // Description
      fileData.fileId,
      fileData.fileName,
      fileData.fileSize,
      fileData.mimeType
    );
  }
}
```

## Database Migration

Create a migration for the messages table:

```typescript
// migrations/XXXXXX-create-messages.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      room_type: {
        type: Sequelize.ENUM('project', 'study'),
        allowNull: false,
      },
      room_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'projectId or studyId depending on roomType',
      },
      sender_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      type: {
        type: Sequelize.ENUM('text', 'image', 'file'),
        allowNull: false,
        defaultValue: 'text',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      file_size: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      reply_to_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      edited_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('messages', ['room_type', 'room_id'], {
      name: 'idx_messages_room',
    });
    await queryInterface.addIndex('messages', ['sender_id'], {
      name: 'idx_messages_sender',
    });
    await queryInterface.addIndex('messages', ['reply_to_id'], {
      name: 'idx_messages_reply_to',
    });
    await queryInterface.addIndex('messages', ['created_at'], {
      name: 'idx_messages_created_at',
    });
    await queryInterface.addIndex('messages', ['room_type', 'room_id', 'created_at'], {
      name: 'idx_messages_room_created',
    });
    await queryInterface.addIndex('messages', ['deleted_at'], {
      name: 'idx_messages_deleted_at',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('messages');
  },
};
```

Run the migration:

```bash
npm run db:migrate
```

## Environment Variables

Add to your `.env` file:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-secret-key
```

## Testing

### Test Socket Connection

```typescript
// Test socket connection
import { initializeSocketClient } from '@/lib/socket/client';
import { store } from '@/store';

const token = 'your-jwt-token';
const socket = initializeSocketClient(token, store.dispatch);

socket.on('connect', () => {
  console.log('Connected!');
});

socket.on('auth:success', (data) => {
  console.log('Authenticated:', data);
});
```

### Test Room Join

```typescript
import { joinRoom } from '@/lib/socket/client';

// Join a project room
joinRoom('project', 1);

// Join a study room
joinRoom('study', 5);
```

### Test Message Send

```typescript
import { sendTextMessage } from '@/lib/socket/client';

sendTextMessage('project', 1, 'Hello, world!');
```

## Troubleshooting

### Socket Not Connecting

1. Check that the server is running
2. Verify `NEXT_PUBLIC_SOCKET_URL` is correct
3. Check browser console for connection errors
4. Verify JWT token is valid

### Messages Not Appearing

1. Verify you've joined the room
2. Check Redux state: `useAppSelector((state) => state.messages)`
3. Verify RBAC permissions for the room
4. Check server logs for errors

### File Upload Issues

1. Verify file size limits
2. Check file type restrictions
3. Verify upload directory permissions
4. Check API route is accessible

## Next Steps

1. Implement file storage system (S3, Cloudinary, etc.)
2. Add message search functionality
3. Implement read receipts
4. Add message reactions
5. Add push notifications for offline users
6. Implement message encryption for sensitive projects

