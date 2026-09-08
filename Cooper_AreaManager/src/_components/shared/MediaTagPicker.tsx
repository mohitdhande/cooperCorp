import React, { useState } from 'react';
import { Modal, Pressable, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/_components/AppText';
import { Tag, X, Check } from 'lucide-react-native';
import { MediaType } from '../../models/taskForm.types';

// Fixed option lists per the mobile-commissioning developer guide §9.4 —
// single source of truth for both Commissioning and Service (the guide
// states these are fixed regardless of form). Mirror exactly if these ever
// need to change; the backend/report side expects these literal strings.
export const PHOTO_VIDEO_TAGS = [
  'Genset All Side', 'Foundation', 'Earthing', 'Control Panel', 'Power Cable Connection',
  'GSN', 'ESN', 'Alternator Sr.No.', 'Controller', 'RMS device', 'Battery', 'ATS Sr',
  'Failed Parts', 'New Used Parts',
];
export const PDF_TAGS = [
  'Delivery Challan', 'EDO for warranty parts', 'AMC CAMC part Requirement format', 'Quotation', 'Approval',
];

type Props = {
  // The item's confirmed MediaType — chooses which fixed list applies.
  // Undefined only while an item hasn't finished uploading yet (see
  // `disabled` below), in which case this picker isn't shown at all.
  type?: MediaType;
  // 0 or 1 tag — this UI only ever picks exactly one, but the prop/callback
  // stay array-shaped to match the backend's own tags: string[] field.
  tags?: string[];
  onSelectTag: (tags: string[]) => void;
  // True while the item has no gcsUrl yet (mid-upload) — tagging needs the
  // real gcsUrl as PATCH's own key, so there's nothing to tag against yet.
  // In practice PhotosVideoCard/DocumentsCard are never rendered mid-upload
  // anyway (every item only lands there once its own upload has already
  // succeeded), so this is a defensive fallback, not the common case.
  disabled?: boolean;
  // 'chip' (default) = the pill with text, for a video/PDF row (no image
  // to overlay onto there). 'icon' = a small circular semi-transparent
  // overlay button with no label, for a photo thumbnail's own top icon
  // row — matches MediaLocationButton's 'overlay' variant visually. 'label'
  // = a full-width dark bar across the bottom of a photo thumbnail,
  // always showing either the current tag or "Add Tag" — used instead of
  // 'icon' so an untagged photo visibly invites tagging instead of just
  // showing a small, easy-to-miss icon.
  variant?: 'chip' | 'icon' | 'label';
};

// Small "+ Tag" chip (or the current tag, once picked) shown on each
// uploaded photo/video/PDF — tap it to open a bottom sheet of the fixed
// options for that item's type and pick one, or "Clear tag" to remove it.
// A real Modal (not AnchoredPanel's inline dropdown — see its own comment
// for why that one deliberately has no outside-tap backdrop) so tapping
// anywhere outside the sheet closes it, same pattern as every other
// option-picking sheet in this app (AssignEngineerModal, the "Add Photo"
// sheets). Tagging is optional and separate from the upload itself (see
// updateCommissioningMediaTag/updateServiceMediaTag in commisionAPi.ts) —
// this component only ever fires onSelectTag, never blocks anything.
export function MediaTagPicker({ type, tags, onSelectTag, disabled, variant = 'chip' }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const currentTag = tags?.[0];
  const options = type === 'pdf' ? PDF_TAGS : PHOTO_VIDEO_TAGS;

  if (disabled || !type) return null;

  const handlePick = (tag: string) => {
    onSelectTag([tag]);
    setVisible(false);
  };
  const handleClear = () => {
    onSelectTag([]);
    setVisible(false);
  };

  return (
    <>
      {variant === 'icon' ? (
        <TouchableOpacity style={styles.iconButton} onPress={() => setVisible(true)}>
          <Tag size={14} color="#FFFFFF" />
        </TouchableOpacity>
      ) : variant === 'label' ? (
        <TouchableOpacity style={styles.labelBar} onPress={() => setVisible(true)}>
          <Tag size={12} color="#FFFFFF" />
          {/* numberOfLines={2}, not 1 — same truncation problem as the chip
              variant above (a real tag like "Power Cable Connection" or
              "AMC CAMC part Requirement format" is longer than this bar
              usually needs to be for the short default "Add Tag"). This bar
              overlays a photo thumbnail rather than sitting in a row with
              other controls, so letting it grow to a second line is the
              simplest fix here — no sibling to collide with. */}
          <Text style={[styles.labelBarText, !currentTag && styles.labelBarTextEmpty]} numberOfLines={2}>
            {currentTag || 'Add Tag'}
          </Text>
        </TouchableOpacity>
      ) : (
        // Used by video/PDF rows (no thumbnail to overlay a bar onto, so
        // this sits inline next to the location button instead). Used to
        // read a plain grey "Tag" when untagged — easy to miss next to the
        // location pin icon, and didn't match photos' own bold "Add Tag"
        // bar. Untagged now uses the same dashed-orange "something to add
        // here" look the rest of the form already uses (e.g. DocumentsCard's
        // own Upload PDF button) instead of blending into the row.
        <TouchableOpacity
          style={[styles.chip, currentTag ? styles.chipTagged : styles.chipUntagged]}
          onPress={() => setVisible(true)}
        >
          <Tag size={12} color={currentTag ? '#E76124' : '#6B7280'} style={{ marginTop: 1 }} />
          <Text style={[styles.chipText, currentTag ? styles.chipTextTagged : styles.chipTextUntagged]}>
            {currentTag || 'Add Tag'}
          </Text>
        </TouchableOpacity>
      )}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          {/* Plain View, not a nested Pressable — same reasoning as every
              other bottom-sheet in this app (AssignEngineerModal etc.): a
              second Pressable here makes the outer/inner overlay negotiate
              for the touch on Android, requiring two taps on rows inside. */}
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
            <View style={styles.dragHandle} />
            <Text style={styles.title}>Tag this {type === 'pdf' ? 'document' : type === 'video' ? 'video' : 'photo'}</Text>

            <ScrollView style={styles.list} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
              {!!currentTag && (
                <TouchableOpacity style={[styles.optionRow, styles.clearRow]} onPress={handleClear}>
                  <X size={16} color="#DC2626" />
                  <Text style={styles.clearText}>Clear tag</Text>
                </TouchableOpacity>
              )}
              {options.map((option) => {
                const isSelected = option === currentTag;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => handlePick(option)}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>{option}</Text>
                    {isSelected && <Check size={16} color="#E76124" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 4,
    alignSelf: 'flex-start',
    // Was maxWidth: 140 with numberOfLines={1} on the text — truncated a
    // real tag like "Power Cable Connection" or "AMC CAMC part Requirement
    // format" (both real, fixed options in this picker's own list, see the
    // PHOTO_VIDEO_TAGS/PDF_TAGS above) down to an unreadable ellipsis.
    // flexShrink (not a fixed cap) lets this chip cooperate with whatever
    // sibling it's next to (MediaLocationButton) instead of forcing a hard
    // width, and the text below wraps onto a second line rather than
    // cutting off — PhotosVideoCard/DocumentsCard's own actions row wraps
    // to accommodate it.
    flexShrink: 1,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#F8F8F8',
  },
  chipTagged: { backgroundColor: '#FCEEDD', borderColor: '#F7A57C' },
  // Dashed border, same "tap to add something" affordance as the app's
  // other add-boxes (e.g. DocumentsCard's Upload PDF button) — makes an
  // untagged video/PDF row visibly invite tapping instead of looking like
  // an inert grey label easy to skim past.
  chipUntagged: { borderStyle: 'dashed', borderColor: '#C6C6C6', backgroundColor: '#F8F8F8' },
  chipText: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', flexShrink: 1 },
  chipTextTagged: { color: '#E76124' },
  chipTextUntagged: { color: '#6B7280', fontWeight: '700' },
  // Matches MediaLocationButton's own 'overlay' variant exactly, so the
  // tag/location/remove icons sit as one visually consistent row.
  iconButton: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  // Full-width bar across the bottom of a photo thumbnail — same position/
  // look as PhotosVideoCard's own (now-retired) plain tag label, just
  // always visible and tappable instead of only showing once a tag exists.
  labelBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  labelBarText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },
  labelBarTextEmpty: { color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

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
  title: { fontSize: 18, fontWeight: '700', color: '#000000', marginBottom: 12 },
  list: { maxHeight: 340, marginBottom: 12 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionRowSelected: { backgroundColor: '#FCEEDD' },
  optionText: { flexShrink: 1, fontSize: 15, color: '#1F2937' },
  optionTextSelected: { fontWeight: '700', color: '#E76124' },
  clearRow: { justifyContent: 'flex-start', gap: 8 },
  clearText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
  cancelButton: {
    height: 52, borderRadius: 100,
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelButtonText: { color: '#374151', fontSize: 16, fontWeight: '700' },
});
