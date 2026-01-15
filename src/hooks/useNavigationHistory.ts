// Custom hook for tracking navigation history

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hook to track navigation history and provide back navigation
 * Stores the previous page URL in sessionStorage
 */
export function useNavigationHistory() {
  const pathname = usePathname();

  useEffect(() => {
    // Store current pathname as the referrer for the next navigation
    // This will be used when navigating to detail pages
    const previousPath = sessionStorage.getItem('currentPath');
    if (previousPath && previousPath !== pathname) {
      // Store the previous path as referrer for detail pages
      sessionStorage.setItem(`referrer:${pathname}`, previousPath);
    }
    // Update current path
    sessionStorage.setItem('currentPath', pathname);
  }, [pathname]);

  /**
   * Get the referrer URL for a given path
   * Falls back to a default route if no referrer is found
   */
  const getReferrer = (currentPath: string, defaultPath: string): string => {
    const referrer = sessionStorage.getItem(`referrer:${currentPath}`);
    return referrer || defaultPath;
  };

  /**
   * Store a referrer for a specific path (useful when navigating programmatically)
   */
  const setReferrer = (path: string, referrer: string) => {
    sessionStorage.setItem(`referrer:${path}`, referrer);
  };

  return { getReferrer, setReferrer };
}
