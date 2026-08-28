import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { CheckCheck } from 'lucide-react-native';

type Props = {
  onPress: () => void;
  saving?: boolean;
  done?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The small green circular double-check button every per-section "Save"
// action uses — Genset Identification, Alternator & Panel, each
// commissioning checklist group, Electrical Readings, Engine Parameters,
// Customer Handover, ... 14 separately hand-written copies of the exact
// same button across taskForm.tsx/srTaskForm.tsx before this. Darkens
// once `done` (the section's already been saved at least once), shows a
// spinner in place of the checkmark while `saving`.
export function SectionSaveButton({ onPress, saving, done, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, done && styles.buttonDone, style]}
      onPress={onPress}
      disabled={saving}
    >
      {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4AC686',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 16,
  },
  buttonDone: { backgroundColor: '#33A86B' },
});
