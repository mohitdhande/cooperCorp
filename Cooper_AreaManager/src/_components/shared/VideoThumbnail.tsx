import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = { uri: string; style?: StyleProp<ViewStyle> };

// A paused, no-controls preview frame for a locally picked/recorded video —
// used in the site-photos grid to visually distinguish a video item from a
// plain photo. Each instance needs its own useVideoPlayer, so this is a
// dedicated per-item component rather than something rendered inline in a
// .map() (hooks can't be called in a loop).
export function VideoThumbnail({ uri, style }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.pause();
  });

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', height: '100%' },
});
