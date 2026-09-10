import axiosClient from './axiosClient';
import { LoginRequest } from '../models/Login';

// Authenticates the dealer and returns { token, profilePic }.
export const loginApi = async (data: LoginRequest) => {
  try {
    const response = await axiosClient.post('/api/auth/login', data);
    return response.data;
  } catch (error: any) {
    console.log('Login API Error:', error.response?.data || error.message);
    throw error;
  }
};

// No auth required — `login` accepts an email, username, or mobile number
// in the same field. Always returns the same generic message whether or
// not the account exists (by design, to avoid leaking which logins are
// real) — never branch UI logic on this response, just move to the
// OTP-entry step regardless.
export const forgotPassword = async (login: string) => {
  try {
    const response = await axiosClient.post('/api/auth/forgot-password', { login });
    return response.data; // { message: string }
  } catch (error: any) {
    console.log('Forgot Password Error:', error.response?.data || error.message);
    throw error;
  }
};

// Completes the forgot-password flow — same `login` value used to request
// the OTP, plus the 6-digit code and the new password. Requesting a new OTP
// (calling forgotPassword again) invalidates any earlier unused one, so
// only the most recently sent code is ever valid.
export const resetPasswordWithOtp = async (login: string, otp: string, newPassword: string) => {
  try {
    const response = await axiosClient.post('/api/auth/reset-password', { login, otp, newPassword });
    return response.data; // { message: string }
  } catch (error: any) {
    console.log('Reset Password Error:', error.response?.data || error.message);
    throw error;
  }
};

// Revokes the refresh token server-side — best-effort on the caller's
// side (logout should still clear local session state even if this fails,
// e.g. no network), but this is what actually invalidates it so a copy of
// the refresh token can't keep minting new access tokens after logout.
export const logoutApi = async (token: string, refreshToken: string) => {
  try {
    await axiosClient.post(
      '/api/auth/logout',
      { refreshToken },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error: any) {
    console.log('Logout API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Self-service — the logged-in user changing their OWN password, hence
// requiring currentPassword (unlike changePassword() below, which is the
// admin/manager-resets-someone-else's-password endpoint and takes no
// current password at all). Server enforces min 6 chars and rejects reuse
// of any of the user's last 5 passwords (VALIDATION_ERROR), and rejects a
// wrong currentPassword with INVALID_CREDENTIALS — this call just surfaces
// whichever the server returns. A successful call also triggers the
// server's own "Your password was changed" email + in-app notification —
// no separate client-side confirmation toast needed on top of that.
export const changeOwnPassword = async (token: string, currentPassword: string, newPassword: string) => {
  try {
    const response = await axiosClient.put(
      '/api/auth/change-password',
      { currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Change Own Password Error:', error.response?.data || error.message);
    throw error;
  }
};

// Register this device's Expo push token — call after login and after
// notification permission is granted (see utils/pushNotifications.ts).
export const registerDeviceToken = async (token: string, pushToken: string, deviceId: string, platform: string) => {
  try {
    const response = await axiosClient.post(
      '/api/me/device-token',
      { token: pushToken, deviceId, platform },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data; // { ok: true }
  } catch (error: any) {
    console.log('Register Device Token Error:', error.response?.data || error.message);
    throw error;
  }
};

// Remove this device's push token — call on logout, before revoking the
// session, so notifications stop arriving once the user has signed out.
export const removeDeviceToken = async (token: string, deviceId: string) => {
  try {
    const response = await axiosClient.delete('/api/me/device-token', {
      headers: { Authorization: `Bearer ${token}` },
      data: { deviceId },
    });
    return response.data;
  } catch (error: any) {
    console.log('Remove Device Token Error:', error.response?.data || error.message);
    throw error;
  }
};

// Fetches the profile for the given auth token.
export const getUser = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.log('GetUser Error:', error.response?.data || error.message);
    throw error;
  }
};

// The Profile screen's real data source — name/email/mobile/address, the
// AM/dealer this user reports to (context.am/context.dealer), and their
// team (role-dependent: peers for engineer, subordinates for dealer/AM).
// A superset of getUser()/api/auth/me, which only carries what's worth
// putting in the JWT.
export const getMyProfile = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get My Profile Error:', error.response?.data || error.message);
    throw error;
  }
};

export const uploadProfilePic = async (userId: string, token: string, imageUri: string) => {
  try {
    const formData = new FormData();

    // React Native FormData needs this specific object shape for files
    formData.append('photo', {
      uri: imageUri,
      name: 'profile.jpg',
      type: 'image/jpeg',
    } as any);

    const response = await axiosClient.post(
      `/api/users/${userId}/profile-pic`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.log('Upload Profile Pic Error:', error.response?.data || error.message);
    throw error;
  }
};

export const removeProfilePic = async (userId: string, token: string) => {
  try {
    const response = await axiosClient.delete(`/api/users/${userId}/profile-pic`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.log('Remove Profile Pic Error:', error.response?.data || error.message);
    throw error;
  }
};

// Server enforces min 6 chars and rejects any of the user's last 5
// passwords — this call just surfaces whatever the server rejects it for.
export const changePassword = async (userId: string, token: string, newPassword: string) => {
  try {
    const response = await axiosClient.put(
      `/api/users/${userId}/password`,
      { newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Change Password Error:', error.response?.data || error.message);
    throw error;
  }
};
