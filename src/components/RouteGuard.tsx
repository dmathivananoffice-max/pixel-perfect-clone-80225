import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const routePermissions: Record<string, string[]> = {
  '/admin/scoring': ['super_admin'],
  '/admin/users': ['super_admin', 'managing_director'],
  '/recruiter': ['recruiter', 'super_admin'],
  '/agency': ['agency_partner'],
  '/employer': ['employer'],
  '/candidate': ['candidate'],
  '/sti': ['german_trainer', 'recruiter', 'super_admin'],
  '/contracts': ['candidate'],
  '/documents/import': ['recruiter', 'documentation_officer', 'super_admin'],
};

const roleHomeRoutes: Record<string, string> = {
  candidate: '/candidate',
  agency_partner: '/agency',
  employer: '/employer',
  german_trainer: '/sti',
};

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const path = location.pathname;
  const role = user?.role || '';

  // Check if route needs specific permissions
  for (const [routePath, allowedRoles] of Object.entries(routePermissions)) {
    if (path.startsWith(routePath) && !allowedRoles.includes(role)) {
      // Redirect to role-specific home or dashboard
      const homeRoute = roleHomeRoutes[role] || '/dashboard';
      return <Navigate to={homeRoute} replace />;
    }
  }

  return <>{children}</>;
}
