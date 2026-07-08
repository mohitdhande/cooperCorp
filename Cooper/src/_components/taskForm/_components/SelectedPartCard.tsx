import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from '../TaskForm.styles';
import { SelectedPart } from '@/models/taskForm.types';


type Props = {
  part: SelectedPart;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

export const SelectedPartCard: React.FC<Props> = ({ part, onIncrease, onDecrease, onRemove }) => (
  <View style={styles.partCard}>
    <View style={styles.partCardInfo}>
      <View style={styles.partCardCodeRow}>
        <Text style={styles.partCardCode}>{part.code}</Text>
        <Text style={styles.partCardUnit}>{part.unit}</Text>
      </View>
      <Text style={styles.partCardName}>{part.name}</Text>
      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
        {part.category} › {part.subCategory}
      </Text>
    </View>
    <View style={styles.partCardControls}>
      <TouchableOpacity style={styles.qtyButton} onPress={onDecrease}>
        <Text style={styles.qtyButtonText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.qtyValue}>{part.quantity}</Text>
      <TouchableOpacity style={styles.qtyButton} onPress={onIncrease}>
        <Text style={styles.qtyButtonText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.removePartButton} onPress={onRemove}>
        <Text style={styles.removePartButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  </View>
);