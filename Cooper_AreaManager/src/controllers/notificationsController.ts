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

export type NotificationsTab = 'unread' | 'all';

const PAGE_LIMIT = 20;

// Drives the in-app Notification Inbox screen (§16) — the header bell's
// real destination. data.screen/data.entityId on each item is the exact
// same shape a push notification's own payload carries (§15.5), so tapping
// an item reuses navigateFromPushData rather than duplicating that mapping.
//
// Unread vs All is NOT a client-side filter over one cached list — the
// backend's own GET /me/notifications defaults to unread-only (read:
// false) and requires an explicit `filter=all` to return everything.
// Confirmed directly (both the app and a raw Postman call agreed): the
// endpoint was never buggy, this app just never passed `filter=all` for
// what its own "All" tab was supposed to show, so both tabs were silently
// hitting the same unread-only result the whole time. Switching tabs here
// re-fetches from the server with the right filter, rather than re-slicing
// one shared array — there IS no single shared array that could serve both
// views correctly, since the server itself decides what's even returned.
export function useNotificationsController() {
  const router = useRouter();
  const { refreshUnreadCount } = useNotifications();

  const [activeTab, setActiveTab] = useState<NotificationsTab>('unread');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const hasMore = items.length < total;

  const loadPage = useCallback(async (pageToLoad: number, mode: 'initial' | 'refresh' | 'more', tab: NotificationsTab) => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getMyNotifications(token, pageToLoad, PAGE_LIMIT, tab === 'all' ? 'all' : undefined);
      setItems((prev) => (mode === 'more' ? [...prev, ...(data.items || [])] : data.items || []));
      setTotal(data.total || 0);
      setPage(pageToLoad);
      // Syncs the header bell's badge to match what this screen just
      // actually fetched — without this, the badge only ever updated on
      // login/cold-start or after a mark-read action here, so a
      // notification that arrived since the last of those (e.g. a new push
      // while the app was already open) left the badge showing a stale,
      // too-low count even while this screen correctly listed it as
      // unread. Not gated to 'initial' only — a pull-to-refresh or a
      // loadMore page can just as easily reveal newer unread items.
      if (mode !== 'more') refreshUnreadCount();
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to load notifications.');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [refreshUnreadCount]);

  // Re-fetches from scratch every time the tab changes — see this hook's
  // own comment on why this can't just re-filter a single cached array.
  useEffect(() => { loadPage(1, 'initial', activeTab); }, [loadPage, activeTab]);

  const switchTab = useCallback((tab: NotificationsTab) => {
    setActiveTab(tab);
  }, []);

  const onRefresh = useCallback(() => loadPage(1, 'refresh', activeTab), [loadPage, activeTab]);
  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    loadPage(page + 1, 'more', activeTab);
  }, [loadingMore, loading, hasMore, page, loadPage, activeTab]);

  // Marks read, then navigates using the same mapping a push tap uses —
  // matches the guide's own ordering ("call when the user taps... before
  // navigating"). Updates local state to match what a fresh fetch would
  // now show instead of just flipping a flag: on the Unread tab, a newly-
  // read item no longer belongs in this list at all (the backend excludes
  // it from the unread-only response), so it's removed outright; on the
  // All tab it stays, just without its unread dot. Also refreshes the
  // shared bell badge (NotificationsContext) so it reflects this
  // immediately even after leaving this screen.
  const handleOpenNotification = useCallback(async (item: NotificationItem) => {
    if (!item.read) {
      setItems((prev) => (
        activeTab === 'unread'
          ? prev.filter((it) => it._id !== item._id)
          : prev.map((it) => (it._id === item._id ? { ...it, read: true } : it))
      ));
      try {
        const token = await getToken();
        if (token) await markNotificationRead(token, item._id);
      } catch (err) {
        console.log('[Notifications] Failed to mark notification read:', err);
      }
      refreshUnreadCount();
    }
    navigateFromPushData(router, item.data);
  }, [router, refreshUnreadCount, activeTab]);

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true);
    try {
      const token = await getToken();
      if (!token) return;
      await markAllNotificationsRead(token);
      // Same reasoning as handleOpenNotification above — on Unread, nothing
      // qualifies anymore once everything's read, so the list empties
      // outright; on All, every item stays, just without its dot.
      setItems((prev) => (activeTab === 'unread' ? [] : prev.map((it) => ({ ...it, read: true }))));
      refreshUnreadCount();
    } catch (err) {
      console.log('[Notifications] Failed to mark all notifications read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  }, [refreshUnreadCount, activeTab]);

  return {
    activeTab, switchTab,
    items, loading, loadingMore, refreshing, error, hasMore,
    onRefresh, loadMore, handleOpenNotification,
    markingAllRead, handleMarkAllRead,
  };
}
