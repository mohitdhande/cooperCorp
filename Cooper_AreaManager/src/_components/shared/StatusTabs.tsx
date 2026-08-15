import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// Kept as one constant so the segment's style height and its gradient
// pill's rx/ry can never drift apart (see the Rect below).
const SEGMENT_HEIGHT = 36;

type Tab = 'Active' | 'Completed' | 'Closed';

type Props = {
  // Same gradient-pill rendering for both — only the two gradient stops
  // (and the outer glow tint) differ by variant, per GRADIENT_STOPS below.
  variant: 'commissioning' | 'service';
  selected: Tab;
  onChange: (tab: Tab) => void;
  counts: { active: number; completed: number; closed: number };
};

// Service's darker stop stays #1E1951 — the app's canonical service color
// (see AGENTS.md / color-consolidation work) — everything else here is
// purely a lighter partner tone for the gradient sheen + glow, not a new
// standalone surface color.
// Tuple order is [left stop, right stop] — both variants go darker-on-the-
// left to lighter-on-the-right, matching commissioning's existing FA9568
// (darker) -> F5B38E (lighter) direction.
const GRADIENT_STOPS: Record<Props['variant'], [string, string]> = {
  commissioning: ['#FA9568', '#F5B38E'],
  service: ['#1E1951', '#3F35A0'],
};

// The selected segment's gradient pill background, shared by both variants
// — a flat fill reads dead next to this soft two-tone sheen, which is what
// actually produces the "radiant" look (this used to be commissioning-only,
// with service falling back to a flat navy fill; now both use it).
function SegmentGradientPill({ variant }: { variant: Props['variant'] }) {
  const [from, to] = GRADIENT_STOPS[variant];
  const gradientId = `segmentGradientBg-${variant}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={from} />
          <Stop offset="100%" stopColor={to} />
        </LinearGradient>
      </Defs>
      {/* rx/ry both set to exactly half the segment's fixed height — a
          single large rx (e.g. 100) gets clamped independently per axis (by
          width/2 horizontally, by height/2 vertically), which produces two
          different effective radii and an oval/egg shape instead of a
          clean pill with matching semicircular ends. */}
      <Rect width="100%" height="100%" rx={SEGMENT_HEIGHT / 2} ry={SEGMENT_HEIGHT / 2} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

const TABS: { key: Tab; label: string; countKey: keyof Props['counts'] }[] = [
  { key: 'Active', label: 'Active', countKey: 'active' },
  { key: 'Completed', label: 'Completed', countKey: 'completed' },
  { key: 'Closed', label: 'Closed', countKey: 'closed' },
];

// Shared 3-way Active/Completed/Closed segmented control with count badges
// — used by both the Commissioning and Service task-list screens.
export function StatusTabs({ variant, selected, onChange, counts }: Props) {
  const isService = variant === 'service';
  return (
    <View style={styles.segmentedControl}>
      {TABS.map(({ key, label, countKey }) => {
        const isActive = selected === key;
        const count = counts[countKey];
        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.segment,
              isActive && (isService ? styles.segmentGlowService : styles.segmentGlowCommissioning),
            ]}
            onPress={() => onChange(key)}
            activeOpacity={0.85}
          >
            {isActive && <SegmentGradientPill variant={variant} />}
            <Text
              style={[
                styles.segmentText,
                isActive
                  ? (isService ? styles.segmentTextActiveService : styles.segmentTextActiveCommissioning)
                  : (isService ? styles.segmentTextInactiveService : styles.segmentTextInactiveCommissioning),
              ]}
            >
              {label}
            </Text>
            {count > 0 && (
              <View
                style={[
                  styles.segmentBadge,
                  styles.segmentBadgeCommissioning,
                  isService && styles.segmentBadgeGlowService,
                ]}
              >
                <Text
                  style={[
                    styles.segmentBadgeText,
                    styles.segmentBadgeTextCommissioning,
                    isActive && styles.segmentBadgeTextOnDarkCommissioning,
                  ]}
                >
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 100,
    borderWidth: 1, borderColor: '#FFC3A8',
    backgroundColor: '#FFFFFF',
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    height: SEGMENT_HEIGHT,
    borderRadius: 100,
    justifyContent: 'center', alignItems: 'center',
    gap: 6,
  },
  // Soft outward halo behind the active pill — the "radiance" that a flat
  // fill (service's old look) doesn't produce on its own. Same shape for
  // both, tinted to each variant's brighter gradient stop so the glow
  // reads as light coming off the pill rather than a plain drop shadow.
  segmentGlowCommissioning: {
    shadowColor: '#FA9568', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  segmentGlowService: {
    shadowColor: '#3F35A0', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  segmentText: { fontSize: 16, fontWeight: '500' },
  segmentTextActiveCommissioning: { color: '#000000', fontWeight: '700' },
  segmentTextInactiveCommissioning: { color: '#413f3f', opacity: 0.5, fontWeight: '700' },
  segmentTextActiveService: { color: '#FFFFFF', fontWeight: '700' },
  segmentTextInactiveService: { color: '#000000', opacity: 0.5 },
  segmentBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center', alignItems: 'center',
  },
  // Same bg/text for both variants now — service's badge used to be a
  // fully inverted black/white treatment, but that's been dropped in favor
  // of matching commissioning's exactly; only the glow below is left as a
  // service-specific addition.
  segmentBadgeCommissioning: { backgroundColor: 'rgba(223, 219, 219, 0.3)' },
  segmentBadgeGlowService: {
    shadowColor: '#3F35A0', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.6, shadowRadius: 4, elevation: 4,
  },
  segmentBadgeText: { fontSize: 11, fontWeight: '700' },
  segmentBadgeTextCommissioning: { color: '#4B5563' },
  // Active tab's badge number goes white (both variants) — its translucent
  // light bg sits on top of the active pill's own dark/orange fill, so
  // white reads clearly there instead of the gray used against the plain
  // white unselected background.
  segmentBadgeTextOnDarkCommissioning: { color: '#FFFFFF' },
});
