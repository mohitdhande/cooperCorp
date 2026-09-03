import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { AnchoredPanel } from '../shared/AnchoredPanel';

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
  // Already has a value carried over from an earlier task on the same
  // asset (Genset Identification/Alternator & Panel) — shown, but locked
  // from further changes rather than hidden, same reasoning as every
  // other "locked" field pattern in these forms (e.g. DEF Level's KVA
  // gate): visible context beats a blank field with no explanation.
  disabled?: boolean;
};

// A tap-to-open dropdown field used across the task form's asset sections.
// Opens as a small panel anchored right under the field (see
// AnchoredPanel's own comment for why it's not a full-screen sheet/Modal —
// in short, so the rest of the screen keeps scrolling normally while
// it's open, instead of needing an explicit tap to close it first).
export function DropdownField({ label, value, options, onSelect, required = true, plainLabel = false, placeholder = '', requiredAsterisk = false, disabled = false }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={plainLabel ? styles.fieldLabelPlain : styles.fieldLabel}>
        {plainLabel ? label : `${required ? '● ' : ''}${label}`}
        {requiredAsterisk && <Text style={styles.requiredAsterisk}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.dropdownInput, visible && styles.dropdownInputActive, disabled && styles.dropdownInputDisabled]}
        onPress={() => !disabled && setVisible((v) => !v)}
        disabled={disabled}
      >
        <Text style={[styles.dropdownText, disabled && styles.dropdownTextDisabled]}>{value || placeholder}</Text>
        {!disabled && <Text style={styles.dropdownArrow}>▾</Text>}
      </TouchableOpacity>

      <AnchoredPanel visible={visible} maxHeight={340} minWidth={220}>
        {/* Plain ScrollView + map, not FlatList — these lists are always a
            handful of strings (never long enough to need virtualization),
            and a VirtualizedList nested inside the screen's own ScrollView
            (now that AnchoredPanel isn't a separate Modal anymore) throws
            "VirtualizedLists should never be nested inside plain
            ScrollViews with the same orientation".
            Explicit maxHeight on the ScrollView itself, matching the
            panel's own maxHeight — flexShrink alone doesn't reliably make
            this an actually-scrollable bounded viewport once a list is
            long enough to exceed it (found via newServiceJob.tsx's
            Category picker hitting exactly this with a long list). */}
        {/* keyboardShouldPersistTaps="handled" — without it, tapping an
            option while a text field's keyboard is still up spends that
            first tap dismissing the keyboard instead of picking the
            option, needing a second tap to actually select it. The outer
            screen ScrollView already has this set, but a nested
            ScrollView like this one needs its own — it isn't inherited. */}
        <ScrollView style={{ flexShrink: 1, maxHeight: 340 }} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {['—', ...options].map((item) => {
            // The blank row's own real value is '' (see onSelect below),
            // not the literal '—' it displays — compare against that so
            // the blank row correctly highlights as selected when nothing's
            // been picked yet, instead of never matching.
            const isSelected = item === '—' ? value === '' : value === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                onPress={() => { onSelect(item === '—' ? '' : item); setVisible(false); }}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </AnchoredPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  // The panel positions itself (position: 'absolute', top: '100%') relative
  // to this — since the label sits above the trigger with no absolutely
  // positioned siblings involved, this container's own bottom edge already
  // coincides with the trigger's bottom edge, so top: '100%' lands the
  // panel exactly where it should without needing to measure anything.
  container: { position: 'relative' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  fieldLabelPlain: {
    fontSize: 13,
    fontWeight: '700',
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
  dropdownInputDisabled: { backgroundColor: '#F3F4F6' },
  dropdownText: {
    fontSize: 14,
    color: '#1F2937',
  },
  dropdownTextDisabled: { color: '#6B7280' },
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
    backgroundColor: '#DBEAFE',
  },
  optionText: {
    fontSize: 15,
    color: '#1F2937',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#1D4ED8',
  },
});
