import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { onSocketEvent } from '../api/socket.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const NotificationContext = createContext(null);

/**
 * Keeps the notification bell in sync. Socket.IO pushes new notifications
 * instantly; a periodic refetch covers reconnects and multiple tabs.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [notificationData, messageData] = await Promise.all([
        api.get('/notifications?limit=30'),
        api.get('/messages/threads'),
      ]);
      setNotifications(notificationData.notifications);
      setUnread(notificationData.unread);
      setUnreadMessages(messageData.unread ?? 0);
    } catch {
      /* the bell is non-critical: stay quiet on failure */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      setUnreadMessages(0);
      return undefined;
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [user, load]);

  // Realtime pushes
  useEffect(() => {
    if (!user) return undefined;
    const unsubscribers = [
      onSocketEvent('notification:new', ({ notification, unread: count }) => {
        setNotifications((current) => [notification, ...current].slice(0, 30));
        setUnread(count);
        toast.info(notification.title || notification.message);
      }),
      onSocketEvent('notification:read', ({ unread: count }) => setUnread(count)),
      onSocketEvent('message:new', (message) => {
        if (message.receiver_id === user.user_id) setUnreadMessages((current) => current + 1);
      }),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [user, toast]);

  const markRead = useCallback(async (notificationId) => {
    await api.patch(`/notifications/${notificationId}/read`);
    setNotifications((current) =>
      current.map((entry) => (entry.notification_id === notificationId ? { ...entry, read_status: 1 } : entry)),
    );
    setUnread((current) => Math.max(current - 1, 0));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all');
    setNotifications((current) => current.map((entry) => ({ ...entry, read_status: 1 })));
    setUnread(0);
  }, []);

  const value = useMemo(
    () => ({ notifications, unread, unreadMessages, setUnreadMessages, reload: load, markRead, markAllRead }),
    [notifications, unread, unreadMessages, load, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
};
