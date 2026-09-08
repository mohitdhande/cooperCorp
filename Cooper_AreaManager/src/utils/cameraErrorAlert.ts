import { Alert, Linking } from 'react-native';

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
