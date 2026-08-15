import { useCallback, useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { formatRole } from '../../utils/reportFormatters';

export type TooltipSide = 'left' | 'right';

// Shared by every tappable avatar in the app (task card assignee clusters,
// the footer avatar, Profile's team list) — one tap toggles the name
// tooltip on, a second tap (or 3s of no further taps) hides it again, and
// only one tooltip is ever open at a time app-wide isn't required since
// each screen owns its own instance of this hook.
export function useAvatarTooltip() {
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [side, setSide] = useState<TooltipSide>('right');

  useEffect(() => {
    if (!revealedId) return;
    const timer = setTimeout(() => setRevealedId(null), 3000);
    return () => clearTimeout(timer);
  }, [revealedId]);

  // Measures the tapped avatar's real on-screen position — an avatar
  // sitting in the left half of the screen opens its tooltip rightward
  // (anchored left:0), one in the right half opens it leftward (anchored
  // right:0), so the pill never runs off the screen edge regardless of
  // where on the page or which side of a cluster it's tapped.
  const toggle = useCallback((id: string, ref: React.RefObject<View | null>) => {
    setRevealedId((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        ref.current?.measureInWindow((x, _y, width) => {
          const screenWidth = Dimensions.get('window').width;
          setSide(x + width / 2 > screenWidth / 2 ? 'left' : 'right');
        });
      }
      return next;
    });
  }, []);

  const hide = useCallback(() => setRevealedId(null), []);

  return { revealedId, side, toggle, hide };
}

type BubbleProps = {
  visible: boolean;
  side: TooltipSide;
  name: string;
  role?: string;
};

// The floating name pill itself — positioned absolutely relative to
// whatever wraps the tapped avatar (that wrapper needs its own
// position:'relative', same as AssetIdentityHeader's avatarCluster).
export function AvatarTooltipBubble({ visible, side, name, role }: BubbleProps) {
  if (!visible) return null;
  return (
    <View style={[styles.tooltip, side === 'left' ? { right: 0 } : { left: 0 }]}>
      <Text style={styles.tooltipName} numberOfLines={1}>{name}</Text>
      {!!role && <Text style={styles.tooltipRole} numberOfLines={1}>{formatRole(role)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    top: '100%',
    marginTop: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 12,
    zIndex: 10,
    elevation: 10,
    minWidth: 120,
  },
  tooltipName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tooltipRole: { color: '#B0AEB8', fontSize: 11, fontWeight: '500', marginTop: 2 },
});
