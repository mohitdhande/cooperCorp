import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, getRefreshToken, clearTokens } from '../utils/tokenStore';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';
import { uploadProfilePic, removeProfilePic, getMyProfile, logoutApi, changeOwnPassword } from '../viewModel/LoginAPis';
import { unregisterPushToken } from '../utils/pushNotifications';
import { showCameraUnavailableAlert } from '../utils/cameraErrorAlert';
import { UserProfile } from '../models/Login';
import { MyProfileResponse } from '../models/profile.types';
import { parseApiError } from '../utils/apiError';

const PROFILE_PHOTO_SIZE = 400;

// The picker's own aspect:[1,1] crop only constrains the crop *ratio* — the
// output can still be any square resolution depending on the source photo
// (a 12MP camera shot crops to a huge square, not a 400x400 one). This
// forces the actual pixel dimensions down to exactly 400x400 before upload.
// Falls back to the original (un-resized but still square) uri on failure
// rather than blocking the whole upload over a manipulator glitch.
async function resizeToProfilePhotoSize(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);
    const image = await context.resize({ width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE }).renderAsync();
    const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return result.uri;
  } catch (error) {
    console.log('[Profile] Photo resize failed, uploading original crop instead:', error);
    return uri;
  }
}

// Handles profile loading, photo upload/removal, Change Password, and
// logout behavior for the profile screen. Change Password here is the
// self-service PUT /api/auth/change-password (requires currentPassword) —
// distinct from PUT /api/users/:id/password, which is manager-resets-
// subordinate only (see teamMemberDetailController.ts) and never used here.
export function useProfileScreenController() {
  const router = useRouter();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  // JWT-decoded cache from login — only used for userId (photo upload/
  // remove need it) and as an instant-render fallback before myProfile
  // arrives. Every displayed field (name/role/email/mobile/address/team)
  // comes from myProfile instead.
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // GET /api/me/profile — the screen's real data source: name/email/
  // mobile/address, the AM/dealer this user reports to, and their team
  // (peers for engineer, subordinates for dealer/areaManager, per the
  // backend's own role-dependent shape — not something this screen needs
  // to re-derive from permissions.ts).
  const [myProfile, setMyProfile] = useState<MyProfileResponse | null>(null);
  const [myProfileLoading, setMyProfileLoading] = useState(true);
  const [myProfileError, setMyProfileError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const savedUserData = await AsyncStorage.getItem('userData');
      if (savedUserData) {
        setProfile(JSON.parse(savedUserData));
      }
    } catch (error) {
      // A corrupted cache entry shouldn't leave this as an unhandled
      // rejection — profile just stays null and the screen keeps showing
      // its loading state, same as every other screen's !vm.profile gate.
      console.log('[Profile] Failed to load cached profile:', error);
    }

    setMyProfileLoading(true);
    setMyProfileError('');
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getMyProfile(token);
      setMyProfile(data);
    } catch (error: any) {
      console.log('[Profile] Failed to load GET /api/me/profile:', error);
      const { message } = parseApiError(error, 'Failed to load profile.');
      setMyProfileError(message);
    } finally {
      setMyProfileLoading(false);
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
            // Best-effort — revokes the refresh token server-side so it
            // can't keep minting new access tokens after this device signs
            // out. Local session state (AsyncStorage) is cleared either
            // way, even if this call fails (no network, token already
            // expired, etc.) — logout must never get the user stuck.
            try {
              const [token, refreshToken] = await Promise.all([
                getToken(),
                getRefreshToken(),
              ]);
              // Unregister this device's push token before revoking the
              // session (per unregisterPushToken's own comment) — it's
              // best-effort and never throws, so it can't block logout.
              if (token) await unregisterPushToken(token);
              if (token && refreshToken) await logoutApi(token, refreshToken);
            } catch (error) {
              console.log('[Profile] Logout API call failed (clearing session locally anyway):', error);
            }
            // clear() only wipes AsyncStorage — the tokens live in
            // SecureStore and need their own explicit clear.
            await Promise.all([AsyncStorage.clear(), clearTokens()]);
            router.replace('/screens/login');
          },
        },
      ]
    );
  }, [router]);

  const uploadAndUpdate = useCallback(async (localImageUri: string) => {
    if (!profile) return;

    console.log('[Profile] Photo upload: starting', { userId: profile.userId, localImageUri });
    setUploading(true);
    try {
      const token = await getToken();
      if (!token) {
        console.log('[Profile] Photo upload: aborted — no token in storage');
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }

      const result = await uploadProfilePic(profile.userId, token, localImageUri);
      const updatedProfile = { ...profile, profilePic: result.profilePic };

      setProfile(updatedProfile);
      // Patch the same field on myProfile too — the avatar itself always
      // loads from the authenticated /api/me/avatar proxy, not this value,
      // but UserAvatar's cacheKey reads it to know a new photo just landed
      // and the previously-cached image needs busting.
      setMyProfile((prev) => (prev ? { ...prev, profilePic: result.profilePic } : prev));
      await AsyncStorage.setItem('userData', JSON.stringify(updatedProfile));
      console.log('[Profile] Photo upload: success', { profilePic: result.profilePic });
    } catch (error: any) {
      // Surfaces the server's real reason (e.g. "Insufficient permissions")
      // instead of a generic failure message.
      const { message } = parseApiError(error, 'Could not update profile picture. Please try again.');
      console.log('[Profile] Photo upload: failed', error.response?.status, error.response?.data || error.message);
      Alert.alert('Upload Failed', message);
    } finally {
      setUploading(false);
    }
  }, [profile]);

  const handleTakePhoto = useCallback(async () => {
    console.log('[Profile] Take Photo: tapped');
    setOptionsVisible(false);

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      console.log('[Profile] Take Photo: camera permission', permission.granted ? 'granted' : 'denied');
      if (!permission.granted) {
        showCameraUnavailableAlert('permission');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled) {
        console.log('[Profile] Take Photo: canceled by user');
        return;
      }
      console.log('[Profile] Take Photo: captured', { uri: result.assets[0].uri });
      const resizedUri = await resizeToProfilePhotoSize(result.assets[0].uri);
      await uploadAndUpdate(resizedUri);
    } catch (error: any) {
      // launchCameraAsync itself throwing (no try/catch caught this before)
      // otherwise crashed or failed silently — same fix as the task forms'
      // own camera capture (useTaskFormPhotos.ts/useSrTaskForm.ts).
      console.log('[Profile] Take Photo: camera failed', error?.code || '', error?.message || error);
      showCameraUnavailableAlert('unavailable');
    }
  }, [uploadAndUpdate]);

  const handleChooseGallery = useCallback(async () => {
    console.log('[Profile] Choose from Gallery: tapped');
    setOptionsVisible(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[Profile] Choose from Gallery: media library permission', permission.granted ? 'granted' : 'denied');
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

    if (result.canceled) {
      console.log('[Profile] Choose from Gallery: canceled by user');
      return;
    }
    console.log('[Profile] Choose from Gallery: selected', { uri: result.assets[0].uri });
    const resizedUri = await resizeToProfilePhotoSize(result.assets[0].uri);
    await uploadAndUpdate(resizedUri);
  }, [uploadAndUpdate]);

  const handleRemovePhoto = useCallback(() => {
    console.log('[Profile] Remove Photo: tapped, asking for confirmation');
    setOptionsVisible(false);
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('[Profile] Remove Photo: canceled') },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!profile) return;

            console.log('[Profile] Remove Photo: confirmed, starting', { userId: profile.userId });
            setUploading(true);
            try {
              const token = await getToken();
              if (!token) {
                console.log('[Profile] Remove Photo: aborted — no token in storage');
                Alert.alert('Error', 'Session expired. Please login again.');
                return;
              }

              await removeProfilePic(profile.userId, token);

              const updatedProfile = { ...profile, profilePic: null };
              setProfile(updatedProfile);
              setMyProfile((prev) => (prev ? { ...prev, profilePic: null } : prev));
              await AsyncStorage.setItem('userData', JSON.stringify(updatedProfile));
              console.log('[Profile] Remove Photo: success');
            } catch (error: any) {
              const { message } = parseApiError(error, 'Could not remove profile picture. Please try again.');
              console.log('[Profile] Remove Photo: failed', error.response?.status, error.response?.data || error.message);
              Alert.alert('Remove Failed', message);
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  }, [profile]);

  // ── Change Password (self-service, PUT /api/auth/change-password) ──
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');

  // Fresh every time the sheet opens — no leftover text/error from a
  // previous attempt.
  const openChangePassword = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
    setChangePasswordError('');
    setChangePasswordVisible(true);
  }, []);
  const closeChangePassword = useCallback(() => setChangePasswordVisible(false), []);

  const handleUpdatePassword = useCallback(async () => {
    setChangePasswordError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordError('Please fill in all three fields.');
      return;
    }
    if (newPassword.length < 6) {
      setChangePasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('New password and confirmation do not match.');
      return;
    }

    setChangePasswordSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert('Error', 'Session expired. Please login again.');
        return;
      }
      await changeOwnPassword(token, currentPassword, newPassword);
      // No client-side "password changed" confirmation toast — the server
      // already sends an email + in-app notification for this. Just close
      // the sheet.
      setChangePasswordVisible(false);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to update password. Please try again.');
      setChangePasswordError(message);
    } finally {
      setChangePasswordSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  return {
    optionsVisible,
    setOptionsVisible,
    uploading,
    profile,
    myProfile,
    myProfileLoading,
    myProfileError,
    handleLogout,
    handleTakePhoto,
    handleChooseGallery,
    handleRemovePhoto,
    refreshProfile: loadProfile,
    changePasswordVisible, openChangePassword, closeChangePassword,
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    showPasswords, setShowPasswords,
    changePasswordSaving, changePasswordError,
    handleUpdatePassword,
  };
}
