// Toast notification component - appears in lower right corner

'use client';

import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  selectNotifications,
  markAsRead,
  removeNotification,
} from '@/store/slices/notificationSlice';
import { useRouter } from 'next/navigation';

export function ToastNotifications() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notifications = useAppSelector(selectNotifications);

  // Show only unread notifications as toasts (messages and tasks)
  const unreadToasts = notifications
    .filter((n) => !n.read && (n.type === 'message' || n.type === 'task'))
    .slice(0, 3); // Show max 3 toasts at once

  const handleToastClick = (notification: typeof notifications[0]) => {
    dispatch(markAsRead(notification.id));
    dispatch(removeNotification(notification.id));

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
    dispatch(removeNotification(notificationId));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {unreadToasts.map((notification) => (
        <div
          key={notification.id}
          className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[320px] max-w-md animate-slide-in-right"
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
