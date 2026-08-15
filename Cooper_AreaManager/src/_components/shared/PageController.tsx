import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

type Props = {
  // 1-indexed, already display-ready (callers with a 0-indexed carousel
  // state pass index + 1) — this component only renders it, it doesn't
  // decide the indexing convention.
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  // e.g. "Page " for the task-list screens' "Page 2/5" — omitted by
  // default for the Dashboard's plain "2/5" carousels.
  labelPrefix?: string;
};

// Shared prev/next pagination control — used by the Dashboard's SR
// Approvals/Active Task carousels and the Commissioning/Service task-list
// screens. 50% faded whenever that direction has nowhere to go — left at
// the first item, right at the last one.
export function PageController({ current, total, onPrev, onNext, labelPrefix = '' }: Props) {
  const atStart = current <= 1;
  const atEnd = current >= total;
  return (
    <View style={styles.pagination}>
      <TouchableOpacity
        style={[styles.pageArrow, atStart && styles.pageArrowFaded]}
        onPress={onPrev}
        disabled={atStart}
      >
        <ChevronLeft size={16} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.pageCount}>{labelPrefix}{current}/{total}</Text>
      <TouchableOpacity
        style={[styles.pageArrow, atEnd && styles.pageArrowFaded]}
        onPress={onNext}
        disabled={atEnd}
      >
        <ChevronRight size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#616161',
    borderWidth: 0.67, borderColor: '#494747',
    justifyContent: 'center', alignItems: 'center',
  },
  pageArrowFaded: { opacity: 0.5 },
  pageCount: { fontSize: 18, fontWeight: '400', color: '#000000' },
});
