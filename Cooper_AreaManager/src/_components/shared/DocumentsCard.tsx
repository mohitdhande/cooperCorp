import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { FileText, Plus, Trash2 } from 'lucide-react-native';
import { SitePhoto } from '../../models/taskForm.types';
import { formatFileSize } from '../../utils/reportFormatters';

type Props = {
  pdfs: SitePhoto[];
  uploading: boolean;
  uploadProgress: number;
  uploadSuccess: boolean;
  uploadError?: string;
  onPickPdf: () => void;
  onRemove: (id: string) => void;
};

// PDF-only Documents card — shared by the Commissioning (taskForm.tsx) and
// Service (srTaskForm.tsx) forms' own Step 6 / Step 3, instead of each
// screen hand-rolling its own copy of this same list+upload UI. No camera
// option (a PDF can't be "captured"), and no dedicated document endpoint on
// either backend — picked PDFs ride the same GCS video-confirm flow as
// recorded videos, which is why upload state here is named generically
// (uploading/uploadProgress/...) rather than "pdf"-specific — it's shared
// with whatever's driving the caller's own video upload.
export function DocumentsCard({ pdfs, uploading, uploadProgress, uploadSuccess, uploadError, onPickPdf, onRemove }: Props) {
  const statusLabel = uploading ? `Uploading… ${uploadProgress}%` : uploadSuccess ? 'Uploaded' : 'Ready';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconChip}>
          <FileText size={16} color="#E76124" />
        </View>
        <Text style={styles.title}>DOCUMENTS</Text>
        {pdfs.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pdfs.length}</Text>
          </View>
        )}
      </View>

      {pdfs.length > 0 && (
        <View style={styles.list}>
          {pdfs.map((pdf) => {
            const sizeLabel = formatFileSize(pdf.fileSize);
            return (
              <View key={pdf.id} style={styles.row}>
                <View style={styles.rowIconChip}>
                  <FileText size={18} color="#374151" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{pdf.fileName}</Text>
                  <Text style={styles.meta}>{sizeLabel ? `${sizeLabel} · ${statusLabel}` : statusLabel}</Text>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => onRemove(pdf.id)}>
                  <Trash2 size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.uploadButton} onPress={onPickPdf}>
        <Plus size={18} color="#374151" />
        <Text style={styles.uploadButtonText}>Upload PDF</Text>
      </TouchableOpacity>

      {!!uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 16,
    gap: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconChip: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#FCEEDD',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#000000', letterSpacing: 0.4 },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#1E1951' },
  list: { gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 12,
  },
  rowIconChip: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  fileName: { fontSize: 15, fontWeight: '700', color: '#000000' },
  meta: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  deleteButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#C6C6C6', borderStyle: 'dashed', borderRadius: 16,
    backgroundColor: '#F8F8F8',
    paddingVertical: 16,
  },
  uploadButtonText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500' },
});
