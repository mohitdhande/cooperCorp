import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_URL } from '../constants/StringConstants';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Guards against multiple simultaneous redirects if several requests fail at once.
let isRedirecting = false;

const redirectToLogin = async (sessionMessage?: string) => {
  if (isRedirecting) return;
  isRedirecting = true;
  await AsyncStorage.clear();
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
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw error;

        const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        const newToken = refreshResponse.data.token;
        const newRefreshToken = refreshResponse.data.refreshToken;
        await AsyncStorage.setItem('token', newToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);

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
