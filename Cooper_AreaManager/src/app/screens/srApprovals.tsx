import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, Bell, Wrench, Clock, CheckCircle2, XCircle } from 'lucide-react-native';
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
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 8, paddingBottom: 130, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
        // Search box above stays focused/keyboard-up while typing —
        // without this, the first tap on a card just dismisses the
        // keyboard instead of opening it, needing a second tap.
        keyboardShouldPersistTaps="handled"
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
            const engineNumber = entry.asset?.engineNumber || entry.assetId?.engineNumber || entry.engineNumber;
            const primaryLabel = gensetNumber || entry.title || entry.srNumber || 'Service Request';

            return (
              <TouchableOpacity
                key={entry._id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => goToDetail(entry)}
              >
                <View style={styles.cardTopRow}>
                  {!!entry.srNumber && <SrNumberText srNumber={entry.srNumber} style={styles.ticketNumber} />}
                  <Text style={styles.categoryLabel} numberOfLines={1}>
                    {entry.category}{categoryInfo ? ` · ${categoryInfo.name}` : ''}
                  </Text>
                </View>

                <View style={styles.cardMidRow}>
                  <View style={styles.gensetRow}>
                    <Wrench size={16} color="#6B7280" />
                    <Text style={styles.genset} numberOfLines={1}>{primaryLabel}</Text>
                  </View>
                  {!!entry.date && <Text style={styles.time}>{relTime}</Text>}
                </View>

                {(!!engineNumber || statusPills.length > 0) && (
                  <View style={styles.cardBottomRow}>
                    <Text style={styles.engineNumber} numberOfLines={1}>{engineNumber || ''}</Text>
                    <View style={styles.statusPillGroup}>
                      {statusPills.map((pill) => {
                        // Pending gates read as an in-progress/info state on
                        // this card (blue), not the amber "needs attention"
                        // tone used elsewhere — Reviewed/Rejected keep their
                        // own colors from the shared resolver unchanged.
                        const isPending = pill.label.includes('Pending');
                        const bg = isPending ? '#DBEAFE' : pill.bg;
                        const text = isPending ? '#1D4ED8' : pill.text;
                        const label = isPending ? pill.label.replace('Pending', 'Awaiting') : pill.label;
                        const Icon = pill.label.includes('Rejected') ? XCircle : isPending ? Clock : CheckCircle2;
                        return (
                          <View key={pill.label} style={[styles.entryStatusPill, { backgroundColor: bg }]}>
                            <Icon size={13} color={text} />
                            <Text style={[styles.entryStatusPillText, { color: text }]}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Floats over the ScrollView (instead of sitting below it as a
          normal flex sibling) so cards keep visibly scrolling behind this
          bar rather than the scroll area stopping flush above it. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        <BottomNavBar active="home" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },

  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },

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
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000000', textTransform: 'uppercase' },

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
    gap: 8,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketNumber: { fontSize: 12, color: '#9CA3AF' },
  categoryLabel: { fontSize: 14, fontWeight: '700', color: '#1E1951', flexShrink: 1, textAlign: 'right' },

  cardMidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gensetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  genset: { fontSize: 16, fontWeight: '700', color: '#000000', flexShrink: 1 },
  time: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },

  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  engineNumber: { fontSize: 14, fontWeight: '500', color: '#9CA3AF', flexShrink: 1 },
  statusPillGroup: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, flexShrink: 0 },
  entryStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12,
  },
  entryStatusPillText: { fontSize: 12, fontWeight: '700' },
});
