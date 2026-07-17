import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }
    if (roles && user && !roles.includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [isHydrating, isAuthenticated, location.pathname, navigate, roles, user]);

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (roles && user && !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
