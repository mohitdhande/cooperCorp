import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from '@/_components/AppText';
import { Calendar } from 'lucide-react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';

// Feeds/reads @expo/ui's DateTimePicker, which works in Date objects, not
// the dd/mm/yyyy strings every date field in this app stores/sends.
function parseDDMMYYYYToDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function dateToDDMMYYYY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

type Props = {
  label: string;
  required?: boolean;
  labelExtra?: React.ReactNode;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

// Every "type a date" field in the app shares this: tapping opens the
// native date picker instead of the keyboard, so the dd/mm/yyyy value is
// always valid — no free-typing, no format mistakes.
//
// disabled: locks the field once it already holds a genuinely pre-filled
// value (e.g. pulled from SAP) — greys it out and blocks the picker from
// opening, matching the read-only look/behavior used elsewhere for
// pre-filled asset fields (styles.fieldInputReadOnly in taskForm.tsx).
export function DateField({ label, required, labelExtra, value, onChangeText, placeholder, disabled, containerStyle, inputStyle, labelStyle }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={containerStyle}>
      <Text style={[styles.label, labelStyle]}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}{labelExtra ? <> {labelExtra}</> : null}
      </Text>
      <TouchableOpacity
        style={[styles.input, disabled && styles.inputDisabled, inputStyle]}
        onPress={() => { if (!disabled) setPickerOpen(true); }}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <Text style={[value ? styles.valueText : styles.placeholderText, disabled && styles.valueTextDisabled]}>{value || placeholder}</Text>
        <Calendar size={16} color="#9CA3AF" />
      </TouchableOpacity>

      {/* presentation="dialog" (Android's default) mounts and immediately
          shows the native dialog, firing onValueChange/onDismiss once the
          user picks or cancels — the caller unmounts it in response,
          same conditionally-rendered-modal pattern used elsewhere in this
          app. */}
      {pickerOpen && (
        <DateTimePicker
          value={parseDDMMYYYYToDate(value) || new Date()}
          mode="date"
          // Every date field in the app (Dispatch Date, Commissioning
          // Entry Date) records something that already happened or is
          // happening now — never a future date — so the native picker
          // itself blocks picking past today, rather than accepting one
          // and catching it as a validation error afterward.
          maximumDate={new Date()}
          onValueChange={(_event, date) => {
            onChangeText(dateToDDMMYYYY(date));
            setPickerOpen(false);
          }}
          onDismiss={() => setPickerOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  required: { color: '#DC2626' },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  valueText: { fontSize: 15, color: '#1F2937' },
  placeholderText: { fontSize: 15, color: '#9CA3AF' },
  inputDisabled: { backgroundColor: '#F3F4F6' },
  valueTextDisabled: { color: '#6B7280' },
});
