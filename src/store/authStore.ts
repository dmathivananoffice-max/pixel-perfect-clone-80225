import { create } from 'zustand';
import type { User, UserRole } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showMFA: boolean;
  tempToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyMFA: (code: string) => Promise<void>;
  setUser: (user: User) => void;
}

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'deeban@workforce-europe.com': {
    password: 'admin123',
    user: { id: 'user-1', name: 'Deeban', email: 'deeban@workforce-europe.com', role: 'super_admin' as UserRole, department: 'Management', status: 'active', mfa_enabled: true, created_at: '2024-01-01T08:00:00Z' },
  },
  'lisa@workforce-europe.com': {
    password: 'recruiter123',
    user: { id: 'user-3', name: 'Lisa Anderson', email: 'lisa@workforce-europe.com', role: 'recruiter' as UserRole, department: 'Recruitment', status: 'active', mfa_enabled: true, created_at: '2024-01-15T08:00:00Z' },
  },
  'klaus@workforce-europe.com': {
    password: 'trainer123',
    user: { id: 'user-7', name: 'Klaus Mueller', email: 'klaus@workforce-europe.com', role: 'german_trainer' as UserRole, department: 'Training', status: 'active', mfa_enabled: false, created_at: '2024-03-01T09:00:00Z' },
  },
  'rajesh@gts.com': {
    password: 'agency123',
    user: { id: 'user-8', name: 'Rajesh Kumar', email: 'rajesh@gts.com', role: 'agency_partner' as UserRole, department: 'External', status: 'active', mfa_enabled: true, created_at: '2024-03-15T10:00:00Z' },
  },
  'hans@charite.de': {
    password: 'employer123',
    user: { id: 'user-9', name: 'Dr. Hans Mueller', email: 'hans@charite.de', role: 'employer' as UserRole, department: 'External', status: 'active', mfa_enabled: false, created_at: '2024-04-01T08:00:00Z' },
  },
  'sarah@workforce-europe.com': {
    password: 'doc123',
    user: { id: 'user-6', name: 'Sarah Johnson', email: 'sarah@workforce-europe.com', role: 'documentation_officer' as UserRole, department: 'Documentation', status: 'active', mfa_enabled: true, created_at: '2024-02-15T08:00:00Z' },
  },
  'james@workforce-europe.com': {
    password: 'sales123',
    user: { id: 'user-11', name: 'James Smith', email: 'james@workforce-europe.com', role: 'sales_executive' as UserRole, department: 'Sales', status: 'active', mfa_enabled: false, created_at: '2024-05-01T08:00:00Z' },
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  showMFA: false,
  tempToken: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mockEntry = MOCK_USERS[email.toLowerCase()];
    if (!mockEntry || mockEntry.password !== password) {
      set({ isLoading: false });
      throw new Error('Invalid email or password');
    }

    if (mockEntry.user.mfa_enabled) {
      set({
        showMFA: true,
        tempToken: 'mock-temp-token-' + mockEntry.user.id,
        isLoading: false,
      });
    } else {
      set({
        user: mockEntry.user,
        token: 'mock-jwt-token-' + mockEntry.user.id,
        isAuthenticated: true,
        isLoading: false,
        showMFA: false,
      });
    }
  },

  verifyMFA: async (code: string) => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (code.length !== 6 || code === '000000') {
      set({ isLoading: false });
      throw new Error('Invalid MFA code');
    }

    const state = useAuthStore.getState();
    const userId = state.tempToken?.replace('mock-temp-token-', '');
    const mockEntry = Object.values(MOCK_USERS).find((m) => m.user.id === userId);

    if (!mockEntry) {
      set({ isLoading: false });
      throw new Error('Session expired');
    }

    set({
      user: mockEntry.user,
      token: 'mock-jwt-token-' + mockEntry.user.id,
      isAuthenticated: true,
      isLoading: false,
      showMFA: false,
      tempToken: null,
    });
  },

  logout: () => {
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      showMFA: false,
      tempToken: null,
    });
  },

  setUser: (user: User) => set({ user }),
}));
