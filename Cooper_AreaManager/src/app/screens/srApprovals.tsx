import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSrApprovalsController } from '../../controllers/srApprovalsController';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';
import { SearchBar } from '../../_components/shared/SearchBar';
import { SrNumberText } from '../../_components/shared/SrNumberText';
import { formatTimeAgoLabel, resolveApprovalStatusPills } from '../../utils/reportFormatters';
import { SERVICE_CATEGORIES } from '../../_components/srTaskForm/srDropdownOptions';

const REF_WIDTH = 420;

// Same peach->light radial gradient backdrop as the other screens
// (duplicated, not extracted — small, screen-specific visual).
function ScreenBackground() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [size, setSize] = React.useState({ width: windowWidth, height: windowHeight });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <Svg width={size.width} height={size.height}>
        <Defs>
          <RadialGradient id="srApprovalsBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#srApprovalsBg)" />
      </Svg>
    </View>
  );
}

// Full "SR Approvals" list — reached from the Dashboard's SR Approvals
// "Show all" link. My/All picks the fetch scope (mine=true vs unfiltered,
// see srApprovalsController.ts), Pending/Approved is a client-side split
// of that same fetch off partApproval/workApproval status.
export default function SrApprovalsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    scopeTab, setScopeTab,
    statusTab, setStatusTab,
    searchText, setSearchText,
    visibleEntries, pendingCount, approvedCount,
    isLoading, error, refreshing, onRefresh,
    goToDetail,
  } = useSrApprovalsController();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      {isLoading && <LoadingOverlay />}

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SR APPROVALS</Text>
        <View style={styles.headerButton}>
          <Bell size={22} color="#979797" />
        </View>
      </View>

      <View style={[styles.scopeToggle, { marginHorizontal: hPad }]}>
        <TouchableOpacity
          style={[styles.scopeSegment, scopeTab === 'my' && styles.scopeSegmentActive]}
          onPress={() => setScopeTab('my')}
        >
          <Text style={[styles.scopeSegmentText, scopeTab === 'my' && styles.scopeSegmentTextActive]}>My</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeSegment, scopeTab === 'all' && styles.scopeSegmentActive]}
          onPress={() => setScopeTab('all')}
        >
          <Text style={[styles.scopeSegmentText, scopeTab === 'all' && styles.scopeSegmentTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statusToggle, { marginHorizontal: hPad }]}>
        <TouchableOpacity
          style={[styles.statusSegment, statusTab === 'pending' && styles.statusSegmentActive]}
          onPress={() => setStatusTab('pending')}
        >
          <Text style={[styles.statusSegmentText, statusTab === 'pending' && styles.statusSegmentTextActive]}>Pending</Text>
          <View style={[styles.statusCountBadge, statusTab === 'pending' && styles.statusCountBadgeActive]}>
            <Text style={[styles.statusCountText, statusTab === 'pending' && styles.statusCountTextActive]}>{pendingCount}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusSegment, statusTab === 'approved' && styles.statusSegmentActive]}
          onPress={() => setStatusTab('approved')}
        >
          <Text style={[styles.statusSegmentText, statusTab === 'approved' && styles.statusSegmentTextActive]}>Approved</Text>
          <View style={[styles.statusCountBadge, statusTab === 'approved' && styles.statusCountBadgeActive]}>
            <Text style={[styles.statusCountText, statusTab === 'approved' && styles.statusCountTextActive]}>{approvedCount}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow, { marginHorizontal: hPad }]}>
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search genset, client, title..."
          toggleStyle={styles.searchButton}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 8, paddingBottom: 24, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        {isLoading ? null : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : visibleEntries.length === 0 ? (
          <Text style={styles.statusText}>No {statusTab} SR approvals.</Text>
        ) : (
          visibleEntries.map((entry) => {
            const categoryInfo = SERVICE_CATEGORIES.find((c) => c.letter === entry.category);
            const statusPills = resolveApprovalStatusPills(entry);
            const relTime = formatTimeAgoLabel(entry.date);

            // GET /api/service's list items don't embed a populated `asset`
            // (unlike GET /me/dashboard's approvalList) — its own doc entry
            // lists srNumber/status/assignedTo/.../workApproval as the
            // fields, no asset. Falls back through whatever's actually
            // there instead of rendering a blank title when asset is
            // absent/unpopulated.
            const gensetNumber = entry.asset?.gensetNumber || entry.assetId?.gensetNumber || entry.gensetNumber;
            const clientName = entry.asset?.clientName || entry.assetId?.clientName;
            const primaryLabel = gensetNumber || entry.title || entry.srNumber || 'Service Request';
            const showTitleAsSubtitle = !!entry.title && entry.title !== primaryLabel;

            return (
              <TouchableOpacity
                key={entry._id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => goToDetail(entry)}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.categoryPill}>
                    <Text style={styles.categoryPillText} numberOfLines={1}>
                      {entry.category}{categoryInfo ? ` — ${categoryInfo.name}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                    {!!entry.srNumber && <SrNumberText srNumber={entry.srNumber} style={styles.srNumber} />}
                    {!!entry.date && <Text style={styles.time}>{relTime}</Text>}
                  </View>
                </View>

                <Text style={styles.genset}>{primaryLabel}</Text>
                {!!clientName && <Text style={styles.subtitle}>{clientName}</Text>}
                {showTitleAsSubtitle && <Text style={styles.subtitle}>{entry.title}</Text>}

                {statusPills.length > 0 && (
                  <View style={[styles.cardBottomRow, { flexWrap: 'wrap' }]}>
                    {statusPills.map((pill) => (
                      <View key={pill.label} style={[styles.entryStatusPill, { backgroundColor: pill.bg }]}>
                        <Text style={[styles.entryStatusPillText, { color: pill.text }]}>{pill.label}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <BottomNavBar active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#000000', letterSpacing: 0.5 },

  // My/All — small pill toggle, navy active state.
  scopeToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    padding: 4,
    marginBottom: 14,
  },
  scopeSegment: {
    paddingVertical: 8, paddingHorizontal: 24,
    borderRadius: 100,
  },
  scopeSegmentActive: { backgroundColor: '#1E1951' },
  scopeSegmentText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  scopeSegmentTextActive: { color: '#FFFFFF' },

  // Pending/Approved — wider toggle with counts, orange active state.
  statusToggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    borderWidth: 1.5, borderColor: '#FFC3A8',
    padding: 4,
    marginBottom: 16,
  },
  statusSegment: {
    flex: 1,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    paddingVertical: 10,
    borderRadius: 100,
  },
  statusSegmentActive: { backgroundColor: '#F26722' },
  statusSegmentText: { fontSize: 15, fontWeight: '700', color: '#9CA3AF' },
  statusSegmentTextActive: { color: '#FFFFFF' },
  statusCountBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  statusCountBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  statusCountText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  statusCountTextActive: { color: '#FFFFFF' },

  searchRow: { marginBottom: 16 },
  searchButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  statusText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 20 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  categoryPill: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: '#1E1951',
    borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  categoryPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  srNumber: { fontSize: 11, color: '#D1D5DB', fontFamily: 'monospace' },
  time: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },

  genset: { fontSize: 17, fontWeight: '700', color: '#000000' },
  subtitle: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },

  cardBottomRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  entryStatusPill: { borderRadius: 100, paddingVertical: 6, paddingHorizontal: 14 },
  entryStatusPillText: { fontSize: 12, fontWeight: '700' },
});
