import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getToken } from '../utils/tokenStore';
import { getUnreadNotificationCount } from '../viewModel/commisionAPi';

type NotificationsState = {
  unreadCount: number;
  // Re-fetches just the cheap unread-count endpoint (§16 — deliberately
  // separate from the full list) so the header bell's badge can refresh
  // from any screen without pulling the whole notification list. Called on
  // login (authController.ts) and after returning from the Notifications
  // screen (its own mark-read/mark-all-read actions call this too, so the
  // badge reflects whatever was just read).
  refreshUnreadCount: () => void;
};

const NotificationsContext = createContext<NotificationsState | null>(null);

// One shared unread-count instead of every screen's own header bell
// independently polling GET /me/notifications/unread-count on its own
// mount — same reasoning as TeamContext's shared roster.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUnreadCount(0);
        return;
      }
      const { count } = await getUnreadNotificationCount(token);
      setUnreadCount(count || 0);
    } catch (error) {
      // Silent by design, same reasoning as TeamContext's own refresh — an
      // expired/invalid token here is already surfaced elsewhere (axios
      // interceptor's own session-expiry redirect), and a stale badge count
      // isn't worth its own separate error.
      console.log('[Notifications] Failed to load unread count:', error);
    }
  }, []);

  // Covers the "already logged in, cold start" case, same as TeamContext's
  // own mount effect. Not also polled on a timer/every foreground — a
  // slightly stale badge until the next login/app-reopen/visit to the
  // Notifications screen is an acceptable tradeoff against adding a second
  // polling loop alongside syncEngine's existing one.
  useEffect(() => { refreshUnreadCount(); }, [refreshUnreadCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
