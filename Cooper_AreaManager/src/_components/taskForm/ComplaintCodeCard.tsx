import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { X, Pencil, CheckCheck, Camera } from 'lucide-react-native';
import { SelectedComplaintCode, SitePhoto } from '../../models/taskForm.types';
import { MediaLocationButton } from '../shared/MediaLocationButton';

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
  // One optional image per card, matching the Running Hours meter-photo
  // pattern (compact dashed "add" trigger when empty, a small thumbnail
  // once picked). Omitted entirely (not just undefined-valued) hides this
  // section — kept optional so this component stays usable anywhere a
  // caller hasn't wired fault-code images.
  photo?: SitePhoto;
  onAddPhoto?: () => void;
  onRemovePhoto?: () => void;
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
export function ComplaintCodeCard({ item, onRemove, onChangeObservation, onChangeRootCause, onChangeCorrectiveAction, onSave, isSaving, photo, onAddPhoto, onRemovePhoto }: Props) {
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

      {/* Fault code image — one optional photo per card, same compact
          dashed "add" trigger / thumbnail-with-remove pattern as the
          Running Hours meter photo, just sized to sit inline on this card
          rather than stretched full width. Sits after the observation/
          root-cause/corrective-action fields (whichever variant is
          showing) and before the save row, regardless of edit state. */}
      {!!onAddPhoto && (
        photo ? (
          <View style={styles.faultPhotoWrapper}>
            <Image source={{ uri: photo.uri }} style={styles.faultPhotoThumb} />
            {/* Same top icon row as every other photo thumbnail in this
                app (PhotosVideoCard) — location on the left, remove on the
                right. No MediaTagPicker here on purpose: the tag isn't
                user-editable for this photo (it's auto-set to
                complaintCodeMediaTag(item.code) so the report can link it
                back to this exact card — see useTaskFormPhotos.ts's own
                comment), so it's shown read-only in the label bar below
                instead of behind a tappable picker. */}
            <View style={styles.faultPhotoIconRow}>
              <MediaLocationButton location={photo.location} />
              {!!onRemovePhoto && (
                <TouchableOpacity style={styles.faultPhotoRemove} onPress={onRemovePhoto}>
                  <X size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
            {!!photo.tags?.[0] && (
              <View style={styles.faultPhotoLabelBar}>
                <Text style={styles.faultPhotoLabelText} numberOfLines={1}>{photo.tags[0]}</Text>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.faultPhotoAddBox} onPress={onAddPhoto}>
            <Camera size={16} color="#6B7280" />
            <Text style={styles.faultPhotoAddText}>+ Fault Code Image</Text>
          </TouchableOpacity>
        )
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
  // Compact, self-sized (not stretched full width) — matches the small
  // dashed "Add Meter Photo" pill used elsewhere, just scaled to sit inline
  // on this card instead of the full-width PhotosVideoCard/SelfieCard
  // add-box these forms otherwise use for a full section.
  faultPhotoAddBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#C6C6C6', borderStyle: 'dashed', borderRadius: 16,
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  faultPhotoAddText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  faultPhotoWrapper: {
    alignSelf: 'flex-start',
    width: 100, height: 100, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  faultPhotoThumb: { width: '100%', height: '100%' },
  // Same top icon row PhotosVideoCard's own thumbnails use — location on
  // the left, remove on the right.
  faultPhotoIconRow: {
    position: 'absolute', top: 6, left: 6, right: 6,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  faultPhotoRemove: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  // Read-only — this tag isn't user-editable (see the comment above where
  // this renders), so it's a plain label bar, not a tappable MediaTagPicker
  // chip. Same bottom-bar-over-the-thumbnail look as the report's own
  // reportThumbLabelBar/taskReport.tsx.
  faultPhotoLabelBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 5,
  },
  faultPhotoLabelText: { fontSize: 10.5, fontWeight: '700', color: '#FFFFFF' },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  saveButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
  },
});
