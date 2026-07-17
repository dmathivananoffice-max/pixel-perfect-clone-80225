import { useEffect, useState, type ComponentType } from "react";

/**
 * Mounts the legacy React Router (BrowserRouter) app on the client only.
 * SSR renders nothing to avoid `window is not defined`.
 *
 * We eagerly initialise Supabase and await getSession() BEFORE mounting so
 * that:
 *  - the magic-link URL hash (#access_token=...) is parsed and persisted
 *    before any route guard runs (otherwise the guard navigates to /login
 *    and drops the hash before Supabase can consume it).
 *  - the auth store is hydrated, so RouteGuard sees isAuthenticated=true
 *    on first render and doesn't bounce the user to /login.
 */
export function LegacyAppMount() {
  const [Mounted, setMounted] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rr, mod, clientMod, storeMod] = await Promise.all([
        import("react-router-dom"),
        import("./legacy-app"),
        import("@/integrations/supabase/client"),
        import("@/store/authStore"),
      ]);

      // Force the supabase client to instantiate and parse the URL hash.
      const { data } = await clientMod.supabase.auth.getSession();
      await storeMod.useAuthStore.getState().hydrateFromSession(data.session ?? null);

      // Clean the token fragment from the URL so it doesn't linger.
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      if (cancelled) return;
      const App = mod.default;
      const { BrowserRouter } = rr;
      const Wrapped: ComponentType = () => (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );
      setMounted(() => Wrapped);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  return <Mounted />;
}
