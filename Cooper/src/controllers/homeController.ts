import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// Controls the home screen drawer and the navigation actions used by the home view.
export function useHomeScreenController() {
  const router = useRouter();
  const [drawerVisible, setDrawerVisible] = useState(false);

  const openDrawer = useCallback(() => setDrawerVisible(true), []);
  const closeDrawer = useCallback(() => setDrawerVisible(false), []);

  const handleProfile = useCallback(() => {
    closeDrawer();
    router.push('/screens/profile');
  }, [closeDrawer, router]);

  const handleLogout = useCallback(async () => {
    closeDrawer();
    await AsyncStorage.clear();
    router.replace('/screens/login');
  }, [closeDrawer, router]);

  const handleBackToLogin = useCallback(async () => {
    await AsyncStorage.clear();
    router.replace('/screens/login');
  }, [router]);

  return {
    drawerVisible,
    openDrawer,
    closeDrawer,
    handleProfile,
    handleLogout,
    handleBackToLogin,
  };
}
