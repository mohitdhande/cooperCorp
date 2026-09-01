import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getUser, loginApi } from '../viewModel/LoginAPis';
import { LoginRequest, UserProfile } from '../models/Login';
import { parseApiError, formatRetryAfter } from '../utils/apiError';

// Maps API/network errors to a short, user-facing message.
export function getLoginErrorMessage(error: any): string {
  const { code, message, retryAfter } = parseApiError(error, 'Invalid credentials');

  switch (code) {
    case 'VALIDATION_ERROR':
      return message || 'Please enter your username and password.';
    case 'INVALID_CREDENTIALS':
      return 'Invalid credentials';
    case 'ACCOUNT_INACTIVE':
      return 'Your account has been deactivated. Please contact your admin.';
    case 'ACCOUNT_LOCKED':
      return `Too many failed attempts. Try again in ${formatRetryAfter(retryAfter ?? 900)}.`;
    default:
      return message;
  }
}

export async function persistAuthSession(token: string, refreshToken: string, profile: UserProfile) {
  await AsyncStorage.multiSet([
    ['token', token],
    ['refreshToken', refreshToken],
    ['userData', JSON.stringify(profile)],
  ]);
}

// Manages login state, validation, and navigation after a successful authentication request.
export function useLoginController() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionMessage?: string }>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Surfaces a forced-logout reason (session expired, account deactivated)
  // handed off by axiosClient's interceptor via the redirect params.
  useEffect(() => {
    if (params.sessionMessage) setLoginError(params.sessionMessage);
  }, [params.sessionMessage]);

  const handleLogin = useCallback(async () => {
    if (!username || !password) {
      setLoginError('Please enter your credentials.');
      return;
    }

    setLoading(true);
    setLoginError('');

    try {
      const request: LoginRequest = { username, password };
      const loginResponse = await loginApi(request);
      const token = loginResponse.token;
      const refreshToken = loginResponse.refreshToken;
      const profileResponse: UserProfile = await getUser(token);

      profileResponse.profilePic = loginResponse.profilePic;
      await persistAuthSession(token, refreshToken, profileResponse);

      if (profileResponse.role === 'admin') {
        router.replace('/screens/home');
      } else if (profileResponse.role === 'engineer') {
        router.replace('/screens/commissioningTasks');
      } else {
        router.replace('/screens/home');
      }
    } catch (error: any) {
      setLoginError(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [password, router, username]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  return {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    loginError,
    setLoginError,
    showPassword,
    togglePasswordVisibility,
    handleLogin,
  };
}
