import AsyncStorage from '@react-native-async-storage/async-storage';

// A persisted list of writes that couldn't reach the backend (no network),
// replayed later by syncEngine.ts once connectivity comes back. Only PUT is
// needed today — every engineer-facing save endpoint this queue currently
// wraps (asset sections, commissioning checks/readings, SR save-progress)
// is a PUT; extend the union if a queued POST ever becomes necessary.
const QUEUE_KEY = 'cc_offline_queue';

export type PendingAction = {
  id: string;
  createdAt: number;
  method: 'PUT';
  url: string;
  body: Record<string, any>;
  // Shown in the pending-sync UI — e.g. "Genset Identification (Task #123)".
  description: string;
  // Identifies which *logical* save this is — deliberately separate from
  // `url`, because several different sections legitimately PUT the same
  // endpoint with only their own partial fields (Genset vs Alternator both
  // hit /api/assets/:id; Group A-E checks all hit
  // /api/commissioning/:id/progress). Deduping on `url` alone would let a
  // later section's queued save silently replace an earlier, still-pending
  // section's edit. Callers must pass something unique per logical save,
  // e.g. `asset_genset_${assetId}` vs `asset_alternator_${assetId}`.
  dedupeKey: string;
};

async function readQueue(): Promise<PendingAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log('[Offline Queue] Failed to read queue:', error);
    return [];
  }
}

async function writeQueue(queue: PendingAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Merges into any existing not-yet-synced entry for the same dedupeKey
// rather than replacing it outright — e.g. the engineer saves the same
// section's Field A, then later its Field B, both while still offline;
// this keeps both instead of the second save silently dropping the first
// one's field. Newer values win where both saves touched the same field.
export async function enqueueAction(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<void> {
  const queue = await readQueue();
  const existingIndex = queue.findIndex((a) => a.dedupeKey === action.dedupeKey);
  if (existingIndex >= 0) {
    queue[existingIndex] = {
      ...queue[existingIndex],
      body: { ...queue[existingIndex].body, ...action.body },
      description: action.description,
      createdAt: Date.now(),
    };
  } else {
    queue.push({ ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: Date.now() });
  }
  await writeQueue(queue);
}

export async function getQueue(): Promise<PendingAction[]> {
  return readQueue();
}

export async function getQueueCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((a) => a.id !== id));
}

// A queued action the server actually rejected (validation error, the task
// since being closed elsewhere, etc.) — distinct from a network failure,
// which just gets retried forever. Previously these were dropped from the
// queue with nothing but a console.log — silently "syncing" (removing the
// pending-changes banner) while never actually reaching the server, which
// is indistinguishable from a real sync to anyone not watching device
// logs. Kept as a short, separate list so the UI can surface exactly what
// failed and why instead of the edit just vanishing.
const FAILURES_KEY = 'cc_sync_failures';
const MAX_FAILURES = 20;

export type SyncFailure = {
  id: string;
  description: string;
  message: string;
  failedAt: number;
};

async function readFailures(): Promise<SyncFailure[]> {
  try {
    const raw = await AsyncStorage.getItem(FAILURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log('[Offline Queue] Failed to read sync failures:', error);
    return [];
  }
}

async function writeFailures(failures: SyncFailure[]): Promise<void> {
  await AsyncStorage.setItem(FAILURES_KEY, JSON.stringify(failures));
}

export async function recordSyncFailure(description: string, message: string): Promise<void> {
  const failures = await readFailures();
  failures.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, description, message, failedAt: Date.now() });
  await writeFailures(failures.slice(0, MAX_FAILURES));
}

export async function getSyncFailures(): Promise<SyncFailure[]> {
  return readFailures();
}

export async function clearSyncFailures(): Promise<void> {
  await writeFailures([]);
}

// Returns the body of a still-queued action for this exact dedupeKey, or
// null if nothing's queued for it. A live GET can succeed (connectivity is
// back) before a matching queued PUT has actually been replayed — without
// this, re-populating a form straight from that GET response would revert
// fields the user already edited offline back to the stale pre-edit server
// value, even though the real edit is still sitting in the queue waiting to
// sync. Callers overlay this on top of a fresh/cached server response
// before writing it into form state, never into what gets cached.
export async function getPendingBody(dedupeKey: string): Promise<Record<string, any> | null> {
  const queue = await readQueue();
  const match = queue.find((a) => a.dedupeKey === dedupeKey);
  return match ? match.body : null;
}

// Reconstructs the in-memory "already accepted/started" status bump that
// handleAcceptActiveTask/handleStartActiveTask (dashboardHomeController.ts,
// commissioningTasksController.ts, serviceTasksController.ts) each apply
// optimistically the instant those actions are tapped — from this durable
// queue instead, since a fresh mount of any of those controllers (e.g. the
// bottom nav's router.replace always creating a brand new screen instance
// rather than popping back to the existing one) resets that in-memory state
// to {} and loses the bump entirely. Without this, a task accepted/started
// while offline would revert to showing its stale pre-accept/start status
// after any such remount, even though the accept/start is still safely
// queued and waiting to sync. putOrQueue's dedupeKeys for these two actions
// are predictable (`${kind}_accept_${taskId}` / `${kind}_start_${taskId}`),
// so this just checks which of those are still sitting in the queue —
// nothing to find once the queued action has actually synced and been
// removed, since a live refetch by then already reflects the real status.
export async function deriveQueuedTaskStatusOverrides(tasks: { _id: string; __kind?: string }[]): Promise<Record<string, string>> {
  const queue = await readQueue();
  const dedupeKeys = new Set(queue.map((action) => action.dedupeKey));
  const overrides: Record<string, string> = {};
  tasks.forEach((task) => {
    const kind = task.__kind === 'service' ? 'service' : 'commissioning';
    if (dedupeKeys.has(`${kind}_start_${task._id}`)) overrides[task._id] = 'IN_PROGRESS';
    else if (dedupeKeys.has(`${kind}_accept_${task._id}`)) overrides[task._id] = 'ACCEPTED';
  });
  return overrides;
}
