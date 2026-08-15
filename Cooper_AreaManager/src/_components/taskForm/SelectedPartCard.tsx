import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { X, Minus, Plus } from 'lucide-react-native';
import { SelectedPart } from '../../models/taskForm.types';

type Props = {
  part: SelectedPart;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

// A selected part — code/unit pills, remove button, name, category
// breadcrumb, a divider, then the quantity +/- stepper. Adding a part,
// changing its quantity, or removing it all persist automatically (see
// useTaskForm.ts/useSrTaskForm.ts) — no separate save button here.
export function SelectedPartCard({ part, onIncrease, onDecrease, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{part.code}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{part.unit}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <X size={14} color="#0F0F0F" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{part.name}</Text>
        <Text style={styles.breadcrumb}>{part.category} › {part.subCategory}</Text>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.qtyStepper}>
          <TouchableOpacity style={styles.qtyButton} onPress={onDecrease}>
            <Minus size={16} color="#0F0F0F" />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{part.quantity}</Text>
          <TouchableOpacity style={styles.qtyButton} onPress={onIncrease}>
            <Plus size={16} color="#0F0F0F" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 16,
    gap: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  tag: {
    backgroundColor: '#F7A57C',
    borderRadius: 120,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F0F',
    opacity: 0.5,
  },
  removeButton: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 1, borderColor: '#DEDEDE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  titleBlock: { gap: 2, paddingHorizontal: 16 },
  title: {
    fontWeight: '700',
    color: '#0F0F0F',
    fontSize: 16,
  },
  breadcrumb: {
    fontSize: 14,
    color: '#0F0F0F',
    opacity: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBDBDB',
    padding: 4,
  },
  qtyButton: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DEDEDE',
    justifyContent: 'center', alignItems: 'center',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F0F',
    minWidth: 24,
    textAlign: 'center',
  },
});
