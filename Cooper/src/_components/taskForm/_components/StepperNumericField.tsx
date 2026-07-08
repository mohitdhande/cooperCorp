import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { styles } from '../TaskForm.styles';

type StepperNumericFieldProps = {
  label: string;
  value: string;
  onChangeValue: (value: string) => void;
};

export const StepperNumericField: React.FC<StepperNumericFieldProps> = ({ label, value, onChangeValue }) => {
  const handleStep = (direction: 1 | -1) => {
    const current = parseFloat(value);
    const base = isNaN(current) ? 0 : current;
    const next = base + direction;
    onChangeValue(String(next));
  };

  return (
    <View>
      <Text style={styles.numericFieldLabel}>{label}</Text>
      <View style={styles.stepperInputWrapper}>
        <TextInput
          style={styles.stepperInput}
          value={value}
          onChangeText={onChangeValue}
          placeholder="—"
          keyboardType="numeric"
        />
        <View style={styles.stepperArrows}>
          <TouchableOpacity style={styles.stepperArrowButton} onPress={() => handleStep(1)}>
            <Text style={styles.stepperArrowText}>▲</Text>
          </TouchableOpacity>
          <View style={styles.stepperArrowDivider} />
          <TouchableOpacity style={styles.stepperArrowButton} onPress={() => handleStep(-1)}>
            <Text style={styles.stepperArrowText}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};