import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { getToken } from '../utils/tokenStore';
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '../viewModel/commisionAPi';
import { navigateFromPushData, PushNavigationData } from '../utils/pushNotificationHandlers';
import { useNotifications } from '../context/NotificationsContext';
import { parseApiError } from '../utils/apiError';

export type NotificationItem = {
  _id: string;
  type: string;
  title: string;
  body: string;
  data?: PushNavigationData;
  read: boolean;
  createdAt: string;
};

const PAGE_LIMIT = 20;

// Drives the in-app Notification Inbox screen (§16) — the header bell's
// real destination. data.screen/data.entityId on each item is the exact
// same shape a push notification's own payload carries (§15.5), so tapping
// an item reuses navigateFromPushData rather than duplicating that mapping.
export function useNotificationsController() {
  const router = useRouter();
  const { refreshUnreadCount } = useNotifications();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const hasMore = items.length < total;

  const loadPage = useCallback(async (pageToLoad: number, mode: 'initial' | 'refresh' | 'more') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getMyNotifications(token, pageToLoad, PAGE_LIMIT);
      setItems((prev) => (mode === 'more' ? [...prev, ...(data.items || [])] : data.items || []));
      setTotal(data.total || 0);
      setPage(pageToLoad);
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to load notifications.');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadPage(1, 'initial'); }, [loadPage]);

  const onRefresh = useCallback(() => loadPage(1, 'refresh'), [loadPage]);
  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    loadPage(page + 1, 'more');
  }, [loadingMore, loading, hasMore, page, loadPage]);

  // Marks read, then navigates using the same mapping a push tap uses —
  // matches the guide's own ordering ("call when the user taps... before
  // navigating"). Optimistically flips this one item's own read flag
  // locally instead of waiting on a refetch, and refreshes the shared bell
  // badge (NotificationsContext) so it reflects this immediately even after
  // leaving this screen.
  const handleOpenNotification = useCallback(async (item: NotificationItem) => {
    if (!item.read) {
      setItems((prev) => prev.map((it) => (it._id === item._id ? { ...it, read: true } : it)));
      try {
        const token = await getToken();
        if (token) await markNotificationRead(token, item._id);
      } catch (err) {
        console.log('[Notifications] Failed to mark notification read:', err);
      }
      refreshUnreadCount();
    }
    navigateFromPushData(router, item.data);
  }, [router, refreshUnreadCount]);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      const token = await getToken();
      if (!token) return;
      await markAllNotificationsRead(token);
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      refreshUnreadCount();
    } catch (err) {
      console.log('[Notifications] Failed to mark all notifications read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  }, [refreshUnreadCount]);

  return {
    items, loading, loadingMore, refreshing, error, hasMore,
    onRefresh, loadMore, handleOpenNotification,
    markingAllRead, handleMarkAllRead,
  };
}
