// usePermissions hook

import { useAppSelector } from '@/store/hooks';
import { UserRole } from '@/types/entities';
import { hasPermission } from '@/lib/rbac/permissions';
import { Resource, Action } from '@/types/rbac';

export function usePermissions() {
  const { user } = useAppSelector((state) => state.auth);

  const can = (resource: Resource, action: Action): boolean => {
    if (!user) return false;
    return hasPermission(user.role, resource, action);
  };

  const isManager = user?.role === UserRole.MANAGER;
  const isResearcher = user?.role === UserRole.RESEARCHER;

  return {
    can,
    isManager,
    isResearcher,
    role: user?.role,
  };
}

