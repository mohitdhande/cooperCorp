import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getToken } from '../../utils/tokenStore';
import { uploadCommissioningPhotos, uploadCommissioningVideos } from '../../viewModel/commisionAPi';
import { SitePhoto } from '../../models/taskForm.types';
import { parseApiError } from '../../utils/apiError';
import { getPhotoValidationError, getPdfValidationError, partitionValidPhotos } from '../../utils/photoValidation';

type UseTaskFormPhotosArgs = {
  taskId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
};

// Keeps photo capture, selection, and upload behavior isolated from the screen component.
export function useTaskFormPhotos({ taskId, showToast }: UseTaskFormPhotosArgs) {
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);
  const [runningHoursPhotos, setRunningHoursPhotos] = useState<SitePhoto[]>([]);
  const [step2PhotoOptionsVisible, setStep2PhotoOptionsVisible] = useState(false);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [photosUploadProgress, setPhotosUploadProgress] = useState(0);
  const [photosUploadError, setPhotosUploadError] = useState('');
  const [photosUploadSuccess, setPhotosUploadSuccess] = useState(false);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [videosUploading, setVideosUploading] = useState(false);
  const [videosUploadProgress, setVideosUploadProgress] = useState(0);
  const [videosUploadError, setVideosUploadError] = useState('');
  const [videosUploadSuccess, setVideosUploadSuccess] = useState(false);

  const addPhoto = useCallback((photo: SitePhoto, target: 'site' | 'runningHours') => {
    if (target === 'site') {
      setSitePhotos(prev => [...prev, photo]);
      return;
    }
    setRunningHoursPhotos(prev => [...prev, photo]);
  }, []);

  // Android's native camera intent can't mix photo and video capture in
  // one launch (ACTION_IMAGE_CAPTURE vs ACTION_VIDEO_CAPTURE are separate
  // intents) — passing mediaTypes: ['images', 'videos'] to launchCameraAsync
  // silently falls back to photo-only there, with no video toggle shown.
  // So "Take Photo" and "Record Video" are two distinct camera launches,
  // each requesting only its own type; this works on iOS too.
  const captureFromCamera = useCallback(async (mediaType: 'images' | 'videos', target: 'site' | 'runningHours') => {
    try {
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
        addPhoto({ id: `${Date.now()}`, uri: asset.uri, fileName, mediaType: isVideo ? 'video' : 'image' }, target);
      }
    } catch (error) {
      // A native picker/camera failure (no camera, OS-level glitch) would
      // otherwise fail silently — the button tap would just do nothing
      // with no feedback.
      console.log('[Task Form Photos] Camera failed:', error);
      Alert.alert('Camera unavailable', 'Could not open the camera. Please try again.');
    }
  }, [addPhoto]);

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
        valid.forEach((asset, index) => {
          const isVideo = asset.type === 'video';
          const fileName = asset.uri.split('/').pop() || `${isVideo ? 'video' : 'photo'}_${Date.now()}_${index}.${isVideo ? 'mp4' : 'jpg'}`;
          addPhoto({ id: `${Date.now()}_${index}`, uri: asset.uri, fileName, mediaType: isVideo ? 'video' : 'image' }, 'site');
        });
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the photo gallery. Please try again.');
    }
  }, [addPhoto]);

  const handleRemoveSitePhoto = useCallback((id: string) => {
    setSitePhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  // Documents card's own picker (Step 6 only) — device storage only (no
  // camera option; a PDF can't be "captured"). No dedicated document
  // endpoint exists on the backend, so picked PDFs are tagged
  // mediaType: 'pdf' and ride the same GCS video flow as recorded videos
  // (handleSaveAllVideos below) — same as the SR form's own Documents card.
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
      const newPdfs = valid.map((asset, i) => ({
        id: `${Date.now()}-${i}`,
        uri: asset.uri,
        fileName: asset.name || `document_${i + 1}.pdf`,
        mediaType: 'pdf' as const,
        fileSize: asset.size,
      }));
      setSitePhotos(prev => [...prev, ...newPdfs]);

      const skippedCount = result.assets.length - valid.length;
      if (skippedCount > 0) {
        Alert.alert('Some files were skipped', `${skippedCount} file${skippedCount > 1 ? 's were' : ' was'} skipped: ${Array.from(reasons).join(' ')}`);
      }
    } catch (error) {
      console.log('[Task Form Photos] PDF picker failed:', error);
      Alert.alert('Storage unavailable', 'Could not open device storage. Please try again.');
    }
  }, []);

  const handleTakeRunningHoursPhoto = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    await captureFromCamera('images', 'runningHours');
  }, [captureFromCamera]);

  const handleRecordRunningHoursVideo = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    await captureFromCamera('videos', 'runningHours');
  }, [captureFromCamera]);

  const handleChooseRunningHoursPhotos = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
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
        valid.forEach((asset, index) => {
          const isVideo = asset.type === 'video';
          const fileName = asset.uri.split('/').pop() || `${isVideo ? 'video' : 'photo'}_${Date.now()}_${index}.${isVideo ? 'mp4' : 'jpg'}`;
          addPhoto({ id: `${Date.now()}_${index}`, uri: asset.uri, fileName, mediaType: isVideo ? 'video' : 'image' }, 'runningHours');
        });
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the photo gallery. Please try again.');
    }
  }, [addPhoto]);

  const handleRemoveRunningHoursPhoto = useCallback((id: string) => {
    setRunningHoursPhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  // Returns whether the upload succeeded so callers (e.g. the step 6
  // "Complete" action) can decide whether it's safe to move on.
  const handleSaveAllPhotos = useCallback(async (): Promise<boolean> => {
    setPhotosUploading(true);
    setPhotosUploadProgress(0);
    setPhotosUploadError('');
    setPhotosUploadSuccess(false);
    try {
      const token = await getToken();
      if (!token || !taskId) return false;

      // Videos and PDFs go through their own handleSaveAllVideos (GCS
      // upload+confirm flow, no multipart endpoint for either) — excluded
      // here so they aren't sent to this image-only upload call. See
      // SitePhoto.mediaType.
      const allPhotos = [...runningHoursPhotos, ...sitePhotos].filter(p => p.mediaType !== 'video' && p.mediaType !== 'pdf');
      if (allPhotos.length === 0) {
        setPhotosUploadError('Please add at least one photo before saving.');
        return false;
      }

      const data = await uploadCommissioningPhotos(token, taskId, allPhotos, setPhotosUploadProgress);
      const urls = data.photos || [];
      setUploadedPhotoUrls(urls);
      setPhotosUploadSuccess(true);
      showToast('Photos uploaded successfully!', 'success');
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to upload photos. Please try again.').message;
      setPhotosUploadError(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setPhotosUploading(false);
    }
  }, [showToast, sitePhotos, runningHoursPhotos, taskId]);

  // Videos (and PDFs — see handlePickPdf above) are optional (unlike
  // photos, which are required before saving) — none added is just a
  // no-op success, not an error. Each file uploads to GCS and confirms
  // individually inside uploadCommissioningVideos, so a failure partway
  // through still keeps whatever confirmed successfully; the remaining
  // (still-local) items stay in sitePhotos for the user to retry via the
  // same Complete tap. Only sitePhotos (Step 6) can hold pdf/video items —
  // runningHoursPhotos (Step 2) never does, so this doesn't need to
  // consider that list at all.
  const handleSaveAllVideos = useCallback(async (): Promise<boolean> => {
    const videosOnly = sitePhotos.filter(p => p.mediaType === 'video' || p.mediaType === 'pdf');
    if (videosOnly.length === 0) return true;
    setVideosUploading(true);
    setVideosUploadProgress(0);
    setVideosUploadError('');
    setVideosUploadSuccess(false);
    try {
      const token = await getToken();
      if (!token || !taskId) return false;
      await uploadCommissioningVideos(token, taskId, videosOnly.map(v => ({ uri: v.uri, fileName: v.fileName })), setVideosUploadProgress);
      setVideosUploadSuccess(true);
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to upload video. Please try again.').message;
      setVideosUploadError(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setVideosUploading(false);
    }
  }, [showToast, sitePhotos, taskId]);

  return {
    sitePhotos,
    setSitePhotos,
    photoOptionsVisible,
    setPhotoOptionsVisible,
    runningHoursPhotos,
    setRunningHoursPhotos,
    step2PhotoOptionsVisible,
    setStep2PhotoOptionsVisible,
    photosUploading,
    photosUploadProgress,
    photosUploadError,
    photosUploadSuccess,
    uploadedPhotoUrls,
    videosUploading,
    videosUploadProgress,
    videosUploadError,
    videosUploadSuccess,
    handleTakeSitePhoto,
    handleRecordSiteVideo,
    handleChooseSitePhotos,
    handleRemoveSitePhoto,
    handlePickPdf,
    handleTakeRunningHoursPhoto,
    handleRecordRunningHoursVideo,
    handleChooseRunningHoursPhotos,
    handleRemoveRunningHoursPhoto,
    handleSaveAllPhotos,
    handleSaveAllVideos,
  };
}
