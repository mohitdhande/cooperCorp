import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getToken } from '../../utils/tokenStore';
import { uploadOneCommissioningMedia, updateCommissioningMediaTag, getGcsSignedUrls } from '../../viewModel/commisionAPi';
import { SitePhoto, MediaType, MediaLocation, complaintCodeMediaTag } from '../../models/taskForm.types';
import { getPhotoValidationError, getPdfValidationError, partitionValidPhotos } from '../../utils/photoValidation';
import { videoFileName } from '../../utils/reportFormatters';
import { useMediaUploadQueue, QueueItem, PickedAsset } from '../shared/useMediaUploadQueue';
import { enqueuePendingMedia } from '../../utils/pendingMediaQueue';
import { showCameraUnavailableAlert } from '../../utils/cameraErrorAlert';

type UseTaskFormPhotosArgs = {
  taskId: string;
  // Threaded straight into useMediaUploadQueue's own offlineEnabled — same
  // engineer-only scoping as every other offline feature in this form (see
  // useTaskForm.ts's own isEngineer comment).
  isEngineer: boolean;
};

// gcsUrl/type only ever missing if this fires before the migration to the
// media[] model somehow left an item without them — shouldn't happen since
// onItemSucceeded only ever calls with a confirmed item, but the field is
// optional on QueueItem itself (not populated yet while pending/uploading),
// so this still needs a fallback rather than asserting non-null.
function toSitePhoto(item: QueueItem): SitePhoto {
  return {
    id: item.gcsUrl || item.localId,
    uri: item.uri,
    fileName: item.fileName,
    mediaType: item.kind === 'photo' ? 'image' : item.kind,
    fileSize: item.fileSize,
    gcsUrl: item.gcsUrl,
    type: item.type,
    tags: item.tags || [],
    location: item.location,
  };
}

