import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';

type Props = { notes?: string | null };

// Self-contained amber notes block — clipped to 3 lines with a "...more"
// toggle, long admin notes shouldn't dictate the whole card's height by
// default. Whether the toggle is even needed is decided by a one-time
// invisible probe render of the unclamped text (see noteMeasureProbe below)
// rather than reading numberOfLines' own onTextLayout, which reports the
// clamped count, not how many lines the full text actually needs. Returns
// null when there's nothing to show — matches the reference's TaskNotesBlock
// contract exactly.
export function TaskNotesBlock({ notes }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [truncated, setTruncated] = React.useState(false);
  const [measured, setMeasured] = React.useState(false);

  if (!notes) return null;

  return (
    <View style={styles.noteBox}>
      {!measured && (
        <Text
          style={[styles.noteText, styles.noteMeasureProbe]}
          pointerEvents="none"
          onTextLayout={(e) => {
            setTruncated(e.nativeEvent.lines.length > 3);
            setMeasured(true);
          }}
        >
          {notes}
        </Text>
      )}
      <Text style={styles.noteText} numberOfLines={expanded ? undefined : 3}>
        {notes}
      </Text>
      {/* A trailing nested Text here would only render when the clamped
          last line has leftover width — often not the case at exactly
          3 lines, silently hiding the toggle. A separate row below is
          guaranteed visible regardless of how full that last line is. */}
      {truncated && (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.noteMoreRow}>
          <Text style={styles.noteMoreText}>{expanded ? 'less' : '...more'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noteBox: { backgroundColor: '#f8e9e2', borderRadius: 16, padding: 16 },
  noteText: { fontSize: 15, fontWeight: '500', color: '#686868', lineHeight: 20 },
  // Invisible, unclamped — exists only to measure how many lines the full
  // note would take, absolutely positioned so it doesn't affect layout.
  noteMeasureProbe: { position: 'absolute', left: 16, right: 16, top: 16, opacity: 0 },
  noteMoreRow: { alignSelf: 'flex-start', marginTop: 4 },
  noteMoreText: { fontSize: 15, fontWeight: '700', color: '#B45309' },
});
