import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { AnchoredPanel, Anchor } from '../shared/AnchoredPanel';

type Props = {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  required?: boolean;
  // Step 1's redesigned sections (Genset Identification/Alternator &
  // Panel/Service) use plain sentence-case labels with no "required" dot,
  // matching the Figma reference — every other caller keeps the original
  // uppercase + bullet look untouched.
  plainLabel?: boolean;
  // Shown in place of the value when nothing's picked yet — defaults to a
  // plain dash for every existing caller, only overridden where a real
  // instruction (e.g. "Select sub-category...") reads better.
  placeholder?: string;
  // A red "*" suffix instead of the leading "●" bullet — the newer
  // required-field convention (newServiceJob.tsx's requiredStar) used by
  // srTaskForm's Service Type/Billing Type fields. Independent of
  // `required`/plainLabel so existing bullet-style callers are unaffected.
  requiredAsterisk?: boolean;
};

// A tap-to-open dropdown field used across the task form's asset sections.
// Opens as a small panel anchored right under the field, not a full sheet.
export function DropdownField({ label, value, options, onSelect, required = true, plainLabel = false, placeholder = '', requiredAsterisk = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<View>(null);

  const openDropdown = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };

  return (
    <View>
      <Text style={plainLabel ? styles.fieldLabelPlain : styles.fieldLabel}>
        {plainLabel ? label : `${required ? '● ' : ''}${label}`}
        {requiredAsterisk && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>
      <TouchableOpacity ref={triggerRef} style={[styles.dropdownInput, visible && styles.dropdownInputActive]} onPress={openDropdown}>
        <Text style={styles.dropdownText}>{value || placeholder}</Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </TouchableOpacity>

      <AnchoredPanel visible={visible} anchor={anchor} onRequestClose={() => setVisible(false)} maxHeight={260}>
        <FlatList
          data={['—', ...options]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.optionRow, value === item && styles.optionRowSelected]}
              onPress={() => { onSelect(item === '—' ? '' : item); setVisible(false); }}
            >
              <Text style={styles.optionText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </AnchoredPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  fieldLabelPlain: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#DC2626',
    fontWeight: '700',
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fff',
  },
  dropdownInputActive: { borderColor: '#E76124' },
  dropdownText: {
    fontSize: 14,
    color: '#1F2937',
  },
  dropdownArrow: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  optionRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionRowSelected: {
    backgroundColor: '#FDECE1',
  },
  optionText: {
    fontSize: 15,
    color: '#1F2937',
  },
});
