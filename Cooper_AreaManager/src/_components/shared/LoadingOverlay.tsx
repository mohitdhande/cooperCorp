import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LOADING_OVERLAY_VIDEO_SIZE } from '@/constants/branding';
import { SplashVideoCircle } from './SplashVideoCircle';
import { Text } from '@/_components/AppText';

// A full-screen dimmed overlay with the same looping splash video used on
// the login screen, shown as a small circle. For screen-level blocking
// loads only (e.g. "fetching this screen's data before anything renders")
// — not for small inline button/save spinners, which should keep their
// plain ActivityIndicator.
//
// Mount conditionally at the call site (`{loading && <LoadingOverlay />}`)
// rather than passing a `visible` prop — that unmounts the video player
// (and stops it consuming resources) whenever it isn't needed, instead of
// leaving it created-but-hidden in the background.
// `message` overrides the default "Loading..." — used for e.g. photo/video
// upload progress ("Uploading photos... 42%"), so the user isn't staring
// at a generic spinner during a multi-second upload with no sense of
// whether it's actually moving.
export function LoadingOverlay({ message }: { message?: string } = {}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {/* A separate absolute-fill layer for the dim, not `opacity` on the
          wrapper — opacity would cascade to the video circle too and wash
          it out along with the background. */}
      <View style={styles.dim} />

      <Text style={styles.loadingText}>{message || 'Loading...'}</Text>

      {/* Same bottom-alignment stack as BottomNavBar's wrapper/bar (paddingTop
          8, a 76px-tall row — the center logo button's 60px plus the bar's
          own 8px padding top/bottom — then the safe-area bottom inset), so
          the video sits in exactly the spot the center logo occupies once
          the bar is actually mounted, not just an approximate offset. Only
          the size is different (LOADING_OVERLAY_VIDEO_SIZE, not the logo's). */}
      <View style={[styles.barWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.barSlot}>
          <SplashVideoCircle size={LOADING_OVERLAY_VIDEO_SIZE} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  dim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    // #1D1D1D at 90% alpha (E5), per spec.
    backgroundColor: '#1D1D1DE5',
  },
  // Positioned above the screen's true center (not the top edge) — same
  // orange used everywhere else in the app (login CTA, brand accents).
  loadingText: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#E76124',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  barWrapper: { paddingTop: 8 },
  barSlot: { height: 76, justifyContent: 'center', alignItems: 'center' },
});
