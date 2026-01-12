// Redux provider

'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { initializeAuth } from '@/store/slices/authSlice';
import { setupTokenRefresh, stopTokenRefresh } from '@/lib/auth/tokenRefresh';
import type { AppDispatch } from '@/store';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();

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

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  );
}

