import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, Image, StyleSheet, Text } from 'react-native';
import { ErrorBoundary } from '@/_components/ErrorBoundary';
import * as SplashScreen from 'expo-splash-screen';
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const savedUserData = await AsyncStorage.getItem('userData'); // 👈 Fetch saved profile json string

        // If BOTH token and profile data exist, forward them safely with params
       if (token && savedUserData) {
  const parsedUser = JSON.parse(savedUserData);
  
  if (parsedUser.role === 'admin') {
    router.replace('/screens/home');
  } else if (parsedUser.role === 'engineer') {
    router.replace('/screens/commissioningTasks');
  } else {
    router.replace('/screens/home');
  }
}

      } catch (error) {
        console.log('Error checking auth token status:', error);
      } finally {
        setIsLoading(false);
        await SplashScreen.hideAsync();
        console.log('[SPLASH] Native splash hidden — app ready');
      }
    };

    checkLoginStatus();
  }, []);

if (isLoading) {
    return (
      <View style={splashStyles.container}>
        <Image source={require('../../assets/splash_logo.png')} style={splashStyles.logo} />
        <Text style={splashStyles.brandTitle}>Cooper Corp</Text>
        <Text style={splashStyles.brandSubtitle}>Gentset E-FSR</Text>
        <ActivityIndicator size="small" color="#F26722" style={{ marginTop: 30 }} />
      </View>
    );
  }

  return (
   <ErrorBoundary>
     <Stack>
  <Stack.Screen name="screens/login" options={{ headerShown: false }} />
  <Stack.Screen name="screens/home" options={{ headerShown: false }} />
  <Stack.Screen name="screens/profile" options={{ headerShown: false }} />
  <Stack.Screen name="screens/commissioningTasks" options={{ headerShown: false }} />
  <Stack.Screen name="screens/taskForm" options={{ headerShown: false }} />
  <Stack.Screen name="screens/taskReport" options={{ headerShown: false }} />
</Stack>
   </ErrorBoundary>
  );

}
 

const splashStyles = StyleSheet.create({
 
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#241D67',  // ← was '#F5F7FA'
  },
  logo: {
    width: 140, height: 140, marginBottom: 16,
    borderRadius: 70,  // make it circular to avoid white corners
  },
  brandTitle: {
    fontSize: 24, fontWeight: '700',
    color: '#FFFFFF',  // ← was '#241D67', now white on dark bg
  },
  brandSubtitle: {
    fontSize: 14, color: '#F26722',
    fontWeight: '600', marginTop: 4,
  }
});