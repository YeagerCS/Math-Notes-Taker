import { useSyncExternalStore, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { session } from './session';

export function useIsLoggedIn() {
  return useSyncExternalStore(session.subscribe, () => session.token() !== null);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const loggedIn = useIsLoggedIn();
  const location = useLocation();
  if (!loggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
