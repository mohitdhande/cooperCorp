import React, { useEffect, useMemo, useState } from 'react';
import { ApiFaultCode, Priority } from '@/models/taskForm.types';
import { styles } from '../TaskForm.styles';
import {
  ActivityIndicator, FlatList, Modal, Pressable, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  faultCodes: ApiFaultCode[];
  loading: boolean;
  onSelectCode: (code: ApiFaultCode) => void;
};

export const ComplaintCodePickerModal: React.FC<Props> = ({
  visible, onClose, faultCodes, loading, onSelectCode,
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSearchText('');
      setSelectedCategory(null);
      setSelectedSubCategory(null);
    }
  }, [visible]);

  // Build hierarchy from flat list
  const categories = useMemo(() =>
    [...new Set(faultCodes.map(f => f.category))], [faultCodes]);

  const subCategories = useMemo(() =>
    selectedCategory
      ? [...new Set(faultCodes
          .filter(f => f.category === selectedCategory)
          .map(f => f.subCategory))]
      : [], [faultCodes, selectedCategory]);

  const filteredCodes = useMemo(() => {
    if (!selectedCategory || !selectedSubCategory) return [];
    const q = searchText.trim().toLowerCase();
    return faultCodes.filter(f =>
      f.category === selectedCategory &&
      f.subCategory === selectedSubCategory &&
      (!q || f.code.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))
    );
  }, [faultCodes, selectedCategory, selectedSubCategory, searchText]);

  const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
    P1: { bg: '#FEE2E2', text: '#DC2626' },
    P2: { bg: '#FFEDD5', text: '#C2410C' },
    P3: { bg: '#DBEAFE', text: '#1D4ED8' },
    P4: { bg: '#F3F4F6', text: '#6B7280' },
  };

  const headerTitle = selectedSubCategory ?? selectedCategory ?? 'Select Complaint Code';

  const handleBack = () => {
    if (selectedSubCategory) setSelectedSubCategory(null);
    else if (selectedCategory) setSelectedCategory(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={() => {}}>

          <View style={styles.pickerHeaderRow}>
            <View style={styles.pickerHeaderLeft}>
              {(selectedCategory || selectedSubCategory) && (
                <TouchableOpacity onPress={handleBack} style={styles.pickerBackButton}>
                  <Text style={styles.pickerBackArrow}>‹</Text>
                </TouchableOpacity>
              )}
              <View>
                {selectedCategory && !selectedSubCategory &&
                  <Text style={styles.pickerBreadcrumb}>Categories</Text>}
                {selectedSubCategory &&
                  <Text style={styles.pickerBreadcrumb}>{selectedCategory}</Text>}
                <Text style={styles.pickerHeaderTitle}>{headerTitle}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.pickerCloseIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {(selectedSubCategory) && (
            <View style={styles.pickerSearchBar}>
              <Text style={styles.pickerSearchIcon}>🔍</Text>
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search code or description..."
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color="#F26722" />
          ) : !selectedCategory ? (
            // Level 1: Categories
            <FlatList
              data={categories}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => setSelectedCategory(item)}
                >
                  <Text style={styles.pickerRowTitle}>{item}</Text>
                  <View style={styles.pickerRowRight}>
                    <Text style={styles.pickerRowCount}>
                      {faultCodes.filter(f => f.category === item).length} codes
                    </Text>
                    <Text style={styles.pickerRowChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : !selectedSubCategory ? (
            // Level 2: SubCategories
            <FlatList
              data={subCategories}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => setSelectedSubCategory(item)}
                >
                  <Text style={styles.pickerRowTitle}>{item}</Text>
                  <View style={styles.pickerRowRight}>
                    <Text style={styles.pickerRowCount}>
                      {faultCodes.filter(f =>
                        f.category === selectedCategory && f.subCategory === item
                      ).length} codes
                    </Text>
                    <Text style={styles.pickerRowChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            // Level 3: Codes
            <FlatList
              data={filteredCodes}
              keyExtractor={(item) => item._id}
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.pickerEmptyText}>No matching codes</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerCodeRow}
                  onPress={() => { onSelectCode(item); onClose(); }}
                >
                  <View style={styles.pickerCodeTag}>
                    <Text style={styles.pickerCodeTagText}>{item.code}</Text>
                  </View>
                  <View style={[styles.priorityBadge,
                    { backgroundColor: PRIORITY_COLORS[item.priority]?.bg }]}>
                    <Text style={[styles.priorityBadgeText,
                      { color: PRIORITY_COLORS[item.priority]?.text }]}>
                      {item.priority}
                    </Text>
                  </View>
                  <Text style={styles.pickerCodeTitle}>{item.description}</Text>
                </TouchableOpacity>
              )}
            />
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
};