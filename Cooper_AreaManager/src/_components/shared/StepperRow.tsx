import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';

type Props = {
  // The step wizard's own step-value sequence — not always [1,2,3,...]
  // literally (e.g. taskForm.tsx's pre-commissioning flow reorders to
  // [1,5,3,4,6]), so the circle numbers shown are always the step's
  // *position* in this array (index+1), never the raw step value itself.
  steps: number[];
  currentStep: number;
  onSelectStep: (step: number) => void;
};

// Numbered step circles, evenly spread across the full width — no prev/
// next arrows (removed per design update; each screen already has its own
// Back/Next buttons lower on the page, and tapping a circle directly jumps
// to that step, so the arrows were a redundant second way to do the same
// adjacent-step move). Shared between the commissioning task form and the
// SR task form's step wizards.
export function StepperRow({ steps, currentStep, onSelectStep }: Props) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <View style={styles.stepperRow}>
      {steps.map((step, index) => {
        const displayNumber = index + 1;
        const isDone = currentIndex > index;
        const isActive = step === currentStep;
        return (
          <TouchableOpacity
            key={step}
            style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}
            onPress={() => onSelectStep(step)}
          >
            {isDone ? (
              <Text style={styles.stepCircleTextActive}>✓</Text>
            ) : (
              <Text style={[styles.stepCircleText, isActive && styles.stepCircleTextActive]}>{displayNumber}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 16,
  },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: '#E76124' },
  stepCircleDone: { backgroundColor: '#16A34A' },
  stepCircleText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  stepCircleTextActive: { color: '#fff' },
});
