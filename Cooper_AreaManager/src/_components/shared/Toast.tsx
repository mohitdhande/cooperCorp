import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';

type Props = {
  visible: boolean;
  message: string;
  type: 'success' | 'error';
};

// Same visual language as taskForm.tsx's own hand-rolled toast (green
// success / red error banner, floats near the top, auto-dismisses) —
// extracted here since taskReport.tsx/srTaskReport.tsx need the same thing
// for the PDF generate/regenerate confirmation. Pair with useToast below.
export function Toast({ visible, message, type }: Props) {
  if (!visible) return null;
  return (
    <View style={[styles.container, type === 'success' ? styles.success : styles.error]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10,
    borderRadius: 12, padding: 14, elevation: 6,
  },
  success: { backgroundColor: '#15803D' },
  error: { backgroundColor: '#DC2626' },
  text: { color: '#fff', fontWeight: '600', textAlign: 'center' },
});
