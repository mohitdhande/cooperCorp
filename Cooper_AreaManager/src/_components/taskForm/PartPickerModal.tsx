import React, { useMemo, useState } from 'react';
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
  // The asset's own Genset Identification values (Step 1) — single values,
  // unlike a part's own engineFamily (array) — used to narrow the list to
  // parts compatible with this specific genset. Optional: an asset that
  // hasn't had these filled in yet just shows the full list.
  assetEngineFamily?: string;
  assetCpcbNorm?: string;
};

// Part picker, filtered by the live /api/parts list. Genuinely full-screen
// (not a percentage-height bottom sheet) — same reasoning as
// ComplaintCodePickerModal: a fixed height tuned to one phone doesn't scale
// across different screen sizes/aspect ratios, while SafeAreaView + flex:1
// fills whatever space is actually available on any device. Not anchored
// to the "+ Add Part" button.
//
// Flat list, not grouped — the old category/subCategory grouping was
// removed along with those fields in the 2026-08-29 Part schema change
// (see models/taskForm.types.ts's ApiPart comment). Nothing replaced them.
export function PartPickerModal({ visible, onClose, parts, loading, onSelectPart, assetEngineFamily, assetCpcbNorm }: Props) {
  const [searchText, setSearchText] = useState('');

  // Genset-compatibility filtering (mirrors the web app's parts picker,
  // per the Parts API reference doc — not enforced by the API itself).
  // A part's engineFamily is a list (empty/unset = "universal", fits any
  // engine); cpcbNorm is a single value (unset = "universal" there too).
  // Only narrows on whichever of the asset's two fields is actually set.
  const hasAssetInfo = !!assetEngineFamily || !!assetCpcbNorm;
  const compatibleParts = useMemo(() => {
    if (!hasAssetInfo) return parts;
    return parts.filter(p => {
      const familyOk = !assetEngineFamily || !p.engineFamily?.length || p.engineFamily.includes(assetEngineFamily);
      const cpcbOk = !assetCpcbNorm || !p.cpcbNorm || p.cpcbNorm === assetCpcbNorm;
      return familyOk && cpcbOk;
    });
  }, [parts, hasAssetInfo, assetEngineFamily, assetCpcbNorm]);

  // If the compatibility filter would leave nothing to pick from, fall
  // back to the full list rather than stranding the user with an empty
  // picker — the banner below reflects which of the two happened.
  const zeroMatches = hasAssetInfo && compatibleParts.length === 0;
  const basisList = zeroMatches ? parts : compatibleParts;

  // Guard against a part missing componentNumber/description from the
  // API — a bare p.componentNumber.toLowerCase() crashes the whole screen
  // (caught only by the app's one top-level ErrorBoundary, which resets
  // the nav stack) instead of just silently not matching that one part.
  const filtered = basisList.filter(p =>
    (p.componentNumber || '').toLowerCase().includes(searchText.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchText.toLowerCase())
  );

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

        {hasAssetInfo && !zeroMatches && (
          <View style={styles.compatBanner}>
            <Text style={styles.compatBannerText}>
              {!!assetEngineFamily && (
                <>Engine Family: <Text style={styles.compatBannerValue}>{assetEngineFamily}</Text></>
              )}
              {!!assetEngineFamily && !!assetCpcbNorm && '  ·  '}
              {!!assetCpcbNorm && (
                <>CPCB Norm: <Text style={styles.compatBannerValue}>{assetCpcbNorm}</Text></>
              )}
            </Text>
          </View>
        )}
        {zeroMatches && (
          <View style={styles.compatBanner}>
            <Text style={styles.compatBannerText}>
              No parts match this genset's
              {!!assetEngineFamily && ` Engine Family (${assetEngineFamily})`}
              {!!assetEngineFamily && !!assetCpcbNorm && ' /'}
              {!!assetCpcbNorm && ` CPCB Norm (${assetCpcbNorm})`}
              {' — showing all parts instead.'}
            </Text>
          </View>
        )}
        {!hasAssetInfo && (
          <View style={styles.compatBanner}>
            <Text style={styles.compatBannerText}>
              Showing all parts — this genset's Engine Family / CPCB Norm isn't set.
            </Text>
          </View>
        )}

        <View style={styles.searchBox}>
          <Search size={16} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search component number or description..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#F26722" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(part) => part._id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {parts.length === 0 ? 'No parts available.' : 'No matching parts'}
              </Text>
            }
            renderItem={({ item: part }) => (
              <TouchableOpacity style={styles.partRow} onPress={() => { onSelectPart(part); onClose(); }}>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{part.componentNumber}</Text>
                </View>
                <Text style={styles.partDescription} numberOfLines={1} ellipsizeMode="tail">
                  {part.description}
                </Text>
                {/* cpcbNorm deliberately NOT shown here — it's already
                covered by the compatibility banner above (or, when a part
                doesn't match the asset at all, by the selected-part card
                once picked). Purely a UI guardrail (not enforced
                server-side) — Max N shown only when the part has a cap. */}
                {!!part.maxQty && (
                  <Text style={styles.maxQtyText}>Max {part.maxQty}</Text>
                )}
              </TouchableOpacity>
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
  compatBanner: {
    backgroundColor: '#FEF0E6',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  compatBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EA580C',
  },
  compatBannerValue: {
    fontWeight: '800',
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
  // SafeAreaView's bottom edge accounts for gesture-nav devices, but a
  // classic 3-button Android nav bar isn't reported as a safe-area inset
  // at all — without extra padding here, the last row sits right behind
  // those system buttons.
  listContent: {
    paddingBottom: 120,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 20,
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  partDescription: {
    flex: 1,
    fontSize: 13,
    color: '#1F2937',
  },
  maxQtyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 8,
  },
});
