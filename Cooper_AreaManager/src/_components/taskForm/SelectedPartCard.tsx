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

// A selected part — componentNumber/cpcbNorm/Max Qty pills, remove button,
// description, engineFamily subtitle, a divider, then the quantity +/-
// stepper. Adding a part, changing its quantity, or removing it all
// persist automatically (see useTaskForm.ts/useSrTaskForm.ts) — no
// separate save button here.
//
// maxQty (new field, not enforced server-side — purely a UI guardrail,
// per the Parts API reference doc's "web app parts picker" notes):
// - Always shown as its own "Max Qty: N" pill up top when set, regardless
//   of the value.
// - maxQty === 1 skips the stepper entirely — nothing to adjust, so a
//   bordered "×1" box shows instead, with "Max qty is 1" alongside it.
// - Otherwise the "+" button disables once quantity reaches maxQty.
// - A part whose already-saved quantity exceeds maxQty (imported before
//   the cap existed, or the cap was lowered afterward) shows a warning
//   instead, but never blocks decreasing/removing it.
export function SelectedPartCard({ part, onIncrease, onDecrease, onRemove }: Props) {
  const atMax = !!part.maxQty && part.quantity >= part.maxQty;
  const overMax = !!part.maxQty && part.quantity > part.maxQty;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{part.componentNumber}</Text>
        </View>
        {!!part.cpcbNorm && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{part.cpcbNorm}</Text>
          </View>
        )}
        {!!part.maxQty && (
          <View style={styles.maxQtyTag}>
            <Text style={styles.maxQtyTagText}>Max Qty: {part.maxQty}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <X size={14} color="#0F0F0F" />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{part.description}</Text>
        {!!part.engineFamily?.length && (
          <Text style={styles.subtitle}>{part.engineFamily.join(', ')}</Text>
        )}
      </View>

      <View style={styles.footerRow}>
        <View style={{ flex: 1 }}>
          {overMax ? (
            <Text style={styles.warningText}>Exceeds max qty ({part.maxQty})</Text>
          ) : part.maxQty === 1 ? (
            <Text style={styles.maxQtyHint}>Max qty is 1</Text>
          ) : null}
        </View>
        {part.maxQty === 1 ? (
          <View style={styles.staticQtyBox}>
            <Text style={styles.staticQtyText}>×1</Text>
          </View>
        ) : (
          <View style={styles.qtyStepper}>
            <TouchableOpacity style={styles.qtyButton} onPress={onDecrease}>
              <Minus size={16} color="#0F0F0F" />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{part.quantity}</Text>
            <TouchableOpacity
              style={[styles.qtyButton, atMax && styles.qtyButtonDisabled]}
              onPress={onIncrease}
              disabled={atMax}
            >
              <Plus size={16} color={atMax ? '#B0B0B0' : '#0F0F0F'} />
            </TouchableOpacity>
          </View>
        )}
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
    backgroundColor: '#FFEDD5',
    borderRadius: 120,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C2410C',
  },
  maxQtyTag: {
    backgroundColor: '#F3F4F6',
    borderRadius: 120,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  maxQtyTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
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
  subtitle: {
    fontSize: 14,
    color: '#0F0F0F',
    opacity: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  maxQtyHint: {
    fontSize: 13,
    color: '#0F0F0F',
    opacity: 0.4,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  staticQtyBox: {
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  staticQtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F0F',
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
  qtyButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F0F',
    minWidth: 24,
    textAlign: 'center',
  },
});
