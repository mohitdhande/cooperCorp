import { getToken } from './tokenStore';
import { uploadOneCommissioningMedia, uploadOneServiceMedia } from '../viewModel/commisionAPi';
import { resolveMediaType } from '../models/taskForm.types';
import { getPendingMediaQueue, getPendingMediaCount, removePendingMedia, PendingMediaItem } from './pendingMediaQueue';
import { isNetworkError, isServerError } from './syncEngine';
import { devLog } from './devLog';

// The persistent-media counterpart to syncEngine.ts's runSync/pending-count
// pub-sub, replaying pendingMediaQueue.ts instead of the plain-JSON write
// queue. Kept as its own module (rather than folded into syncEngine.ts)
// since it deals in files, not JSON PUT bodies, and dispatches to a
// different pair of upload functions per formKind/mediaKind.

type CountListener = (count: number) => void;
const countListeners = new Set<CountListener>();
type SyncingListener = (syncing: boolean) => void;
const syncingListeners = new Set<SyncingListener>();
// Notified with the just-uploaded item whenever a background sync succeeds
// — lets a still-open form screen (useTaskFormPhotos.ts/useSrTaskForm.ts)
// append it into its own sitePhotos/runningHoursPhotos list live, instead
// of only appearing the next time that task happens to be reopened.
type SuccessListener = (item: PendingMediaItem) => void;
const successListeners = new Set<SuccessListener>();

export function subscribeToMediaQueueCount(listener: CountListener): () => void {
  countListeners.add(listener);
  getPendingMediaCount().then(listener);
  return () => { countListeners.delete(listener); };
}

export function subscribeToMediaSyncingStatus(listener: SyncingListener): () => void {
  syncingListeners.add(listener);
  listener(mediaSyncing);
  return () => { syncingListeners.delete(listener); };
}

export function subscribeToMediaSyncSuccess(listener: SuccessListener): () => void {
  successListeners.add(listener);
  return () => { successListeners.delete(listener); };
}

async function notifyCountListeners() {
  const count = await getPendingMediaCount();
  countListeners.forEach((listener) => listener(count));
}

function notifySyncingListeners() {
  syncingListeners.forEach((listener) => listener(mediaSyncing));
}

function notifySuccessListeners(item: PendingMediaItem) {
  successListeners.forEach((listener) => listener(item));
}

let mediaSyncing = false;

// Replays every queued upload, oldest first — same "stop at the first
// network error, drop a real server rejection" shape as syncEngine.ts's
// runSync. Called from the same triggers (_layout.tsx: startup, app
// foreground, every 20s while open).
export async function runMediaSync(): Promise<{ synced: number }> {
  if (mediaSyncing) return { synced: 0 };
  const queue = await getPendingMediaQueue();
  if (queue.length === 0) return { synced: 0 };

  mediaSyncing = true;
  notifySyncingListeners();
  let synced = 0;
  try {
    const token = await getToken();
    if (!token) return { synced: 0 };
    for (const item of queue) {
      try {
        const file = { uri: item.fileUri, fileName: item.fileName };
        const type = resolveMediaType(item.mediaKind, item.source);
        // No location for a replayed item — see PendingMediaItem's own
        // comment for why (original capture-time location would be
        // misleading by the time this finally uploads). target already
        // tells us which picker this came from, so a queued Running Hours
        // photo still confirms pre-tagged even after an offline retry.
        const tags = item.target === 'runningHours' ? ['Running Hours'] : undefined;
        const uploadOne = item.formKind === 'service' ? uploadOneServiceMedia : uploadOneCommissioningMedia;
        await uploadOne(token, item.taskId, file, type, undefined, tags);
        await removePendingMedia(item.id);
        synced++;
        notifySuccessListeners(item);
      } catch (error: any) {
        if (isNetworkError(error) || error?.name === 'NetworkError' || isServerError(error)) break;
        devLog('[Media Sync] Server rejected a queued upload, dropping it:', item.fileName, error?.response?.data || error?.message);
        await removePendingMedia(item.id);
      }
    }
  } finally {
    mediaSyncing = false;
    notifySyncingListeners();
    await notifyCountListeners();
  }
  return { synced };
}
