import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getUser, loginApi } from '../viewModel/LoginAPis';
import { LoginRequest, UserProfile } from '../models/Login';
import { parseApiError, formatRetryAfter, formatCountdown } from '../utils/apiError';
import { getPermissions } from '../constants/permissions';
import { useTeam } from '../context/TeamContext';
import { saveTokens } from '../utils/tokenStore';

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
  // Credentials go to SecureStore (encrypted), not AsyncStorage — only the
  // display profile (non-sensitive) stays in plain AsyncStorage.
  await Promise.all([
    saveTokens(token, refreshToken),
    AsyncStorage.setItem('userData', JSON.stringify(profile)),
  ]);
}

// Manages login state, validation, and navigation after a successful authentication request.
export function useLoginController() {
  const router = useRouter();
  const { refresh: refreshTeam } = useTeam();
  const params = useLocalSearchParams<{ sessionMessage?: string }>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // 423 ACCOUNT_LOCKED — a live-ticking countdown, not just a static
  // message, per the guide's own "disable the login button and show a
  // countdown" rule. Counts down once a second while > 0; the button stays
  // disabled for the whole duration, not just while a request is in flight.
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setLockoutSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockoutSecondsLeft > 0]);

  // Surfaces a forced-logout reason (session expired, account deactivated)
  // handed off by axiosClient's interceptor via the redirect params.
  useEffect(() => {
    if (params.sessionMessage) setLoginError(params.sessionMessage);
  }, [params.sessionMessage]);

  const handleLogin = useCallback(async () => {
    // Defense in depth — the button is already disabled for the whole
    // lockout window, but this guards direct calls too.
    if (lockoutSecondsLeft > 0) return;
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

      // Fire-and-forget — starts the team-roster fetch immediately so it's
      // already warm by the time the user reaches a screen that needs it,
      // rather than waiting for that screen's own mount to kick it off.
      refreshTeam();

      // Destination depends on role: engineer/dealer/areaManager land on the
      // shared jobCards screen (which self-gates by role); admin lands on home.
      router.replace(getPermissions(profileResponse.role).landingRoute);
    } catch (error: any) {
      const { code, retryAfter } = parseApiError(error);
      if (code === 'ACCOUNT_LOCKED' && typeof retryAfter === 'number' && retryAfter > 0) {
        setLockoutSecondsLeft(retryAfter);
      }
      setLoginError(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [password, router, username, refreshTeam, lockoutSecondsLeft]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // While locked out, this live-ticking message takes over the display in
  // place of whatever static loginError text was last set — counts down to
  // 0:00 instead of staying frozen at "try again in 15 minutes".
  const displayedLoginError = lockoutSecondsLeft > 0
    ? `Too many failed attempts. Try again in ${formatCountdown(lockoutSecondsLeft)}.`
    : loginError;

  return {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    loginError: displayedLoginError,
    setLoginError,
    showPassword,
    togglePasswordVisibility,
    handleLogin,
    isLockedOut: lockoutSecondsLeft > 0,
  };
}
