import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, Bell, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommissioningTasksController } from '../../controllers/commissioningTasksController';
import { TaskPreviewCard } from '../../_components/shared/TaskPreviewCard';
import { StatusTabs } from '../../_components/shared/StatusTabs';
import { PageController } from '../../_components/shared/PageController';
import { AssignEngineerModal } from '../../_components/shared/AssignEngineerModal';
import { SearchBar } from '../../_components/shared/SearchBar';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      {(isLoading || Object.values(taskActionLoading).some(Boolean)) && <LoadingOverlay />}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      >
        <View style={[styles.header, { paddingHorizontal: headerPad }]}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.replace('/screens/dashboard' as any)}>
            <ChevronLeft size={22} color="#979797" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>COMMISSIONING</Text>
          <View style={styles.headerButton}>
            <Bell size={22} color="#979797" />
          </View>
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

        <View style={{ paddingHorizontal: hPad, gap: 32 }}>
        {isSearchActive ? (
          isSearching ? null : searchError ? (
            <Text style={styles.statusText}>{searchError}</Text>
          ) : matchedSearchResults.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>You're all caught up — no active tasks.</Text>
            </View>
          ) : (
            matchedSearchResults.map(({ task }) => {
              // Active tab: arrow/start-continue only for a task genuinely
              // assigned to the viewer (a dealer's own self-assigned task,
              // same parity serviceTasks.tsx already has) — a dealer's team
              // task (assigned to one of their engineers) still only gets
              // Accept/Assign here, never Start/Continue. Completed tab
              // keeps the arrow (View Report needs it) for everyone.
              const isMyOwnTask = task.assignedTo?.userId === profile?.userId;
              const canActInActiveTab = isMyOwnTask;
              return (
              <TaskPreviewCard
                key={task._id}
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
                // backend rejects it ("not assigned to you"). This used to
                // also gate on `!isDealer`, which suppressed Accept for
                // every non-dealer role even on their OWN task (an area
                // manager's/engineer's own self-assigned ASSIGNED task on
                // this Active tab wrongly showed the Start/Continue arrow
                // instead of Accept — inconsistent with the exact same task
                // correctly showing Accept on the Dashboard). isMyOwnTask
                // alone is the actual rule; role doesn't matter.
                onAcceptPress={selectedTab === 'Active' && !isMyOwnTask ? undefined : () => handleAcceptTask(task._id)}
                onAssignPress={isDealer && !isMyOwnTask ? () => openAssignPicker(task) : undefined}
                onManagerAssignPress={selectedTab === 'Active' ? undefined : (isAreaManagerAssign ? () => openAssignPicker(task) : undefined)}
                assigneeOnlyCluster
              />
              );
            })
          )
        ) : isLoading ? null : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.statusText}>No {selectedTab.toLowerCase()} commissioning tasks.</Text>
        ) : (
          tasks.map((task) => {
            // Active tab: arrow/start-continue only for a task genuinely
            // assigned to the viewer (a dealer's own self-assigned task) —
            // a dealer's team task (assigned to an engineer) still only
            // gets Accept/Assign here. Completed tab keeps the arrow (View
            // Report needs it) for everyone.
            const isMyOwnTask = task.assignedTo?.userId === profile?.userId;
            const canActInActiveTab = isMyOwnTask;
            return (
            <TaskPreviewCard
              key={task._id}
              task={task}
              effectiveStatus={taskStatusOverrides[task._id] || task.status}
              isLoading={!!taskActionLoading[task._id]}
              errorMsg={taskActionError[task._id]}
              onArrowPress={
                selectedTab === 'Active'
                  ? (canActInActiveTab ? () => handleArrowPress(task) : undefined)
                  : () => handleArrowPress(task)
              }
              // Nobody can Accept a task that isn't assigned to them — see
              // the matching comment in the search-results branch above for
              // why this doesn't also gate on `!isDealer`.
              onAcceptPress={selectedTab === 'Active' && !isMyOwnTask ? undefined : () => handleAcceptTask(task._id)}
              onAssignPress={isDealer && !isMyOwnTask ? () => openAssignPicker(task) : undefined}
              onManagerAssignPress={selectedTab === 'Active' ? undefined : (isAreaManagerAssign ? () => openAssignPicker(task) : undefined)}
              assigneeOnlyCluster
            />
            );
          })
        )}
        </View>
      </ScrollView>

      <AssignEngineerModal
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

      {/* Floats over the ScrollView (instead of sitting below it as a
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
  // Pinned over the ScrollView, not a normal flex sibling below it — see
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
