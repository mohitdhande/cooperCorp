import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getToken } from '../../utils/tokenStore';
import { uploadCommissioningPhotos, uploadOneCommissioningVideoOrPdf, getGcsSignedUrls } from '../../viewModel/commisionAPi';
import { SitePhoto } from '../../models/taskForm.types';
import { getPhotoValidationError, getPdfValidationError, partitionValidPhotos } from '../../utils/photoValidation';
import { splitMediaByExtension, videoFileName } from '../../utils/reportFormatters';
import { useMediaUploadQueue, QueueItem, PickedAsset } from '../shared/useMediaUploadQueue';

type UseTaskFormPhotosArgs = {
  taskId: string;
};

function toSitePhoto(item: QueueItem): SitePhoto {
  return { id: item.localId, uri: item.uri, fileName: item.fileName, mediaType: item.kind === 'photo' ? 'image' : item.kind, fileSize: item.fileSize };
}

// Keeps photo capture, selection, and upload behavior isolated from the
// screen component. Every photo/video/PDF now uploads immediately (via
// useMediaUploadQueue) the moment it's picked/captured, rather than sitting
// local until a final "Complete" batch upload — see MediaUploadOverlay for
// the overlay this drives.
export function useTaskFormPhotos({ taskId }: UseTaskFormPhotosArgs) {
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [runningHoursPhotos, setRunningHoursPhotos] = useState<SitePhoto[]>([]);
  const [step2PhotoOptionsVisible, setStep2PhotoOptionsVisible] = useState(false);

  // Both Step 2 (running-hours, images only) and Step 6 (site, photo/video/
  // PDF) hit the same commissioning endpoints for the same taskId — only
  // which local list a successful item lands in (onItemSucceeded) differs,
  // which is exactly what lets one shared hook drive both.
  const uploaders = useMemo(() => ({
    uploadPhoto: async (file: { uri: string; fileName: string }, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      await uploadCommissioningPhotos(token, taskId, [file], onProgress, signal);
    },
    uploadVideoOrPdf: async (file: { uri: string; fileName: string }, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      await uploadOneCommissioningVideoOrPdf(token, taskId, file, onProgress, signal);
    },
  }), [taskId]);

  const siteQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setSitePhotos((prev) => [...prev, toSitePhoto(item)]), [])
  );
  const runningHoursQueue = useMediaUploadQueue(
    uploaders,
    useCallback((item: QueueItem) => setRunningHoursPhotos((prev) => [...prev, toSitePhoto(item)]), [])
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
        const picked: PickedAsset = { uri: asset.uri, fileName, fileSize: asset.fileSize, kind: isVideo ? 'video' : 'photo' };
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
          return { uri: asset.uri, fileName, fileSize: asset.fileSize, kind: isVideo ? 'video' : 'photo' };
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

  const handleTakeRunningHoursPhoto = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    await captureFromCamera('images', 'runningHours');
  }, [captureFromCamera]);

  const handleChooseRunningHoursPhotos = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
        return;
      }

      // Images only — Step 2's running-hours upload never takes video or
      // PDF, unlike Step 6's own site photos.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled) {
        const { valid, skippedMessage } = partitionValidPhotos(result.assets);
        const picked: PickedAsset[] = valid.map((asset, index) => ({
          uri: asset.uri,
          fileName: asset.uri.split('/').pop() || `photo_${Date.now()}_${index}.jpg`,
          fileSize: asset.fileSize,
          kind: 'photo',
        }));
        if (picked.length > 0) runningHoursQueue.startBatch(picked);
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the photo gallery. Please try again.');
    }
  }, [runningHoursQueue]);

  const handleRemoveRunningHoursPhoto = useCallback((id: string) => {
    setRunningHoursPhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  // Shows whatever was already uploaded in an earlier session — called once
  // when the task detail first loads (see useTaskForm.ts), so reopening a
  // task you'd already added photos/videos/PDFs to doesn't look empty just
  // because this session's own sitePhotos/runningHoursPhotos state starts
  // fresh. Commissioning's task.photos is one flat array with no per-item
  // record of which step (2 or 6) an item was originally added from — the
  // backend genuinely can't tell them apart (both hit the same endpoint) —
  // so everything hydrates into sitePhotos (Step 6's "everything" list)
  // rather than guessing a split. Photos need a signed URL to actually
  // render as a thumbnail (private GCS bucket, same as the report screens);
  // video/PDF rows only ever show a filename/icon, never the file itself,
  // so the raw URL is fine as-is for those.
  const hydrateSitePhotos = useCallback(async (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    const { photos: photoUrls, videos: videoUrls, documents: pdfUrls } = splitMediaByExtension(urls);

    let signedPhotoUrls: Record<string, string> = {};
    if (photoUrls.length > 0) {
      try {
        const token = await getToken();
        if (token) signedPhotoUrls = await getGcsSignedUrls(token, photoUrls);
      } catch (error) {
        console.log('[Task Form Photos] Failed to sign previously-uploaded photo URLs:', error);
      }
    }

    const hydrated: SitePhoto[] = [
      ...photoUrls.map((url) => ({ id: url, uri: signedPhotoUrls[url] || url, fileName: videoFileName(url), mediaType: 'image' as const })),
      ...videoUrls.map((url) => ({ id: url, uri: url, fileName: videoFileName(url), mediaType: 'video' as const })),
      ...pdfUrls.map((url) => ({ id: url, uri: url, fileName: videoFileName(url), mediaType: 'pdf' as const })),
    ];
    setSitePhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...hydrated.filter((p) => !existingIds.has(p.id))];
    });
  }, []);

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
  };
}
