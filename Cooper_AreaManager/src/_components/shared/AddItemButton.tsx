import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/_components/AppText';
import { Plus } from 'lucide-react-native';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// "+ Add Code" / "+ Add Parts" — shared by Commissioning and Service task
// forms' complaint-code and parts-used steps, previously two separately
// hand-written copies of the same button that had drifted apart (one had
// an invisible white border, the other a real light-gray one; only one
// disabled itself once the task was already completed).
export function AddItemButton({ label, onPress, disabled, style }: Props) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress} disabled={disabled}>
      <Plus size={18} color="#0F0F0F" />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#DEDEDE', borderRadius: 24,
    backgroundColor: '#FFFFFF',
    height: 56, paddingHorizontal: 24,
    overflow: 'hidden',
  },
  text: { color: '#0F0F0F', fontWeight: '600', fontSize: 18 },
});
