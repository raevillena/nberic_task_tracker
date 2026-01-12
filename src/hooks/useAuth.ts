// useAuth hook

import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logoutThunk } from '@/store/slices/authSlice';

export function useAuth() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  const logout = () => {
    dispatch(logoutThunk());
  };

  return {
    ...auth,
    logout,
  };
}

