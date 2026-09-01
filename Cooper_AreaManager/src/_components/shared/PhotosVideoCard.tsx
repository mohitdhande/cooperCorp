import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
// expo-image (not RN's own Image) — disk-caches by URL/URI, so a thumbnail
// already rendered once (local pick or a hydrated signed GCS URL) doesn't
// get re-decoded/re-fetched every time this list re-renders.
import { Image } from 'expo-image';
import { Text } from '@/_components/AppText';
import { Camera, Image as ImageIcon, Trash2, Video, X } from 'lucide-react-native';
import { SitePhoto } from '../../models/taskForm.types';
import { formatFileSize } from '../../utils/reportFormatters';
import { MAX_PHOTO_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES } from '../../utils/photoValidation';
import { MediaTagPicker } from './MediaTagPicker';
import { MediaLocationButton } from './MediaLocationButton';

const MAX_PHOTO_MB = MAX_PHOTO_SIZE_BYTES / (1024 * 1024);
const MAX_VIDEO_MB = MAX_VIDEO_SIZE_BYTES / (1024 * 1024);

type Props = {
  sitePhotos: SitePhoto[];
  onRemove: (id: string) => void;
  onAddPress: () => void;
  // Step 2's running-hours upload only ever takes images (no video, no
  // PDF) — flips the header/add-box copy to match instead of always
  // claiming "& Video" for a caller that can never actually add one.
  imagesOnly?: boolean;
  // Caps how many photos+videos (pdfs don't count, they're DocumentsCard's
  // own concern) this card accepts — e.g. Running Hours only ever wants
  // exactly one photo. Omitted/undefined means no cap, every other caller.
  // Once reached, the Add trigger is replaced with a plain notice instead
  // of offering "Add More".
  maxItems?: number;
  // Fires MediaTagPicker's picked/cleared tags up to the caller, which owns
  // the actual PATCH call (Commissioning/Service each have their own).
  // Omitted entirely (rather than defaulted to a no-op) hides the tag
  // picker altogether — used nowhere today, every real caller passes it,
  // but keeps this card usable in a context that hasn't wired tagging yet.
  onUpdateTag?: (gcsUrl: string, tags: string[]) => void;
};

