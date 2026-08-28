import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/_components/ErrorBoundary';
import { TeamProvider } from '../context/TeamContext';
import * as SplashScreen from 'expo-splash-screen';
import { View, AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';
import { useFonts } from 'expo-font';
import {
  Inter_300Light, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { runSync } from '../utils/syncEngine';
import { runMediaSync } from '../utils/mediaSyncEngine';

SplashScreen.preventAutoHideAsync();

// The Stack is always mounted — the splash/auth-check screen lives at
// "index" as a normal, permanent route instead of a separate view swapped
// in before the Stack exists. That way there's exactly one navigation
// (index -> the real destination) instead of two back-to-back hand-offs
// (splash view -> Stack mounts on its own default route -> replace), which
// is what caused a visible blink between the splash and the login screen.
export default function RootLayout() {
  // Every screen's Text now renders through AppText, which maps its
  // existing fontWeight to one of these static Inter files — so the app
  // stays on the native splash (preventAutoHideAsync above) until the fonts
  // are ready, instead of a flash of the system font before Inter loads in.
  const [fontsLoaded] = useFonts({
    Inter_300Light, Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });

  // Tries to drain the offline write queue (syncEngine.ts) and the offline
  // media-upload queue (mediaSyncEngine.ts) once at startup, again every
  // time the app comes back to the foreground, and then every 20s while it
  // stays in the foreground — covers both "engineer was
  // offline at a site, phone regains signal on the drive back, app is
  // still open/backgrounded" (the AppState listener) and "app stayed open
  // the whole time, connectivity (e.g. mobile data) just turned back on
  // mid-session" (the interval) — that second case has no AppState
  // transition to key off at all, so without the interval a still-open app
  // would never notice it's back online. No dedicated network-change
  // listener here since that needs a native module + rebuild; this
  // piggybacks on AppState + a plain setInterval, needing neither. A
  // network error inside runSync is expected and silent — it just means
  // still offline, try again next tick.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    runSync();
    runMediaSync();
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        runSync();
        runMediaSync();
      }
      appState.current = nextState;
    });
    const interval = setInterval(() => {
      if (appState.current === 'active') {
        runSync();
        runMediaSync();
      }
    }, 20000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
     <View style={{ flex: 1, backgroundColor: '#11101C' }}>
    <SafeAreaProvider>
      <ErrorBoundary>
        <TeamProvider>
        {/* No transition animation anywhere in the app — every screen swap
            (push, replace, back) is an instant cut. contentStyle here is
            the native Screen container's own background — every screen
            except index/login is light-themed (#f8f9fa/#F5F7FA/#fff/
            #F6F6F6), so a dark default here showed as a navy flash mid-
            swap against an otherwise all-light app. Overridden back to
            dark only for the two screens that are actually dark. */}
        <Stack screenOptions={{ contentStyle: { backgroundColor: '#F5F7FA' }, animation: 'none' }}>
          <Stack.Screen name="index" options={{ headerShown: false, contentStyle: { backgroundColor: '#11101C' } }} />
          <Stack.Screen name="screens/login" options={{ headerShown: false, contentStyle: { backgroundColor: '#11101C' } }} />
          <Stack.Screen name="screens/dashboard" options={{ headerShown: false }} />
          <Stack.Screen name="screens/commissioningTasks" options={{ headerShown: false }} />
          <Stack.Screen name="screens/serviceTasks" options={{ headerShown: false }} />
          <Stack.Screen name="screens/profile" options={{ headerShown: false }} />
          <Stack.Screen name="screens/taskReport" options={{ headerShown: false }} />
          <Stack.Screen name="screens/srTaskReport" options={{ headerShown: false }} />
          <Stack.Screen name="screens/taskForm" options={{ headerShown: false }} />
          <Stack.Screen name="screens/srTaskForm" options={{ headerShown: false }} />
          <Stack.Screen name="screens/newJob" options={{ headerShown: false }} />
          <Stack.Screen name="screens/newServiceJob" options={{ headerShown: false }} />
          <Stack.Screen name="screens/createAssetCommission" options={{ headerShown: false }} />
          <Stack.Screen name="screens/srDetail" options={{ headerShown: false }} />
          <Stack.Screen name="screens/srApprovals" options={{ headerShown: false }} />
        </Stack>
        </TeamProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
    </View>
  );
}
