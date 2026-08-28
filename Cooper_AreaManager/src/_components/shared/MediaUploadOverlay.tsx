import React from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { Check, X } from 'lucide-react-native';
import { QueueItem } from '../../controllers/shared/useMediaUploadQueue';

type Props = {
  visible: boolean;
  items: QueueItem[];
  onCancelItem: (localId: string) => void;
  onCancelAll: () => void;
  onDismiss: () => void;
};

// "2 MB" / "850 KB" — no decimal point, matching the reference design
// exactly (reportFormatters.ts's own formatFileSize gives "2.0 MB").
function formatSize(bytes?: number): string {
  if (typeof bytes !== 'number') return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function fileExtension(fileName: string): string {
  const ext = fileName.split('.').pop();
  return ext ? ext.toUpperCase() : '';
}

function UploadRow({ item, index, onCancelItem }: { item: QueueItem; index: number; onCancelItem: (localId: string) => void }) {
  const isDone = item.status === 'done';
  const isError = item.status === 'error';
  const isUploading = item.status === 'uploading';

  return (
    <View style={[styles.row, isDone && styles.rowDone, isUploading && styles.rowUploading]}>
      <View style={styles.rowTopLine}>
        <Text style={styles.rowFileName} numberOfLines={1}>
          <Text style={styles.rowIndex}>{String(index + 1).padStart(2, '0')} </Text>
          {item.fileName}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowExt}>{fileExtension(item.fileName)}</Text>
          <Text style={[styles.rowSize, isError && styles.rowSizeError]}>{formatSize(item.fileSize)}</Text>
          {isDone && (
            <View style={styles.statusCircleDone}>
              <Check size={13} color="#FFFFFF" strokeWidth={3} />
            </View>
          )}
          {isError && (
            <View style={styles.statusCircleError}>
              <X size={13} color="#FFFFFF" strokeWidth={3} />
            </View>
          )}
        </View>
      </View>

      {/* Retryable (offline) rows skip their own copy of this message — it's
          the same text on every one of them, so it's shown once for the
          whole batch instead (see MediaUploadOverlay's own offlineBanner
          below). A real, non-retryable error still gets its own per-row
          text, since those messages genuinely differ file to file. */}
      {isError && !!item.errorMessage && !item.retryable && <Text style={styles.rowErrorText}>{item.errorMessage}</Text>}

      {isUploading && (
        <>
          <View style={styles.uploadingLine}>
            <Text style={styles.uploadingLabel}>Uploading</Text>
            <Text style={styles.uploadingPercent}>{item.itemProgress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${item.itemProgress}%` }]} />
          </View>
          <TouchableOpacity style={styles.itemCancelButton} onPress={() => onCancelItem(item.localId)}>
            <Text style={styles.itemCancelButtonText}>CANCEL</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// Full-screen dimmed backdrop behind a centered white card, matching
// the reference design exactly — every picked photo/video/PDF shown as its
// own row, all at once (scrollable if there are more than fit), instead of
// a single-focus "one file at a time" screen. Shared by both the
// Commissioning and Service task forms — one component, one hook driving
// it, so this behavior can't quietly diverge between the two the way
// copy-pasted upload logic has before.
export function MediaUploadOverlay({ visible, items, onCancelItem, onCancelAll, onDismiss }: Props) {
  if (!visible || items.length === 0) return null;

  const isBusy = items.some((it) => it.status === 'pending' || it.status === 'uploading');
  const retryableCount = items.filter((it) => it.retryable).length;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.dim} />

      <View style={styles.card}>
        <Text style={styles.title}>UPLOADING</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <UploadRow key={item.localId} item={item} index={index} onCancelItem={onCancelItem} />
          ))}
        </ScrollView>

        {/* One shared line for every offline (retryable) row instead of
            each repeating the identical message under its own file. */}
        {retryableCount > 0 && (
          <Text style={styles.offlineBannerText}>
            Offline — {retryableCount} file{retryableCount > 1 ? 's' : ''} saved on this device, will upload once you're back online
          </Text>
        )}

        {isBusy ? (
          <TouchableOpacity style={styles.cancelAllButton} onPress={onCancelAll}>
            <Text style={styles.cancelAllButtonText}>CANCEL ALL</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.doneButton} onPress={onDismiss}>
            <Text style={styles.doneButtonText}>DONE</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 100,
  },
  dim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '86%', maxWidth: 380, maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center', letterSpacing: 0.5, marginBottom: 16 },
  list: { flexGrow: 0 },

  row: {
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  rowDone: { backgroundColor: '#E9F9EF', borderColor: '#86EFAC' },
  rowUploading: { borderColor: '#111827', borderWidth: 1.5 },
  rowTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowIndex: { color: '#6B7280', fontWeight: '600' },
  rowFileName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827', marginRight: 8 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  rowExt: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  rowSize: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  rowSizeError: { color: '#DC2626' },
  statusCircleDone: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#22C55E',
    justifyContent: 'center', alignItems: 'center',
  },
  statusCircleError: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
  },
  rowErrorText: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', marginTop: 8 },
  offlineBannerText: {
    fontSize: 12, fontWeight: '600', color: '#B45309',
    textAlign: 'center',
    marginTop: 4, marginBottom: 12,
  },

  uploadingLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  uploadingLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  uploadingPercent: { fontSize: 13, fontWeight: '700', color: '#111827' },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: '#1F2937',
    marginTop: 6, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 3 },
  itemCancelButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 6,
    marginTop: 8,
  },
  itemCancelButtonText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.4 },

  cancelAllButton: {
    borderWidth: 1.5, borderColor: '#111827',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelAllButtonText: { fontSize: 15, fontWeight: '800', color: '#111827', letterSpacing: 0.4 },
  doneButton: {
    backgroundColor: '#111827',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  doneButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },
});
