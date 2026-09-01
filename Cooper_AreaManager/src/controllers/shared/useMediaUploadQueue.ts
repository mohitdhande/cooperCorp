import { useCallback, useEffect, useRef, useState } from 'react';
import { validateItemSize } from '../../utils/photoValidation';
import { isNetworkError } from '../../utils/syncEngine';
import { subscribeToMediaSyncSuccess } from '../../utils/mediaSyncEngine';
import { PendingMediaItem } from '../../utils/pendingMediaQueue';
import { logLocationForAction, resolveUploadLocation } from '../../utils/locationLogger';
import { devLog } from '../../utils/devLog';
import { MediaType, MediaLocation, MediaSource, resolveMediaType } from '../../models/taskForm.types';

export type QueueItemKind = 'photo' | 'video' | 'pdf';
// Every item's outcome is shown as its own row, all at once (not one
// single-focus screen) — so there's no "paused, waiting for a decision"
// status anymore. A size-exceeded, canceled, or genuinely failed item just
// settles into 'error' (or disappears, for an individual cancel) and the
// loop moves straight on to the next item; only "Cancel All" ever stops
// the whole batch.
export type QueueItemStatus = 'pending' | 'uploading' | 'done' | 'error';

export type QueueItem = {
  localId: string;
  uri: string;
  fileName: string;
  fileSize?: number;
  kind: QueueItemKind;
  source: MediaSource;
  status: QueueItemStatus;
  itemProgress: number;
  // Only set when status is 'error' — the size-limit message or the real
  // upload failure's message, shown right on that item's own row.
  errorMessage?: string;
  // Only true for an 'error' row caused purely by a network failure while
  // offlineEnabled — persisted to disk (see pendingMediaId below) and
  // uploaded automatically once connectivity returns, even if the app is
  // fully closed and reopened in the meantime.
  retryable?: boolean;
  // The durable pendingMediaQueue.ts entry's own id, once persisted —
  // lets this row recognize itself when mediaSyncEngine.ts's background
  // sync (running from _layout.tsx, with no idea this screen even exists)
  // reports that this exact item finally uploaded, so it can flip to
  // 'done' live instead of only showing up next time the task reopens.
  pendingMediaId?: string;
  // Set once the upload actually confirms — the real backend media key
  // (gcsUrl) and the exact MediaType it confirmed as. onItemSucceeded only
  // ever fires with both populated; they're on the type as optional purely
  // because the item doesn't have them yet while pending/uploading.
  gcsUrl?: string;
  type?: MediaType;
  // The location actually resolved (and sent) for this item's batch — see
  // MediaLocationButton, which shows this back to the user. Undefined if
  // GPS/permission wasn't available at capture time.
  location?: MediaLocation;
  // The tags actually sent at confirm time — see this hook's own
  // defaultTags param (e.g. Running Hours always confirms pre-tagged
  // 'Running Hours', not left for the user to pick afterward).
  tags?: string[];
};

export type UploadQueueState = {
  visible: boolean;
  items: QueueItem[];
};

export type PickedAsset = {
  uri: string;
  fileName: string;
  fileSize?: number;
  kind: QueueItemKind;
  source: MediaSource;
};

type Uploaders = {
  // Both return the confirmed gcsUrl — callers need it as the item's own
  // stable key for tagging afterward (MediaTagPicker's PATCH matches by
  // gcsUrl).
  uploadPhoto: (file: { uri: string; fileName: string }, type: MediaType, location: MediaLocation | undefined, tags: string[] | undefined, onProgress: (percent: number) => void, signal: AbortSignal) => Promise<string>;
  uploadVideoOrPdf: (file: { uri: string; fileName: string }, type: MediaType, location: MediaLocation | undefined, tags: string[] | undefined, onProgress: (percent: number) => void, signal: AbortSignal) => Promise<string>;
};

const INITIAL_STATE: UploadQueueState = { visible: false, items: [] };

