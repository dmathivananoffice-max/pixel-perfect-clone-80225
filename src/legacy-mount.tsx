import { useEffect, useState, type ComponentType } from "react";

/**
 * Mounts the legacy React Router (BrowserRouter) app on the client only.
 * SSR renders nothing to avoid `window is not defined`.
 */
export function LegacyAppMount() {
  const [Mounted, setMounted] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("react-router-dom"), import("./legacy-app")]).then(
      ([rr, mod]) => {
        if (cancelled) return;
        const App = mod.default;
        const { BrowserRouter } = rr;
        const Wrapped: ComponentType = () => (
          <BrowserRouter>
            <App />
          </BrowserRouter>
        );
        setMounted(() => Wrapped);
      },
    );
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
