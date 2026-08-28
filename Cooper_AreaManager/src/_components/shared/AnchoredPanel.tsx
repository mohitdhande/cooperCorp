import React from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  maxHeight?: number;
  // Numeric (e.g. 220) lets the panel spill wider than a narrow parent
  // column (Engine Family/CPCB Norm's own 48%-width field, for instance) —
  // defaults to '100%' (exactly the parent's own width) when omitted.
  minWidth?: number | string;
  children: React.ReactNode;
};

// Renders `children` as a small floating panel anchored right below
// whatever wraps it — the caller must give that wrapper `position:
// 'relative'` (DropdownField/CategoryPickerField etc. already do). Not a
// full-screen Modal anymore: a Modal blocked the whole screen's own
// scrolling while a dropdown was open (a tap to close it was required
// before you could scroll at all) — this panel is just part of the normal
// content instead, so it scrolls together with its own field, no drift,
// and the rest of the screen keeps scrolling normally while it's open.
// Trade-off: since it's no longer portaled above everything, it can only
// reliably paint over content in its own immediate row/card, not over
// unrelated sections further down a long screen — acceptable for the
// short field lists these pickers actually live in.
// No backdrop to tap outside of anymore — closes only when an option is
// picked or the trigger itself is tapped again (each caller's own
// openDropdown toggles visible rather than always setting it true).
export function AnchoredPanel({ visible, maxHeight = 320, minWidth, children }: Props) {
  if (!visible) return null;

  return (
    <View style={[styles.panel, { maxHeight, minWidth: minWidth ?? ('100%' as any) }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    overflow: 'hidden',
    zIndex: 1000,
  },
});
