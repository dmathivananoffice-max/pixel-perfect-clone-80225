interface RouteGuardProps {
  children: React.ReactNode;
}

// DEV BYPASS: auth/role checks disabled so /dashboard is reachable without login.
export function RouteGuard({ children }: RouteGuardProps) {
  return <>{children}</>;
}
