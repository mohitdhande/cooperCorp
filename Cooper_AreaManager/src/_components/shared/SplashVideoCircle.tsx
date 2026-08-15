import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = { size: number };

// The app's original splash/loading swirl video — distinct from
// login_video.mp4, which is used only on the actual startup splash screen
// (src/app/index.tsx). This one covers every other place the brand's swirl
// animation appears: LoadingOverlay's spinner and inline uses like the
// task-completion success screen.
export function SplashVideoCircle({ size }: Props) {
  const player = useVideoPlayer(require('../../../assets/splash_Screen_video.mp4'), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: 'hidden', backgroundColor: '#000000' },
});
