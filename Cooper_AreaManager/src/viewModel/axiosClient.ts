import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_URL } from '../constants/StringConstants';
import { getToken, getRefreshToken, saveTokens, saveToken, clearTokens } from '../utils/tokenStore';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Centralized Authorization header — most call sites across the app still
// also pass it explicitly themselves (harmless duplication, same value
// either way, not worth the risk of touching ~80 call sites to remove),
// but this is what actually makes it mandatory: any call that forgets to
// attach it is still authenticated correctly from here on.
axiosClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Guards against multiple simultaneous redirects if several requests fail at once.
let isRedirecting = false;

// Also persisted (not just handed off as a route param) — if the session was
// already cleared by the time the app is next opened (a cold reload after
// the fact, not a live redirect the user was watching happen), there'd be no
// navigation event to attach a param to. authController reads and consumes
// this once on mount so a reload still explains why you're logged out.
const SESSION_MESSAGE_KEY = 'sessionMessage';

const redirectToLogin = async (sessionMessage?: string) => {
  if (isRedirecting) return;
  isRedirecting = true;
  // Tokens live in SecureStore, not AsyncStorage — clear() only wipes the
  // latter, so the credentials need their own explicit clear too.
  await Promise.all([AsyncStorage.clear(), clearTokens()]);
  if (sessionMessage) {
    await AsyncStorage.setItem(SESSION_MESSAGE_KEY, sessionMessage);
  }
  router.replace(
    sessionMessage ? { pathname: '/screens/login', params: { sessionMessage } } : '/screens/login'
  );
  setTimeout(() => { isRedirecting = false; }, 1000);
};

// Queues requests that 401'd while a refresh is already in flight, so
// concurrent calls share one refresh instead of each triggering their own.
let isRefreshing = false;
let pendingQueue: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

const resolveQueue = (error: any, token: string | null) => {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token as string)));
  pendingQueue = [];
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const url: string = originalRequest.url || '';
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/refresh');
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    // Account deactivated mid-session — nothing to retry, just sign out.
    if (status === 403 && code === 'ACCOUNT_INACTIVE') {
      await redirectToLogin('Your account has been deactivated. Please contact your admin.');
      return Promise.reject(error);
    }

    // Expired/invalid access token — silently refresh once, then retry the
    // original request. Anything from the login/refresh endpoints themselves
    // is left alone so their callers can show the real error (wrong password,
    // expired refresh token, etc.) instead of looping back through here.
    if (status === 401 && !isAuthRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
              resolve(axiosClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw error;

        const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        const newToken = refreshResponse.data.token;
        const newRefreshToken = refreshResponse.data.refreshToken;
        // The refresh endpoint only reissues the access token — the refresh
        // token itself is long-lived and isn't rotated on every call (see
        // tokenStore.ts). Only overwrite it if the backend actually sent a
        // new one; otherwise saveTokens(newToken, undefined) would corrupt
        // the still-valid stored refresh token, killing the session on the
        // very next refresh attempt even though it hadn't really expired.
        if (newRefreshToken) {
          await saveTokens(newToken, newRefreshToken);
        } else {
          await saveToken(newToken);
        }

        resolveQueue(null, newToken);
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` };
        return axiosClient(originalRequest);
      } catch (refreshError: any) {
        resolveQueue(refreshError, null);
        const refreshCode = refreshError.response?.data?.error?.code;
        console.log('[AUTH] Refresh failed — clearing session and redirecting to login:', refreshCode || refreshError.message);
        await redirectToLogin(
          refreshCode === 'ACCOUNT_INACTIVE'
            ? 'Your account has been deactivated. Please contact your admin.'
            : 'Your session has expired. Please log in again.'
        );
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
