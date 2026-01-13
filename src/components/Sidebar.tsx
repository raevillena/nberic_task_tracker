'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import { UserRole } from '@/types/entities';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Projects',
    href: '/dashboard/projects',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: 'Studies',
    href: '/dashboard/studies',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Tasks',
    href: '/dashboard/tasks',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

const aboutNavItem: NavItem = {
  name: 'About',
  href: '/dashboard/about',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAppSelector((state) => state.auth);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState({ projects: 0, studies: 0, tasks: 0 });
  
  // Fetch pending requests count function (memoized)
  const fetchPendingCount = useCallback(async () => {
    try {
      const response = await fetch('/api/task-requests/count', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRequestsCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch pending requests count:', error);
    }
  }, []);

  // Fetch unread counts for researchers
  const fetchUnreadCounts = useCallback(async () => {
    if (user?.role === UserRole.RESEARCHER) {
      try {
        const response = await fetch('/api/navigation/unread-counts', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const counts = {
            projects: data.projects || 0,
            studies: data.studies || 0,
            tasks: data.tasks || 0,
          };
          setUnreadCounts(counts);
        } else {
          console.error('Failed to fetch unread counts:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Failed to fetch unread counts:', error);
      }
    }
  }, [user?.role]);

  // Fetch pending requests count for managers on mount and periodically
  useEffect(() => {
    if (user?.role === UserRole.MANAGER) {
      fetchPendingCount();
      // Refresh count every 30 seconds as a fallback
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    } else if (user?.role === UserRole.RESEARCHER) {
      fetchUnreadCounts();
      // Refresh counts every 30 seconds
      const interval = setInterval(fetchUnreadCounts, 30000);
      
      // Also refresh when page becomes visible or window regains focus (user navigates back)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchUnreadCounts();
        }
      };
      const handleFocus = () => {
        fetchUnreadCounts();
      };
      // Listen for custom event to refresh counts immediately after marking as read
      const handleRefreshEvent = () => {
        fetchUnreadCounts();
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('refreshUnreadCounts', handleRefreshEvent);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('refreshUnreadCounts', handleRefreshEvent);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]); // Only depend on user.role to prevent loops
  
  // Listen for socket events to update count (refetch from API for accuracy)
  useEffect(() => {
    if (user?.role === UserRole.MANAGER) {
      import('@/lib/socket/client').then(({ getSocket }) => {
        const socket = getSocket();
        if (!socket) return;

        // Refetch count from API when events occur to ensure accuracy
        const handleRequestEvent = () => {
          // Small delay to ensure DB is updated
          setTimeout(() => {
            fetchPendingCount();
          }, 100);
        };

        socket.on('task-request:created', handleRequestEvent);
        socket.on('task-request:approved', handleRequestEvent);
        socket.on('task-request:rejected', handleRequestEvent);

        return () => {
          socket.off('task-request:created', handleRequestEvent);
          socket.off('task-request:approved', handleRequestEvent);
          socket.off('task-request:rejected', handleRequestEvent);
        };
      });
    } else if (user?.role === UserRole.RESEARCHER) {
      import('@/lib/socket/client').then(({ getSocket }) => {
        const socket = getSocket();
        if (!socket) return;

        // Refetch unread counts when tasks are assigned
        const handleTaskAssigned = () => {
          setTimeout(() => {
            fetchUnreadCounts();
          }, 200);
        };

        socket.on('task:assigned', handleTaskAssigned);

        return () => {
          socket.off('task:assigned', handleTaskAssigned);
        };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]); // Only depend on user.role to prevent loops
  
  // Add Requests and Trash links for managers
  const managerNavItems = user?.role === UserRole.MANAGER ? [
    {
      name: 'Requests',
      href: '/dashboard/requests',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      badgeCount: pendingRequestsCount,
    },
  ] : [];

  const trashNavItem = user?.role === UserRole.MANAGER ? {
    name: 'Trash',
    href: '/dashboard/trash',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  } : null;
  
  // Add badge counts to navigation items for researchers
  const navItemsWithBadges = navItems.map((item) => {
    if (user?.role === UserRole.RESEARCHER) {
      if (item.name === 'Projects') {
        return { ...item, badgeCount: unreadCounts.projects };
      } else if (item.name === 'Studies') {
        return { ...item, badgeCount: unreadCounts.studies };
      } else if (item.name === 'Tasks') {
        return { ...item, badgeCount: unreadCounts.tasks };
      }
    }
    return item;
  });

  // Debug: Log badge counts
  useEffect(() => {
    if (user?.role === UserRole.RESEARCHER) {
      console.log('Sidebar unreadCounts state:', unreadCounts);
      console.log('NavItemsWithBadges:', navItemsWithBadges.map(item => ({ name: item.name, badgeCount: (item as any).badgeCount })));
    }
  }, [unreadCounts, navItemsWithBadges, user?.role]);
  
  // Combine navigation items: main items, manager items, divider + trash, divider + about
  const allNavItems = [...navItemsWithBadges, ...managerNavItems];

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-indigo-600">NBERIC Task Tracker</h1>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col px-4 py-6 overflow-y-auto">
            <div className="space-y-2">
              {allNavItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const badgeCount = (item as any).badgeCount || 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`
                      flex items-center justify-between px-4 py-3 rounded-lg transition-colors
                      ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={isActive ? 'text-indigo-600' : 'text-gray-400'}>{item.icon}</span>
                      <span>{item.name}</span>
                    </div>
                    {badgeCount > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Divider before Trash (for managers) */}
            {trashNavItem && (
              <>
                <div className="my-2 border-t border-gray-200" />
                <Link
                  href={trashNavItem.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${
                      pathname === trashNavItem.href || pathname.startsWith(trashNavItem.href)
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <span className={pathname === trashNavItem.href || pathname.startsWith(trashNavItem.href) ? 'text-indigo-600' : 'text-gray-400'}>
                    {trashNavItem.icon}
                  </span>
                  <span>{trashNavItem.name}</span>
                </Link>
              </>
            )}

            {/* Divider before About */}
            <div className="mt-auto my-2 border-t border-gray-200" />

            {/* About at the bottom */}
            <Link
              href={aboutNavItem.href}
              onClick={() => setIsMobileOpen(false)}
              className={`
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                ${
                  pathname === aboutNavItem.href || pathname.startsWith(aboutNavItem.href)
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <span className={pathname === aboutNavItem.href || pathname.startsWith(aboutNavItem.href) ? 'text-indigo-600' : 'text-gray-400'}>
                {aboutNavItem.icon}
              </span>
              <span>{aboutNavItem.name}</span>
            </Link>
          </nav>
        </div>
      </aside>
    </>
  );
}
