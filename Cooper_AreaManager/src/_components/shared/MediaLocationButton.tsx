import React, { useRef, useState } from 'react';
import { TouchableOpacity, View, Modal, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { MapPin } from 'lucide-react-native';
import { MediaLocation } from '../../models/taskForm.types';

type Props = {
  location?: MediaLocation;
  // 'overlay' = small circular semi-transparent dark button, for a photo
  // thumbnail's own top icon row. 'inline' = plain bordered icon button,
  // for a video/PDF row (no image to overlay onto there).
  variant?: 'overlay' | 'inline';
};

const POPUP_WIDTH = 220;

// Shows the GPS + reverse-geocoded address captured when this file was
// uploaded (see resolveUploadLocation in locationLogger.ts) — a small card
// anchored right under the tapped icon, not a native Alert (matches this
// app's own visual language). Measures the trigger's actual on-screen
// position (measureInWindow) and renders the card through a transparent
// Modal rather than an inline AnchoredPanel — needed so it can escape
// thumbWrapper's own overflow: 'hidden' and so tapping anywhere else
// reliably closes it (AnchoredPanel deliberately has no outside-tap
// backdrop — see its own comment for why — which is exactly the "won't
// close" complaint that came up when MediaTagPicker briefly used it).
export function MediaLocationButton({ location, variant = 'overlay' }: Props) {
  const triggerRef = useRef<View>(null);
  const [popup, setPopup] = useState<{ top: number; left: number } | null>(null);

  const handlePress = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      // Anchored under the icon, nudged left so the card doesn't run off
      // the right edge for an icon sitting near it (e.g. the rightmost
      // photo in a grid row).
      const left = Math.min(Math.max(8, x - POPUP_WIDTH + width + 8), screenWidth - POPUP_WIDTH - 8);
      setPopup({ top: y + height + 6, left });
    });
  };

  const close = () => setPopup(null);

  const hasCoords = location?.lat != null && location?.lng != null;
  const coordsLine = hasCoords ? `${location!.lat!.toFixed(5)}, ${location!.lng!.toFixed(5)}` : '';

  return (
    <>
      <TouchableOpacity
        ref={triggerRef}
        style={variant === 'overlay' ? styles.overlayButton : styles.inlineButton}
        onPress={handlePress}
      >
        <MapPin size={14} color={variant === 'overlay' ? '#FFFFFF' : (location ? '#E76124' : '#9CA3AF')} />
      </TouchableOpacity>

      {/* Fully transparent full-screen Pressable — no dimming, matches the
          reference's own "just floats over the content" look, but still
          catches a tap anywhere else to close, unlike AnchoredPanel. */}
      <Modal visible={!!popup} transparent animationType="none" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          {!!popup && (
            <View style={[styles.popup, { top: popup.top, left: popup.left }]}>
              {!location ? (
                <Text style={styles.popupPrimary}>No location was captured for this file.</Text>
              ) : (
                <>
                  <Text style={styles.popupPrimary}>{location.address || 'Resolving address...'}</Text>
                  {!!coordsLine && <Text style={styles.popupCoords}>{coordsLine}</Text>}
                </>
              )}
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlayButton: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  inlineButton: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F8F8F8',
    justifyContent: 'center', alignItems: 'center',
  },
  popup: {
    position: 'absolute',
    width: POPUP_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  popupPrimary: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  popupCoords: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 4 },
});
