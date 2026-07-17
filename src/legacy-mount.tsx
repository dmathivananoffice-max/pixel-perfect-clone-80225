import { useEffect, useState, type ComponentType } from "react";

/**
 * Mounts the legacy React Router (BrowserRouter) app on the client only.
 * SSR renders nothing to avoid `window is not defined`.
 *
 * The startup sequence (session check + profile hydration + URL cleanup)
 * is wrapped in try/catch AND a hard 8s timeout so a stalled Supabase
 * request or unexpected error can never trap the UI on "Loading…".
 * On failure we mount the app anyway and let it fall through to the
 * logged-out state (login page).
 */
const STARTUP_TIMEOUT_MS = 8000;

function timeout<T>(ms: number, label: string): Promise<T> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error(`Startup timeout after ${ms}ms: ${label}`)), ms);
  });
}

export function LegacyAppMount() {
  const [Mounted, setMounted] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startup = async () => {
      const [rr, mod, clientMod, storeMod] = await Promise.all([
        import("react-router-dom"),
        import("./legacy-app"),
        import("@/integrations/supabase/client"),
        import("@/store/authStore"),
      ]);

      try {
        // Force the supabase client to instantiate and parse the URL hash.
        const { data, error } = await clientMod.supabase.auth.getSession();
        if (error) {
          console.error("[startup] supabase.auth.getSession error", error);
          try {
            sessionStorage.setItem(
              "wf:login-error",
              "Something went wrong signing you in — please try requesting a new link.",
            );
          } catch {
            /* ignore storage failures */
          }
        }
        await storeMod.useAuthStore.getState().hydrateFromSession(data?.session ?? null);
      } catch (innerErr) {
        console.error("[startup] hydrate step failed", innerErr);
        // Ensure the store is not stuck in the hydrating state.
        try {
          storeMod.useAuthStore.setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isHydrating: false,
          });
        } catch {
          /* noop */
        }
        try {
          sessionStorage.setItem(
            "wf:login-error",
            "Something went wrong signing you in — please try requesting a new link.",
          );
        } catch {
          /* ignore */
        }
      }

      // Clean the token fragment from the URL so it doesn't linger.
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        try {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } catch (cleanupErr) {
          console.error("[startup] URL hash cleanup failed", cleanupErr);
        }
      }

      return { rr, mod };
    };

    (async () => {
      let result: Awaited<ReturnType<typeof startup>> | null = null;
      try {
        result = await Promise.race([
          startup(),
          timeout<Awaited<ReturnType<typeof startup>>>(STARTUP_TIMEOUT_MS, "app bootstrap"),
        ]);
      } catch (err) {
        console.error("[startup] failed or timed out — mounting app in logged-out state", err);
      }

      if (cancelled) return;

      // If startup timed out before dynamic imports finished, load them now
      // so we can still mount the app rather than hang on "Loading…".
      if (!result) {
        try {
          const [rr, mod, storeMod] = await Promise.all([
            import("react-router-dom"),
            import("./legacy-app"),
            import("@/store/authStore"),
          ]);
          try {
            storeMod.useAuthStore.setState({
              user: null,
              token: null,
              isAuthenticated: false,
              isHydrating: false,
            });
          } catch {
            /* noop */
          }
          result = { rr, mod };
        } catch (fallbackErr) {
          console.error("[startup] fallback import failed", fallbackErr);
          return;
        }
      }

      if (cancelled) return;
      const App = result.mod.default;
      const { BrowserRouter } = result.rr;
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
