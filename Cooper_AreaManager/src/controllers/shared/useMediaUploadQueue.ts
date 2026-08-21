import { useCallback, useRef, useState } from 'react';
import { validateItemSize } from '../../utils/photoValidation';

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
  status: QueueItemStatus;
  itemProgress: number;
  // Only set when status is 'error' — the size-limit message or the real
  // upload failure's message, shown right on that item's own row.
  errorMessage?: string;
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
};

type Uploaders = {
  uploadPhoto: (file: { uri: string; fileName: string }, onProgress: (percent: number) => void, signal: AbortSignal) => Promise<void>;
  uploadVideoOrPdf: (file: { uri: string; fileName: string }, onProgress: (percent: number) => void, signal: AbortSignal) => Promise<void>;
};

const INITIAL_STATE: UploadQueueState = { visible: false, items: [] };

// A cancel (either this one item, or the whole batch) surfaces as either
// axios's own ERR_CANCELED (the multipart photo path) or the AbortError tag
// putFileToGcsUrl/uploadOneMediaFile attach for the raw-XHR video/PDF path
// (see commisionAPi.ts) — one check here covers both.
function isCancelError(error: any): boolean {
  return error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';
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
export function useMediaUploadQueue(uploaders: Uploaders, onItemSucceeded: (item: QueueItem) => void) {
  const [state, setState] = useState<UploadQueueState>(INITIAL_STATE);
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

  const startBatch = useCallback(async (assets: PickedAsset[]) => {
    if (assets.length === 0 || runningRef.current) return;
    runningRef.current = true;
    fullCancelRef.current = false;

    const items: QueueItem[] = assets.map((asset, i) => ({
      localId: `${Date.now()}-${i}`,
      uri: asset.uri,
      fileName: asset.fileName,
      fileSize: asset.fileSize,
      kind: asset.kind,
      status: 'pending',
      itemProgress: 0,
    }));
    // Adds to whatever's already showing (done items from a previous batch
    // in the same sitting stay visible) rather than replacing — picking
    // "Add More" mid-review shouldn't wipe out rows the user is still
    // looking at.
    setState((prev) => ({ visible: true, items: [...prev.items, ...items] }));

    for (let i = 0; i < items.length; i++) {
      if (fullCancelRef.current) break;

      // Checked right here — this item's own turn to upload — not back at
      // pick time, so a batch with one oversized file among several still
      // uploads everything else. Settles straight into an error row, no
      // pause/prompt — every item's own outcome is visible at once, so
      // there's nothing to ask the user about.
      const sizeError = validateItemSize(items[i].kind, items[i].fileSize);
      if (sizeError) {
        setState((prev) => ({
          ...prev,
          items: prev.items.map((it) => (it.localId === items[i].localId ? { ...it, status: 'error', errorMessage: sizeError } : it)),
        }));
        continue;
      }

      setState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.localId === items[i].localId ? { ...it, status: 'uploading' } : it)),
      }));

      const controller = new AbortController();
      activeControllerRef.current = controller;
      activeLocalIdRef.current = items[i].localId;
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
          items: prev.items.map((it) => (it.localId === items[i].localId ? { ...it, itemProgress: clamped } : it)),
        }));
      };

      try {
        const uploader = items[i].kind === 'photo' ? uploaders.uploadPhoto : uploaders.uploadVideoOrPdf;
        await uploader({ uri: items[i].uri, fileName: items[i].fileName }, onProgress, controller.signal);

        setState((prev) => ({
          ...prev,
          items: prev.items.map((it) => (it.localId === items[i].localId ? { ...it, status: 'done' as const, itemProgress: 100 } : it)),
        }));
        onItemSucceeded(items[i]);
      } catch (error: any) {
        if (isCancelError(error)) {
          if (fullCancelRef.current) break;
          // This one item's own Cancel was tapped — drop it from the list
          // entirely (as if it was never picked) and move straight on to
          // the next item, rather than stopping the whole batch.
          setState((prev) => ({ ...prev, items: prev.items.filter((it) => it.localId !== items[i].localId) }));
        } else {
          setState((prev) => ({
            ...prev,
            items: prev.items.map((it) => (it.localId === items[i].localId
              ? { ...it, status: 'error', errorMessage: error?.message || 'Upload failed. Please try again.' }
              : it)),
          }));
        }
      }
      activeControllerRef.current = null;
      activeLocalIdRef.current = null;
    }

    runningRef.current = false;

    if (fullCancelRef.current) {
      // Whatever already succeeded is already reflected in the caller's own
      // list (onItemSucceeded already fired for it) — closing the overlay
      // entirely is fine, nothing shown in it was the only record of that.
      fullCancelRef.current = false;
      setState(INITIAL_STATE);
    }
  }, [uploaders, onItemSucceeded]);

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
  // it finished.
  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { state, startBatch, cancel, cancelItem, dismiss };
}
