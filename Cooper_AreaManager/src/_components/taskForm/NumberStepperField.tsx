import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';

type Props = {
  label: string;
  value: string;
  onChangeValue: (val: string) => void;
  unit?: string;
  step?: number;
  // Auto-computed fields (e.g. Total Load KW = Load KW R+Y+B added
  // together) — no typing, no spinner arrows, just the live value.
  readOnly?: boolean;
  // Shown in place of the value when it's blank — e.g. Load % explaining
  // *why* it's empty (KVA Rating not filled yet) instead of just looking
  // like a blank/broken field. Every other caller leaves this unset and
  // gets no placeholder, same as before.
  placeholder?: string;
};

// Numeric input with up/down spinner arrows + optional unit suffix (V, A, %, Hz, °C).
export function NumberStepperField({ label, value, onChangeValue, unit, step = 1, readOnly, placeholder }: Props) {
  const handleStep = (dir: 1 | -1) => {
    const current = parseFloat(value) || 0;
    onChangeValue(String(current + dir * step));
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, readOnly && styles.inputRowReadOnly]}>
        <TextInput
          style={[styles.input, readOnly && styles.inputReadOnly]}
          value={value}
          onChangeText={onChangeValue}
          keyboardType="numeric"
          editable={!readOnly}
          placeholder={placeholder}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        {!readOnly && (
          <View style={styles.spinnerColumn}>
            <TouchableOpacity style={styles.spinnerBtn} onPress={() => handleStep(1)}>
              <Text style={styles.spinnerArrow}>▲</Text>
            </TouchableOpacity>
            <View style={styles.spinnerDivider} />
            <TouchableOpacity style={styles.spinnerBtn} onPress={() => handleStep(-1)}>
              <Text style={styles.spinnerArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  label: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingLeft: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  inputRowReadOnly: { backgroundColor: '#F3F4F6' },
  inputReadOnly: { color: '#6B7280' },
  unit: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  spinnerColumn: {
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  spinnerBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  spinnerArrow: {
    fontSize: 9,
    color: '#9CA3AF',
  },
});
