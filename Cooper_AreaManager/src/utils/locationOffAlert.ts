import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { LocationOffReason, invalidateUploadLocationCache } from './locationLogger';

// One shared router for registerLocationOffWarning's callback — every
// screen controller that registers one (useTaskForm.ts, useSrTaskForm.ts,
// commissioningTasksController.ts, serviceTasksController.ts,
// dashboardHomeController.ts) wires this in identically instead of
// re-deciding "alert vs toast" per reason five separate times.
export function handleLocationOffWarning(reason: LocationOffReason, showToast: (message: string, type: 'success' | 'error') => void) {
  if (reason === 'gpsFailed') {
    // No single button reliably fixes a weak/absent GPS signal — a plain
    // heads-up, not an actionable alert.
    showToast("Couldn't get a GPS fix — your location wasn't recorded this time. The action still went through.", 'error');
    return;
  }
  showLocationOffAlert(reason);
}

// Shown for the two location problems that actually have a real fix the
// person can act on right from the popup — permission being off, or the
// phone's GPS/location toggle itself being off. (A failed GPS *fix* — weak
// signal, no satellite lock yet — has no single button that reliably solves
// it, so that one stays a plain toast instead; see the controllers wiring
// registerLocationOffWarning, e.g. useTaskForm.ts.)
export function showLocationOffAlert(reason: Exclude<LocationOffReason, 'gpsFailed'>) {
  if (reason === 'permission') {
    Alert.alert(
      'Location permission needed',
      "This app needs location access to record where your work happens (attached to photos, Start/Complete, etc.). Turn it on in Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            // Clears the 2-minute "no location" cache so the very next
            // photo/action actually retries instead of silently reusing
            // the failure this alert is fixing — see resolveUploadLocation
            // in locationLogger.ts. Fired here (not only on success) since
            // Linking.openSettings() gives no way to know what the user
            // actually changed before returning — a redundant retry is
            // harmless, a stuck stale cache isn't.
            invalidateUploadLocationCache();
            Linking.openSettings();
          },
        },
      ]
    );
    return;
  }

  // 'servicesOff' — permission is fine, the phone's own GPS/location toggle
  // is switched off at the OS level (separate from app permission).
  Alert.alert(
    'Turn on your location',
    "Your phone's location is switched off, so your work location isn't being recorded. Turn it on to fix this.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Turn On',
        onPress: async () => {
          if (Platform.OS === 'android') {
            try {
              // Shows Android's own native "turn on location" dialog right
              // in the app (via Google Play services) — resolves as soon
              // as the user accepts it, no need to leave the app at all.
              // Only falls back to the phone's own Settings if that dialog
              // itself isn't available (e.g. no Play services) or the
              // resolution attempt errors out.
              await Location.enableNetworkProviderAsync();
            } catch {
              Linking.openSettings();
            }
          } else {
            // iOS gives apps no way to toggle Location Services directly —
            // Settings is the only route Apple allows.
            Linking.openSettings();
          }
          // Same reasoning as the permission branch above — without this,
          // the very next photo could still silently reuse the pre-fix "no
          // location" result for up to 2 more minutes even though GPS is
          // now actually on.
          invalidateUploadLocationCache();
        },
      },
    ]
  );
}
