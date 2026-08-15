import React, { useRef } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, FlatList, Image, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { X } from 'lucide-react-native';

type Props = {
  visible: boolean;
  // Already-resolved (signed) display URIs, in the same order as the
  // grid — the caller is responsible for the raw-url -> signed-url lookup,
  // same division of responsibility as VideoPlayerModal.
  photos: string[];
  initialIndex: number;
  onClose: () => void;
};

// Full-screen, swipe-between viewer for a private-bucket photo grid — the
// grid's own thumbnails are 100x100, too small to make out a serial number
// or a hairline crack, so tapping one opens it here at full width instead.
// No pinch-zoom (React Native's ScrollView zoom scale is iOS-only and
// unreliable on Android without a native dependency) — swiping between
// photos and viewing one at full screen width covers the actual gap.
export function PhotoLightboxModal({ visible, photos, initialIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = React.useState(initialIndex);

  // Re-seek to the tapped photo every time the modal opens, not just on
  // first mount — the FlatList instance stays alive across opens since the
  // modal is conditionally rendered by `visible`, not unmounted/remounted.
  React.useEffect(() => {
    if (!visible) return;
    setActiveIndex(initialIndex);
    // Deferred a tick — scrollToIndex on the very first render (before the
    // list has measured its items) is a no-op on some Android devices.
    const timeout = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 0);
    return () => clearTimeout(timeout);
  }, [visible, initialIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={10}>
          <X size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {photos.length > 1 && (
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>{activeIndex + 1} / {photos.length}</Text>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(event) => {
            const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setActiveIndex(nextIndex);
          }}
          // A stale/short list on Android can throw scrollToIndex out of
          // range mid-gesture — fail soft with a delayed retry rather than
          // crashing the modal.
          onScrollToIndexFailed={(info) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 50);
          }}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image source={{ uri: item }} style={styles.fullImage} resizeMode="contain" />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  closeButton: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  counterPill: {
    position: 'absolute', top: 62, alignSelf: 'center', zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
  },
  counterText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  fullImage: { width: '100%', height: '100%' },
});
