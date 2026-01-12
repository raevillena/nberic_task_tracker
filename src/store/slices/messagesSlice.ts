// Redux slice for managing Socket.IO messages state

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message, MessageRoomType } from '@/types/socket';

// Room key format: "project:1" or "study:5"
type RoomKey = string;

interface RoomState {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  nextCursor?: number;
  typingUsers: number[]; // Array of userIds currently typing
}

interface MessagesState {
  // Room-based message storage
  rooms: Record<RoomKey, RoomState>;
  
  // Active room
  activeRoom: {
    type: MessageRoomType | null;
    id: number | null;
  };
  
  // Connection status
  socketConnected: boolean;
  socketAuthenticated: boolean;
  socketError: string | null;
  
  // User info from socket
  socketUser: {
    userId: number | null;
    userRole: string | null;
  };
}

const initialState: MessagesState = {
  rooms: {},
  activeRoom: {
    type: null,
    id: null,
  },
  socketConnected: false,
  socketAuthenticated: false,
  socketError: null,
  socketUser: {
    userId: null,
    userRole: null,
  },
};

/**
 * Generate room key from type and id
 */
function getRoomKey(type: MessageRoomType, id: number): RoomKey {
  return `${type}:${id}`;
}

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    // Connection status
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.socketConnected = action.payload;
      if (!action.payload) {
        // Reset on disconnect
        state.socketAuthenticated = false;
        state.socketUser = { userId: null, userRole: null };
      }
    },
    
    setSocketAuthenticated(state, action: PayloadAction<{ userId: number; userRole: string }>) {
      state.socketAuthenticated = true;
      state.socketUser = {
        userId: action.payload.userId,
        userRole: action.payload.userRole,
      };
    },
    
    setSocketError(state, action: PayloadAction<string | null>) {
      state.socketError = action.payload;
    },
    
    // Room management
    setActiveRoom(
      state,
      action: PayloadAction<{ type: MessageRoomType; id: number }>
    ) {
      state.activeRoom = action.payload;
      
      // Initialize room state if it doesn't exist
      const roomKey = getRoomKey(action.payload.type, action.payload.id);
      if (!state.rooms[roomKey]) {
        state.rooms[roomKey] = {
          messages: [],
          isLoading: false,
          hasMore: false,
          typingUsers: [],
        };
      }
    },
    
    clearActiveRoom(state) {
      state.activeRoom = { type: null, id: null };
    },
    
    // Message history
    setMessages(
      state,
      action: PayloadAction<{
        roomKey: RoomKey;
        messages: Message[];
        hasMore: boolean;
        nextCursor?: number;
      }>
    ) {
      const { roomKey, messages, hasMore, nextCursor } = action.payload;
      
      if (!state.rooms[roomKey]) {
        state.rooms[roomKey] = {
          messages: [],
          isLoading: false,
          hasMore: false,
          typingUsers: [],
        };
      }
      
      state.rooms[roomKey].messages = messages;
      state.rooms[roomKey].hasMore = hasMore;
      state.rooms[roomKey].nextCursor = nextCursor;
      state.rooms[roomKey].isLoading = false;
    },
    
    appendMessages(
      state,
      action: PayloadAction<{
        roomKey: RoomKey;
        messages: Message[];
        hasMore: boolean;
        nextCursor?: number;
      }>
    ) {
      const { roomKey, messages, hasMore, nextCursor } = action.payload;
      
      if (!state.rooms[roomKey]) {
        state.rooms[roomKey] = {
          messages: [],
          isLoading: false,
          hasMore: false,
          typingUsers: [],
        };
      }
      
      // Append older messages (for pagination)
      state.rooms[roomKey].messages = [
        ...messages,
        ...state.rooms[roomKey].messages,
      ];
      state.rooms[roomKey].hasMore = hasMore;
      state.rooms[roomKey].nextCursor = nextCursor;
      state.rooms[roomKey].isLoading = false;
    },
    
    setMessagesLoading(
      state,
      action: PayloadAction<{ roomKey: RoomKey; isLoading: boolean }>
    ) {
      const { roomKey, isLoading } = action.payload;
      
      if (!state.rooms[roomKey]) {
        state.rooms[roomKey] = {
          messages: [],
          isLoading: false,
          hasMore: false,
          typingUsers: [],
        };
      }
      
      state.rooms[roomKey].isLoading = isLoading;
    },
    
    // Single message operations
    addMessage(
      state,
      action: PayloadAction<{ roomKey: RoomKey; message: Message }>
    ) {
      const { roomKey, message } = action.payload;
      
      if (!state.rooms[roomKey]) {
        state.rooms[roomKey] = {
          messages: [],
          isLoading: false,
          hasMore: false,
          typingUsers: [],
        };
      }
      
      // Check if message already exists (avoid duplicates)
      const exists = state.rooms[roomKey].messages.some((m) => m.id === message.id);
      if (!exists) {
        state.rooms[roomKey].messages.push(message);
      }
    },
    
    updateMessage(
      state,
      action: PayloadAction<{ roomKey: RoomKey; message: Message }>
    ) {
      const { roomKey, message } = action.payload;
      
      if (!state.rooms[roomKey]) {
        return;
      }
      
      const index = state.rooms[roomKey].messages.findIndex(
        (m) => m.id === message.id
      );
      
      if (index !== -1) {
        state.rooms[roomKey].messages[index] = message;
      }
    },
    
    deleteMessage(
      state,
      action: PayloadAction<{ roomKey: RoomKey; messageId: number }>
    ) {
      const { roomKey, messageId } = action.payload;
      
      if (!state.rooms[roomKey]) {
        return;
      }
      
      state.rooms[roomKey].messages = state.rooms[roomKey].messages.filter(
        (m) => m.id !== messageId
      );
    },
    
    // Typing indicators
    addTypingUser(
      state,
      action: PayloadAction<{ roomKey: RoomKey; userId: number }>
    ) {
      const { roomKey, userId } = action.payload;
      
      if (!state.rooms[roomKey]) {
        state.rooms[roomKey] = {
          messages: [],
          isLoading: false,
          hasMore: false,
          typingUsers: [],
        };
      }
      
      if (!state.rooms[roomKey].typingUsers.includes(userId)) {
        state.rooms[roomKey].typingUsers.push(userId);
      }
    },
    
    removeTypingUser(
      state,
      action: PayloadAction<{ roomKey: RoomKey; userId: number }>
    ) {
      const { roomKey, userId } = action.payload;
      
      if (!state.rooms[roomKey]) {
        return;
      }
      
      state.rooms[roomKey].typingUsers = state.rooms[roomKey].typingUsers.filter(
        (id) => id !== userId
      );
    },
    
    clearTypingUsers(
      state,
      action: PayloadAction<{ roomKey: RoomKey }>
    ) {
      const { roomKey } = action.payload;
      
      if (!state.rooms[roomKey]) {
        return;
      }
      
      state.rooms[roomKey].typingUsers = [];
    },
    
    // Cleanup
    clearRoom(state, action: PayloadAction<{ roomKey: RoomKey }>) {
      const { roomKey } = action.payload;
      delete state.rooms[roomKey];
    },
    
    clearAllRooms(state) {
      state.rooms = {};
      state.activeRoom = { type: null, id: null };
    },
  },
});

