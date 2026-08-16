import { create } from "zustand";
import type { User, UserRole } from "@/types";
import { authSupabase } from "@/lib/authClient";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrating: boolean;
  showMFA: boolean;
  tempToken: string | null;
  sendMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyMFA: (code: string) => Promise<void>;
  setUser: (user: User | null) => void;
  hydrateFromSession: (
    session: {
      user: { id: string; email?: string | null };
      access_token: string;
    } | null,
  ) => Promise<void>;
  /** Legacy no-op — password login disabled. */
  login: (email: string, password: string) => Promise<void>;
}

async function loadProfile(authUserId: string, email: string): Promise<User | null> {
  // Fetch the app_users row (role, department, activation state).
  const { data, error } = await authSupabase
    .from("app_users")
    .select("id, email, full_name, role_key, active, metadata, created_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.active) return null; // deactivated accounts cannot use the app

  const metadata = (data.metadata ?? {}) as { department?: string };

  return {
    id: data.id,
    email: data.email ?? email,
    name: data.full_name,
    role: data.role_key as UserRole,
    department: metadata.department,
    status: "active",
    mfa_enabled: false,
    created_at: data.created_at,
  };
}

function flagLoginError(message: string) {
  try {
    sessionStorage.setItem("wf:login-error", message);
  } catch {
    /* storage may be unavailable — non-fatal */
  }
}

/**
 * Auto-provision: any authenticated Supabase user gets an app_users row on
 * first login (default role "recruiter", active). Upsert on email also
 * relinks rows whose auth_user_id is stale. No admin step required.
 */
async function provisionProfile(authUserId: string, email: string): Promise<User | null> {
  const { data, error } = await authSupabase
    .from("app_users")
    .upsert(
      {
        auth_user_id: authUserId,
        email,
        full_name: "",
        role_key: "recruiter",
        active: true,
      },
      { onConflict: "email" },
    )
    .select("id, email, full_name, role_key, metadata, created_at")
    .maybeSingle();

  if (error || !data) return null;
  const metadata = (data.metadata ?? {}) as { department?: string };
  return {
    id: data.id,
    email: data.email ?? email,
    name: data.full_name,
    role: data.role_key as UserRole,
    department: metadata.department,
    status: "active",
    mfa_enabled: false,
    created_at: data.created_at,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  // The app boots in the hydrating state; legacy-mount resolves it via
  // hydrateFromSession before any guarded route renders.
  isHydrating: true,
  showMFA: false,
  tempToken: null,

  sendMagicLink: async (email: string) => {
    set({ isLoading: true });
    try {
      const { error } = await authSupabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin + "/login" : undefined,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await authSupabase.auth.signOut();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      showMFA: false,
      tempToken: null,
    });
  },

  verifyMFA: async () => {
    set({ isLoading: false, showMFA: false });
  },

  login: async () => {
    throw new Error("Password login is disabled. Please use the magic link.");
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  hydrateFromSession: async (session) => {
    if (!session) {
      set({ user: null, token: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    const email = session.user.email ?? "";
    let profile = await loadProfile(session.user.id, email);

    if (!profile) {
      // No app_users row yet (or relink needed) — auto-provision instead
      // of refusing entry. The activation gate was removed: anyone who
      // completes the magic-link sign-in gets in.
      profile = await provisionProfile(session.user.id, email);
    }

    if (!profile) {
      // Last-resort in-memory profile (e.g. RLS blocked the upsert) —
      // never lock an authenticated user out.
      console.warn("[auth] profile provisioning failed, using in-memory profile");
      profile = {
        id: session.user.id,
        email,
        name: "",
        role: "recruiter",
        status: "active",
        mfa_enabled: false,
        created_at: new Date().toISOString(),
      };
    }

    set({
      user: profile,
      token: session.access_token,
      isAuthenticated: true,
      isHydrating: false,
    });
  },
}));

// Single auth lifecycle listener: keeps the store in sync when the token
// is refreshed or the session ends in another tab. Registered once, on the
// client only.
if (typeof window !== "undefined") {
  authSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      useAuthStore.setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrating: false,
      });
      return;
    }
    if (event === "TOKEN_REFRESHED" && session) {
      useAuthStore.setState({ token: session.access_token });
      return;
    }
    // A sign-in that did not flow through legacy-mount's startup (e.g. magic
    // link completed in another tab) still hydrates the app profile.
    if (event === "SIGNED_IN" && session && !useAuthStore.getState().isAuthenticated) {
      void useAuthStore.getState().hydrateFromSession(session);
    }
  });
}
