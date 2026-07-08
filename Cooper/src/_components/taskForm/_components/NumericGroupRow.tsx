import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { styles } from '../TaskForm.styles';
import { NumericGroupItem } from '@/models/taskForm.types';
type NumericGroupRowProps = {
  group: NumericGroupItem;
  onChangeField: (subGroupIndex: number, fieldId: string, value: string) => void;
  onSave: () => void;
};

export const NumericGroupRow: React.FC<NumericGroupRowProps> = ({ group, onChangeField, onSave }) => {
  return (
    <View style={styles.checkItemBlock}>
      <Text style={styles.checkItemQuestion}>{group.title}</Text>

      {group.subGroups.map((sg, sgIndex) => (
        <View key={sgIndex} style={{ marginBottom: 14 }}>
          {sg.label !== '' && <Text style={styles.numericSubLabel}>{sg.label}</Text>}
          <View style={styles.numericFieldRow}>
            {sg.fields.map((field) => (
              <View key={field.id} style={styles.numericFieldThird}>
                <Text style={styles.numericFieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.numericFieldInput}
                  value={field.value}
                  onChangeText={(text) => onChangeField(sgIndex, field.id, text)}
                  placeholder="—"
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.itemSaveButton, group.saved && styles.itemSaveButtonOrange]}
        onPress={onSave}
      >
        <Text style={styles.itemSaveButtonText}>✓  Save</Text>
      </TouchableOpacity>
    </View>
  );
};