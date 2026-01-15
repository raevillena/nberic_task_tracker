// Redux provider

'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { initializeAuth, selectAccessToken } from '@/store/slices/authSlice';
import { fetchNotificationsThunk } from '@/store/slices/notificationSlice';
import { setupTokenRefresh, stopTokenRefresh } from '@/lib/auth/tokenRefresh';
import { initializeSocketClient, disconnectSocket } from '@/lib/socket/client';
import type { AppDispatch, RootState } from '@/store';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    // Initialize auth from localStorage
    dispatch(initializeAuth());
    
    // Fetch notifications from database
    dispatch(fetchNotificationsThunk());
    
    // Setup proactive token refresh
    setupTokenRefresh(store);

    // Cleanup on unmount
    return () => {
      stopTokenRefresh();
    };
  }, [dispatch]);

  return <>{children}</>;
}

/**
 * SocketInitializer - Handles global socket connection
 * 
 * This component initializes the Socket.IO connection when the user is authenticated.
 * It ensures real-time notifications work across all pages, not just the chat page.
 */
function SocketInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => selectAccessToken(state));
  const socketInitialized = useRef(false);

  useEffect(() => {
    // Only initialize socket if we have a token and haven't already initialized
    if (token && !socketInitialized.current) {
      console.log('[SocketInitializer] Initializing socket connection...');
      initializeSocketClient(token, dispatch, () => store.getState());
      socketInitialized.current = true;
    }

    // If token is removed (logout), disconnect socket
    if (!token && socketInitialized.current) {
      console.log('[SocketInitializer] Token removed, disconnecting socket...');
      disconnectSocket();
      socketInitialized.current = false;
    }

    // Cleanup on unmount
    return () => {
      if (socketInitialized.current) {
        disconnectSocket();
        socketInitialized.current = false;
      }
    };
  }, [token, dispatch]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>
        <SocketInitializer>{children}</SocketInitializer>
      </AuthInitializer>
    </Provider>
  );
}

