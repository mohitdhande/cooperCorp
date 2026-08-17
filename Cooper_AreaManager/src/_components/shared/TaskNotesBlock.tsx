import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NotesBulletList } from './NotesBulletList';

type Props = { notes?: string | null };

// Self-contained amber notes block on task-list cards — same bulleted,
// "+N more"-clamped rendering as the dedicated Notes sections in the report
// screens, just wrapped in this card's own amber background instead of a
// ReportSectionCard. Returns null when there's nothing to show.
export function TaskNotesBlock({ notes }: Props) {
  if (!notes) return null;

  return (
    <View style={styles.noteBox}>
      <NotesBulletList notes={notes} />
    </View>
  );
}

const styles = StyleSheet.create({
  noteBox: { backgroundColor: '#f8e9e2', borderRadius: 16, padding: 16 },
});
