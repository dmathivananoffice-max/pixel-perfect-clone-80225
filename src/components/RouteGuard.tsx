import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface RouteGuardProps {
  children: React.ReactNode;
  roles?: string[];
}

/**
 * Protects authenticated routes.
 *  - While the session is hydrating: render a loading state (never blank).
 *  - Unauthenticated: redirect to /login, remembering where we were headed.
 *  - roles given: enforce role membership.
 */
export function RouteGuard({ children, roles }: RouteGuardProps) {
  const { isAuthenticated, isHydrating, user } = useAuthStore();
  const location = useLocation();

  if (isHydrating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading your session…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0 && user && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">No access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your role ({user.role}) does not have permission to open this area.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
