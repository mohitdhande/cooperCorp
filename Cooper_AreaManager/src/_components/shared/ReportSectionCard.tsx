import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

type Props = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  // Optional small grey count badge between the title and the chevron
  // (e.g. how many fault codes/parts are in this section) — omitted when
  // not passed, existing callers are unaffected.
  count?: number;
  // Optional colored label badge before the count (e.g. srDetail.tsx's
  // "AM Review Needed" on the Parts section) — omitted when not passed.
  badge?: { label: string; bg: string; text: string };
};

// Collapsible section shared by taskReport.tsx/srTaskReport.tsx — a light
// purple pill header (matching ActivityHistoryCard's own header pill) inset
// inside a white outer card, instead of the pill itself being a full-bleed
// bar. Expanded content sits below the pill within that same white card.
export function ReportSectionCard({ title, expanded, onToggle, children, count, badge }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.8}>
          <Text style={styles.headerText}>{title}</Text>
          <View style={styles.headerRight}>
            {!!badge && (
              <View style={[styles.labelBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.labelBadgeText, { color: badge.text }]}>{badge.label}</Text>
              </View>
            )}
            {count !== undefined && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{count}</Text>
              </View>
            )}
            {expanded ? <ChevronUp size={18} color="#1E1951" /> : <ChevronDown size={18} color="#1E1951" />}
          </View>
        </TouchableOpacity>
        {expanded && <View style={styles.body}>{children}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F1FD',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerText: { fontSize: 14, fontWeight: '700', color: '#1E1951' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  labelBadge: {
    borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  labelBadgeText: { fontSize: 11, fontWeight: '700' },
  body: {
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 4,
  },
});
