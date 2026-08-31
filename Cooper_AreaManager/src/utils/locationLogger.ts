import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform, ToastAndroid } from 'react-native';
import { devLog } from './devLog';

// Also shown as an on-device toast (see showOnScreen below) — testing this
// over a USB/Metro console connection turned out to be unreliable (Metro's
// own log relay can drop out independently of whether location capture
// itself is working), so this prints somewhere that needs no computer,
// cable, or dev-server connection at all to see. ToastAndroid is
// Android-only (this app's real-world usage so far), so this is a no-op
// on iOS rather than a crash.
function showOnScreen(message: string) {
  if (Platform.OS !== 'android') return;
  ToastAndroid.show(message, ToastAndroid.LONG);
}

// Kept on-device (not sent to the backend yet, per the same "console-only
// for now" instruction) so every successful capture survives past its own
// toast/console line — a running history to check later, not just a
// moment-in-time message that's gone the instant you miss it. Same
// AsyncStorage-list pattern as offlineQueue.ts's own sync-failure log,
// capped so it can't grow unbounded over a long session.
const LOCATION_LOG_KEY = 'cc_location_log';
const MAX_LOCATION_LOG_ENTRIES = 100;

export type LocationLogEntry = {
  id: string;
  actionLabel: string;
  latitude: number;
  longitude: number;
  address: string;
  capturedAt: number;
};

async function storeLocationLocally(entry: Omit<LocationLogEntry, 'id' | 'capturedAt'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_LOG_KEY);
    const list: LocationLogEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, capturedAt: Date.now() });
    await AsyncStorage.setItem(LOCATION_LOG_KEY, JSON.stringify(list.slice(0, MAX_LOCATION_LOG_ENTRIES)));
  } catch (error) {
    devLog('[Location] Failed to store location locally:', error);
  }
}

// Newest first — matches storeLocationLocally's own unshift order.
export async function getStoredLocationLog(): Promise<LocationLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    devLog('[Location] Failed to read stored location log:', error);
    return [];
  }
}

// Console-only for now, by explicit instruction — not sent to the backend
// yet, just proving the capture points are all wired up correctly (Accept,
// Start, every section Save button, and Complete) before this gets folded
// into an actual API payload later. Every call site fires this without
// awaiting it, so a slow/denied location request never delays or blocks
// the real action it's attached to.
export async function logLocationForAction(actionLabel: string): Promise<void> {
  devLog(`[Location] Fetching location for "${actionLabel}"...`);
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      devLog(`[Location] Permission not granted — no location captured for: ${actionLabel}`);
      showOnScreen('Location permission not granted');
      return;
    }

    // App permission and the phone's own GPS/location toggle are two
    // separate things — permission can be granted while location services
    // themselves are switched off at the OS level, in which case every
    // call below would just fail with a generic error. Checked explicitly
    // so that specific case gets its own clear "turn on GPS" message
    // instead of looking like a random failure.
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      devLog(`[Location] Location services are off — no location captured for: ${actionLabel}`);
      showOnScreen('Please turn on GPS / Location to capture your position');
      return;
    }
    // getLastKnownPositionAsync returns instantly — whatever the OS already
    // has cached from the last time anything asked for a GPS fix, no new
    // satellite lock needed. Tried first specifically because a *fresh*
    // fix (getCurrentPositionAsync) can take a long time without a network
    // to assist it, which is what was making this feel slow/unreliable
    // offline. Only falls through to waiting for a fresh fix when there's
    // truly nothing cached yet (e.g. the very first location request since
    // the phone rebooted) — still capped by the same timeout so that case
    // can't hang indefinitely either.
    const cached = await Location.getLastKnownPositionAsync({});
    const location = cached ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS fix timed out after 15s')), 15000)),
    ]);
    const { latitude, longitude } = location.coords;

    // Reverse geocoding (coordinates -> a readable address) needs its own
    // network request, unlike the GPS fix above — its success/failure here
    // doubles as the only "are we online right now" signal this function
    // has (no NetInfo in this app). Offline, it doesn't reject quickly the
    // way a normal network call does either — it can sit waiting for a
    // long time before ever failing, so this is raced against a short
    // timeout to guarantee a fast answer either way.
    try {
      const results = await Promise.race([
        Location.reverseGeocodeAsync({ latitude, longitude }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('reverse geocode timed out')), 4000)),
      ]);
      const place = results[0];
      const addressLine = place
        ? [place.name, place.street, place.city, place.region, place.postalCode, place.country].filter(Boolean).join(', ')
        : 'not found for these coordinates';

      devLog(`[Location] "${actionLabel}" — lat: ${latitude}, lng: ${longitude} -- — address: ${addressLine}`);
      showOnScreen(`📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n${addressLine}`);
      await storeLocationLocally({ actionLabel, latitude, longitude, address: addressLine });
    } catch {
      // Offline (or reverse geocoding failed for some other reason) —
      // skip the address entirely rather than showing a placeholder for
      // it. Just the coordinates: stored, then confirmed with a popup.
      devLog(`[Location] "${actionLabel}" — offline, storing coordinates only: lat: ${latitude}, lng: ${longitude}`);
      await storeLocationLocally({ actionLabel, latitude, longitude, address: '' });
      showOnScreen(`📍 Location saved (offline)\nlat: ${latitude.toFixed(5)}, lng: ${longitude.toFixed(5)}`);
    }
  } catch (error) {
    devLog(`[Location] Failed to get location for "${actionLabel}":`, error);
    showOnScreen('Could not get location (see console for details)');
  }
}
