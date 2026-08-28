import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

// Shared by Commissioning's Step 6 and Service's (area_manager) Step 5 —
// both forms' final action ends here, same look and same label, only the
// onPress call (and which API it hits) differs per caller.
export function CompleteTaskButton({ onPress, loading, disabled }: Props) {
  const isDisabled = !!disabled || !!loading;
  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.text}>Complete The Task</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    backgroundColor: '#4AC686',
    borderRadius: 30,
    borderWidth: 1, borderColor: '#DEDEDE',
    height: 56,
    justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  text: { color: '#FFFFFF', fontWeight: '600', fontSize: 18 },
});
