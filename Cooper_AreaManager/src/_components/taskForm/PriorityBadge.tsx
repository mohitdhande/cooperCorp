import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { Priority } from '../../models/taskForm.types';

export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  P1: { bg: '#FEE2E2', text: '#DC2626' },
  P2: { bg: '#FFEDD5', text: '#C2410C' },
  P3: { bg: '#DBEAFE', text: '#1D4ED8' },
  P4: { bg: '#F3F4F6', text: '#6B7280' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const colors = PRIORITY_COLORS[priority];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{priority}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
