import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ApiFaultCode } from '../../models/taskForm.types';
import { PRIORITY_COLORS } from './PriorityBadge';

type Props = {
  visible: boolean;
  onClose: () => void;
  faultCodes: ApiFaultCode[];
  loading: boolean;
  onSelectCode: (code: ApiFaultCode) => void;
};

// Three-level picker (category → subcategory → code) built from the live
// /api/fault-codes list, for browsing. The search box is always visible
// (not just at the innermost level) — typing anything switches the list to
// a flat set of matching codes across the WHOLE list, ignoring whichever
// category/subcategory is currently selected, and only ever matches a
// code's own code/description, never the category/subCategory labels.
// Clearing the search goes back to wherever you were browsing. Genuinely
// full-screen (not a percentage-height bottom sheet) via SafeAreaView +
// flex:1, and only closes via the explicit X button — no
// tap-outside-to-dismiss.
export function ComplaintCodePickerModal({ visible, onClose, faultCodes, loading, onSelectCode }: Props) {
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

  const isSearching = searchText.trim().length > 0;

  const categories = useMemo(() => [...new Set(faultCodes.map(f => f.category))], [faultCodes]);

  const subCategories = useMemo(() => (
    selectedCategory
      ? [...new Set(faultCodes.filter(f => f.category === selectedCategory).map(f => f.subCategory))]
      : []
  ), [faultCodes, selectedCategory]);

  // Scoped to the current category/subcategory when browsing normally, but
  // a global search across every code (still code/description only) once
  // there's search text — so searching from the category or subcategory
  // screen still finds a match anywhere, not just within where you were.
  const searchResults = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    // Guard against a fault code missing code/description from the API —
    // same crash risk as PartPickerModal's identical search filter.
    return faultCodes.filter(f =>
      (f.code || '').toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q)
    );
  }, [faultCodes, searchText]);

  const browsedCodes = useMemo(() => {
    if (!selectedCategory || !selectedSubCategory) return [];
    return faultCodes.filter(f => f.category === selectedCategory && f.subCategory === selectedSubCategory);
  }, [faultCodes, selectedCategory, selectedSubCategory]);

  const handleBack = () => {
    if (selectedSubCategory) setSelectedSubCategory(null);
    else if (selectedCategory) setSelectedCategory(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* No tap-to-dismiss backdrop — full-screen, only closes via the
          explicit X button next to the title. */}
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {(selectedCategory || selectedSubCategory) && (
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <ChevronLeft size={22} color="#1E1951" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedSubCategory ?? selectedCategory ?? 'Select Complaint Code'}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Always visible — typing here searches every code's code/
            description regardless of which category/subcategory (if any)
            is currently selected below. */}
        <View style={styles.searchBox}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search code or description..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#F26722" />
        ) : isSearching ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No matching codes</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.codeRow} onPress={() => { onSelectCode(item); onClose(); }}>
                <View style={styles.codeTag}>
                  <Text style={styles.codeTagText}>{item.code}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority]?.bg }]}>
                  <Text style={[styles.priorityBadgeText, { color: PRIORITY_COLORS[item.priority]?.text }]}>
                    {item.priority}
                  </Text>
                </View>
                <Text style={styles.codeTitle}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        ) : !selectedCategory ? (
          <FlatList
            data={categories}
            keyExtractor={(item) => item}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No fault codes available.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => setSelectedCategory(item)}>
                <Text style={styles.rowTitle}>{item}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowCount}>{faultCodes.filter(f => f.category === item).length} codes</Text>
                  <ChevronRight size={18} color="#D1D5DB" />
                </View>
              </TouchableOpacity>
            )}
          />
        ) : !selectedSubCategory ? (
          <FlatList
            data={subCategories}
            keyExtractor={(item) => item}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => setSelectedSubCategory(item)}>
                <Text style={styles.rowTitle}>{item}</Text>
                <View style={styles.rowRight}>
                  <Text style={styles.rowCount}>
                    {faultCodes.filter(f => f.category === selectedCategory && f.subCategory === item).length} codes
                  </Text>
                  <ChevronRight size={18} color="#D1D5DB" />
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <FlatList
            data={browsedCodes}
            keyExtractor={(item) => item._id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.codeRow} onPress={() => { onSelectCode(item); onClose(); }}>
                <View style={styles.codeTag}>
                  <Text style={styles.codeTagText}>{item.code}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority]?.bg }]}>
                  <Text style={[styles.priorityBadgeText, { color: PRIORITY_COLORS[item.priority]?.text }]}>
                    {item.priority}
                  </Text>
                </View>
                <Text style={styles.codeTitle}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 4,
  },
  backButton: { marginRight: 4 },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
    flexShrink: 1,
  },
  closeButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    borderWidth: 1.5, borderColor: '#F26722',
    paddingHorizontal: 16,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  list: {
    paddingHorizontal: 20,
  },
  // Same fix as PartPickerModal's identical full-screen list — a classic
  // 3-button Android nav bar isn't reported as a safe-area inset, so
  // without extra padding here the last row sits right behind it.
  listContent: {
    paddingBottom: 120,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowTitle: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '700',
    flexShrink: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowCount: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 20,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  codeTag: {
    backgroundColor: '#FFEDD5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  codeTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 10,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  codeTitle: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
});
