import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/_components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserCog, Check } from 'lucide-react-native';
import { TeamMember } from '../../models/myTeam.types';
import { UserAvatar } from './UserAvatar';
import { getRole } from '../../constants/permissions';

type Props = {
  visible: boolean;
  onClose: () => void;
  engineers: TeamMember[];
  // Fetching the team roster itself.
  loading: boolean;
  // Performing the actual assign call — keeps the sheet open with a spinner
  // on the Assign button instead of closing immediately, so a failure can
  // be retried from the same sheet.
  assigning?: boolean;
  // Set when the last assign attempt failed — shown above the Assign
  // button so the sheet's own retry stays visible instead of only landing
  // on the task card underneath it.
  error?: string;
  // The asset this job is for (e.g. its genset number) — shown under the
  // title, same as the reference design's subtitle line.
  subtitle?: string;
  onConfirm: (engineer: TeamMember) => void;
  // Dealers assign to engineers, area managers assign to dealers — same
  // sheet, different heading for whichever subordinate role is actually
  // listed below it.
  title?: string;
  // Text on the right-hand confirm button — defaults to "Assign" (with the
  // UserCog icon) for callers reassigning an already-created task. The
  // reference design's own "Assign To" picker (New Job/New Service Job,
  // choosing who to create the job for) instead reads "Select" with no
  // icon — pass that explicitly where it applies.
  confirmLabel?: string;
};

// "Hand this task to one of my subordinates" sheet — tap a row to select
// it, then tap Assign to confirm (a real two-step flow, not tap-to-assign-
// immediately) so a misstap doesn't silently reassign the task. Same
// bottom-sheet chrome as profile.tsx's photo-options sheet.
export function AssignEngineerModal({
  visible, onClose, engineers, loading, assigning, error, subtitle, onConfirm, title = 'Assign to Engineer', confirmLabel = 'Assign',
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fresh selection every time the sheet opens for a (possibly different)
  // task.
  useEffect(() => {
    if (visible) setSelectedId(null);
  }, [visible]);

  const selected = engineers.find((e) => e._id === selectedId) || null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <View style={styles.dragHandle} />

          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

          {!loading && engineers.length > 0 && (
            <Text style={styles.availableCount}>{engineers.length} user{engineers.length === 1 ? '' : 's'} available</Text>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color="#F26722" />
          ) : engineers.length === 0 ? (
            <Text style={styles.emptyText}>No team members yet.</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              {engineers.map((engineer) => {
                const isSelected = engineer._id === selectedId;
                // A dealer row's own company name is the meaningful primary
                // label (that's who the job is really going to) with the
                // contact person's name as the sublabel — the reverse of an
                // engineer row, where the person themselves is who's being
                // assigned and dealerName is just which dealer they're
                // under. Matches the reference design's own row convention.
                const isDealerRow = getRole(engineer.role) === 'dealer';
                const primaryLabel = isDealerRow ? (engineer.dealerName || engineer.name) : engineer.name;
                const secondaryLabel = isDealerRow ? engineer.name : engineer.dealerName;
                return (
                  <TouchableOpacity
                    key={engineer._id}
                    style={[styles.row, isSelected && styles.rowSelected]}
                    onPress={() => setSelectedId(engineer._id)}
                  >
                    <UserAvatar userId={engineer._id} name={engineer.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowText} numberOfLines={1}>{primaryLabel}</Text>
                      {!!secondaryLabel && (
                        <Text style={styles.rowSubtext} numberOfLines={1}>{secondaryLabel}</Text>
                      )}
                    </View>
                    {/* Solid filled circle + white checkmark once selected —
                        a plain smaller dot inside the ring (the initial
                        implementation) read as a generic radio button;
                        the reference design's own selected state is this
                        check-circle instead. Unselected stays the same
                        empty ring. */}
                    {isSelected ? (
                      <View style={styles.radioSelected}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.radioOuter} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={assigning}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.assignButton, (!selected || assigning) && styles.assignButtonDisabled]}
              onPress={() => selected && onConfirm(selected)}
              disabled={!selected || assigning}
            >
              {assigning ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  {/* "Select" -> "Selecting...", "Assign" -> "Assigning..."
                      — so a real API delay (the reassign flows on Dashboard/
                      Commissioning/Service lists) reads as still-working
                      instead of a bare spinner with no label. */}
                  <Text style={styles.assignButtonText}>{confirmLabel}ing...</Text>
                </>
              ) : (
                <>
                  {/* Only the default "Assign" wording gets the person-icon
                      — "Select" (New Job/New Service Job's own picker) reads
                      fine as plain text, matching the reference design. */}
                  {confirmLabel === 'Assign' && <UserCog size={18} color="#FFFFFF" />}
                  <Text style={styles.assignButtonText}>{confirmLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#000000' },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 2, marginBottom: 16 },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  availableCount: { fontSize: 13, color: '#9CA3AF', marginTop: 10, marginBottom: 4 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
  list: { maxHeight: 260, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 10,
  },
  rowSelected: { borderColor: '#F26722', borderWidth: 2, backgroundColor: '#FFF4EE' },
  rowText: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: '#1F2937' },
  rowSubtext: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 1 },
  // Plain radio circle, empty until selected — the reference design's own
  // single-select indicator, replacing the row-border/tint highlight as the
  // only signal (that highlight still stays, this is in addition to it).
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#D1D5DB',
  },
  radioSelected: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  footerRow: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1,
    height: 52, borderRadius: 100,
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelButtonText: { color: '#374151', fontSize: 16, fontWeight: '700' },
  assignButton: {
    flex: 1,
    flexDirection: 'row', gap: 8,
    height: 52, borderRadius: 100,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  assignButtonDisabled: { opacity: 0.5 },
  assignButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
