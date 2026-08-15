import AsyncStorage from '@react-native-async-storage/async-storage';

// A generic "last known good" cache for GET responses — read from when a
// live fetch fails due to no network, so a screen shows the last thing it
// successfully loaded instead of going blank/erroring. Not a replacement
// for a real fetch; every cache write happens right after a real one
// succeeds, and callers should always prefer a fresh network response over
// this when one's available.
const CACHE_PREFIX = 'cc_cache_';

export async function cacheData(key: string, data: any): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch (error) {
    console.log('[Offline Cache] Failed to cache', key, error);
  }
}

export async function getCachedData<T = any>(key: string): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.log('[Offline Cache] Failed to read', key, error);
    return null;
  }
}
