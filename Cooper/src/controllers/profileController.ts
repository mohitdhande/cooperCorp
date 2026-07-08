import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { uploadProfilePic, removeProfilePic } from '../viewModel/LoginAPis';
import { UserProfile } from '../models/Login';

// Handles profile loading, photo upload/removal, and logout behavior for the profile screen.
export function useProfileScreenController() {
  const router = useRouter();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [imageError, setImageError] = useState(false);

  const loadProfile = useCallback(async () => {
    const savedUserData = await AsyncStorage.getItem('userData');
    if (savedUserData) {
      setProfile(JSON.parse(savedUserData));
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/screens/login');
          },
        },
      ]
    );
  }, [router]);

  const uploadAndUpdate = useCallback(async (localImageUri: string) => {
    if (!profile) return;

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const result = await uploadProfilePic(profile.userId, token, localImageUri);
      const updatedProfile = { ...profile, profilePic: result.profilePic };

      setProfile(updatedProfile);
      setImageError(false);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedProfile));
    } catch (error: any) {
      console.log('Upload failed:', error.response?.data || error.message);
      Alert.alert('Upload Failed', 'Could not update profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [profile]);

  const handleTakePhoto = useCallback(async () => {
    setOptionsVisible(false);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      await uploadAndUpdate(result.assets[0].uri);
    }
  }, [uploadAndUpdate]);

  const handleChooseGallery = useCallback(async () => {
    setOptionsVisible(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Gallery access is required to choose a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      await uploadAndUpdate(result.assets[0].uri);
    }
  }, [uploadAndUpdate]);

  const handleRemovePhoto = useCallback(() => {
    setOptionsVisible(false);
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!profile) return;

            setUploading(true);
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert('Error', 'Session expired. Please login again.');
                return;
              }

              await removeProfilePic(profile.userId, token);

              const updatedProfile = { ...profile, profilePic: null };
              setProfile(updatedProfile);
              setImageError(false);
              await AsyncStorage.setItem('userData', JSON.stringify(updatedProfile));
            } catch (error: any) {
              console.log('Remove failed:', error.response?.data || error.message);
              Alert.alert('Remove Failed', 'Could not remove profile picture. Please try again.');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  }, [profile]);

  return {
    optionsVisible,
    setOptionsVisible,
    uploading,
    profile,
    imageError,
    setImageError,
    handleLogout,
    handleTakePhoto,
    handleChooseGallery,
    handleRemovePhoto,
    refreshProfile: loadProfile,
  };
}
