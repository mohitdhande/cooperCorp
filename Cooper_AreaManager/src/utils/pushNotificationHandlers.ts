import type * as NotificationsModule from 'expo-notifications';
import type { ImperativeRouter } from 'expo-router';

// The { screen, entityId } shape both push payloads (§15.5) and in-app
// notification inbox items (§16, each item's own `data` field) carry —
// one mapping table for both, per the dev guide's own note that they
// reuse the exact same shape.
export type PushNavigationData = { screen?: string; entityId?: string };

// A Mongo ObjectId is always exactly 24 hex characters — reliable enough to
// tell "this entityId is a real task _id" apart from "this is a genset
// number" without needing the backend to standardize the inconsistent
// commissioning_completed/approved (genset number) vs
// commissioning_assigned/reassigned (real _id) shape first.
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// Which icon family a notification/inbox item reads as — checked against
// the real `type` string first (e.g. "commissioning_assigned",
// "recommissioning_assigned"), falling back to data.screen for anywhere
// `type` isn't available (the raw push payload's own `data` object may not
// always carry it the same way an inbox item's top-level `type` field
// does). One shared function so the in-app inbox list and the foreground
// push banner can never drift apart on what counts as which category.
export function getNotificationCategory(type?: string, data?: PushNavigationData): 'commissioning' | 'service' {
  if (type && /^re?commissioning/i.test(type)) return 'commissioning';
  if (data?.screen === 'commissioning') return 'commissioning';
  return 'service';
}

// A push received while the app is already open — separate from the tap-
// response listeners below (addNotificationResponseReceivedListener only
// fires on tap; this fires on arrival, tapped or not). Subscribed to by
// ForegroundNotificationBanner, same pub/sub shape as
// mediaSyncEngine.ts's own subscribeToMediaSyncSuccess, so a plain utility
// file (this one) can still notify a React component mounted at the root
// without importing any UI here itself.
export type ForegroundNotificationEvent = { title: string; body: string; data?: PushNavigationData & { type?: string } };
type ForegroundListener = (event: ForegroundNotificationEvent) => void;
const foregroundListeners = new Set<ForegroundListener>();
export function subscribeToForegroundNotification(listener: ForegroundListener): () => void {
  foregroundListeners.add(listener);
  return () => { foregroundListeners.delete(listener); };
}

// Shared by both a tapped push notification and a tapped inbox item —
// same { screen, entityId } payload, same destination either way.
export function navigateFromPushData(router: ImperativeRouter, data: PushNavigationData | undefined | null) {
  if (!data?.screen) return; // user_* account-change events send no data field at all — nothing to navigate to beyond just opening the app

  switch (data.screen) {
    // Service request lifecycle (sr_assigned/reassigned/closed/overdue,
    // work_approval_am_rejected) — entityId is always the SR's own _id, so
    // this can go straight to its report screen; srTaskReportController.ts
    // re-fetches the full detail (including assetId) from just the _id.
    case 'my-tasks':
      if (data.entityId) {
        router.push({ pathname: '/screens/srTaskReport', params: { task: JSON.stringify({ _id: data.entityId }) } } as any);
      } else {
        router.push('/screens/serviceTasks' as any);
      }
      break;

    // Work-approval events — entityId is the SR's own _id. srDetail.tsx
    // (not srApprovals.tsx, which is just the list) is the actual per-entry
    // approval review screen, same nav-param shape as the report screens.
    case 'sr-approvals':
      if (data.entityId) {
        router.push({ pathname: '/screens/srDetail', params: { task: JSON.stringify({ _id: data.entityId }) } } as any);
      } else {
        router.push('/screens/srApprovals' as any);
      }
      break;

    // entityId's shape is genuinely inconsistent per the backend's own
    // documented behavior: commissioning_completed/approved send a genset
    // NUMBER, commissioning_assigned/reassigned send the real entry _id.
    // Deep-link only when it looks like a real _id; fall back to the list
    // rather than guess at resolving a genset number into a task.
    case 'commissioning':
      if (data.entityId && OBJECT_ID_RE.test(data.entityId)) {
        router.push({ pathname: '/screens/taskReport', params: { task: JSON.stringify({ _id: data.entityId }) } } as any);
      } else {
        router.push('/screens/commissioningTasks' as any);
      }
      break;

    // No standalone Asset Detail screen exists in this app — asset info is
    // only ever shown inline (New Job's search result, report headers).
    // Nothing to navigate to yet; a future asset-detail screen would land
    // here.
    case 'asset-detail':
      break;

    case 'profile':
      router.push('/screens/profile' as any);
      break;

    default:
      break;
  }
}

// Foreground display — expo-notifications shows nothing while the app is
// open unless a handler explicitly says to. shouldShowBanner/shouldShowList
// (not the older shouldShowAlert) is the current API; this is the
// expo-notifications equivalent of the bare-RN guide's own
// `messaging().onMessage` custom in-app banner, just using the native
// notification banner instead of a hand-built toast.
export function configureNotificationHandler() {
  try {
    const Notifications: typeof NotificationsModule = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    // Expected in Expo Go (same cause as pushNotifications.ts's own guard) —
    // logged, not surfaced.
    console.log('[Push Notifications] Failed to configure notification handler:', error);
  }
}

// Covers both tap paths the dev guide documents: a tap while the app was
// merely backgrounded (addNotificationResponseReceivedListener) and a tap
// that cold-started the app from fully killed (getLastNotificationResponseAsync,
// the expo-notifications equivalent of bare-RN's getInitialNotification).
// Returns a cleanup function for the listener subscription.
export function setupPushNotificationListeners(router: ImperativeRouter): () => void {
  try {
    const Notifications: typeof NotificationsModule = require('expo-notifications');

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromPushData(router, response.notification.request.content.data as PushNavigationData);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          navigateFromPushData(router, response.notification.request.content.data as PushNavigationData);
        }
      })
      .catch((error) => console.log('[Push Notifications] getLastNotificationResponseAsync failed:', error));

    // Fires on arrival, not just on tap — this is what feeds
    // ForegroundNotificationBanner (the custom, fully-restylable substitute
    // for the OS's own system-tray banner, which can't be restyled per type
    // from app code — see this file's own getNotificationCategory comment).
    // shouldShowBanner (configureNotificationHandler above) still also lets
    // the OS show its own default banner at the same time — this listener
    // doesn't suppress that, it only adds the extra in-app one on top.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      foregroundListeners.forEach((listener) => listener({
        title: content.title || '',
        body: content.body || '',
        data: content.data as PushNavigationData & { type?: string },
      }));
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  } catch (error) {
    console.log('[Push Notifications] Failed to set up notification listeners:', error);
    return () => {};
  }
}
