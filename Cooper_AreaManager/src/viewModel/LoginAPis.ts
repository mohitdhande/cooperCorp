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
