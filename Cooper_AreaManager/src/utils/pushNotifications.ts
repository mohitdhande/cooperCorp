import type * as NotificationsModule from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getToken } from './tokenStore';
import { registerDeviceToken, removeDeviceToken } from '../viewModel/LoginAPis';

// A stable id per install, not per session — generated once and reused for
// the lifetime of the app install, so the backend can tell "this device
// again" apart from "a new device" across logins/logouts on the same phone.
// Lives in SecureStore alongside the auth tokens (not AsyncStorage) since
// it's the same kind of long-lived device credential.
const DEVICE_ID_KEY = 'cc_device_id';

async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = `${Device.modelName ?? 'device'}-${Date.now()}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

// Call after login and on each app foreground while authenticated (see
// _layout.tsx's AppState listener) — registering again with the same
// deviceId is a harmless no-op server-side, not a duplicate registration.
// Silently no-ops (not throws) on every "can't register" path — a missing
// push token should never block or interrupt anything else the user is
// doing, it's a background nicety, not a critical request.
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return; // skip in simulator/emulator — no real push token exists there

  try {
    // Required lazily, inside this try/catch, instead of statically
    // imported at module scope: as of Expo SDK 53, expo-notifications
    // throws as soon as it's imported when running inside Expo Go (Android
    // push was removed from Expo Go entirely — see the SDK 53 release
    // notes). This file is statically imported from the root _layout.tsx,
    // so a top-level `import * as Notifications from 'expo-notifications'`
    // here previously crashed the ENTIRE app on every route whenever it
    // ran under Expo Go, not just push registration. A lazy require keeps
    // that throw contained to this one try/catch.
    const Notifications: typeof NotificationsModule = require('expo-notifications');

    const authToken = await getToken();
    if (!authToken) return; // not logged in — nothing to register against

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (status !== 'granted') {
      const result = await Notifications.requestPermissionsAsync();
      status = result.status;
    }
    if (status !== 'granted') return;

    const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
    const deviceId = await getOrCreateDeviceId();
    await registerDeviceToken(authToken, pushToken, deviceId, Platform.OS);
  } catch (error) {
    // Also the expected path in Expo Go — logged, not surfaced, since push
    // notifications require a native dev build there regardless.
    console.log('[Push Notifications] Failed to register device token:', error);
  }
}

// Call on logout, before revoking the session (POST /auth/logout) — same
// best-effort spirit as logoutApi: failing to unregister shouldn't block
// signing out, it just means this one device keeps a stale token
// server-side until it naturally stops resolving. Doesn't touch
// expo-notifications at all (just the stored deviceId), so no lazy-require
// guard needed here.
export async function unregisterPushToken(authToken: string): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId();
    await removeDeviceToken(authToken, deviceId);
  } catch (error) {
    console.log('[Push Notifications] Failed to remove device token:', error);
  }
}
