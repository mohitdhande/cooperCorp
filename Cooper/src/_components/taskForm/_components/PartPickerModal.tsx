import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { styles } from '../TaskForm.styles';
import { Part } from '@/models/taskForm.types';
import { PARTS_CATALOG } from '@/constants/partsCatalog';

import { ApiPart } from '@/models/taskForm.types';

type Props = {
  visible: boolean;
  onClose: () => void;
  parts: ApiPart[];
  loading: boolean;
  onSelectPart: (part: ApiPart) => void;
};

export const PartPickerModal: React.FC<Props> = ({
  visible, onClose, parts, loading, onSelectPart,
}) => {
  const [searchText, setSearchText] = useState('');

  const filtered = parts.filter(p =>
    p.code.toLowerCase().includes(searchText.toLowerCase()) ||
    p.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Group by category › subCategory
  const grouped: { category: string; subCategory: string; parts: ApiPart[] }[] = [];
  filtered.forEach(part => {
    const key = `${part.category} › ${part.subCategory}`;
    let group = grouped.find(g => `${g.category} › ${g.subCategory}` === key);
    if (!group) {
      group = { category: part.category, subCategory: part.subCategory, parts: [] };
      grouped.push(group);
    }
    group.parts.push(part);
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.partModalOverlay}>
        <View style={styles.partModalSheet}>

          <View style={styles.partModalHeaderRow}>
            <Text style={styles.partModalTitle}>Select Part</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.partModalCloseIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.partSearchBox}>
            <Text style={styles.partSearchIcon}>🔍</Text>
            <TextInput
              style={styles.partSearchInput}
              placeholder="Search code or name..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color="#F26722" />
          ) : (
            <FlatList
              data={grouped}
              keyExtractor={(g) => `${g.category}-${g.subCategory}`}
              renderItem={({ item: group }) => (
                <View>
                  <Text style={styles.partCategoryLabel}>
                    {group.category} › {group.subCategory}
                  </Text>
                  {group.parts.map(part => (
                    <TouchableOpacity
                      key={part._id}
                      style={styles.partRow}
                      onPress={() => { onSelectPart(part); onClose(); }}
                    >
                      <View style={styles.partCodeBox}>
                        <Text style={styles.partCodeText}>{part.code}</Text>
                      </View>
                      <View style={[styles.unitBadge,
                        ['Litre', 'Roll', 'Pkt'].includes(part.unit)
                          ? styles.unitBadgeOrange : styles.unitBadgeRed]}>
                        <Text style={[styles.unitBadgeText,
                          ['Litre', 'Roll', 'Pkt'].includes(part.unit)
                            ? styles.unitBadgeTextOrange : styles.unitBadgeTextRed]}>
                          {part.unit}
                        </Text>
                      </View>
                      <Text style={styles.partNameText}>{part.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          )}

        </View>
      </View>
    </Modal>
  );
};