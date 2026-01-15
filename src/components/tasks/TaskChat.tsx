// Task chat/thread component with file upload support

'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useSocket } from '@/hooks/useSocket';
import {
  joinRoom,
  leaveRoom,
  sendTextMessage,
  sendImageMessage,
  sendFileMessage,
  startTyping,
  stopTyping,
} from '@/lib/socket/client';
import {
  selectRoomMessages,
  selectRoomTypingUsers,
  selectActiveRoom,
  selectSocketConnected,
} from '@/store/slices/messagesSlice';
import { selectAuthUser } from '@/store/slices/authSlice';
import { Message, MessageType } from '@/types/socket';
import { FileViewer } from '@/components/files/fileViewer';

interface TaskChatProps {
  taskId: number;
  taskName: string;
  projectId?: number;
  studyId?: number;
}

export function TaskChat({ taskId, taskName, projectId, studyId }: TaskChatProps) {
  useSocket(); // Initialize socket connection
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) =>
    selectRoomMessages(state, 'task', taskId)
  );
  const typingUsers = useAppSelector((state) =>
    selectRoomTypingUsers(state, 'task', taskId)
  );
  const activeRoom = useAppSelector(selectActiveRoom);
  const socketConnected = useAppSelector(selectSocketConnected);
  const user = useAppSelector(selectAuthUser);
  const [messageInput, setMessageInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerMessage, setViewerMessage] = useState<Message | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Join room when component mounts and socket is connected
  useEffect(() => {
    if (socketConnected) {
      joinRoom('task', taskId);
    }

    return () => {
      if (socketConnected) {
        leaveRoom('task', taskId);
      }
    };
  }, [taskId, socketConnected]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    if (!socketConnected) {
      alert('Socket not connected. Please refresh the page and try again.');
      return;
    }

    const messageContent = messageInput.trim();
    setMessageInput('');
    stopTyping('task', taskId);
    
    // Send message via socket
    sendTextMessage('task', taskId, messageContent);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const fileData = await response.json();

      // Determine message type based on file type
      const isImage = file.type.startsWith('image/');
      const messageType: MessageType = isImage ? 'image' : 'file';

      // Use stored filename (UUID + extension) for file access, original name for display
      const storedFileName = fileData.storedFileName || fileData.url?.replace('/uploads/', '') || fileData.fileName;

      if (isImage) {
        sendImageMessage(
          'task',
          taskId,
          file.name, // Original filename as content/description
          fileData.fileId,
          storedFileName, // Stored filename for file access
          fileData.fileSize,
          fileData.mimeType
        );
      } else {
        sendFileMessage(
          'task',
          taskId,
          file.name, // Original filename as content/description
          fileData.fileId,
          storedFileName, // Stored filename for file access
          fileData.fileSize,
          fileData.mimeType
        );
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Memoize file messages to prevent recalculation on every render
  const fileMessages = useMemo(
    () => messages.filter((m) => m.type === 'image' || m.type === 'file'),
    [messages]
  );

  // Memoize viewer navigation state
  const { currentViewerIndex, hasNext, hasPrevious } = useMemo(() => {
    const index = viewerMessage
      ? fileMessages.findIndex((m) => m.id === viewerMessage.id)
      : -1;
    return {
      currentViewerIndex: index,
      hasNext: index >= 0 && index < fileMessages.length - 1,
      hasPrevious: index > 0,
    };
  }, [viewerMessage, fileMessages]);

  const handleOpenViewer = useCallback((message: Message) => {
    setViewerMessage(message);
    setViewerOpen(true);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
    setViewerMessage(null);
  }, []);

  const handleNextFile = useCallback(() => {
    if (hasNext && currentViewerIndex >= 0) {
      setViewerMessage(fileMessages[currentViewerIndex + 1]);
    }
  }, [hasNext, currentViewerIndex, fileMessages]);

  const handlePreviousFile = useCallback(() => {
    if (hasPrevious && currentViewerIndex >= 0) {
      setViewerMessage(fileMessages[currentViewerIndex - 1]);
    }
  }, [hasPrevious, currentViewerIndex, fileMessages]);

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">
          Comments & Discussion
        </h3>
        <p className="text-xs text-gray-500 mt-1">{taskName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message: Message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === user?.id ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.senderId === user?.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs font-medium">
                    {message.sender?.firstName} {message.sender?.lastName}
                  </span>
                  <span className="text-xs opacity-75">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                  {message.editedAt && (
                    <span className="text-xs opacity-75">(edited)</span>
                  )}
                </div>

                {message.type === 'text' && (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}

                {message.type === 'image' && (
                  <div className="relative group">
                    <img
                      src={message.fileName ? `/uploads/${message.fileName}` : `/api/files/${message.fileId || ''}`}
                      alt={message.content || 'Image'}
                      className="max-w-full rounded mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '300px' }}
                      onClick={() => handleOpenViewer(message)}
                      onError={(e) => {
                        // Fallback to API route if direct upload path fails
                        if (message.fileId) {
                          (e.target as HTMLImageElement).src = `/api/files/${message.fileId}`;
                        }
                      }}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded p-1.5 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                    </div>
                    {message.content && message.content !== message.fileName && (
                      <p className="text-sm mt-2">{message.content}</p>
                    )}
                  </div>
                )}

                {message.type === 'file' && (
                  <div>
                    <button
                      onClick={() => handleOpenViewer(message)}
                      className="flex items-center space-x-2 text-sm underline hover:opacity-80 transition-opacity"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      <span>{message.content || message.fileName}</span>
                      {message.fileSize && (
                        <span className="text-xs opacity-75">
                          ({formatFileSize(message.fileSize)})
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              ></div>
              <div
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
            <span>
              {typingUsers.length === 1
                ? 'Someone is typing...'
                : `${typingUsers.length} people are typing...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        {!socketConnected && (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              ⚠️ Socket not connected. Stop <code className="bg-yellow-100 px-1 rounded">next dev</code> and run <code className="bg-yellow-100 px-1 rounded">npm run dev:socket</code> instead to enable Socket.IO.
            </p>
          </div>
        )}
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                if (e.target.value.trim() && socketConnected) {
                  startTyping('task', taskId);
                } else {
                  stopTyping('task', taskId);
                }
              }}
              onKeyPress={handleKeyPress}
              onBlur={() => stopTyping('task', taskId)}
              placeholder={socketConnected ? "Type a message... (Shift+Enter for new line)" : "Socket not connected - cannot send messages"}
              disabled={!socketConnected}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={2}
            />
          </div>
          <div className="flex space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id={`file-upload-${taskId}`}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <label
              htmlFor={`file-upload-${taskId}`}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer transition-colors"
              title="Upload file or image"
            >
              {isUploading ? (
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              )}
            </label>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || isUploading || !socketConnected}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={!socketConnected ? "Socket not connected" : ""}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* File Viewer Modal */}
      <FileViewer
        message={viewerMessage}
        isOpen={viewerOpen}
        onClose={handleCloseViewer}
        onNext={handleNextFile}
        onPrevious={handlePreviousFile}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
      />
    </div>
  );
}
