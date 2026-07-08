import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../TaskForm.styles';
import { Priority } from '@/models/taskForm.types';
import { PRIORITY_COLORS } from '@/constants/complaintCodes';
export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
  const colors = PRIORITY_COLORS[priority];
  return (
    <View style={[styles.priorityBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.priorityBadgeText, { color: colors.text }]}>{priority}</Text>
    </View>
  );
};