import { create } from 'zustand';
import type { User, UserRole } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showMFA: boolean;
  tempToken: string | null;
  sendMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyMFA: (code: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setSession: (email: string | null, token: string | null, userId: string | null) => void;
  // legacy compatibility (unused) - kept so any lingering callers compile
  login: (email: string, password: string) => Promise<void>;
}

// Email → profile map. New emails default to recruiter; the founder gets admin.
const PROFILES: Record<string, { name: string; role: UserRole; department: string }> = {
  'deeban@workforce-europe.com': { name: 'Deeban', role: 'super_admin', department: 'Management' },
  'lisa@workforce-europe.com':   { name: 'Lisa Anderson', role: 'recruiter', department: 'Recruitment' },
  'klaus@workforce-europe.com':  { name: 'Klaus Mueller', role: 'german_trainer', department: 'Training' },
  'sarah@workforce-europe.com':  { name: 'Sarah Johnson', role: 'documentation_officer', department: 'Documentation' },
  'james@workforce-europe.com':  { name: 'James Smith', role: 'sales_executive', department: 'Sales' },
  'rajesh@gts.com':              { name: 'Rajesh Kumar', role: 'agency_partner', department: 'External' },
  'hans@charite.de':             { name: 'Dr. Hans Mueller', role: 'employer', department: 'External' },
};

function buildUser(email: string, id: string): User {
  const profile = PROFILES[email.toLowerCase()] ?? {
    name: email.split('@')[0],
    role: 'recruiter' as UserRole,
    department: 'Recruitment',
  };
  return {
    id,
    email,
    name: profile.name,
    role: profile.role,
    department: profile.department,
    status: 'active',
    mfa_enabled: false,
    created_at: new Date().toISOString(),
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  // DEV BYPASS: auto-signed-in as super admin so /dashboard is reachable without login.
  user: buildUser('deeban@workforce-europe.com', 'dev-bypass-user'),
  token: 'dev-bypass-token',
  isAuthenticated: true,
  isLoading: false,
  showMFA: false,
  tempToken: null,


  sendMagicLink: async (email: string) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      showMFA: false,
      tempToken: null,
    });
  },

  // Kept for backwards-compat with the (now unused) MFA screen.
  verifyMFA: async () => {
    set({ isLoading: false, showMFA: false });
  },

  // Legacy password path — no longer used. Kept as a no-op reject to satisfy the type.
  login: async () => {
    throw new Error('Password login is disabled. Please use the magic link.');
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setSession: (email, token, userId) => {
    if (!email || !token || !userId) {
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }
    set({
      user: buildUser(email, userId),
      token,
      isAuthenticated: true,
    });
  },
}));

// Hydrate session on module load (client-only).
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (session?.user?.email) {
      useAuthStore.getState().setSession(session.user.email, session.access_token, session.user.id);
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.email) {
      useAuthStore.getState().setSession(session.user.email, session.access_token, session.user.id);
    } else {
      useAuthStore.getState().setSession(null, null, null);
    }
  });
}
