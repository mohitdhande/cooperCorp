import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { styles } from '../TaskForm.styles';
import { SelectedComplaintCode } from '@/models/taskForm.types';
import { PriorityBadge } from './PriorityBadge';

type ComplaintCodeCardProps = {
  item: SelectedComplaintCode;
  onRemove: () => void;
  onChangeObservation: (text: string) => void;
  onChangeRootCause: (text: string) => void;
};

export const ComplaintCodeCard: React.FC<ComplaintCodeCardProps> = ({
  item, onRemove, onChangeObservation, onChangeRootCause,
}) => {
  return (
    <View style={styles.complaintCard}>
      <View style={styles.complaintCardTopRow}>
        <View style={styles.pickerCodeTag}>
          <Text style={styles.pickerCodeTagText}>{item.code}</Text>
        </View>
        <PriorityBadge priority={item.priority} />
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.complaintCardRemoveButton} onPress={onRemove}>
          <Text style={styles.complaintCardRemoveIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.complaintCardTitle}>{item.title}</Text>
      <Text style={styles.complaintCardBreadcrumb}>
        {item.categoryName} › {item.subcategoryName}
      </Text>

      <View style={styles.complaintCardDivider} />

      <Text style={styles.complaintFieldLabel}>OBSERVATION</Text>
      <TextInput
        style={styles.complaintTextArea}
        placeholder="Describe the observation..."
        placeholderTextColor="#9CA3AF"
        value={item.observation}
        onChangeText={onChangeObservation}
        multiline
      />

      <Text style={[styles.complaintFieldLabel, { marginTop: 14 }]}>ROOT CAUSE</Text>
      <TextInput
        style={styles.complaintTextArea}
        placeholder="Describe the root cause..."
        placeholderTextColor="#9CA3AF"
        value={item.rootCause}
        onChangeText={onChangeRootCause}
        multiline
      />
    </View>
  );
};
