import { Alert, AppState, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Shown whenever the camera can't be used — either the OS-level permission
// was denied, or launchCameraAsync itself failed after permission was
// already granted. Both cases can genuinely be a device-level issue: some
// phone brands (Xiaomi/MIUI, Oppo/ColorOS, Vivo/FuntouchOS, Realme — very
// common on Indian devices) have their own separate privacy manager that
// silently blocks the camera even when Android's own permission shows
// "granted", so a plain "try again" often isn't the actual fix. "Open
// Settings" jumps straight to this app's system settings page — the most
// useful next step either way, since that's also where those OEMs' own
// per-app privacy toggles usually live.
export function showCameraUnavailableAlert(reason: 'permission' | 'unavailable') {
  const title = reason === 'permission' ? 'Camera permission needed' : 'Camera unavailable';
  const message = reason === 'permission'
    ? "This app needs camera access to take photos/videos. If you've already allowed it and this keeps showing up, some phones (Xiaomi, Oppo, Vivo, Realme) have their own extra privacy switch for the camera, separate from the normal Android permission — check this app's permissions in your phone's Settings."
    : "Could not open the camera. If this keeps happening, check this app's camera permission in your phone's Settings — some phones (Xiaomi, Oppo, Vivo, Realme) block the camera at the phone level even when it looks allowed.";
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}

// Wraps ImagePicker.launchCameraAsync with a silent-failure detector — the
// same OEM privacy managers described above can block a camera launch with
// zero feedback: no error thrown, no result returned, the promise just
// never settles, so the button tap looks like it did nothing at all (no
// alert, no way out). A real camera launch always takes the app out of
// 'active' (the camera activity takes over the screen); if that hasn't
// happened within a few seconds, the launch was blocked before it ever
// reached the user, so this shows the same "unavailable" alert instead of
// leaving the screen stuck forever.
//
// Callers should treat a `null` return the same as "do nothing further" —
// the alert has already fired, and a late result arriving after that
// shouldn't also silently queue a photo or double up on feedback.
export async function launchCameraSafely(options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult | null> {
  let cameraOpened = false;
  let bailedOut = false;
  // Not started until the caller's own permission check has already
  // succeeded — the permission prompt itself can also briefly change
  // AppState, which would otherwise look like a real camera launch and
  // mask a genuinely silent failure right after it.
  const appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') cameraOpened = true;
  });
  const silentFailureTimer = setTimeout(() => {
    if (!cameraOpened) {
      bailedOut = true;
      showCameraUnavailableAlert('unavailable');
    }
  }, 4000);
  try {
    const result = await ImagePicker.launchCameraAsync(options);
    return bailedOut ? null : result;
  } finally {
    clearTimeout(silentFailureTimer);
    appStateSub.remove();
  }
}
