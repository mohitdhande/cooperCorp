import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/_components/AppText';
import { Check, CheckCheck, ChevronDown, ChevronUp } from 'lucide-react-native';

type Props = {
  // Unused by this component itself (kept optional for callers that still
  // pass a checklist-group letter for their own bookkeeping).
  letter?: string;
  title: string;
  saved: boolean;
  // Opt-in tap-to-collapse (same pattern as Step 1's sections) — omit for
  // groups that don't have a collapsible body (e.g. the revalidation
  // checklist's Groups F/G).
  onPress?: () => void;
  expanded?: boolean;
  // taskForm.tsx's Step 1 sections show a red "N missing" pill instead of
  // the saved-badge while the section still has required fields empty —
  // only ever shown when saved is false.
  missingCount?: number;
  // The SR task form's Complaint Codes/Parts Used sections use a plain
  // white pill instead of the default light-purple — same shape, different
  // background, so this stays a style override rather than a new prop name.
  style?: StyleProp<ViewStyle>;
};

// The light-purple pill shown above each checklist group — same visual
// language as the Step 1 sections' sectionPillHeader: plain title, or title
// + a green double-check once the group has been saved.
export function GroupHeader({ title, saved, onPress, expanded, missingCount, style }: Props) {
  const content = (
    <>
      <Text style={styles.title}>{title}</Text>
      {saved && onPress ? (
        <View style={styles.rightGroup}>
          <View style={styles.savedCircleBadge}><Check size={12} color="#FFFFFF" strokeWidth={3} /></View>
          {expanded ? <ChevronUp size={16} color="#000000" /> : <ChevronDown size={16} color="#000000" />}
        </View>
      ) : saved ? (
        <CheckCheck size={18} color="#16A34A" />
      ) : !!missingCount ? (
        <View style={styles.missingPill}><Text style={styles.missingPillText}>{missingCount} missing</Text></View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={[styles.pill, style]} activeOpacity={0.8} onPress={onPress} disabled={!saved}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.pill, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedCircleBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
  },
  missingPill: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  missingPillText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
});