// A cancel (either this one item, or the whole batch) surfaces as either
// axios's own ERR_CANCELED (the multipart photo path) or the AbortError tag
// putFileToGcsUrl/uploadOneMediaFile attach for the raw-XHR video/PDF path
// (see commisionAPi.ts) — one check here covers both.
function isCancelError(error: any): boolean {
  return error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';
}

// True for a genuine connectivity failure on either upload path this hook
// drives — axios's own no-response/has-request shape (isNetworkError,
// covers the photo multipart call and the GCS sign/confirm calls) or the
// raw-XHR video/PDF PUT's own tagged NetworkError (putFileToGcsUrl in
// commisionAPi.ts has no axios request/response object for isNetworkError
// to key off, so it tags its own network failure the same way AbortError
// already is).
function isRetryableFailure(error: any): boolean {
  return isNetworkError(error) || error?.name === 'NetworkError';
}

// Generic, form-agnostic sequential upload orchestrator, shared by the
// Commissioning and Service task forms so "upload immediately, show every
// file's own real progress, let Cancel actually abort the request" can't
// drift between them the way copy-pasted per-form logic has before. Neither
// this hook nor the overlay it feeds ever touches sitePhotos/
// runningHoursPhotos directly — onItemSucceeded is how each caller appends
// its own confirmed-uploaded item into whichever list it owns, which is
// what lets one hook serve both forms (and, for commissioning, two
// independent lists) without knowing anything about either.
//
// `offlineEnabled` (default true) — matches putOrQueue's own convention
// (syncEngine.ts): offline retry is meant for engineers filling in the
// form on-site, not every role. When false, a network failure just settles
// into a normal, non-retrying error row (same as any other real failure).
//
// `persistOnFailure` — called once a network failure is confirmed (never
// for every attempt) to hand the picked file off to pendingMediaQueue.ts,
// which copies it into permanent storage and records it for
// mediaSyncEngine.ts's own background sync (_layout.tsx's same startup/
// foreground/20s triggers as the plain-JSON write queue) to pick up later —
// even across a full app restart. The caller supplies this (rather than
// this hook calling enqueuePendingMedia itself) since only the caller knows
// which taskId/formKind/target this upload belongs to.
export function useMediaUploadQueue(
  uploaders: Uploaders,
  onItemSucceeded: (item: QueueItem) => void,
  offlineEnabled: boolean = true,
  persistOnFailure: (item: QueueItem) => Promise<PendingMediaItem>,
  // Applied to every item confirmed through this queue instance — e.g. the
  // Running Hours queue passes ['Running Hours'] so every photo it uploads
  // is pre-tagged at confirm time, never left for the user to pick
  // afterward. Undefined/omitted (every other queue) sends no tags.
  defaultTags?: string[]
) {
  const [state, setState] = useState<UploadQueueState>(INITIAL_STATE);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const activeControllerRef = useRef<AbortController | null>(null);
  const activeLocalIdRef = useRef<string | null>(null);
  // Set by cancel() ("Cancel All") — checked at the top of every loop
  // iteration so no further items are even attempted, and in the catch
  // block to tell "the whole batch was stopped" apart from "just this one
  // item was canceled" (both raise the same AbortError).
  const fullCancelRef = useRef(false);
  // Set by cancelItem() right before aborting — cleared at the start of
  // every new item's own turn.
  const itemCancelRequestedRef = useRef(false);
  const runningRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  // One location *promise* shared by every item in a given startBatch call
  // (not per file, per §9.5), keyed by each item's own localId. A promise,
  // not the resolved value — attemptItem actually awaits it, so the first
  // item genuinely waits on the real GPS/geocode resolution (capped by
  // resolveUploadLocation's own timeouts) while every later item in that
  // same batch awaits the identical already-settled promise, effectively
  // instant. Not part of QueueItem's own public shape (MediaUploadOverlay
  // never needs to display it) — discarded from this map once read.
  const pendingLocationsRef = useRef<Map<string, Promise<MediaLocation | undefined>>>(new Map());

  // Uploads one already-tracked item (by localId) and updates its row's
  // status as it goes.
  const attemptItem = useCallback(async (item: QueueItem) => {
    // Same capture point as every accept/start/save action (putOrQueue in
    // syncEngine.ts) — picking/recording a photo or video while filling in
    // the form is exactly the kind of moment this is meant to prove the
    // engineer was on-site for, so it needs its own explicit call here
    // rather than getting it for free the way putOrQueue-backed actions do.
    logLocationForAction(`Upload ${item.kind} (${item.fileName})`);

    const sizeError = validateItemSize(item.kind, item.fileSize);
    if (sizeError) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.localId === item.localId ? { ...it, status: 'error', errorMessage: sizeError, retryable: false } : it)),
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.localId === item.localId ? { ...it, status: 'uploading', errorMessage: undefined } : it)),
    }));

    const controller = new AbortController();
    activeControllerRef.current = controller;
    activeLocalIdRef.current = item.localId;
    itemCancelRequestedRef.current = false;

    const onProgress = (percent: number) => {
      // Defense in depth — commisionAPi.ts already clamps at the source
      // (Android's native upload layer can report event.loaded slightly
      // over event.total near the end of a raw file PUT), but nothing
      // here should ever be able to push the displayed % past 100
      // regardless of what a given uploader reports.
      const clamped = Math.max(0, Math.min(100, percent));
      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.localId === item.localId ? { ...it, itemProgress: clamped } : it)),
      }));
    };

    try {
      const type = resolveMediaType(item.kind, item.source);
      const locationPromise = pendingLocationsRef.current.get(item.localId);
      pendingLocationsRef.current.delete(item.localId);
      const location = locationPromise ? await locationPromise : undefined;
      const uploader = item.kind === 'photo' ? uploaders.uploadPhoto : uploaders.uploadVideoOrPdf;
      const gcsUrl = await uploader({ uri: item.uri, fileName: item.fileName }, type, location, defaultTags, onProgress, controller.signal);

      // The confirmed gcsUrl/type — not on the stale `item` closure param,
      // only just resolved above — is what onItemSucceeded's caller needs
      // to build a SitePhoto that can actually be tagged afterward
      // (MediaTagPicker's PATCH matches by gcsUrl). tags mirrors whatever
      // was actually sent (defaultTags), so the local list reflects the
      // real saved tag immediately, without a separate re-fetch.
      const succeededItem: QueueItem = { ...item, status: 'done', itemProgress: 100, gcsUrl, type, location, tags: defaultTags };
      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.localId === item.localId ? succeededItem : it)),
      }));
      onItemSucceeded(succeededItem);
    } catch (error: any) {
      if (isCancelError(error)) {
        if (fullCancelRef.current) return;
        // This one item's own Cancel was tapped — drop it from the list
        // entirely (as if it was never picked) and move straight on to
        // the next item, rather than stopping the whole batch.
        setState((prev) => ({ ...prev, items: prev.items.filter((it) => it.localId !== item.localId) }));
      } else if (offlineEnabled && isRetryableFailure(error)) {
        let pendingMediaId: string | undefined;
        try {
          const persisted = await persistOnFailure(item);
          pendingMediaId = persisted.id;
        } catch (persistError) {
          // Couldn't even save it locally (disk full, etc.) — falls
          // through to a normal, non-retrying error row below instead of
          // silently pretending it's safely queued.
          devLog('[Media Queue] Failed to persist item for offline retry:', persistError);
        }
        setState((prev) => ({
          ...prev,
          items: prev.items.map((it) => (it.localId === item.localId
            ? {
                ...it,
                status: 'error',
                itemProgress: 0,
                retryable: !!pendingMediaId,
                pendingMediaId,
                errorMessage: pendingMediaId
                  ? "Offline — saved on this device, will upload once you're back online"
                  : 'Upload failed. Please try again.',
              }
            : it)),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          items: prev.items.map((it) => (it.localId === item.localId
            ? { ...it, status: 'error', errorMessage: error?.message || 'Upload failed. Please try again.', retryable: false }
            : it)),
        }));
      }
    }
    activeControllerRef.current = null;
    activeLocalIdRef.current = null;
  }, [uploaders, onItemSucceeded, offlineEnabled, persistOnFailure, defaultTags]);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    fullCancelRef.current = false;

    while (queueRef.current.length > 0) {
      if (fullCancelRef.current) break;
      const item = queueRef.current.shift()!;
      await attemptItem(item);
    }

    runningRef.current = false;

    if (fullCancelRef.current) {
      // Whatever already succeeded is already reflected in the caller's own
      // list (onItemSucceeded already fired for it) — closing the overlay
      // entirely is fine, nothing shown in it was the only record of that.
      fullCancelRef.current = false;
      queueRef.current = [];
      setState(INITIAL_STATE);
    }
  }, [attemptItem]);

  const startBatch = useCallback((assets: PickedAsset[]) => {
    if (assets.length === 0) return;

    const items: QueueItem[] = assets.map((asset, i) => ({
      localId: `${Date.now()}-${i}`,
      uri: asset.uri,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      kind: asset.kind,
      source: asset.source,
      status: 'pending',
      itemProgress: 0,
    }));
    // Started once here, not awaited — every item in this batch shares the
    // exact same promise (§9.5's "one location reading per batch, not per
    // file"). Kicking it off now (rather than inside attemptItem, per
    // item) is what makes that sharing possible.
    const locationPromise = resolveUploadLocation();
    items.forEach((it) => pendingLocationsRef.current.set(it.localId, locationPromise));
    // Adds to whatever's already showing (done items from a previous batch
    // in the same sitting stay visible) rather than replacing — picking
    // "Add More" mid-review shouldn't wipe out rows the user is still
    // looking at.
    setState((prev) => ({ visible: true, items: [...prev.items, ...items] }));
    queueRef.current.push(...items);
    pump();
  }, [pump]);

  // Reacts to mediaSyncEngine.ts's background sync (triggered from
  // _layout.tsx, with no idea this screen — or any screen — is even open)
  // successfully uploading one of this hook's own persisted items. Flips
  // that row to 'done' and feeds it into the caller's list live, instead of
  // it only ever showing up the next time this task happens to be reopened.
  useEffect(() => {
    return subscribeToMediaSyncSuccess((syncedItem) => {
      const match = stateRef.current.items.find((it) => it.pendingMediaId === syncedItem.id);
      if (!match) return;
      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.localId === match.localId ? { ...it, status: 'done' as const, itemProgress: 100 } : it)),
      }));
      onItemSucceeded(match);
    });
  }, [onItemSucceeded]);

  // Cancels just the one item currently uploading — only ever called from
  // that item's own row, so it's a no-op if localId isn't actually the
  // active one (e.g. a stale button press after it already finished).
  const cancelItem = useCallback((localId: string) => {
    if (activeLocalIdRef.current !== localId) return;
    itemCancelRequestedRef.current = true;
    activeControllerRef.current?.abort();
  }, []);

  // "Cancel All" — stops the batch outright: aborts whatever's currently in
  // flight and never starts anything still pending.
  const cancel = useCallback(() => {
    fullCancelRef.current = true;
    activeControllerRef.current?.abort();
  }, []);

  // The bottom button once nothing is pending/uploading anymore — just
  // closes the review list. Doesn't touch sitePhotos/runningHoursPhotos;
  // every item shown as 'done' already landed there via onItemSucceeded as
  // it finished. Keeps still-retrying (retryable) rows around instead of
  // wiping them — they're already safely persisted to disk regardless, but
  // this way they also reappear (still showing their "will upload
  // automatically" row) if the overlay reopens for a new pick before they
  // finish syncing in the background.
  const dismiss = useCallback(() => {
    setState((prev) => ({ visible: false, items: prev.items.filter((it) => it.retryable) }));
  }, []);

  return { state, startBatch, cancel, cancelItem, dismiss };
}
