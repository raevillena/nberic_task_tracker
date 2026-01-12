// Custom hook for Socket.IO connection

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initializeSocketClient, disconnectSocket } from '@/lib/socket/client';
import { selectAccessToken } from '@/store/slices/authSlice';
import { store } from '@/store';

export function useSocket() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAccessToken);
  const socketInitialized = useRef(false);

  useEffect(() => {
    if (!token || socketInitialized.current) {
      return;
    }

    // Initialize socket with getState function
    const socket = initializeSocketClient(token, dispatch, () => store.getState());
    socketInitialized.current = true;

    // Cleanup on unmount
    return () => {
      disconnectSocket();
      socketInitialized.current = false;
    };
  }, [token, dispatch]);
}
