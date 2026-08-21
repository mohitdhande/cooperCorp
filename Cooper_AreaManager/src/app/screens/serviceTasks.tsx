import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, Bell, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useServiceTasksController } from '../../controllers/serviceTasksController';
import { TaskPreviewCard } from '../../_components/shared/TaskPreviewCard';
import { StatusTabs } from '../../_components/shared/StatusTabs';
import { PageController } from '../../_components/shared/PageController';
import { AssignEngineerModal } from '../../_components/shared/AssignEngineerModal';
import { SearchBar } from '../../_components/shared/SearchBar';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';

// Same 420px Figma reference frame the Dashboard/Commissioning screens
// scale their paddings off.
const REF_WIDTH = 420;

// Same peach->light radial gradient backdrop as Commissioning/Dashboard
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
          <RadialGradient id="servicesBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#servicesBg)" />
      </Svg>
    </View>
  );
}

// Services task-list screen — the service/SR equivalent of
// commissioningTasks.tsx (reached from the bottom nav bar's Services icon).
// Same TaskPreviewCard-based design, filtered to service tasks only.
export default function ServiceTasksScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    selectedTab, selectTab,
    page, totalPages,
    tasks, counts, isLoading, error,
    refreshing, onRefresh,
    goToPrevPage, goToNextPage,
    taskStatusOverrides, taskActionLoading, taskActionError,
    handleAcceptTask, handleArrowPress, goToSrDetail, goToTaskReport,
    isDealer, isAreaManagerAssign, subordinateRole, canCreate, profile, engineers, engineersLoading,
    assignPickerTask, openAssignPicker, closeAssignPicker, handleAssignTask, assigningTask,
    searchText, setSearchText, handleSearch, handleClearSearch,
    searchResults, isSearching, searchError, searched,
  } = useServiceTasksController();

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        <View style={[styles.header, { paddingHorizontal: headerPad }]}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.replace('/screens/dashboard' as any)}>
            <ChevronLeft size={22} color="#979797" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SERVICES</Text>
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
            <TouchableOpacity style={[styles.toolButton, styles.toolButtonCreate]} onPress={() => router.push('/screens/newServiceJob' as any)}>
              <Plus size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginHorizontal: hPad, marginBottom: 16 }}>
          <StatusTabs variant="service" selected={selectedTab} onChange={selectTab} counts={counts} />
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
              // Active tab normally has no arrow/start-continue button — a
              // dealer still gets Accept (ASSIGNED) and the assign icon
              // there, since Active is the only tab where those statuses
              // ever appear for them. An area manager who assigned this
              // task to themselves (or had it self-assigned/handed to
              // them) is in the exact same position a dealer is — they
              // need to be able to Accept/Start it right here too, not
              // just from the Dashboard's own Active Task carousel.
              // Any role can act on a task genuinely assigned to them
              // (most commonly an engineer) — not just the dealer/AM
              // self-assigned cases this used to be scoped to. Without this,
              // an engineer's own task (at ANY Active-tab status, including
              // COMPLETED/OTP-pending) had no arrow here at all, and
              // COMPLETED specifically doesn't even appear on the
              // Dashboard's own Active Task carousel (filtered to
              // ASSIGNED/ACCEPTED/IN_PROGRESS only) — leaving it with no
              // actionable arrow anywhere.
              const isMyOwnTask = task.assignedTo?.userId === profile?.userId;
              const canActInActiveTab = isDealer || isMyOwnTask;
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
                      : () => goToTaskReport(task)
                  }
                  // A dealer can only Accept their own self-assigned task —
                  // accepting on behalf of an engineer isn't a real action
                  // (the backend rejects it: "not assigned to you"). Doesn't
                  // affect an engineer's own Accept (canActInActiveTab
                  // already covers that via isMyOwnTask on its own).
                  onAcceptPress={selectedTab === 'Active' && (!canActInActiveTab || (isDealer && !isMyOwnTask)) ? undefined : () => handleAcceptTask(task._id)}
                  // A dealer's self-assigned task follows the same Accept/
                  // Start/Complete flow as an engineer's own task
                  // (canActInActiveTab above already grants the arrow) —
                  // Assign/Reassign only makes sense for a task actually
                  // handed off to one of their engineers.
                  onAssignPress={isDealer && !isMyOwnTask ? () => openAssignPicker(task) : undefined}
                  onManagerAssignPress={selectedTab === 'Active' ? undefined : (isAreaManagerAssign ? () => openAssignPicker(task) : undefined)}
                  onCardPress={() => goToSrDetail(task)}
                  assigneeOnlyCluster
                />
              );
            })
          )
        ) : isLoading ? null : error ? (
          <Text style={styles.statusText}>{error}</Text>
        ) : tasks.length === 0 ? (
          <Text style={styles.statusText}>No {selectedTab.toLowerCase()} service tasks.</Text>
        ) : (
          tasks.map((task) => {
            // Any role can act on a task genuinely assigned to them (most
            // commonly an engineer) — not just the dealer/AM self-assigned
            // cases this used to be scoped to. Without this, an engineer's
            // own task (at ANY Active-tab status, including COMPLETED/
            // OTP-pending) had no arrow here at all, and COMPLETED
            // specifically doesn't even appear on the Dashboard's own
            // Active Task carousel (filtered to ASSIGNED/ACCEPTED/
            // IN_PROGRESS only) — leaving it with no actionable arrow
            // anywhere. Completed tab keeps the arrow (View Report needs
            // it) for everyone regardless.
            const isMyOwnTask = task.assignedTo?.userId === profile?.userId;
            const canActInActiveTab = isDealer || isMyOwnTask;
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
                  : () => goToTaskReport(task)
              }
              // A dealer can only Accept their own self-assigned task — see
              // the matching comment in the search-results branch above.
              onAcceptPress={selectedTab === 'Active' && (!canActInActiveTab || (isDealer && !isMyOwnTask)) ? undefined : () => handleAcceptTask(task._id)}
              onAssignPress={isDealer && !isMyOwnTask ? () => openAssignPicker(task) : undefined}
              onManagerAssignPress={selectedTab === 'Active' ? undefined : (isAreaManagerAssign ? () => openAssignPicker(task) : undefined)}
              onCardPress={() => goToSrDetail(task)}
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
          bar rather than the scroll area stopping flush above it. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        <BottomNavBar active="services" />
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
  // Create ("+") button uses Service's own navy, distinct from Commissioning's
  // orange toolButtonCreate — reverted from the earlier orange-to-match
  // decision. Search stays orange, matching Commissioning's searchToggleButton.
  toolButtonCreate: { backgroundColor: '#1E1951' },
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
