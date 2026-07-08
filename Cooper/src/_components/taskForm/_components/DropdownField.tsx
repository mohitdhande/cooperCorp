import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, FlatList } from 'react-native';
import { styles } from '../TaskForm.styles';
type DropdownFieldProps = {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  required?: boolean;
};

export const DropdownField: React.FC<DropdownFieldProps> = ({ label, value, options, onSelect, required = true }) => {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Text style={styles.fieldLabel}>{required ? '● ' : ''}{label}</Text>
      <TouchableOpacity style={styles.dropdownInput} onPress={() => setVisible(true)}>
        <Text style={styles.dropdownText}>{value || '—'}</Text>
        <Text style={styles.dropdownArrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setVisible(false)}>
          <View style={styles.dropdownSheet}>
            <FlatList
              data={['—', ...options]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownOptionRow,
                    value === item && styles.dropdownOptionRowSelected,
                  ]}
                  onPress={() => {
                    onSelect(item === '—' ? '' : item);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};