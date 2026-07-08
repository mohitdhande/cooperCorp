import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadCommissioningPhotos } from '@/viewModel/commisionAPi';
import { SitePhoto } from '@/models/taskForm.types';

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
  const [photosUploadError, setPhotosUploadError] = useState('');
  const [photosUploadSuccess, setPhotosUploadSuccess] = useState(false);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);

  const addPhoto = useCallback((photo: SitePhoto, target: 'site' | 'runningHours') => {
    if (target === 'site') {
      setSitePhotos(prev => [...prev, photo]);
      return;
    }
    setRunningHoursPhotos(prev => [...prev, photo]);
  }, []);

  const handleTakeSitePhoto = useCallback(async () => {
    setPhotoOptionsVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      const asset = result.assets[0];
      const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      addPhoto({ id: `${Date.now()}`, uri: asset.uri, fileName }, 'site');
    }
  }, [addPhoto]);

  const handleChooseSitePhotos = useCallback(async () => {
    setPhotoOptionsVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      result.assets.forEach((asset, index) => {
        const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}_${index}.jpg`;
        addPhoto({ id: `${Date.now()}_${index}`, uri: asset.uri, fileName }, 'site');
      });
    }
  }, [addPhoto]);

  const handleRemoveSitePhoto = useCallback((id: string) => {
    setSitePhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  const handleTakeRunningHoursPhoto = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) {
      const asset = result.assets[0];
      const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      addPhoto({ id: `${Date.now()}`, uri: asset.uri, fileName }, 'runningHours');
    }
  }, [addPhoto]);

  const handleChooseRunningHoursPhotos = useCallback(async () => {
    setStep2PhotoOptionsVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to choose photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      result.assets.forEach((asset, index) => {
        const fileName = asset.uri.split('/').pop() || `photo_${Date.now()}_${index}.jpg`;
        addPhoto({ id: `${Date.now()}_${index}`, uri: asset.uri, fileName }, 'runningHours');
      });
    }
  }, [addPhoto]);

  const handleRemoveRunningHoursPhoto = useCallback((id: string) => {
    setRunningHoursPhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  const handleSaveAllPhotos = useCallback(async () => {
    setPhotosUploading(true);
    setPhotosUploadError('');
    setPhotosUploadSuccess(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !taskId) {
        return;
      }

      const allPhotos = [...runningHoursPhotos, ...sitePhotos];
      if (allPhotos.length === 0) {
        setPhotosUploadError('Please add at least one photo before saving.');
        return;
      }

      const data = await uploadCommissioningPhotos(token, taskId, allPhotos);
      const urls = data.photos || [];
      setUploadedPhotoUrls(urls);
      setPhotosUploadSuccess(true);
      showToast('Photos uploaded successfully!', 'success');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to upload photos. Please try again.';
      setPhotosUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setPhotosUploading(false);
    }
  }, [showToast, sitePhotos, runningHoursPhotos, taskId]);

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
    photosUploadError,
    photosUploadSuccess,
    uploadedPhotoUrls,
    handleTakeSitePhoto,
    handleChooseSitePhotos,
    handleRemoveSitePhoto,
    handleTakeRunningHoursPhoto,
    handleChooseRunningHoursPhotos,
    handleRemoveRunningHoursPhoto,
    handleSaveAllPhotos,
  };
}
