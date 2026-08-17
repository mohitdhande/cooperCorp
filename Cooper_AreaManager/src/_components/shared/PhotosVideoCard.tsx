import React from 'react';
import { View, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { Camera, CheckCheck, Image as ImageIcon, Trash2, Video, X } from 'lucide-react-native';
import { SitePhoto } from '../../models/taskForm.types';
import { formatFileSize } from '../../utils/reportFormatters';
import { MAX_PHOTO_SIZE_BYTES } from '../../utils/photoValidation';

const MAX_PHOTO_MB = MAX_PHOTO_SIZE_BYTES / (1024 * 1024);

type Props = {
  sitePhotos: SitePhoto[];
  onRemove: (id: string) => void;
  onAddPress: () => void;
  photosUploading: boolean;
  photosUploadProgress: number;
  photosUploadSuccess: boolean;
  photosUploadError?: string;
  videosUploading: boolean;
  videosUploadProgress: number;
  videosUploadSuccess: boolean;
  // Step 2's running-hours upload only ever takes images (no video, no
  // PDF) — flips the header/add-box copy to match instead of always
  // claiming "& Video" for a caller that can never actually add one.
  imagesOnly?: boolean;
};

// One combined "PHOTOS & VIDEO" card — shared by the Commissioning
// (taskForm.tsx) and Service (srTaskForm.tsx) forms' own Step 6 / Step 3,
// instead of each screen hand-rolling its own copy. Photos render as a
// thumbnail grid (multipart upload); videos render as their own list rows
// with filename/size/status (GCS upload — no multipart endpoint for video
// on either backend), all behind one "Add Photo or Video" trigger — that
// split is invisible to the user here. PDFs never appear in this card even
// if present in sitePhotos — they belong to the separate DocumentsCard.
export function PhotosVideoCard({
  sitePhotos, onRemove, onAddPress,
  photosUploading, photosUploadProgress, photosUploadSuccess, photosUploadError,
  videosUploading, videosUploadProgress, videosUploadSuccess,
  imagesOnly = false,
}: Props) {
  const photos = sitePhotos.filter((p) => p.mediaType !== 'video' && p.mediaType !== 'pdf');
  const videos = sitePhotos.filter((p) => p.mediaType === 'video');
  const videoStatusLabel = videosUploading ? `Uploading… ${videosUploadProgress}%` : videosUploadSuccess ? 'Uploaded' : 'Ready';

  return (
    <View style={styles.card}>
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <View style={styles.iconChip}>
            <ImageIcon size={16} color="#E76124" />
          </View>
          <Text style={styles.title}>{imagesOnly ? 'PHOTOS' : 'PHOTOS & VIDEO'}</Text>
        </View>
        {/* Real enforced limits (photoValidation.ts) — photos are capped,
            videos deliberately aren't ("per explicit instruction not to
            restrict video size at all"), so this never claims a video cap. */}
        <Text style={styles.subtitle}>
          Photo {MAX_PHOTO_MB} MB max{imagesOnly ? '' : ' · Video 100 mb max'}
        </Text>
      </View>

      {photos.length > 0 && (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.thumbWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              <TouchableOpacity style={styles.removeBadge} onPress={() => onRemove(photo.id)}>
                <X size={14} color="#FFFFFF" />
              </TouchableOpacity>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.videoFileName} numberOfLines={1}>{video.fileName}</Text>
                  <Text style={styles.videoMeta}>{sizeLabel ? `${sizeLabel} · ${videoStatusLabel}` : videoStatusLabel}</Text>
                </View>
                <TouchableOpacity style={styles.videoDeleteButton} onPress={() => onRemove(video.id)}>
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.addBox} onPress={onAddPress}>
        <View style={styles.addIconCircle}>
          <Camera size={22} color="#6B7280" />
        </View>
        <Text style={styles.addTitle}>
          {sitePhotos.some((p) => p.mediaType !== 'pdf') ? 'Add More' : imagesOnly ? 'Add Photo' : 'Add Photo or Video'}
        </Text>
        <Text style={styles.addSubtitle}>Tap to open camera or gallery</Text>
      </TouchableOpacity>

      {/* No separate save button — photos/videos upload automatically when
          leaving this step, with live % progress shown right here. */}
      {photosUploading && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#E76124" />
          <Text style={styles.statusText}>Uploading photos... {photosUploadProgress}%</Text>
        </View>
      )}
      {!photosUploading && photosUploadSuccess && (
        <View style={styles.statusRow}>
          <CheckCheck size={16} color="#16A34A" />
          <Text style={[styles.statusText, { color: '#16A34A' }]}>Photos uploaded</Text>
        </View>
      )}
      {!!photosUploadError && <Text style={styles.errorText}>{photosUploadError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 16, gap: 16 },
  headerBlock: { gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#FCEEDD',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#000000', letterSpacing: 0.4 },
  subtitle: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbWrapper: { width: 150, height: 120, borderRadius: 16, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  removeBadge: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center',
  },
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusText: { fontSize: 13, fontWeight: '600', color: '#E76124' },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500' },
});
