import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../TaskForm.styles';
type GroupHeaderProps = {
  letter: string;
  title: string;
  saved: boolean;
};

export const GroupHeader: React.FC<GroupHeaderProps> = ({ letter, title, saved }) => {
  return (
    <View style={styles.groupHeaderRow}>
      <View style={styles.groupBadgeRow}>
        <View style={[styles.groupStatusCircle, saved && styles.groupStatusCircleSaved]}>
          <Text style={styles.groupStatusCircleText}>{saved ? '✓' : letter}</Text>
        </View>
        <Text style={styles.groupTitle}>{title}</Text>
      </View>

      <View style={[styles.groupStatusPill, saved ? styles.groupStatusPillSaved : styles.groupStatusPillUnsaved]}>
        <Text style={[styles.groupStatusPillText, saved ? styles.groupStatusPillTextSaved : styles.groupStatusPillTextUnsaved]}>
          {saved ? 'Saved' : 'Unsaved'}
        </Text>
      </View>
    </View>
  );
};