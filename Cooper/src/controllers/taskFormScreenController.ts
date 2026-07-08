import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../models/Login';

// Loads the current signed-in user details used by the task form app bar and profile access.
export function useTaskFormScreenController() {
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async () => {
    setLoading(true);

    try {
      const savedUser = await AsyncStorage.getItem('userData');

      if (!savedUser) {
        setUserData(null);
        setUserName('');
        setUserProfilePic(null);
        return;
      }

      const user: UserProfile = JSON.parse(savedUser);
      setUserData(user);
      setUserName(user.name || '');
      setUserProfilePic(user.profilePic || null);
    } catch (error) {
      console.log('Failed to load user profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  return {
    userData,
    userName,
    userProfilePic,
    loading,
    refreshUserProfile: loadUserProfile,
  };
}