// Keeps photo capture, selection, and upload behavior isolated from the
// screen component. Every photo/video/PDF now uploads immediately (via
// useMediaUploadQueue) the moment it's picked/captured, rather than sitting
// local until a final "Complete" batch upload — see MediaUploadOverlay for
// the overlay this drives.
export function useTaskFormPhotos({ taskId, isEngineer }: UseTaskFormPhotosArgs) {
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [runningHoursPhotos, setRunningHoursPhotos] = useState<SitePhoto[]>([]);
  const [step2PhotoOptionsVisible, setStep2PhotoOptionsVisible] = useState(false);
  // Mandatory, single, front-camera selfie shown on Step 6 above the
  // suggestion comment — see SelfieCard's own comment for why this is a
  // separate slot rather than just another sitePhotos entry (it's excluded
  // from that grid and gated as its own hard requirement at Complete Task).
  const [selfiePhoto, setSelfiePhoto] = useState<SitePhoto | null>(null);
  // One image per complaint code, keyed by that code's own `uid` — unlike
  // Running Hours/Selfie (one fixed global slot each), there can be many
  // complaint codes at once, so this is a map instead of a single slot. No
  // backend field ties a photo to a specific fault code today (the
  // faultCodes[] save payload is just {codeId, observation, rootCause,
  // correctiveAction} — see saveFaultCodes), so each upload gets PATCHed
  // (right after it confirms) with complaintCodeMediaTag(code) — a tag
  // encoding that code's own short `code` string — via the general media
  // tagging endpoint. That tag is what survives a reload: the report reads
  // it straight back off task.media to show the right photo under the
  // right complaint code, not just this local uid-keyed map (which only
  // ever matters for this session's own live form).
  const [faultCodePhotos, setFaultCodePhotos] = useState<Record<string, SitePhoto>>({});
  // Which complaint code's card triggered the camera — read inside
  // faultCodeQueue's onItemSucceeded (a ref, not state, so that closure
  // always sees the value current at upload-completion time rather than
  // whatever it was when the queue was first created). Carries both the
  // local uid (keys the local faultCodePhotos map) and the code string
  // (what actually gets sent as the tag).
  const activeFaultCodeRef = useRef<{ uid: string; code: string } | null>(null);

  // Both Step 2 (running-hours, images only) and Step 6 (site, photo/video/
  // PDF) hit the same commissioning endpoints for the same taskId — only
  // which local list a successful item lands in (onItemSucceeded) differs,
  // which is exactly what lets one shared hook drive both. Every media
  // type now rides the same uploadOneCommissioningMedia call (unified
  // media[] model) — the old separate photo (multipart) vs. video/PDF (GCS)
  // paths are gone, so uploadPhoto/uploadVideoOrPdf both just forward here.
  const uploaders = useMemo(() => ({
    uploadPhoto: async (file: { uri: string; fileName: string }, type: MediaType, location: MediaLocation | undefined, tags: string[] | undefined, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      return uploadOneCommissioningMedia(token, taskId, file, type, location, tags, onProgress, signal);
    },
    uploadVideoOrPdf: async (file: { uri: string; fileName: string }, type: MediaType, location: MediaLocation | undefined, tags: string[] | undefined, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      return uploadOneCommissioningMedia(token, taskId, file, type, location, tags, onProgress, signal);
    },
  }), [taskId]);

  const persistSiteFailure = useCallback((item: QueueItem) => enqueuePendingMedia({
    sourceUri: item.uri, fileName: item.fileName, fileSize: item.fileSize,
    mediaKind: item.kind, source: item.source, formKind: 'commissioning', taskId, target: 'site',
  }), [taskId]);
  const persistRunningHoursFailure = useCallback((item: QueueItem) => enqueuePendingMedia({
    sourceUri: item.uri, fileName: item.fileName, fileSize: item.fileSize,
    mediaKind: item.kind, source: item.source, formKind: 'commissioning', taskId, target: 'runningHours',
  }), [taskId]);
  const persistSelfieFailure = useCallback((item: QueueItem) => enqueuePendingMedia({
    sourceUri: item.uri, fileName: item.fileName, fileSize: item.fileSize,
    mediaKind: item.kind, source: item.source, formKind: 'commissioning', taskId, target: 'selfie',
  }), [taskId]);

  // offlineEnabled is `true` here regardless of role — unlike every other
  // putOrQueue-backed save in this form (still scoped to isEngineer only,
  // per useTaskForm.ts's own note on why), a dropped signal mid-upload
  // should save-and-auto-resume a photo/video/PDF for whoever is filling
  // this form, not just an engineer. In practice the only other role that
  // ever reaches this screen is areaManager (dealer can't fill task forms
  // at all — see permissions.ts's canFillTaskForm), but this is written as
  // "always on" rather than re-deriving that role check here, so it stays
  // correct even if that permission ever changes.
  const siteQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setSitePhotos((prev) => [...prev, toSitePhoto(item)]), []),
    true,
    persistSiteFailure
  );
  // Every Running Hours photo confirms pre-tagged 'Running Hours' by
  // default (defaultTags below) — the tag picker on this photo can still
  // re-tag it afterward if that's ever genuinely needed, same as any other
  // item, it just doesn't start blank.
  const runningHoursQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setRunningHoursPhotos((prev) => [...prev, toSitePhoto(item)]), []),
    true,
    persistRunningHoursFailure,
    ['Running Hours']
  );
  // Confirms pre-tagged 'Selfie' by default — same pattern as the Running
  // Hours queue above, and the one reliable signal hydrateSitePhotos uses to
  // pull a previously-uploaded selfie into its own slot on reopen instead of
  // the general site photos grid. Replaces (not appends) on success — see
  // SelfieCard's own comment on why retake is a direct replace.
  const selfieQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setSelfiePhoto(toSitePhoto(item)), []),
    true,
    persistSelfieFailure,
    ['Selfie']
  );

  // offlineEnabled: false — the client-side uid↔photo association above
  // can't meaningfully survive a queued/replayed-later upload (a dropped
  // network mid-upload, possibly resumed after an app restart, with no
  // guarantee the same complaint code still exists in this session's
  // state), so a failure here just settles into a normal, retry-by-hand
  // error row instead of pretending it's safely queued. persistOnFailure
  // is required by the hook's own signature but never actually invoked
  // while offlineEnabled is false.
  const persistFaultCodeFailure = useCallback((): Promise<never> => (
    Promise.reject(new Error('Offline retry not supported for fault code images'))
  ), []);
  const faultCodeQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => {
      const active = activeFaultCodeRef.current;
      if (!active) return;
      const tag = complaintCodeMediaTag(active.code);
      setFaultCodePhotos((prev) => ({ ...prev, [active.uid]: { ...toSitePhoto(item), tags: [tag] } }));
      // Best-effort, fire-and-forget — the upload itself already
      // succeeded and is already visible on this card locally; a failed
      // tag PATCH just means the report won't be able to re-link this
      // specific photo to this specific code after a reload, not a
      // failure worth interrupting the user over.
      (async () => {
        try {
          const token = await getToken();
          if (!token || !taskId || !item.gcsUrl) return;
          await updateCommissioningMediaTag(token, taskId, item.gcsUrl, [tag]);
        } catch (error) {
          console.log('[Task Form Photos] Failed to tag fault code image:', error);
        }
      })();
    }, [taskId]),
    false,
    persistFaultCodeFailure
  );

  // Android's native camera intent can't mix photo and video capture in
  // one launch (ACTION_IMAGE_CAPTURE vs ACTION_VIDEO_CAPTURE are separate
  // intents) — passing mediaTypes: ['images', 'videos'] to launchCameraAsync
  // silently falls back to photo-only there, with no video toggle shown.
  // So "Take Photo" and "Record Video" are two distinct camera launches,
  // each requesting only its own type; this works on iOS too.
  const captureFromCamera = useCallback(async (mediaType: 'images' | 'videos', target: 'site' | 'runningHours' | 'selfie' | 'faultCode') => {
    try {
      // The options sheet Modal (fade-out) is still tearing down its own
      // native window when the button's onPress fires — launching the
      // camera activity while that's still in flight is what causes the
      // black-screen flash some Android devices show before the camera
      // actually appears. A short pause here lets the Modal's close
      // animation finish first, same fix for both the permission prompt
      // and the camera launch itself.
      await new Promise((resolve) => setTimeout(resolve, 350));

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showCameraUnavailableAlert('permission');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: [mediaType],
        videoMaxDuration: 60,
        quality: 0.7,
        // Selfie is the one capture in this form that must come from the
        // front camera — a proof-of-presence photo taken with the back
        // camera would defeat the point.
        ...(target === 'selfie' ? { cameraType: ImagePicker.CameraType.front } : {}),
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        const validationError = getPhotoValidationError(asset);
        if (validationError) {
          Alert.alert(mediaType === 'videos' ? 'Video not allowed' : 'Photo not allowed', validationError);
          return;
        }
        const isVideo = mediaType === 'videos';
        const fileName = asset.uri.split('/').pop() || `${isVideo ? 'video' : 'photo'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
        const picked: PickedAsset = { uri: asset.uri, fileName, fileSize: asset.fileSize, kind: isVideo ? 'video' : 'photo', source: 'camera' };
        const queue = target === 'site' ? siteQueue : target === 'runningHours' ? runningHoursQueue : target === 'faultCode' ? faultCodeQueue : selfieQueue;
        queue.startBatch([picked]);
      }
    } catch (error: any) {
      // A native picker/camera failure (no camera, OS-level glitch, or an
      // OEM privacy manager silently blocking it — see
      // showCameraUnavailableAlert's own comment) would otherwise fail
      // silently — the button tap would just do nothing with no feedback.
      // Logged with whatever detail the thrown error actually carries
      // (code/message, if any) so a real device failure can be pinned down
      // from the logs instead of guessing.
      console.log('[Task Form Photos] Camera failed:', error?.code || '', error?.message || error);
      showCameraUnavailableAlert('unavailable');
    }
  }, [siteQueue, runningHoursQueue, selfieQueue, faultCodeQueue]);

  const handleTakeSelfie = useCallback(async () => {
    await captureFromCamera('images', 'selfie');
  }, [captureFromCamera]);

  const handleTakeSitePhoto = useCallback(async () => {
    setPhotoOptionsVisible(false);
    await captureFromCamera('images', 'site');
  }, [captureFromCamera]);

  const handleRecordSiteVideo = useCallback(async () => {
    setPhotoOptionsVisible(false);
    await captureFromCamera('videos', 'site');
  }, [captureFromCamera]);

  const handleChooseSitePhotos = useCallback(async () => {
    setPhotoOptionsVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled) {
        const { valid, skippedMessage } = partitionValidPhotos(result.assets);
        const picked: PickedAsset[] = valid.map((asset, index) => {
          const isVideo = asset.type === 'video';
          const fileName = asset.uri.split('/').pop() || `${isVideo ? 'video' : 'photo'}_${Date.now()}_${index}.${isVideo ? 'mp4' : 'jpg'}`;
          return { uri: asset.uri, fileName, fileSize: asset.fileSize, kind: isVideo ? 'video' : 'photo', source: 'gallery' };
        });
        if (picked.length > 0) siteQueue.startBatch(picked);
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the photo gallery. Please try again.');
    }
  }, [siteQueue]);

  const handleRemoveSitePhoto = useCallback((id: string) => {
    setSitePhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  // Documents card's own picker (Step 6 only) — device storage only (no
  // camera option; a PDF can't be "captured"). No dedicated document
  // endpoint exists on the backend, so picked PDFs are tagged
  // mediaType: 'pdf' and ride the same GCS video flow as recorded videos —
  // same as the SR form's own Documents card.
  const handlePickPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets) return;

      const valid: DocumentPicker.DocumentPickerAsset[] = [];
      const reasons = new Set<string>();
      for (const asset of result.assets) {
        const error = getPdfValidationError(asset);
        if (error) reasons.add(error);
        else valid.push(asset);
      }
      const picked: PickedAsset[] = valid.map((asset, i) => ({
        uri: asset.uri,
        fileName: asset.name || `document_${i + 1}.pdf`,
        fileSize: asset.size,
        kind: 'pdf',
        source: 'gallery',
      }));
      if (picked.length > 0) siteQueue.startBatch(picked);

      const skippedCount = result.assets.length - valid.length;
      if (skippedCount > 0) {
        Alert.alert('Some files were skipped', `${skippedCount} file${skippedCount > 1 ? 's were' : ' was'} skipped: ${Array.from(reasons).join(' ')}`);
      }
    } catch (error) {
      console.log('[Task Form Photos] PDF picker failed:', error);
      Alert.alert('Storage unavailable', 'Could not open device storage. Please try again.');
    }
  }, [siteQueue]);

  // Exactly one running-hours photo — the PhotosVideoCard usage in
  // taskForm.tsx already hides its own Add trigger once one exists
  // (maxItems={1}), but these are guarded directly too rather than relying
  // solely on that UI-level hiding, in case either handler is ever reached
  // another way.
  const handleTakeRunningHoursPhoto = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    if (runningHoursPhotos.length >= 1) {
      Alert.alert('Only one photo allowed', 'Remove the current running-hours photo before adding a different one.');
      return;
    }
    await captureFromCamera('images', 'runningHours');
  }, [captureFromCamera, runningHoursPhotos]);

  const handleChooseRunningHoursPhotos = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    if (runningHoursPhotos.length >= 1) {
      Alert.alert('Only one photo allowed', 'Remove the current running-hours photo before adding a different one.');
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
        return;
      }

      // Images only — Step 2's running-hours upload never takes video or
      // PDF, unlike Step 6's own site photos. Single-select — only one
      // running-hours photo is ever wanted, not a batch.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: false,
      });

      if (!result.canceled) {
        const { valid, skippedMessage } = partitionValidPhotos(result.assets);
        // Belt-and-suspenders on top of allowsMultipleSelection: false —
        // caps at exactly 1 regardless of what the native picker returns.
        const picked: PickedAsset[] = valid.slice(0, 1).map((asset, index) => ({
          uri: asset.uri,
          fileName: asset.uri.split('/').pop() || `photo_${Date.now()}_${index}.jpg`,
          fileSize: asset.fileSize,
          kind: 'photo',
          source: 'gallery',
        }));
        if (picked.length > 0) runningHoursQueue.startBatch(picked);
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the photo gallery. Please try again.');
    }
  }, [runningHoursQueue, runningHoursPhotos]);

  const handleRemoveRunningHoursPhoto = useCallback((id: string) => {
    setRunningHoursPhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  // Camera-only, no options sheet — tapping "+ Fault Code Image" opens the
  // camera directly, same one-tap pattern as SelfieCard's own onCapture
  // (no gallery choice for either). Records which uid/code this upload
  // belongs to (activeFaultCodeRef) before launching, read by
  // faultCodeQueue's onItemSucceeded once the upload confirms.
  const handleTakeFaultCodePhoto = useCallback(async (uid: string, code: string) => {
    activeFaultCodeRef.current = { uid, code };
    await captureFromCamera('images', 'faultCode');
  }, [captureFromCamera]);

  const handleRemoveFaultCodePhoto = useCallback((uid: string) => {
    setFaultCodePhotos((prev) => {
      if (!(uid in prev)) return prev;
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  }, []);

  // Shows whatever was already uploaded in an earlier session — called once
  // when the task detail first loads (see useTaskForm.ts), so reopening a
  // task you'd already added photos/videos/PDFs to doesn't look empty just
  // because this session's own sitePhotos/runningHoursPhotos state starts
  // fresh. Reads the unified task.media array directly and filters by each
  // item's own .type — no more extension-guessing (splitMediaByExtension)
  // now that the backend tells us exactly what each item is. An item
  // tagged 'Running Hours' (the fixed default runningHoursQueue always
  // confirms with) hydrates into runningHoursPhotos instead of the general
  // site list — that tag is now the one reliable signal for "which step
  // this came from," where before there was none at all. Same idea for a
  // 'Selfie'-tagged item, into its own single-item selfiePhoto slot instead.
  // Photos need a signed URL to actually render as a thumbnail (private GCS
  // bucket, same as the report screens); video/PDF rows only ever show a
  // filename/icon, never the file itself, so the raw gcsUrl is fine as-is
  // for those.
  const hydrateSitePhotos = useCallback(async (media: { type: string; gcsUrl: string; tags?: string[]; location?: MediaLocation }[]) => {
    if (!media || media.length === 0) return;
    const isRunningHours = (m: { tags?: string[] }) => !!m.tags?.includes('Running Hours');
    const isSelfie = (m: { tags?: string[] }) => !!m.tags?.includes('Selfie');
    // Complaint-code photos (tagged via complaintCodeMediaTag) get their
    // own per-card slot too (see hydrateFaultCodePhotos below) — excluded
    // here the same way Running Hours/Selfie already are, so they don't
    // also show up a second time in the general Photos grid.
    const isComplaintCode = (m: { tags?: string[] }) => !!m.tags?.some((t) => t.startsWith('Complaint Code: '));
    const runningHoursItems = media.filter(isRunningHours);
    const selfieItems = media.filter(isSelfie);
    const siteMedia = media.filter((m) => !isRunningHours(m) && !isSelfie(m) && !isComplaintCode(m));

    const photoItems = siteMedia.filter((m) => m.type === 'photo' || m.type === 'image');
    const videoItems = siteMedia.filter((m) => m.type === 'video');
    const pdfItems = siteMedia.filter((m) => m.type === 'pdf');
    // Running Hours/Selfie only ever hold photo-like items in practice
    // (both pickers are images-only), but filtered defensively all the same
    // rather than assuming.
    const runningHoursPhotoItems = runningHoursItems.filter((m) => m.type === 'photo' || m.type === 'image');
    // Retaking a selfie replaces it locally but never deletes the earlier
    // upload from the backend's own media[] array — so more than one
    // 'Selfie'-tagged item can legitimately exist there. The most recently
    // uploaded one (last in array order) is the one that actually matters.
    const selfiePhotoItem = selfieItems.filter((m) => m.type === 'photo' || m.type === 'image').slice(-1)[0];

    const allPhotoUrls = [...photoItems, ...runningHoursPhotoItems, ...(selfiePhotoItem ? [selfiePhotoItem] : [])].map((m) => m.gcsUrl);
    let signedPhotoUrls: Record<string, string> = {};
    if (allPhotoUrls.length > 0) {
      try {
        const token = await getToken();
        if (token) signedPhotoUrls = await getGcsSignedUrls(token, allPhotoUrls);
      } catch (error) {
        console.log('[Task Form Photos] Failed to sign previously-uploaded photo URLs:', error);
      }
    }

    const hydrated: SitePhoto[] = [
      ...photoItems.map((m) => ({ id: m.gcsUrl, uri: signedPhotoUrls[m.gcsUrl] || m.gcsUrl, fileName: videoFileName(m.gcsUrl), mediaType: 'image' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location })),
      ...videoItems.map((m) => ({ id: m.gcsUrl, uri: m.gcsUrl, fileName: videoFileName(m.gcsUrl), mediaType: 'video' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location })),
      ...pdfItems.map((m) => ({ id: m.gcsUrl, uri: m.gcsUrl, fileName: videoFileName(m.gcsUrl), mediaType: 'pdf' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location })),
    ];
    setSitePhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...hydrated.filter((p) => !existingIds.has(p.id))];
    });

    const hydratedRunningHours: SitePhoto[] = runningHoursPhotoItems.map((m) => ({
      id: m.gcsUrl, uri: signedPhotoUrls[m.gcsUrl] || m.gcsUrl, fileName: videoFileName(m.gcsUrl),
      mediaType: 'image' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location,
    }));
    if (hydratedRunningHours.length > 0) {
      setRunningHoursPhotos((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...hydratedRunningHours.filter((p) => !existingIds.has(p.id))];
      });
    }

    if (selfiePhotoItem) {
      setSelfiePhoto({
        id: selfiePhotoItem.gcsUrl,
        uri: signedPhotoUrls[selfiePhotoItem.gcsUrl] || selfiePhotoItem.gcsUrl,
        fileName: videoFileName(selfiePhotoItem.gcsUrl),
        mediaType: 'image',
        gcsUrl: selfiePhotoItem.gcsUrl,
        type: selfiePhotoItem.type as MediaType,
        tags: selfiePhotoItem.tags || [],
        location: selfiePhotoItem.location,
      });
    }
  }, []);

  // Restores whichever complaint codes already have a photo saved from an
  // earlier session — reads the tag itself (complaintCodeMediaTag(code)),
  // not the local uid, so this survives a reload unlike faultCodePhotos'
  // own uid keys. Called once per complaint code list build (see
  // useTaskForm.ts's own fault-code hydration effect), passing each
  // entry's {uid, code} alongside the task's raw media array.
  const hydrateFaultCodePhotos = useCallback(async (
    entries: { uid: string; code?: string }[],
    media: { type: string; gcsUrl: string; tags?: string[]; location?: MediaLocation }[]
  ) => {
    if (!entries.length || !media.length) return;
    const matches: { uid: string; item: typeof media[number] }[] = [];
    entries.forEach((entry) => {
      if (!entry.code) return;
      const tag = complaintCodeMediaTag(entry.code);
      const item = media.find((m) => (m.type === 'photo' || m.type === 'image') && m.tags?.includes(tag));
      if (item) matches.push({ uid: entry.uid, item });
    });
    if (!matches.length) return;

    let signedUrls: Record<string, string> = {};
    try {
      const token = await getToken();
      if (token) signedUrls = await getGcsSignedUrls(token, matches.map((m) => m.item.gcsUrl));
    } catch (error) {
      console.log('[Task Form Photos] Failed to sign fault code photo URLs:', error);
    }

    setFaultCodePhotos((prev) => {
      const next = { ...prev };
      matches.forEach(({ uid, item }) => {
        // Don't clobber a photo already picked this session (e.g. this
        // effect re-firing) with the server's own copy of the same thing.
        if (next[uid]) return;
        next[uid] = {
          id: item.gcsUrl, uri: signedUrls[item.gcsUrl] || item.gcsUrl, fileName: videoFileName(item.gcsUrl),
          mediaType: 'image', gcsUrl: item.gcsUrl, type: item.type as MediaType, tags: item.tags || [], location: item.location,
        };
      });
      return next;
    });
  }, []);

  // Updates the tag(s) on an already-uploaded item, matched by gcsUrl —
  // could be in either list (site photos or the running-hours photo), so
  // this just tries both; only the one that actually has a matching id
  // changes.
  const handleUpdateMediaTag = useCallback(async (gcsUrl: string, tags: string[]) => {
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      await updateCommissioningMediaTag(token, taskId, gcsUrl, tags);
      const applyTag = (photos: SitePhoto[]) => photos.map((p) => (p.gcsUrl === gcsUrl ? { ...p, tags } : p));
      setSitePhotos(applyTag);
      setRunningHoursPhotos(applyTag);
    } catch (error) {
      console.log('[Task Form Photos] Failed to update media tag:', error);
      Alert.alert('Failed to update tag', 'Please try again.');
    }
  }, [taskId]);

  return {
    sitePhotos,
    setSitePhotos,
    photoOptionsVisible,
    setPhotoOptionsVisible,
    runningHoursPhotos,
    setRunningHoursPhotos,
    step2PhotoOptionsVisible,
    setStep2PhotoOptionsVisible,
    siteQueue,
    runningHoursQueue,
    selfieQueue,
    selfiePhoto,
    handleTakeSelfie,
    handleTakeSitePhoto,
    handleRecordSiteVideo,
    handleChooseSitePhotos,
    handleRemoveSitePhoto,
    handlePickPdf,
    handleTakeRunningHoursPhoto,
    handleChooseRunningHoursPhotos,
    handleRemoveRunningHoursPhoto,
    hydrateSitePhotos,
    handleUpdateMediaTag,
    hydrateFaultCodePhotos,
    faultCodePhotos,
    faultCodeQueue,
    handleTakeFaultCodePhoto,
    handleRemoveFaultCodePhoto,
  };
}
