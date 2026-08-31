import axiosClient from '../viewModel/axiosClient';
import { getToken } from './tokenStore';
import { enqueueAction, getQueue, getQueueCount, removeFromQueue, recordSyncFailure, getSyncFailures, clearSyncFailures } from './offlineQueue';
import { logLocationForAction } from './locationLogger';
import { devLog } from './devLog';

// True only for a genuine connectivity failure (the request never reached
// the server, or never got a response back) — axios sets `request` but
// leaves `response` undefined in that case. Deliberately NOT true for a
// real server response like 400/401/500 — those are real errors and must
// still surface to the caller normally, not get silently queued and
// "lose" a validation failure the user needed to see.
export function isNetworkError(error: any): boolean {
  return !error?.response && !!error?.request;
}

// Drop-in replacement for a direct `axiosClient.put(url, body, ...)` call
// at any engineer save site that should keep working offline. Tries the
// real request first; only falls back to the local queue on a genuine
// network failure. The caller treats `{queued: true}` as a success (the
// edit is safely saved on-device and will reach the server once connectivity
// returns) rather than an error.
//
// `dedupeKey` must uniquely identify this logical save (not just its URL —
// see PendingAction's own comment for why several different sections share
// a URL) so re-saving it offline merges into the same queued entry instead
// of colliding with a different section that happens to hit the same
// endpoint.
//
// `offlineEnabled` (default true) — offline queueing is meant for the
// commissioning/service FORM-FILLING flows specifically (engineer's own
// on-site work, which is where losing connectivity mid-form actually
// happens), not every action in the app. Callers outside those forms (list
// screen Accept/Start, etc.) don't pass this and keep queueing for every
// role, unchanged. The two form controllers pass `isEngineer` explicitly —
// when false (dealer/area_manager filling the same form), a network
// failure surfaces immediately instead of silently queueing, same as
// before offline support existed.
export async function putOrQueue(url: string, body: Record<string, any>, description: string, dedupeKey: string, offlineEnabled: boolean = true): Promise<{ queued: boolean; data?: any }> {
  // Every Accept/Start/section-Save/Complete action in both forms and both
  // task lists calls putOrQueue — capturing the phone's location here,
  // once, covers all of them in one place instead of needing this wired
  // into each individual button. Console-only for now (not sent to the
  // backend yet) and never awaited, so a slow/denied location request can
  // never delay or block the real save it's attached to.
  logLocationForAction(description);
  const token = await getToken();
  try {
    const response = await axiosClient.put(url, body, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    return { queued: false, data: response.data };
  } catch (error: any) {
    if (isNetworkError(error) && offlineEnabled) {
      await enqueueAction({ method: 'PUT', url, body, description, dedupeKey });
      notifyListeners();
      return { queued: true };
    }
    throw error;
  }
}

type SyncListener = (pendingCount: number) => void;
const listeners = new Set<SyncListener>();
type FailureListener = (failedCount: number) => void;
const failureListeners = new Set<FailureListener>();

// Lets any screen show a live "N changes waiting to sync" indicator
// without polling — called once immediately with the current count, then
// again after every enqueue/sync.
export function subscribeToSyncQueue(listener: SyncListener): () => void {
  listeners.add(listener);
  getQueueCount().then(listener);
  return () => { listeners.delete(listener); };
}

// Same idea, for the separate "this queued edit was rejected by the
// server" log — see recordSyncFailure's own comment for why that's tracked
// apart from the pending queue.
export function subscribeToSyncFailures(listener: FailureListener): () => void {
  failureListeners.add(listener);
  getSyncFailures().then((failures) => listener(failures.length));
  return () => { failureListeners.delete(listener); };
}

async function notifyListeners() {
  const count = await getQueueCount();
  listeners.forEach((listener) => listener(count));
}

async function notifyFailureListeners() {
  const failures = await getSyncFailures();
  failureListeners.forEach((listener) => listener(failures.length));
}

type SyncingListener = (syncing: boolean) => void;
const syncingListeners = new Set<SyncingListener>();

// A separate signal from subscribeToSyncQueue's pending *count* — this is
// specifically "a sync attempt is in flight right now", so a banner can show
// an active "syncing..." message the moment connectivity comes back,
// instead of only ever showing the passive "waiting to sync" state.
export function subscribeToSyncingStatus(listener: SyncingListener): () => void {
  syncingListeners.add(listener);
  listener(syncing);
  return () => { syncingListeners.delete(listener); };
}

function notifySyncingListeners() {
  syncingListeners.forEach((listener) => listener(syncing));
}

let syncing = false;

// True for a server-side failure (the request reached the backend and it
// broke while handling it) as opposed to the backend deliberately rejecting
// the data itself (400 validation error, 404 the task's gone, etc.). A 500
// is often transient — a brief crash, timeout, race condition — and stands
// a real chance of succeeding if simply tried again later, unlike a genuine
// validation error which never will no matter how many times it's retried.
export function isServerError(error: any): boolean {
  const status = error?.response?.status;
  return typeof status === 'number' && status >= 500;
}

// Replays every queued write, oldest first. Stops the moment a genuine
// network error (or a 5xx server error — see isServerError above) recurs —
// no point burning through the rest of a possibly-long queue one failed
// attempt at a time while the backend/connection is down, it'll pick up
// again next trigger. A real client-side rejection on one item (validation
// error, the task since being closed elsewhere, etc.) doesn't jam the rest
// of the queue — it's logged and dropped, and the loop moves on, since a
// stale queued edit that the server has actually refused is not something
// retrying forever will fix.
export async function runSync(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  // Checked before flipping the syncing flag/notifying — this runs on
  // every app foreground and every 20s while open (see _layout.tsx), so
  // the overwhelmingly common case is an empty queue. Without this early
  // return, a "syncing..." message would flash on every one of those
  // ticks even when there's nothing at all to sync.
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  syncing = true;
  notifySyncingListeners();
  let synced = 0;
  let failed = 0;
  try {
    const token = await getToken();
    if (!token) return { synced: 0, failed: 0 };
    for (const action of queue) {
      try {
        await axiosClient.put(action.url, action.body, { headers: { Authorization: `Bearer ${token}` } });
        await removeFromQueue(action.id);
        synced++;
      } catch (error: any) {
        if (isNetworkError(error) || isServerError(error)) break;
        const message = error.response?.data?.message || error.message || 'Rejected by server';
        devLog('[Sync] Server rejected a queued action, dropping it:', action.description, message);
        // Recorded, not just logged — this used to be invisible: the
        // pending-changes banner would clear (removeFromQueue) as if the
        // edit had synced, when it had actually just been discarded.
        await recordSyncFailure(action.description, message);
        await removeFromQueue(action.id);
        failed++;
      }
    }
  } finally {
    syncing = false;
    notifySyncingListeners();
    await notifyListeners();
    await notifyFailureListeners();
  }
  return { synced, failed };
}

export { getQueueCount, getSyncFailures, clearSyncFailures };
