import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { val } from '../utils/reportFormatters';

const getBadgeStyle = (value: string) => {
  if (!value) return { badge: styles.badgeNeutral, text: styles.badgeTextNeutral };
  const v = value.trim().toLowerCase();
  // Customer Handover's own vocabulary (Yes/No) reads the same as OK/Not
  // OK color-wise — both are "done fine" vs "needs attention".
  if (v === 'ok' || v === 'yes') return { badge: styles.badgeOk, text: styles.badgeTextOk };
  if (v === 'not ok' || v === 'no') return { badge: styles.badgeBad, text: styles.badgeTextBad };
  return { badge: styles.badgeNeutral, text: styles.badgeTextNeutral };
};

type CheckRowProps = { label: string; value?: string; comment?: string };

// A single check item on a report screen — label, an OK/Not OK/custom value
// pill, and an optional inspector comment.
export function CheckRow({ label, value, comment }: CheckRowProps) {
  const { badge, text } = getBadgeStyle(value || '');
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkRowTop}>
        <Text style={styles.checkRowLabel}>{label}</Text>
        <View style={[styles.badge, badge]}>
          <Text style={[styles.badgeText, text]}>{val(value)}</Text>
        </View>
      </View>
      {comment ? (
        <View style={styles.commentBox}>
          <Text style={styles.commentText}>{comment}</Text>
        </View>
      ) : null}
    </View>
  );
}

type InfoRowProps = { label: string; value?: any };

// A plain label:value pair row on a report screen.
export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.infoRowValue} numberOfLines={2}>{val(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  checkRow: { marginBottom: 12 },
  checkRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkRowLabel: { flex: 1, fontSize: 13, color: '#374151', marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeOk: { backgroundColor: '#D1FAE5' },
  badgeTextOk: { color: '#059669' },
  badgeBad: { backgroundColor: '#FEE2E2' },
  badgeTextBad: { color: '#DC2626' },
  badgeNeutral: { backgroundColor: '#F3F4F6' },
  badgeTextNeutral: { color: '#4B5563' },
  commentBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  commentText: { color: '#B91C1C', fontStyle: 'italic', fontSize: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  // Both sides get real flex (not just flexShrink on one) so a long label
  // and a long value share the row's actual width instead of the label
  // sizing to its own content and colliding with the value — the same class
  // of overlap bug as AssetLocationContact's contact rows, worse on a
  // device with a larger accessibility font size.
  infoRowLabel: { flex: 1, fontSize: 13, color: '#6B7280' },
  infoRowValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1F2937', textAlign: 'right' },
});
