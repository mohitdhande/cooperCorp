import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/_components/AppText';
import { X } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  visible: boolean;
  // Null while the signed URL is still being fetched (see getGcsSignedUrl)
  // — the modal opens immediately on tap, showing a spinner, rather than
  // waiting for the network call before anything appears.
  uri: string | null;
  error?: string;
  onClose: () => void;
};

// Full-screen playback for a private GCS video — the caller is responsible
// for resolving the tapped item's raw gcsUrl into a short-lived signed `uri`
// via getGcsSignedUrl first; this component only ever plays whatever URL
// it's given.
export function VideoPlayerModal({ visible, uri, error, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <X size={22} color="#FFFFFF" />
        </TouchableOpacity>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : uri ? (
          // Keyed by uri so a new player is created per video rather than
          // reusing one whose source useVideoPlayer won't hot-swap.
          <VideoPlayerInner key={uri} uri={uri} />
        ) : (
          <ActivityIndicator size="large" color="#FFFFFF" />
        )}
      </View>
    </Modal>
  );
}

function VideoPlayerInner({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.play(); });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  closeButton: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  video: { width: '100%', height: '70%' },
  errorText: { color: '#FCA5A5', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 30 },
});
