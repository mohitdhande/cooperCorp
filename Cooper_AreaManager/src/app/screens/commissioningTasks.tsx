import React from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommissioningTasksController } from '../../controllers/commissioningTasksController';
import { NotificationBellButton } from '../../_components/shared/NotificationBellButton';
import { TaskPreviewCard } from '../../_components/shared/TaskPreviewCard';
import { StatusTabs } from '../../_components/shared/StatusTabs';
import { PageController } from '../../_components/shared/PageController';
import { AssignEngineerModal } from '../../_components/shared/AssignEngineerModal';
import { SearchBar } from '../../_components/shared/SearchBar';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { Toast } from '../../_components/shared/Toast';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';

// Same 420px Figma reference frame the Dashboard scales its paddings off.
const REF_WIDTH = 420;

// Same peach->light radial gradient backdrop as the Dashboard (duplicated,
// not extracted — this is a small, screen-specific visual, not worth a
// shared component named after a different screen).
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
          <RadialGradient id="commissioningBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#commissioningBg)" />
      </Svg>
    </View>
  );
}

export default function CommissioningTasksScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    toastMessage, toastType, toastVisible,
    selectedTab, selectTab,
    page, totalPages,
    tasks, counts, isLoading, error,
    goToPrevPage, goToNextPage,
    taskStatusOverrides, taskActionLoading, taskActionError,
    handleAcceptTask, handleArrowPress,
    isDealer, isAreaManagerAssign, subordinateRole, canCreate, engineers, engineersLoading, profile,
    assignPickerTask, openAssignPicker, closeAssignPicker, handleAssignTask, assigningTask,
    searchText, setSearchText, handleSearch, handleClearSearch,
    searchResults, isSearching, searchError, searched,
  } = useCommissioningTasksController();

  const isSearchActive = searched && !!searchText.trim();
  const matchedSearchResults = searchResults.filter((r) => r.task);

  // Unified list data — the search-results branch and the normal task-list
  // branch used to render two separately-written but functionally
  // identical TaskPreviewCard blocks (same isMyOwnTask/canActInActiveTab
  // logic, same props). Flattened to one plain task[] here so renderItem
  // below only needs to exist once, and so the whole screen can ride a
  // single FlatList instead of a ScrollView + .map() that used to mount
  // every task at once regardless of how many there were — see the
  // matching comment on renderItem for why that mattered.
  const listData = isSearchActive ? matchedSearchResults.map((r) => r.task) : tasks;
  // Nothing to show while a search or the initial page load is still in
  // flight — LoadingOverlay above already covers the screen for the
  // isLoading case, and mid-search intentionally shows nothing until it
  // resolves (matches the original ScrollView version's own `? null` arms).
  const showList = isSearchActive ? !isSearching : !isLoading;

  const renderEmptyState = () => {
    if (isSearchActive) {
      if (isSearching) return null;
      if (searchError) return <Text style={styles.statusText}>{searchError}</Text>;
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>You're all caught up — no active tasks.</Text>
        </View>
      );
    }
    if (isLoading) return null;
    if (error) return <Text style={styles.statusText}>{error}</Text>;
    return <Text style={styles.statusText}>No {selectedTab.toLowerCase()} commissioning tasks.</Text>;
  };

  // FlatList virtualizes this — only the cards actually on/near screen are
  // ever mounted, unlike the previous ScrollView + .map() which rendered
  // every single task in the list at once regardless of how many there
  // were. Shared by both the search-results and normal task-list cases
  // (listData above already flattens either source to the same plain
  // task[] shape), so this logic — previously duplicated near-verbatim in
  // both branches — now exists exactly once.
  const renderTaskCard = ({ item: task }: { item: (typeof tasks)[number] }) => {
    // Active tab: arrow/start-continue only for a task genuinely assigned
    // to the viewer (a dealer's own self-assigned task, same parity
    // serviceTasks.tsx already has) — a dealer's team task (assigned to
    // one of their engineers) still only gets Accept/Assign here, never
    // Start/Continue. Completed tab keeps the arrow (View Report needs it)
    // for everyone.
    const isMyOwnTask = task.assignedTo?.userId === profile?.userId;
    const canActInActiveTab = isMyOwnTask;
    return (
      // Padding applied per-row here (not on the FlatList's own
      // contentContainerStyle) — the header sections above already carry
      // their own horizontal padding, so padding the shared container
      // would double it up there.
      <View style={{ paddingHorizontal: hPad }}>
      <TaskPreviewCard
        task={task}
        effectiveStatus={taskStatusOverrides[task._id] || task.status}
        isLoading={!!taskActionLoading[task._id]}
        errorMsg={taskActionError[task._id]}
        onArrowPress={
          selectedTab === 'Active'
            ? (canActInActiveTab ? () => handleArrowPress(task) : undefined)
            : () => handleArrowPress(task)
        }
        // Nobody can Accept a task that isn't assigned to them — the
        // backend rejects it ("not assigned to you"). This used to also
        // gate on `!isDealer`, which suppressed Accept for every
        // non-dealer role even on their OWN task (an area manager's/
        // engineer's own self-assigned ASSIGNED task on this Active tab
        // wrongly showed the Start/Continue arrow instead of Accept —
        // inconsistent with the exact same task correctly showing Accept
        // on the Dashboard). isMyOwnTask alone is the actual rule; role
        // doesn't matter.
        onAcceptPress={selectedTab === 'Active' && !isMyOwnTask ? undefined : () => handleAcceptTask(task._id)}
        onAssignPress={isDealer && !isMyOwnTask ? () => openAssignPicker(task) : undefined}
        onManagerAssignPress={selectedTab === 'Active' ? undefined : (isAreaManagerAssign ? () => openAssignPicker(task) : undefined)}
        assigneeOnlyCluster
      />
      </View>
    );
  };

  const listHeader = (
    <>
      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.replace('/screens/dashboard' as any)}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>COMMISSIONING</Text>
        <NotificationBellButton />
      </View>

      <View style={[styles.toolRow, { paddingHorizontal: headerPad }]}>
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          onSubmit={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search genset number..."
          toggleStyle={styles.searchToggleButton}
          containerStyle={{ flex: 1, marginRight: 12 }}
        />
        {canCreate && (
          <TouchableOpacity style={[styles.toolButton, styles.toolButtonCreate]} onPress={() => router.push('/screens/newJob' as any)}>
            <Plus size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ marginHorizontal: hPad, marginBottom: 16 }}>
        <StatusTabs variant="commissioning" selected={selectedTab} onChange={selectTab} counts={counts} />
      </View>

      <View style={[styles.paginationRow, { paddingHorizontal: hPad }]}>
        <PageController current={page} total={totalPages} onPrev={goToPrevPage} onNext={goToNextPage} labelPrefix="Page " />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      {(isLoading || Object.values(taskActionLoading).some(Boolean)) && <LoadingOverlay />}
      <Toast visible={toastVisible} message={toastMessage} type={toastType} />

      <FlatList
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130, gap: 32 }}
        // Search box above stays focused/keyboard-up while typing —
        // without this, the first tap on a task card just dismisses the
        // keyboard instead of opening it, needing a second tap.
        keyboardShouldPersistTaps="handled"
        data={showList ? listData : []}
        keyExtractor={(task) => task._id}
        renderItem={renderTaskCard}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Keyed on the target task (or 'closed') so every open is a fresh
          picker instance — see the matching comment in newServiceJob.tsx
          for why. */}
      <AssignEngineerModal
        key={assignPickerTask?._id || 'closed'}
        visible={!!assignPickerTask}
        onClose={closeAssignPicker}
        engineers={engineers}
        loading={engineersLoading}
        assigning={assigningTask}
        error={assignPickerTask ? taskActionError[assignPickerTask._id] : undefined}
        subtitle={assignPickerTask?.asset?.gensetNumber}
        title={subordinateRole === 'dealer' ? 'Assign to Dealer' : 'Assign to Engineer'}
        onConfirm={handleAssignTask}
      />

      {/* Floats over the FlatList (instead of sitting below it as a
          normal flex sibling) so cards keep visibly scrolling behind this
          bar rather than the scroll area stopping flush above it — same
          pattern as the Dashboard's own bottom nav. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        <BottomNavBar active="commissioning" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },
  // Pinned over the FlatList, not a normal flex sibling below it — see
  // the comment at its call site for why.
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

  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toolButton: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  toolButtonCreate: { backgroundColor: '#F26722' },
  // Collapsed search icon — full circle + orange, distinct from the
  // create button's own rounded-square shape.
  searchToggleButton: { borderRadius: 24, backgroundColor: '#F26722' },

  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  statusText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 20 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyCardText: { color: '#9CA3AF', fontSize: 15, fontWeight: '500', textAlign: 'center' },
});
