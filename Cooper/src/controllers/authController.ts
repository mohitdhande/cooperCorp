import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getUser, loginApi } from '../viewModel/LoginAPis';
import { LoginRequest, UserProfile } from '../models/Login';

export function getLoginErrorMessage(error: any): string {
  const apiError = error?.response?.data?.error;
  const apiMessage = apiError?.message || error?.response?.data?.message;

  if (error?.message === 'Network Error') {
    return 'No internet connection. Please check your network.';
  }

  if (apiError?.code === 'INVALID_CREDENTIALS') {
    return 'Invalid credentials';
  }

  if (apiMessage) {
    return apiMessage;
  }

  return 'Invalid credentials';
}

export async function persistAuthSession(token: string, profile: UserProfile) {
  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('userData', JSON.stringify(profile));
}

// Manages login state, validation, and navigation after a successful authentication request.
export function useLoginController() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
      const profileResponse: UserProfile = await getUser(token);

      profileResponse.profilePic = loginResponse.profilePic;
      await persistAuthSession(token, profileResponse);

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
