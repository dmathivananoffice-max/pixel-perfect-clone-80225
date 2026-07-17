import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface RouteGuardProps {
  children: React.ReactNode;
  /** Optional: restrict to specific role_key values. */
  roles?: string[];
}

/**
 * Enforces authentication for every internal route. Anonymous users are
 * redirected to /login. If `roles` is provided, users without one of the
 * listed roles are redirected to /dashboard (which itself is gated).
 */
export function RouteGuard({ children, roles }: RouteGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