// One combined "PHOTOS & VIDEO" card — shared by the Commissioning
// (taskForm.tsx) and Service (srTaskForm.tsx) forms' own Step 6 / Step 3,
// instead of each screen hand-rolling its own copy. Photos render as a
// thumbnail grid (multipart upload); videos render as their own list rows
// with filename/size (GCS upload — no multipart endpoint for video on
// either backend), all behind one "Add Photo or Video" trigger — that
// split is invisible to the user here. PDFs never appear in this card even
// if present in sitePhotos — they belong to the separate DocumentsCard.
//
// No in-card upload-progress state anymore — every item only ever lands in
// sitePhotos once its own upload has already succeeded (see
// useMediaUploadQueue), so this card is never rendered mid-upload in the
// first place; MediaUploadOverlay is the single place that shows progress.
export function PhotosVideoCard({ sitePhotos, onRemove, onAddPress, imagesOnly = false, maxItems, onUpdateTag }: Props) {
  const photos = sitePhotos.filter((p) => p.mediaType !== 'video' && p.mediaType !== 'pdf');
  const videos = sitePhotos.filter((p) => p.mediaType === 'video');
  const itemCount = photos.length + videos.length;
  const atLimit = maxItems != null && itemCount >= maxItems;

  return (
    <View style={styles.card}>
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <View style={styles.iconChip}>
            <ImageIcon size={16} color="#E76124" />
          </View>
          <Text style={styles.title}>{imagesOnly ? 'PHOTOS' : 'PHOTOS & VIDEO'}</Text>
        </View>
        <Text style={styles.subtitle}>
          Photo {MAX_PHOTO_MB} MB max{imagesOnly ? '' : ` · Video ${MAX_VIDEO_MB} MB max`}
        </Text>
      </View>

      {photos.length > 0 && (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.thumbWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              {/* Tag / location / remove, all as small overlay icons in one
                  row at the top of the thumbnail. */}
              <View style={styles.thumbIconRow}>
                {!!onUpdateTag && (
                  <MediaTagPicker
                    variant="icon"
                    type={photo.type}
                    tags={photo.tags}
                    disabled={!photo.gcsUrl}
                    onSelectTag={(tags) => onUpdateTag(photo.gcsUrl!, tags)}
                  />
                )}
                <MediaLocationButton location={photo.location} />
                <TouchableOpacity style={styles.iconOverlayButton} onPress={() => onRemove(photo.id)}>
                  <X size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {/* Picked tag, overlaid as a label at the bottom of the
                  thumbnail. */}
              {!!photo.tags?.[0] && (
                <View style={styles.thumbLabelBar}>
                  <Text style={styles.thumbLabelText} numberOfLines={1}>{photo.tags[0]}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {videos.length > 0 && (
        <View style={styles.videoList}>
          {videos.map((video) => {
            const sizeLabel = formatFileSize(video.fileSize);
            return (
              <View key={video.id} style={styles.videoRow}>
                <View style={styles.videoIconChip}>
                  <Video size={18} color="#374151" />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.videoFileName} numberOfLines={1}>{video.fileName}</Text>
                  {!!sizeLabel && <Text style={styles.videoMeta}>{sizeLabel}</Text>}
                  <View style={styles.videoActionsRow}>
                    {!!onUpdateTag && (
                      <MediaTagPicker
                        type={video.type}
                        tags={video.tags}
                        disabled={!video.gcsUrl}
                        onSelectTag={(tags) => onUpdateTag(video.gcsUrl!, tags)}
                      />
                    )}
                    <MediaLocationButton location={video.location} variant="inline" />
                  </View>
                </View>
                <TouchableOpacity style={styles.videoDeleteButton} onPress={() => onRemove(video.id)}>
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {atLimit ? (
        <View style={styles.limitNotice}>
          <Text style={styles.limitNoticeText}>
            Only {maxItems} photo{maxItems === 1 ? '' : 's'} allowed here — remove the current one to add a different photo.
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBox} onPress={onAddPress}>
          <View style={styles.addIconCircle}>
            <Camera size={22} color="#6B7280" />
          </View>
          <Text style={styles.addTitle}>
            {sitePhotos.some((p) => p.mediaType !== 'pdf') ? 'Add More' : imagesOnly ? 'Add Photo' : 'Add Photo or Video'}
          </Text>
          <Text style={styles.addSubtitle}>Tap to open camera or gallery</Text>
        </TouchableOpacity>
      )}

      {/* What to actually photograph — same guidance regardless of which
      screen/step this card is rendered in, since it's one shared
      component. */}
      <Text style={styles.guidanceNote}>
        Photo - Genset All Side / Foundation/ Earthing/ Control Panel Power Cable Connection/GSN/ESN/Alternator Sr.No./Controller/RMS device/Battery/ATS Sr No.Etc.
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 16, gap: 16 },
  headerBlock: { gap: 4 },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#FCEEDD',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#000000', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbWrapper: { width: 150, height: 120, borderRadius: 16, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  // Tag / location / remove — one row of small overlay icons across the
  // top of the thumbnail.
  thumbIconRow: {
    position: 'absolute', top: 8, left: 8, right: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  iconOverlayButton: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  // The picked tag, shown as a label bar across the bottom of the
  // thumbnail — inside thumbWrapper's own overflow: 'hidden' bounds.
  thumbLabelBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  thumbLabelText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  videoList: { gap: 12 },
  videoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 12,
  },
  videoIconChip: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  videoFileName: { fontSize: 15, fontWeight: '700', color: '#000000' },
  videoMeta: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  videoActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  videoDeleteButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  addBox: {
    borderWidth: 1, borderColor: '#C6C6C6', borderStyle: 'dashed', borderRadius: 24,
    backgroundColor: '#F8F8F8',
    paddingVertical: 24, alignItems: 'center', gap: 4,
  },
  addIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  addTitle: { fontSize: 18, fontWeight: '700', color: '#000000' },
  addSubtitle: { fontSize: 16, fontWeight: '400', color: '#000000', opacity: 0.3 },
  guidanceNote: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', lineHeight: 17 },
  limitNotice: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16,
    backgroundColor: '#F8F8F8',
    paddingVertical: 16, paddingHorizontal: 14,
  },
  limitNoticeText: { fontSize: 13, fontWeight: '500', color: '#6B7280', textAlign: 'center' },
});
