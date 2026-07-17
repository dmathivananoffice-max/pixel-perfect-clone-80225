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

function getAuthReturnState() {
  if (typeof window === "undefined") {
    return { code: null, error: null, hasTokenHash: false };
  }

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return {
    code: search.get("code"),
    error: search.get("error_description") ?? search.get("error") ?? hash.get("error_description") ?? hash.get("error"),
    hasTokenHash: hash.has("access_token") || hash.has("refresh_token"),
  };
}

async function waitForHydratedSession(
  supabase: typeof import("@/integrations/supabase/client").supabase,
  timeoutMs = 2500,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

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
        const authReturn = getAuthReturnState();

        if (authReturn.error) {
          console.error("[startup] auth return error", authReturn.error);
          try {
            sessionStorage.setItem(
              "wf:login-error",
              "Something went wrong signing you in — please try requesting a new link.",
            );
          } catch {
            /* ignore storage failures */
          }
        }

        // Magic links may return either a PKCE `code` query parameter or an
        // implicit token hash. Complete that exchange before mounting routes;
        // otherwise /login can briefly render the send-link form again.
        if (authReturn.code) {
          const { error } = await clientMod.supabase.auth.exchangeCodeForSession(authReturn.code);
          if (error) throw error;
        }

        const session = authReturn.code || authReturn.hasTokenHash
          ? await waitForHydratedSession(clientMod.supabase)
          : (await clientMod.supabase.auth.getSession()).data.session;

        await storeMod.useAuthStore.getState().hydrateFromSession(session ?? null);
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
      if (
        typeof window !== "undefined" &&
        (window.location.hash || window.location.search.includes("code=") || window.location.search.includes("error="))
      ) {
        try {
          const cleanSearch = new URLSearchParams(window.location.search);
          cleanSearch.delete("code");
          cleanSearch.delete("error");
          cleanSearch.delete("error_code");
          cleanSearch.delete("error_description");
          const nextSearch = cleanSearch.toString();
          window.history.replaceState(null, "", window.location.pathname + (nextSearch ? `?${nextSearch}` : ""));
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
