import React, { useState } from 'react';
import { View, TouchableOpacity, FlatList, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { Search, X } from 'lucide-react-native';
import { ApiPart } from '../../models/taskForm.types';

type Props = {
  visible: boolean;
  onClose: () => void;
  parts: ApiPart[];
  loading: boolean;
  onSelectPart: (part: ApiPart) => void;
};

// Part picker grouped by category › subCategory, filtered by the live
// /api/parts list. Genuinely full-screen (not a percentage-height bottom
// sheet) — same reasoning as ComplaintCodePickerModal: a fixed height
// tuned to one phone doesn't scale across different screen sizes/aspect
// ratios, while SafeAreaView + flex:1 fills whatever space is actually
// available on any device. Not anchored to the "+ Add Part" button.
export function PartPickerModal({ visible, onClose, parts, loading, onSelectPart }: Props) {
  const [searchText, setSearchText] = useState('');

  const filtered = parts.filter(p =>
    p.code.toLowerCase().includes(searchText.toLowerCase()) ||
    p.name.toLowerCase().includes(searchText.toLowerCase())
  );

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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* No tap-to-dismiss backdrop — full-screen now, so there's no dimmed
          area to tap anyway. Only closes via the explicit X button next to
          "Select Part". */}
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Select Part</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
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
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {parts.length === 0 ? 'No parts available.' : 'No matching parts'}
              </Text>
            }
            renderItem={({ item: group }) => (
              <View>
                <Text style={styles.categoryLabel}>{group.category} › {group.subCategory}</Text>
                {group.parts.map(part => (
                  <TouchableOpacity key={part._id} style={styles.partRow} onPress={() => { onSelectPart(part); onClose(); }}>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeText}>{part.code}</Text>
                    </View>
                    <View style={[
                      styles.unitBadge,
                      ['Litre', 'Roll', 'Pkt'].includes(part.unit) ? styles.unitBadgeOrange : styles.unitBadgeRed,
                    ]}>
                      <Text style={[
                        styles.unitBadgeText,
                        ['Litre', 'Roll', 'Pkt'].includes(part.unit) ? styles.unitBadgeTextOrange : styles.unitBadgeTextRed,
                      ]}>{part.unit}</Text>
                    </View>
                    <Text style={styles.partName}>{part.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // flex: 1 inside SafeAreaView — fills exactly the space the device's own
  // safe area leaves available, on any screen size/aspect ratio, rather
  // than a fixed percentage tuned to one phone.
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
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
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 20,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  codeBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  unitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 10,
  },
  unitBadgeOrange: { backgroundColor: '#FFEDD5' },
  unitBadgeRed: { backgroundColor: '#FEE2E2' },
  unitBadgeText: { fontSize: 10, fontWeight: '700' },
  unitBadgeTextOrange: { color: '#C2410C' },
  unitBadgeTextRed: { color: '#DC2626' },
  partName: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
});
