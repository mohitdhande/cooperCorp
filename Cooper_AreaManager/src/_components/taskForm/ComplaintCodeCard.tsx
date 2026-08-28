import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { X, Pencil, CheckCheck } from 'lucide-react-native';
import { SelectedComplaintCode } from '../../models/taskForm.types';

type Props = {
  item: SelectedComplaintCode;
  onRemove: () => void;
  onChangeObservation: (text: string) => void;
  onChangeRootCause: (text: string) => void;
  onChangeCorrectiveAction?: (text: string) => void;
  // Persists every selected complaint code (the backend saves the whole
  // list in one call — there's no single-item save endpoint) and is wired
  // to each card's own save button so editing one card doesn't require
  // finding a separate page-level save action.
  onSave: () => void;
  isSaving?: boolean;
};

// A selected complaint code — a read-only summary (code/priority pills,
// title, colored Observation/Root Cause/Corrective Action blocks) by
// default, switching to editable text areas once the pencil button is
// tapped. Corrective action is SR (service) tasks only — pass
// onChangeCorrectiveAction to show that field.
//
// Two distinct save mechanisms, one per phase:
// - Before the very first save (a freshly-added, never-saved code), the
//   top-right button is disabled — there's nothing to "edit again" yet —
//   and the dedicated green circle below is the only way to save.
// - After that first save, the green circle disappears and the top-right
//   button takes over entirely: it shows a pencil in view mode (tap to
//   edit), swaps to a checkmark once editing (tap to save the update and
//   collapse back to the summary view, pencil again).
export function ComplaintCodeCard({ item, onRemove, onChangeObservation, onChangeRootCause, onChangeCorrectiveAction, onSave, isSaving }: Props) {
  // Freshly-added codes (item.isNew) open straight into the editable
  // fields instead of an empty read-only summary — only re-collapses to
  // the summary view once actually saved. Only read once per card (a new
  // uid mounts a new card instance), so editing later doesn't reopen it.
  const [isEditing, setIsEditing] = useState(!!item.isNew);
  const [hasSavedOnce, setHasSavedOnce] = useState(!item.isNew);

  const handleTopRightPress = () => {
    if (!hasSavedOnce) return;
    if (isEditing) {
      onSave();
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{item.code}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.actionPill}>
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonLeft]} onPress={onRemove}>
            <X size={20} color="#0F0F0F" />
          </TouchableOpacity>
          {/* Disabled until the first save (nothing to re-edit yet); after
              that, doubles as both the edit-toggle and the save action —
              pencil opens editing, and the same button turns into a
              checkmark that saves and collapses back to the summary. */}
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonRight, !hasSavedOnce && styles.actionButtonDisabled]}
            onPress={handleTopRightPress}
            disabled={!hasSavedOnce || (isEditing && isSaving)}
          >
            {isEditing && isSaving ? (
              <ActivityIndicator size="small" color="#0F0F0F" />
            ) : isEditing ? (
              <CheckCheck size={20} color="#0F0F0F" />
            ) : (
              <Pencil size={20} color="#0F0F0F" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.breadcrumb}>{item.categoryName} › {item.subcategoryName}</Text>
      </View>

      {isEditing ? (
        <>
          <View>
            <Text style={styles.fieldLabel}>Observation</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the observation..."
              placeholderTextColor="#9CA3AF"
              value={item.observation}
              onChangeText={onChangeObservation}
              multiline
            />
          </View>

          <View>
            <Text style={styles.fieldLabel}>Root Cause</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe the root cause..."
              placeholderTextColor="#9CA3AF"
              value={item.rootCause}
              onChangeText={onChangeRootCause}
              multiline
            />
          </View>

          {onChangeCorrectiveAction && (
            <View>
              <Text style={styles.fieldLabel}>Corrective Action Taken</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the corrective action taken..."
                placeholderTextColor="#9CA3AF"
                value={item.correctiveAction}
                onChangeText={onChangeCorrectiveAction}
                multiline
              />
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.infoBlock, { backgroundColor: '#FFFAD9' }]}>
            <Text style={styles.infoBlockTitle}>Observation</Text>
            <Text style={styles.infoBlockValue}>{item.observation || 'Not added yet'}</Text>
          </View>

          <View style={[styles.infoBlock, { backgroundColor: '#FFD9D9' }]}>
            <Text style={styles.infoBlockTitle}>Root Cause</Text>
            <Text style={styles.infoBlockValue}>{item.rootCause || 'Not added yet'}</Text>
          </View>

          {onChangeCorrectiveAction && (
            <View style={[styles.infoBlock, { backgroundColor: '#DBF9E2' }]}>
              <Text style={styles.infoBlockTitle}>Corrective Action</Text>
              <Text style={styles.infoBlockValue}>{item.correctiveAction || 'Not added yet'}</Text>
            </View>
          )}
        </>
      )}

      {/* Only shown before the first save — this card's own save,
          independent of every other complaint code card's. Same green
          circular double-check button as SelectedPartCard's own save
          button, for visual consistency between the two card types. Once
          saved once, the top-right button takes over editing/saving and
          this disappears for good on this card. */}
      {!hasSavedOnce && (
        <View style={styles.saveRow}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => { onSave(); setIsEditing(false); setHasSavedOnce(true); }}
            disabled={isSaving}
          >
            {isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <CheckCheck size={18} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: '#F7A57C',
    borderRadius: 120,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F0F',
    opacity: 0.5,
  },
  // Joined X/edit(-save) pill — same segmented-pill language as the
  // checklist toggle and the qty stepper: outer corners rounded, inner
  // corners sharp.
  actionPill: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBDBDB',
    padding: 4,
    gap: 4,
  },
  actionButton: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DEDEDE',
  },
  actionButtonLeft: {
    borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
    borderTopRightRadius: 2, borderBottomRightRadius: 2,
  },
  actionButtonRight: {
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
    borderTopLeftRadius: 2, borderBottomLeftRadius: 2,
  },
  actionButtonDisabled: { opacity: 0.4 },
  titleBlock: { gap: 2 },
  title: {
    fontWeight: '700',
    color: '#0F0F0F',
    fontSize: 16,
  },
  breadcrumb: {
    fontSize: 14,
    color: '#0F0F0F',
    opacity: 0.5,
  },
  infoBlock: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  infoBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F0F',
  },
  infoBlockValue: {
    fontSize: 14,
    color: '#0F0F0F',
    opacity: 0.5,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  saveButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
  },
});
