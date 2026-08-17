import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as SplashScreen from 'expo-splash-screen';
import { getPermissions } from '@/constants/permissions';
import { UserProfile } from '@/models/Login';
import { SPLASH_VIDEO_SIZE } from '@/constants/branding';
import { LoginContent } from '@/_components/LoginContent';

// The splash video should get its full 7 seconds on screen regardless of
// how fast the AsyncStorage auth check resolves (usually just a few ms).
const MIN_SPLASH_VIDEO_MS = 7000;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Destination = '/screens/dashboard' | '/screens/login';

// Simulates the reference design's CSS
// `box-shadow: 0 0 20px 20px #11101C inset, 0 0 1px 30px #11101C` — React
// Native has no inset-shadow primitive, so this overlays a radial gradient
// (same color as the screen background) on top of the video to fade its
// edges into the surrounding dark background instead.
function SplashVideoVignette() {
  return (
    <Svg
      width={SPLASH_VIDEO_SIZE}
      height={SPLASH_VIDEO_SIZE}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="splashVignette" cx="50%" cy="50%" r="50%">
          <Stop offset="45%" stopColor="#11101C" stopOpacity={0} />
          <Stop offset="100%" stopColor="#11101C" stopOpacity={1} />
        </RadialGradient>
      </Defs>
      <Rect width={SPLASH_VIDEO_SIZE} height={SPLASH_VIDEO_SIZE} fill="url(#splashVignette)" />
    </Svg>
  );
}

// Plays the splash video muted/looping, starting as soon as the player is
// ready.
function SplashVideo() {
  const player = useVideoPlayer(require('../../assets/login_video.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.videoWrapper}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <SplashVideoVignette />
    </View>
  );
}

// The app's real initial route — plays the splash video while checking
// AsyncStorage for a saved session. If a session exists, this replaces
// itself with the role's landing route (ordinary navigation, same as
// everywhere else in the app). If not, instead of navigating to
// /screens/login (which would fully unmount this screen and remount a new
// one — a hard cut, plus that screen's own entrance animation would add
// another static pause on top of the video's), it swaps LoginContent in
// directly, in place: no navigation, no remount, so the logo picks up
// exactly where the video left off and keeps rising with no extra beat.
export default function Index() {
  const router = useRouter();
  const [revealLogin, setRevealLogin] = useState(false);

  // Hidden the moment this screen mounts, not once the video reports
  // 'readyToPlay' — the video's own codec/first-frame init can take a
  // while on a cold start, and gating the native splash on that left the
  // OS's static logo (not our video) on screen for most or all of the
  // splash window whenever that init was slow. Our container is the same
  // #11101C as the native splash background, so hiding it immediately is
  // still a seamless dark-to-dark handoff — the video simply appears
  // inside our already-visible screen whenever it's ready, instead of
  // blocking the whole transition.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    // TeamContext's own refresh() fires the instant the root layout mounts,
    // fully in parallel with this screen's 7s splash timer — if the cached
    // session is stale, that fetch 401s, its refresh attempt fails, and
    // axiosClient's interceptor redirects to /screens/login (with a
    // sessionMessage param) well before checkLoginStatus below ever
    // resolves. Without this guard, this effect would still land its own
    // late, param-less navigation once the splash timer finally elapses —
    // stomping the message the interceptor had already surfaced. cancelled
    // is flipped in the cleanup, which fires as soon as that earlier
    // redirect unmounts this screen.
    let cancelled = false;

    const checkLoginStatus = async (): Promise<Destination> => {
      try {
        const token = await getToken();
        const savedUserData = await AsyncStorage.getItem('userData');

        // Only forward to the role's landing screen once both the token and
        // the cached profile are present — a partial/corrupt session falls
        // through to login instead of crashing on parse.
        if (token && savedUserData) {
          const profile: UserProfile = JSON.parse(savedUserData);
          return getPermissions(profile.role).landingRoute;
        }
      } catch (error) {
        console.log('Error checking auth token status:', error);
      }
      return '/screens/login';
    };

    (async () => {
      const [next] = await Promise.all([checkLoginStatus(), delay(MIN_SPLASH_VIDEO_MS)]);
      if (cancelled) return;

      if (next === '/screens/login') {
        setRevealLogin(true);
      } else {
        router.replace(next);
      }
    })();

    return () => { cancelled = true; };
  }, [router]);

  if (revealLogin) {
    return <LoginContent skipInitialHold />;
  }

  return (
    <View style={styles.container}>
      <SplashVideo />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#11101C',
  },
  videoWrapper: {
    width: SPLASH_VIDEO_SIZE,
    height: SPLASH_VIDEO_SIZE,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#11101C',
  },
});
