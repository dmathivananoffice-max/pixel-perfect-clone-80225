import { create } from 'zustand';
import type { User, UserRole } from '@/types';
import { authSupabase } from '@/lib/authClient';

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
  hydrateFromSession: (session: {
    user: { id: string; email?: string | null };
    access_token: string;
  } | null) => Promise<void>;
  /** Legacy no-op — password login disabled. */
  login: (email: string, password: string) => Promise<void>;
}

async function loadProfile(
  authUserId: string,
  email: string,
): Promise<User | null> {
  // Fetch the app_users row (role, department, activation state).
  const { data, error } = await authSupabase
    .from('app_users')
    .select('id, email, full_name, role_key, active, metadata, created_at')
    .eq('auth_user_id', authUserId)
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
    status: 'active',
    mfa_enabled: false,
    created_at: data.created_at,
  };
}

// ⚠️ DEV BYPASS: login disabled during rapid build phase.
const DEV_USER: User = {
  id: 'dev-super-admin',
  email: 'dev@workforce-europe.local',
  name: 'Dev Super Admin',
  role: 'super_admin',
  status: 'active',
  mfa_enabled: false,
  created_at: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: DEV_USER,
  token: 'dev-bypass',
  isAuthenticated: true,
  isLoading: false,
  isHydrating: false,
  showMFA: false,
  tempToken: null,

  sendMagicLink: async (email: string) => {
    set({ isLoading: true });
    try {
      const { error } = await authSupabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined'
              ? window.location.origin + '/login'
              : undefined,
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
    throw new Error('Password login is disabled. Please use the magic link.');
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  hydrateFromSession: async (_session) => {
    // ⚠️ DEV BYPASS: keep the fake super_admin no matter what Supabase says.
    set({ isHydrating: false });
    return;
    // eslint-disable-next-line no-unreachable
    // @ts-expect-error legacy code preserved below for restore
    // prettier-ignore
    // eslint-disable-next-line
    async (session: never) => {
    if (!session?.user?.email) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrating: false,
      });
      return;
    }
    try {
      const profile = await loadProfile(session.user.id, session.user.email);
      if (!profile) {
        // Signed in via Supabase but no active app_users record — sign back out.
        try {
          await authSupabase.auth.signOut();
        } catch (signOutErr) {
          console.error('[auth] signOut after missing profile failed', signOutErr);
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrating: false,
        });
        return;
      }
      set({
        user: profile,
        token: session.access_token,
        isAuthenticated: true,
        isHydrating: false,
      });
    } catch (err) {
      console.error('[auth] hydrateFromSession failed', err);
      try {
        await authSupabase.auth.signOut();
      } catch (signOutErr) {
        console.error('[auth] signOut after hydrate error failed', signOutErr);
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrating: false,
      });
    }
  },
}));

// Wire Supabase → store. Runs once on module load in the browser.
if (typeof window !== 'undefined') {
  authSupabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      useAuthStore.setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrating: false,
      });
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      void useAuthStore.getState().hydrateFromSession(session);
    }
  });
}
