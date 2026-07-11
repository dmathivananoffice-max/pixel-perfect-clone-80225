import { create } from 'zustand';
import type { NotificationItem } from '@/types';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: NotificationItem[];
  unreadCount: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addNotification: (notification: NotificationItem) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  notifications: [],
  unreadCount: 0,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  setTheme: (theme: 'light' | 'dark') => set({ theme }),

  addNotification: (notification: NotificationItem) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),

  markNotificationRead: (id: string) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}));
