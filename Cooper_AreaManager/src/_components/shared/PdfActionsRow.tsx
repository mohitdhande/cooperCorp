import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Pressable } from 'react-native';
import { FilePlus2, FileDown, Eye, CheckCircle2, RefreshCw } from 'lucide-react-native';

type Props = {
  // Whether the entry already has a cached PDF (task.pdfUrl truthy).
  isReady: boolean;
  // Generate in flight (not-ready state's single button).
  generating: boolean;
  // Preview/Download in flight (ready state's menu).
  downloading: boolean;
  // Regenerate in flight.
  regenerating: boolean;
  // Not-ready state's only action — generates the PDF but does NOT open it
  // (the caller shows a "PDF generated" toast instead); the button then
  // flips to the ready state below once task.pdfUrl comes back populated.
  onGenerate: () => void;
  // Preview and Download both call this once ready — mobile has no in-app
  // PDF viewer, so "look at it" and "save it" are the same hand-off-to-
  // the-OS action (downloadReportPdf in utils/reportPdf.ts).
  onDownload: () => void;
  // Also doesn't open the file — same "toast, not a forced viewer open"
  // reasoning as onGenerate.
  onRegenerate: () => void;
};

// The header keeps ONE button, exactly like before — not ready: tapping it
// generates the PDF directly (nothing to choose between yet). Ready:
// tapping it instead opens a small anchored menu with the web Records
// screen's own icon row (Preview / "already generated" checkmark /
// Download / Regenerate) rather than swapping the button itself out for
// four icons permanently. Shared by taskReport.tsx (Commissioning) and
// srTaskReport.tsx (Service).
export function PdfActionsRow({ isReady, generating, downloading, regenerating, onGenerate, onDownload, onRegenerate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isReady) {
    return (
      <TouchableOpacity style={styles.button} onPress={onGenerate} disabled={generating}>
        {generating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FilePlus2 size={19} color="#FFFFFF" />}
      </TouchableOpacity>
    );
  }

  const runAndClose = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setMenuOpen(true)} disabled={downloading || regenerating}>
        {(downloading || regenerating) ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FileDown size={19} color="#FFFFFF" />}
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuAnchor}>
            <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
              <TouchableOpacity style={styles.menuItem} onPress={() => runAndClose(onDownload)} hitSlop={6}>
                <Eye size={19} color="#374151" />
              </TouchableOpacity>
              <View style={styles.menuItem}>
                <CheckCircle2 size={17} color="#16A34A" />
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => runAndClose(onDownload)} hitSlop={6}>
                <FileDown size={19} color="#374151" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => runAndClose(onRegenerate)} hitSlop={6}>
                <RefreshCw size={19} color="#374151" />
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  // Not measured off the actual button (no ref/layout plumbing needed for
  // a small fixed header) — a fixed top-right offset that sits just under
  // where the button always renders on every screen using this component.
  menuAnchor: { position: 'absolute', top: 90, right: 20 },
  menu: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  menuItem: { justifyContent: 'center', alignItems: 'center' },
});
