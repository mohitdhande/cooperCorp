import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, View, Modal, Pressable } from 'react-native';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { FilePlusCorner, FileCheck, RefreshCw } from 'lucide-react-native';
import { useKeyboardHeight } from '../../utils/useKeyboardHeight';

const CONFIRM_WORD = 'REGENERATE';

type Props = {
  // Whether the entry already has a cached PDF (task.pdfUrl truthy).
  isReady: boolean;
  // Generate in flight (not-ready state's single button).
  generating: boolean;
  // Download in flight.
  downloading: boolean;
  // Regenerate in flight.
  regenerating: boolean;
  // Not-ready state's only action — generates the PDF but does NOT open it
  // (the caller shows a "PDF generated" toast instead); the button then
  // flips to the ready state below once task.pdfUrl comes back populated.
  onGenerate: () => void;
  // Opens/saves the file — mobile has no in-app PDF viewer, so this is
  // both "preview" and "download" in one action.
  onDownload: () => void;
  // Also doesn't open the file — same "toast, not a forced viewer open"
  // reasoning as onGenerate. Only ever called after the type-to-confirm
  // step below passes — never directly from the button tap.
  onRegenerate: () => void;
};

// Not ready: one "Generate" button (nothing to choose between yet). Ready:
// Download and Regenerate sit side by side as two separate, always-visible
// buttons — no menu to open, both actions right there. Regenerate discards
// the previously cached PDF, so tapping it opens a small "type REGENERATE
// to confirm" prompt first rather than firing immediately — checked
// entirely on-device (no backend call for the check itself), just a plain
// guard against an accidental tap. Shared by taskReport.tsx (Commissioning)
// and srTaskReport.tsx (Service).
export function PdfActionsRow({ isReady, generating, downloading, regenerating, onGenerate, onDownload, onRegenerate }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const confirmMatches = confirmText.trim().toUpperCase() === CONFIRM_WORD;
  // RN's <Modal> never pans/resizes for the keyboard — this card sits
  // vertically centered (backdrop's justifyContent: 'center'), so on a
  // shorter screen the open keyboard could cover its Cancel/Regenerate
  // buttons. Same fix as taskReport.tsx's own OTP sheet, adapted for a
  // centered card instead of a bottom sheet: push it up by the keyboard's
  // own height once one opens, via extra bottom margin.
  const kbHeight = useKeyboardHeight();

  const openConfirm = () => {
    setConfirmText('');
    setConfirmOpen(true);
  };
  const closeConfirm = () => setConfirmOpen(false);
  const submitConfirm = () => {
    if (!confirmMatches) return;
    setConfirmOpen(false);
    onRegenerate();
  };

  if (!isReady) {
    return (
      <TouchableOpacity style={styles.button} onPress={onGenerate} disabled={generating}>
        {generating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FilePlusCorner size={19} color="#FFFFFF" />}
      </TouchableOpacity>
    );
  }

  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={openConfirm} disabled={regenerating}>
          {regenerating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RefreshCw size={19} color="#FFFFFF" />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onDownload} disabled={downloading}>
          {downloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FileCheck size={19} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={closeConfirm}>
        <Pressable style={styles.backdrop} onPress={closeConfirm}>
          <Pressable style={[styles.card, kbHeight > 0 && { marginBottom: kbHeight }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Regenerate report?</Text>
            <Text style={styles.body}>
              This rebuilds the PDF from scratch. Type {CONFIRM_WORD} below to confirm.
            </Text>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={CONFIRM_WORD}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeConfirm}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !confirmMatches && styles.confirmButtonDisabled]}
                onPress={submitConfirm}
                disabled={!confirmMatches}
              >
                <Text style={styles.confirmButtonText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#000000', marginBottom: 8 },
  body: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1F2937',
    marginBottom: 16,
  },
  actionsRow: { flexDirection: 'row', gap: 12 },
  cancelButton: {
    flex: 1, height: 48, borderRadius: 100,
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  confirmButton: {
    flex: 1, height: 48, borderRadius: 100,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  confirmButtonDisabled: { backgroundColor: '#F3D6C4' },
  confirmButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
