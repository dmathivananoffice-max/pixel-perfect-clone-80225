import { useState } from 'react';
import { mockNotifications } from '@/lib/mockData';
import type { NotificationItem } from '@/types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
