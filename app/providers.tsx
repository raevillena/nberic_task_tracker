// Redux provider

'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { initializeAuth, selectAccessToken, selectIsAuthenticated } from '@/store/slices/authSlice';
import { fetchNotificationsThunk } from '@/store/slices/notificationSlice';
import { setupTokenRefresh, stopTokenRefresh } from '@/lib/auth/tokenRefresh';
import { initializeSocketClient, disconnectSocket } from '@/lib/socket/client';
import { ToastNotifications } from '@/components/notifications/ToastNotifications';
import type { AppDispatch, RootState } from '@/store';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const accessToken = useSelector(selectAccessToken);

  useEffect(() => {
    // Initialize auth from localStorage
    dispatch(initializeAuth());
    
    // Setup proactive token refresh
    setupTokenRefresh(store);

    // Cleanup on unmount
    return () => {
      stopTokenRefresh();
    };
  }, [dispatch]);

  // Only fetch notifications if user is authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      dispatch(fetchNotificationsThunk());
    }
  }, [dispatch, isAuthenticated, accessToken]);

  return <>{children}</>;
}

/**
 * SocketInitializer - Handles global socket connection
 * 
 * This component initializes the Socket.IO connection ONLY after user is authenticated (logged in).
 * It disconnects the socket when user logs out.
 * It ensures real-time notifications work across all pages, not just the chat page.
 */
function SocketInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const token = useSelector((state: RootState) => selectAccessToken(state));
  const isAuthenticated = useSelector((state: RootState) => selectIsAuthenticated(state));
  const socketInitialized = useRef(false);

  useEffect(() => {
    // Only initialize socket if user is authenticated AND has a token
    // This ensures socket only connects after successful login
    if (isAuthenticated && token && !socketInitialized.current) {
      console.log('[SocketInitializer] User authenticated, initializing socket connection...');
      initializeSocketClient(token, dispatch, () => store.getState());
      socketInitialized.current = true;
    }

    // If user is not authenticated or token is removed (logout), disconnect socket
    if ((!isAuthenticated || !token) && socketInitialized.current) {
      console.log('[SocketInitializer] User logged out, disconnecting socket...');
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
  }, [token, isAuthenticated, dispatch]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>
        <SocketInitializer>
          {children}
          <ToastNotifications />
        </SocketInitializer>
      </AuthInitializer>
    </Provider>
  );
}

