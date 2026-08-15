import React from 'react';
import { Modal, Pressable, StyleSheet, Dimensions } from 'react-native';

export type Anchor = { x: number; y: number; width: number; height: number };

type Props = {
  visible: boolean;
  anchor: Anchor | null;
  onRequestClose: () => void;
  maxHeight?: number;
  minWidth?: number;
  children: React.ReactNode;
};

const SCREEN_MARGIN = 12;
const GAP = 6;

// Renders `children` as a small floating panel anchored just below (or,
// if there isn't room, above) a trigger element's measured on-screen
// position — instead of a full-width bottom sheet — so pickers open "in
// place" next to what was tapped, like a native <select>.
export function AnchoredPanel({ visible, anchor, onRequestClose, maxHeight = 320, minWidth, children }: Props) {
  if (!visible || !anchor) return null;

  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  const spaceBelow = screenHeight - (anchor.y + anchor.height) - SCREEN_MARGIN;
  const spaceAbove = anchor.y - SCREEN_MARGIN;
  const opensUpward = spaceBelow < 160 && spaceAbove > spaceBelow;

  const panelWidth = Math.max(minWidth ?? 0, anchor.width);
  const left = Math.min(Math.max(anchor.x, SCREEN_MARGIN), screenWidth - panelWidth - SCREEN_MARGIN);
  const availableHeight = Math.max(120, opensUpward ? spaceAbove : spaceBelow);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <Pressable style={styles.overlay} onPress={onRequestClose}>
        <Pressable
          style={[
            styles.panel,
            {
              left,
              width: panelWidth,
              maxHeight: Math.min(maxHeight, availableHeight),
              ...(opensUpward
                ? { bottom: screenHeight - anchor.y + GAP }
                : { top: anchor.y + anchor.height + GAP }),
            },
          ]}
          onPress={() => {}}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    overflow: 'hidden',
  },
});
