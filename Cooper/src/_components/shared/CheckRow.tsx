import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { val } from '@/utils/reportFormatters';
import { getCheckValueStyle } from '@/utils/statusStyles';

// A single check item (label + OK/Not OK/value pill + optional comment), used in report screens.
export const CheckRow = ({ label, value, comment }: { label: string; value?: string; comment?: string }) => {
  const { bg, text } = getCheckValueStyle(value || '');
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkRowTop}>
        <Text style={styles.checkRowLabel}>{label}</Text>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={[styles.badgeText, { color: text }]}>{val(value)}</Text>
        </View>
      </View>
      {comment ? (
        <View style={styles.commentBox}>
          <Text style={styles.commentText}>{comment}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  checkRow: { marginBottom: 12 },
  checkRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkRowLabel: { flex: 1, fontSize: 13, color: '#374151', marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  commentBox: { backgroundColor: '#FEF2F2', borderRadius: 6, padding: 8, marginTop: 6 },
  commentText: { color: '#B91C1C', fontStyle: 'italic', fontSize: 12 },
});