export const {
  setSocketConnected,
  setSocketAuthenticated,
  setSocketError,
  setActiveRoom,
  clearActiveRoom,
  setMessages,
  appendMessages,
  setMessagesLoading,
  addMessage,
  updateMessage,
  deleteMessage,
  addTypingUser,
  removeTypingUser,
  clearTypingUsers,
  clearRoom,
  clearAllRooms,
} = messagesSlice.actions;

export default messagesSlice.reducer;

// Selectors
export const selectActiveRoom = (state: { messages: MessagesState }) =>
  state.messages.activeRoom;

export const selectRoomMessages = (
  state: { messages: MessagesState },
  roomType: MessageRoomType | null,
  roomId: number | null
) => {
  if (!roomType || !roomId) {
    return [];
  }
  
  const roomKey = getRoomKey(roomType, roomId);
  return state.messages.rooms[roomKey]?.messages || [];
};

export const selectRoomTypingUsers = (
  state: { messages: MessagesState },
  roomType: MessageRoomType | null,
  roomId: number | null
) => {
  if (!roomType || !roomId) {
    return [];
  }
  
  const roomKey = getRoomKey(roomType, roomId);
  return state.messages.rooms[roomKey]?.typingUsers || [];
};

export const selectSocketConnected = (state: { messages: MessagesState }) =>
  state.messages.socketConnected;

export const selectSocketAuthenticated = (state: { messages: MessagesState }) =>
  state.messages.socketAuthenticated;

