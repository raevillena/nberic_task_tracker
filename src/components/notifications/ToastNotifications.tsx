// Toast notification component - appears in lower right corner

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  selectNotifications,
  markAsRead,
  removeNotification,
  markNotificationAsReadThunk,
  fetchNotificationsThunk,
} from '@/store/slices/notificationSlice';
import { useRouter } from 'next/navigation';

export function ToastNotifications() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notifications = useAppSelector(selectNotifications);
  const dismissTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [isMounted, setIsMounted] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Only render after client-side hydration to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Check socket connection status and listen to connection events
  useEffect(() => {
    if (!isMounted) return;

    const checkSocketConnection = () => {
      import('@/lib/socket/client').then(({ getSocket }) => {
        const socket = getSocket();
        setIsSocketConnected(socket?.connected ?? false);
      });
    };

    // Check immediately
    checkSocketConnection();

    let cleanupSocketListeners: (() => void) | null = null;

    // Listen to socket connection events for real-time updates
    import('@/lib/socket/client').then(({ getSocket }) => {
      const socket = getSocket();
      if (!socket) return;

      const handleConnect = () => setIsSocketConnected(true);
      const handleDisconnect = () => setIsSocketConnected(false);

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);

      cleanupSocketListeners = () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
      };
    });

    // Fallback: Check periodically to catch connection changes (in case events are missed)
    const interval = setInterval(checkSocketConnection, 2000);

    return () => {
      clearInterval(interval);
      if (cleanupSocketListeners) {
        cleanupSocketListeners();
      }
    };
  }, [isMounted]);

  // Show only unread notifications as toasts
  // Only show system notifications when socket is not connected (before login/after logout)
  // Show all notification types (message, task, system) when socket is connected (after login)
  const unreadToasts = notifications
    .filter((n) => {
      if (n.read) return false;
      // If socket is not connected, only show system notifications
      if (!isSocketConnected) {
        return n.type === 'system';
      }
      // If socket is connected, show all notification types
      return n.type === 'message' || n.type === 'task' || n.type === 'system';
    })
    .slice(0, 3); // Show max 3 toasts at once

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    unreadToasts.forEach((notification) => {
      // Clear existing timeout if any
      const existingTimeout = dismissTimeoutsRef.current.get(notification.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout to auto-dismiss
      // For DB notifications, DON'T mark as read - just let toast disappear
      // The notification will still show in the bell dropdown and badge will persist
      // For non-DB notifications, mark as read in Redux
      const timeout = setTimeout(() => {
        if (notification.id.startsWith('db-')) {
          // DB notification: Don't mark as read, don't remove
          // Just let the toast disappear naturally (it will be filtered out)
          // The notification remains unread in DB and will show in bell dropdown
          // Badge count will persist
        } else {
          // Non-DB notification: mark as read in Redux
          dispatch(markAsRead(notification.id));
        }
        dismissTimeoutsRef.current.delete(notification.id);
      }, 5000); // 5 seconds

      dismissTimeoutsRef.current.set(notification.id, timeout);
    });

    // Cleanup timeouts for notifications that are no longer in the list
    const currentIds = new Set(unreadToasts.map((n) => n.id));
    dismissTimeoutsRef.current.forEach((timeout, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timeout);
        dismissTimeoutsRef.current.delete(id);
      }
    });

    // Cleanup on unmount
    return () => {
      dismissTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      dismissTimeoutsRef.current.clear();
    };
  }, [unreadToasts, dispatch]);

  const handleToastClick = (notification: typeof notifications[0]) => {
    // System notifications (like session expired) don't need navigation
    if (notification.type === 'system') {
      // Just mark as read
      dispatch(markAsRead(notification.id));
      return;
    }

    if (notification.id.startsWith('db-')) {
      // DB notification: mark as read in DB, then refresh from DB
      dispatch(markNotificationAsReadThunk(notification.id))
        .then(() => {
          // Refresh notifications from DB to get accurate badge count
          dispatch(fetchNotificationsThunk());
        })
        .catch((error) => {
          // Log error but don't block navigation
          console.error('Failed to mark notification as read:', error);
        });
    } else {
      // Non-DB notification: just mark as read in Redux
      dispatch(markAsRead(notification.id));
    }

    // Navigate to the notification's action URL
    if (notification.actionUrl) {
      // Handle hash-based navigation for tasks
      if (notification.actionUrl.startsWith('#task-')) {
        const taskId = notification.actionUrl.replace('#task-', '');
        // For now, navigate to tasks page - in production, you'd query task to get full path
        router.push(`/dashboard/tasks?highlight=${taskId}`);
      } else {
        router.push(notification.actionUrl);
      }
    }
  };

  const handleDismiss = (notificationId: string) => {
    if (notificationId.startsWith('db-')) {
      // DB notification: mark as read in DB, then refresh from DB
      dispatch(markNotificationAsReadThunk(notificationId))
        .then(() => {
          // Refresh notifications from DB to get accurate badge count
          dispatch(fetchNotificationsThunk());
        })
        .catch((error) => {
          // Log error but don't block dismissal
          console.error('Failed to mark notification as read:', error);
        });
    } else {
      // Non-DB notification: just mark as read in Redux
      dispatch(markAsRead(notificationId));
    }
  };

  // Don't render until after client-side hydration
  if (!isMounted) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {unreadToasts.map((notification) => (
        <div
          key={notification.id}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[320px] max-w-md animate-slide-in-right cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => handleToastClick(notification)}
        >
          <div className="flex items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  {notification.title}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(notification.id);
                  }}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {notification.message}
              </p>
              {notification.senderName && (
                <p className="text-xs text-gray-400 mt-1">
                  from {notification.senderName}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
