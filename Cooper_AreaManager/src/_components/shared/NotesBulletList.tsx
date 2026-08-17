import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';

const MAX_LINES = 3;

type Props = { notes?: string | null };

// Splits a free-text notes field on newlines and renders each as its own
// bulleted line, clamped to MAX_LINES with a "+N more" toggle — dropped into
// whatever card/header a call site already has (ReportSectionCard, a plain
// labeled card, etc.) so multi-line notes read as a scannable list instead
// of one dense paragraph, consistently everywhere a dedicated Notes section
// is shown.
export function NotesBulletList({ notes }: Props) {
  const [expanded, setExpanded] = useState(false);

  const lines = (notes || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const visible = expanded ? lines : lines.slice(0, MAX_LINES);
  const hidden = lines.length - MAX_LINES;

  return (
    <View>
      {visible.map((line, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
      ))}
      {!expanded && hidden > 0 && (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={styles.more}>+{hidden} more</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bullet: { color: '#F59E0B', fontWeight: '700', fontSize: 12, marginTop: 2, marginRight: 8, lineHeight: 20 },
  line: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  more: { fontSize: 12, color: '#6B6899', fontWeight: '600', marginTop: 4 },
});
