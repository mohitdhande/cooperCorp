import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getToken } from '../../utils/tokenStore';
import { uploadOneCommissioningMedia, updateCommissioningMediaTag, getGcsSignedUrls } from '../../viewModel/commisionAPi';
import { SitePhoto, MediaType, MediaLocation } from '../../models/taskForm.types';
import { getPhotoValidationError, getPdfValidationError, partitionValidPhotos } from '../../utils/photoValidation';
import { videoFileName } from '../../utils/reportFormatters';
import { useMediaUploadQueue, QueueItem, PickedAsset } from '../shared/useMediaUploadQueue';
import { enqueuePendingMedia } from '../../utils/pendingMediaQueue';

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

  const siteQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setSitePhotos((prev) => [...prev, toSitePhoto(item)]), []),
    isEngineer,
    persistSiteFailure
  );
  // Every Running Hours photo confirms pre-tagged 'Running Hours' by
  // default (defaultTags below) — the tag picker on this photo can still
  // re-tag it afterward if that's ever genuinely needed, same as any other
  // item, it just doesn't start blank.
  const runningHoursQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setRunningHoursPhotos((prev) => [...prev, toSitePhoto(item)]), []),
    isEngineer,
    persistRunningHoursFailure,
    ['Running Hours']
  );

  // Android's native camera intent can't mix photo and video capture in
  // one launch (ACTION_IMAGE_CAPTURE vs ACTION_VIDEO_CAPTURE are separate
  // intents) — passing mediaTypes: ['images', 'videos'] to launchCameraAsync
  // silently falls back to photo-only there, with no video toggle shown.
  // So "Take Photo" and "Record Video" are two distinct camera launches,
  // each requesting only its own type; this works on iOS too.
  const captureFromCamera = useCallback(async (mediaType: 'images' | 'videos', target: 'site' | 'runningHours') => {
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
        Alert.alert('Permission needed', `Camera access is required to ${mediaType === 'videos' ? 'record a video' : 'take a photo'}.`);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: [mediaType],
        videoMaxDuration: 60,
        quality: 0.7,
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
        (target === 'site' ? siteQueue : runningHoursQueue).startBatch([picked]);
      }
    } catch (error) {
      // A native picker/camera failure (no camera, OS-level glitch) would
      // otherwise fail silently — the button tap would just do nothing
      // with no feedback.
      console.log('[Task Form Photos] Camera failed:', error);
      Alert.alert('Camera unavailable', 'Could not open the camera. Please try again.');
    }
  }, [siteQueue, runningHoursQueue]);

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
  // this came from," where before there was none at all. Photos need a
  // signed URL to actually render as a thumbnail (private GCS bucket, same
  // as the report screens); video/PDF rows only ever show a filename/icon,
  // never the file itself, so the raw gcsUrl is fine as-is for those.
  const hydrateSitePhotos = useCallback(async (media: { type: string; gcsUrl: string; tags?: string[]; location?: MediaLocation }[]) => {
    if (!media || media.length === 0) return;
    const isRunningHours = (m: { tags?: string[] }) => !!m.tags?.includes('Running Hours');
    const runningHoursItems = media.filter(isRunningHours);
    const siteMedia = media.filter((m) => !isRunningHours(m));

    const photoItems = siteMedia.filter((m) => m.type === 'photo' || m.type === 'image');
    const videoItems = siteMedia.filter((m) => m.type === 'video');
    const pdfItems = siteMedia.filter((m) => m.type === 'pdf');
    // Running Hours only ever holds photo-like items in practice (its own
    // picker is images-only), but filtered defensively all the same rather
    // than assuming.
    const runningHoursPhotoItems = runningHoursItems.filter((m) => m.type === 'photo' || m.type === 'image');

    const allPhotoUrls = [...photoItems, ...runningHoursPhotoItems].map((m) => m.gcsUrl);
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
  };
}
