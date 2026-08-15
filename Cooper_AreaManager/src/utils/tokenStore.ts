import * as SecureStore from 'expo-secure-store';

// Access token + refresh token live here, not AsyncStorage — SecureStore is
// encrypted at rest (iOS Keychain / Android Keystore), AsyncStorage is
// plain unencrypted storage. Everything else about the session (userData,
// display profile) stays in AsyncStorage; only the two actual credentials
// belong here.
const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refreshToken';

export async function saveTokens(token: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

// Only the access token changes on a silent refresh — the refresh token
// itself is long-lived (30 days) and isn't reissued on every refresh call.
export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
