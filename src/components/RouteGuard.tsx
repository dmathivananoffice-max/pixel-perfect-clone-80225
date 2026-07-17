import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types';

// ⚠️ DEV BYPASS: Login is disabled during rapid build phase.
// Every route renders as a fake Super Admin. Re-enable RouteGuard before shipping.
const DEV_USER: User = {
  id: 'dev-super-admin',
  email: 'dev@workforce-europe.local',
  name: 'Dev Super Admin',
  role: 'super_admin',
  status: 'active',
  mfa_enabled: false,
  created_at: new Date().toISOString(),
};

interface RouteGuardProps {
  children: React.ReactNode;
  roles?: string[];
}

export function RouteGuard({ children }: RouteGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      useAuthStore.setState({
        user: DEV_USER,
        token: 'dev-bypass',
        isAuthenticated: true,
        isHydrating: false,
      });
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}
