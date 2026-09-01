import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { val } from '@/utils/reportFormatters';

// A plain label:value pair, used in report screens for numeric/text fields.
export const InfoRow = ({ label, value }: { label: string; value?: any }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <Text style={styles.infoRowValue}>{val(value)}</Text>
  </View>
);

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoRowLabel: { fontSize: 13, color: '#6B7280' },
  infoRowValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flexShrink: 1, textAlign: 'right' },
});
