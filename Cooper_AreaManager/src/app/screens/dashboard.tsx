import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Bell, CheckCircle2, Clock, CloudOff, Cog, FileText, Handshake, Settings, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useDashboardHomeController } from '../../controllers/dashboardHomeController';
import { formatTimeAgoLabel, getTaskPeople, resolveApprovalStatusPills } from '../../utils/reportFormatters';
import { getRole } from '../../constants/permissions';
import { SERVICE_CATEGORIES } from '../../_components/srTaskForm/srDropdownOptions';
import { TaskPreviewCard } from '../../_components/shared/TaskPreviewCard';
import { AssetIdentityHeader } from '../../_components/shared/AssetIdentityHeader';
import { UserAvatar } from '../../_components/shared/UserAvatar';
import { PageController } from '../../_components/shared/PageController';
import { AssignEngineerModal } from '../../_components/shared/AssignEngineerModal';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { PendingSyncBanner } from '../../_components/shared/PendingSyncBanner';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';

// Figma reference frame is 420px wide — these paddings scale off that ratio
// so they hold the same proportion on any real device width, instead of
// being hardcoded to the reference frame's absolute pixel values.
const REF_WIDTH = 420;

// Full-screen radial gradient backdrop (peach fading to near-white) — RN has
// no native radial-gradient primitive, so this mirrors the same react-native-svg
// technique already used for the splash screen's vignette in app/index.tsx.
//
// Sized off this View's own measured layout (onLayout) rather than
// useWindowDimensions — on some Android devices "window" dimensions don't
// include the gesture-nav area, which left a flat unshaded strip below the
// bottom bar. Measuring the actual container guarantees the SVG covers
// exactly the space it's rendered into.
function DashboardBackground() {
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
          {/* userSpaceOnUse, centered at the bottom. A wide radius plus a
              mid stop eases the fade in gradually instead of the old
              2-stop version, whose transition band was so much narrower
              than the screen width that its circular arc read as a flat,
              hard-edged rectangle rather than a soft glow. */}
          <RadialGradient id="dashboardBg" cx={size.width / 2} cy={size.height} r={size.height * 0.75} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="45%" stopColor="#F5BC9D" stopOpacity={0.6} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#dashboardBg)" />
      </Svg>
    </View>
  );
}

// Shown in place of the Active Task carousel once its list is empty — a
// green check circle instead of plain "you're all caught up" text.
function EmptyActiveTaskCard() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconCircle}>
        <CheckCircle2 size={32} color="#16A34A" />
      </View>
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptySubtitle}>No active tasks right now.</Text>
    </View>
  );
}

const WEEK_DAY_LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const WEEK_BAR_HEIGHT = 120;

// Bars are keyed to the day the activity actually happened (assignedAt for
// active tasks, completedAt for completed ones) — a task assigned yesterday
// stays on yesterday's column even though "today" has nothing yet. Returns
// null for anything outside the current Mon-Sun week (nothing to plot).
function getWeekdayIndexInCurrentWeek(dateStr?: string): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIndex);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);

  if (date < weekStart || date >= weekEnd) return null;
  return (date.getDay() + 6) % 7;
}

// The track itself is always the full WEEK_BAR_HEIGHT (grey, so all 7
// columns stay the same size), but the colored fill inside it is scaled to
// fillHeightPx — that day's total relative to the week's busiest day, same
// as the reference web dashboard's WeeklyInsights (only the max day ever
// reaches full height; a day with fewer tasks than the week's peak shows a
// visibly shorter fill, not a full bar). Pinned to the bottom via
// justifyContent so the empty portion reads as headroom above the fill.
// Three stacked segments now (Active/Completed/Closed), not two — order
// top-to-bottom matches the legend row above the chart.
function WeekBar({ activeCount, completedCount, closedCount, fillHeightPx }: { activeCount: number; completedCount: number; closedCount: number; fillHeightPx: number }) {
  const total = activeCount + completedCount + closedCount;
  const completedHeight = total > 0 ? Math.round((fillHeightPx * completedCount) / total) : 0;
  const closedHeight = total > 0 ? Math.round((fillHeightPx * closedCount) / total) : 0;
  const activeHeight = fillHeightPx - completedHeight - closedHeight;
  return (
    <View style={[styles.weekBar, { height: WEEK_BAR_HEIGHT, backgroundColor: '#E5E7EB', justifyContent: 'flex-end', overflow: 'hidden' }]}>
      {total > 0 && (
        <View style={{ height: fillHeightPx }}>
          <View style={{ height: activeHeight, backgroundColor: '#7C5CFC' }} />
          <View style={{ height: completedHeight, backgroundColor: '#16A34A' }} />
          <View style={{ height: closedHeight, backgroundColor: '#3B82F6' }} />
        </View>
      )}
    </View>
  );
}

// Post-login landing screen for every role. The greeting reads the
// already-cached profile, and the avatar strip shows the logged-in
// dealer/areaManager's real team roster (fetched via the same
// getDealers/getEngineers call myTeamController.ts uses) — everything else
// on the screen is static. The only live navigation is the bottom nav bar's
// center button, which opens the real Job Cards screen.
export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    profile, permissions, greeting, summary, teamAvatars, myActiveCount, teamLoading, teamError,
    refreshing, onRefresh,
    selectedMemberChoice, selectMember,
    activeTasks, totalActiveCount, activeTasksLoading, activeTasksError, showingCachedDashboard,
    rawActiveTasks, rawRecentCompletedTasks, rawClosedTasks,
    carouselIndex, setCarouselIndex, goToPrevTask, goToNextTask,
    recentCompletedTasks, completedCarouselIndex, setCompletedCarouselIndex, goToPrevCompleted, goToNextCompleted,
    approvalList, approvalIndex, setApprovalIndex, goToPrevApproval, goToNextApproval,
    taskStatusOverrides, taskActionLoading, taskActionError,
    handleAcceptActiveTask, handleArrowPress,
    isDealer, isAreaManagerAssign, subordinateRole, engineers, engineersLoading,
    assignPickerTask, openAssignPicker, closeAssignPicker, handleAssignTask, assigningTask,
  } = useDashboardHomeController();


  // Active Task / Recent Completed carousel — a real horizontal swipe (not
  // just the arrow buttons instantly swapping cards) via a paging
  // ScrollView. Arrow taps still work: they update the same index state,
  // which this effect then scrolls to, so both input methods drive one
  // source of truth instead of drifting out of sync.
  const showingCompleted = !activeTasksLoading && !activeTasksError && activeTasks.length === 0 && recentCompletedTasks.length > 0;
  const activeCarouselList = showingCompleted ? recentCompletedTasks : activeTasks;
  const activeCarouselIndex = showingCompleted ? completedCarouselIndex : carouselIndex;
  const activeCarouselRef = useRef<ScrollView>(null);
  useEffect(() => {
    activeCarouselRef.current?.scrollTo({ x: activeCarouselIndex * width, animated: true });
  }, [activeCarouselIndex, width]);

  // SR Approvals carousel — same paging-ScrollView swipe treatment.
  const approvalCarouselRef = useRef<ScrollView>(null);
  useEffect(() => {
    approvalCarouselRef.current?.scrollTo({ x: approvalIndex * width, animated: true });
  }, [approvalIndex, width]);

  const [insightsTab, setInsightsTab] = React.useState<'Weekly' | 'Overview'>('Weekly');

  // Weekly tab's four stat pills — commissioning + service added together
  // from the same `counts` block, current snapshot totals, not date-bucketed.
  const commissioningCounts = summary?.counts.commissioning;
  const serviceCounts = summary?.counts.service;
  const summaryCounts = summary?.summaryCounts;
  const insightsActive = (commissioningCounts?.active || 0) + (serviceCounts?.active || 0);
  const insightsCompleted = (commissioningCounts?.completed || 0) + (serviceCounts?.completed || 0);
  const insightsClosed = (commissioningCounts?.closed || 0) + (serviceCounts?.closed || 0);
  // Derived from the three boxes beside it, not the API's own counts.*.total
  // field — that field can include statuses (e.g. cancelled) none of
  // Active/Completed/Closed count, which made Total not visually add up to
  // them.
  const insightsTotal = insightsActive + insightsCompleted + insightsClosed;
  const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0 ... Sun=6

  // Per-day active/completed/closed split for the chart bars — all three
  // buckets keyed off each task's own createdAt (not assignedAt/
  // completedAt/closedAt), matching the reference web dashboard's
  // WeeklyInsights logic exactly, so a task created yesterday stays on
  // yesterday's column instead of everything piling onto today.
  const weeklyBreakdown = React.useMemo(() => {
    const days = Array.from({ length: 7 }, () => ({ active: 0, completed: 0, closed: 0 }));
    rawActiveTasks.forEach((t: any) => {
      const idx = getWeekdayIndexInCurrentWeek(t.createdAt || t.date);
      if (idx !== null) days[idx].active += 1;
    });
    rawRecentCompletedTasks.forEach((t: any) => {
      const idx = getWeekdayIndexInCurrentWeek(t.createdAt || t.date);
      if (idx !== null) days[idx].completed += 1;
    });
    rawClosedTasks.forEach((t: any) => {
      const idx = getWeekdayIndexInCurrentWeek(t.createdAt || t.date);
      if (idx !== null) days[idx].closed += 1;
    });
    return days;
  }, [rawActiveTasks, rawRecentCompletedTasks, rawClosedTasks]);

  // The busiest day's total (active+completed+closed) — every other day's
  // bar fill scales relative to this, so only the week's peak day ever
  // reaches the track's full height.
  const weeklyMaxTotal = Math.max(...weeklyBreakdown.map((d) => d.active + d.completed + d.closed), 1);

  if (!profile || !permissions) {
    return (
      <SafeAreaView style={styles.container}>
        <DashboardBackground />
        <LoadingOverlay />
      </SafeAreaView>
    );
  }

  // Engineers get a drastically simplified view while offline (cached
  // dashboard data) — just the offline banner + Active Task carousel, no
  // Insights/team/SR-approvals content that would be stale or meaningless
  // without a live connection. Reuses the same showingCachedDashboard flag
  // and Active Task carousel state/handlers as the normal dashboard below,
  // so tapping a card still opens the task form exactly as it does online.
  if (getRole(profile.role) === 'engineer' && showingCachedDashboard) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <DashboardBackground />
        {(activeTasksLoading || Object.values(taskActionLoading).some(Boolean)) && <LoadingOverlay />}

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
        >
          <View style={[styles.offlineDataBanner, { marginHorizontal: hPad }]}>
            <CloudOff size={16} color="#B45309" />
            <Text style={styles.offlineDataBannerText}>Showing saved data — no connection right now</Text>
          </View>
          <PendingSyncBanner />

          <View style={[styles.sectionHeaderRow, { paddingHorizontal: hPad, marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>
              {showingCompleted ? 'Recents' : 'Active Task'}
            </Text>
            {activeCarouselList.length > 0 && (
              <PageController
                current={activeCarouselIndex + 1}
                total={activeCarouselList.length}
                onPrev={showingCompleted ? goToPrevCompleted : goToPrevTask}
                onNext={showingCompleted ? goToNextCompleted : goToNextTask}
              />
            )}
          </View>

          {activeTasksLoading ? null : activeTasksError ? (
            <View style={{ paddingHorizontal: hPad }}>
              <Text style={styles.teamStatusText}>{activeTasksError}</Text>
            </View>
          ) : activeCarouselList.length === 0 ? (
            <View style={{ paddingHorizontal: hPad }}>
              <EmptyActiveTaskCard />
            </View>
          ) : (
            <ScrollView
              ref={activeCarouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                if (showingCompleted) setCompletedCarouselIndex(newIndex);
                else setCarouselIndex(newIndex);
              }}
            >
              {activeCarouselList.map((task: any) => (
                <View key={task._id} style={{ width, paddingHorizontal: hPad }}>
                  <TaskPreviewCard
                    task={task}
                    effectiveStatus={taskStatusOverrides[task._id] || task.status}
                    isLoading={!!taskActionLoading[task._id]}
                    errorMsg={taskActionError[task._id]}
                    onArrowPress={() => handleArrowPress(task)}
                    onAcceptPress={showingCompleted ? undefined : () => handleAcceptActiveTask(task)}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const showTeamSection = permissions.hasMyTeam;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <DashboardBackground />
      {(teamLoading || activeTasksLoading || Object.values(taskActionLoading).some(Boolean)) && <LoadingOverlay />}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: headerPad }]}>
          <TouchableOpacity style={styles.headerLeft} onPress={() => router.push('/screens/profile' as any)}>
            <UserAvatar userId={profile.userId} name={profile.name} size={65} style={styles.headerAvatarBorder} />
            <View style={{ marginLeft: 12, flexShrink: 1 }}>
              <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
              <Text style={styles.userName} numberOfLines={1}>{profile.name}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.bellButton}>
            <Bell size={27} color="#979797" />
          </View>
        </View>

        <PendingSyncBanner />
        {showingCachedDashboard && (
          <View style={[styles.offlineDataBanner, { marginHorizontal: hPad }]}>
            <CloudOff size={16} color="#B45309" />
            <Text style={styles.offlineDataBannerText}>Showing saved data — no connection right now</Text>
          </View>
        )}

        {/* "You have N active Tasks" — N is commissioning.active +
            service.active from GET /api/me/dashboard's counts block, true
            for every role (not just managers). The avatar strip underneath
            (self + subordinates, each with their own active-task badge from
            teamAvatars) stays dealer/areaManager-only. */}
        <View style={{ paddingHorizontal: hPad, marginBottom: 24 }}>
          <Text style={styles.bannerText}>
            You have <Text style={styles.bannerCountBold}>{totalActiveCount}</Text>
            {'\n'}
            <Text style={styles.bannerActiveText}>active Tasks</Text>
          </Text>
        </View>

        {showTeamSection && (
          teamLoading ? null : teamError ? (
            <Text style={[styles.teamStatusText, { paddingHorizontal: hPad, marginBottom: 20 }]}>{teamError}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 8, gap: 16, marginBottom: 20 }}
            >
              {/* Tapping an avatar filters the SR Approvals/Active Task
                  cards below to just that person (falling back to their
                  recent completed if they have no active task). Nothing
                  selected by default — that shows the full team-wide
                  aggregate, same as before this feature existed. */}
              <TouchableOpacity style={styles.avatarWrapper} onPress={() => selectMember('me')} activeOpacity={0.8}>
                <View>
                  <UserAvatar
                    userId={profile.userId}
                    name={profile.name}
                    size={65}
                    style={[styles.teamAvatarBorder, selectedMemberChoice === 'me' && styles.teamAvatarSelected]}
                  />
                  {myActiveCount > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{myActiveCount}</Text>
                    </View>
                  )}
                  {/* Dealers get an extra handshake badge at the bottom,
                      alongside the count badge above — not instead of it. */}
                  {getRole(profile.role) === 'dealer' && (
                    <View style={styles.handshakeBadge}>
                      <Handshake size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={styles.avatarName} numberOfLines={1}>You</Text>
              </TouchableOpacity>

              {teamAvatars.map((member) => {
                const isSelected = selectedMemberChoice === member._id;
                const isDealer = getRole(member.role || '') === 'dealer';
                return (
                  <TouchableOpacity key={member._id} style={styles.avatarWrapper} onPress={() => selectMember(member._id)} activeOpacity={0.8}>
                    <View>
                      {/* Fallback-initials source (shown when there's no
                          profile photo) is dealerName, not the person's own
                          name — both dealers and engineers carry this
                          field, per the requested change. userId still
                          drives which photo actually loads; this only
                          affects the letters shown when there isn't one. */}
                      <UserAvatar
                        userId={member._id}
                        name={member.dealerName || member.name}
                        size={65}
                        style={[styles.teamAvatarBorder, isSelected && styles.teamAvatarSelected]}
                      />
                      {member.activeCount > 0 && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{member.activeCount}</Text>
                        </View>
                      )}
                      {/* Dealers get an extra handshake badge at the bottom,
                          alongside the count badge above — not instead of it. */}
                      {isDealer && (
                        <View style={styles.handshakeBadge}>
                          <Handshake size={14} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    {/* A dealer's company name is the meaningful label here
                        (that's who the AM is actually managing), not the
                        individual contact person's own name — same
                        dealer-row convention already used in
                        AssignEngineerModal's picker. Engineers still show
                        their own name, unaffected. */}
                    <Text style={styles.avatarName} numberOfLines={1}>
                      {isDealer ? (member.dealerName || member.name) : member.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )
        )}

        {/* SR Approvals — service work-approval requests (AM/RSM sign-off),
            from GET /api/me/dashboard's approvalList. Own carousel, same
            pagination shape as Active Task/Recent Completed below it, hidden
            entirely when there's nothing to show rather than an empty card. */}
        {approvalList.length > 0 && (
          <>
            <View style={[styles.sectionHeaderRow, { paddingHorizontal: hPad }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.sectionTitle}>SR Approvals</Text>
                <TouchableOpacity onPress={() => router.push('/screens/srApprovals' as any)}>
                  <Text style={styles.showAllLink}>Show all</Text>
                </TouchableOpacity>
              </View>
              <PageController current={approvalIndex + 1} total={approvalList.length} onPrev={goToPrevApproval} onNext={goToNextApproval} />
            </View>

            <ScrollView
              ref={approvalCarouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) => {
                setApprovalIndex(Math.round(e.nativeEvent.contentOffset.x / width));
              }}
            >
              {approvalList.map((item: any) => {
                const categoryInfo = SERVICE_CATEGORIES.find((c) => c.letter === item.category);
                // Every outstanding gate shown together now (e.g. Parts ·
                // Pending AM alongside Work · Pending RSM), not just the
                // single most decisive one — a task can genuinely be
                // waiting on both at once, and hiding either was
                // misleading about what's actually still outstanding.
                const statusPills = resolveApprovalStatusPills(item);
                const relTime = formatTimeAgoLabel(item.date);
                const approvalPeople = getTaskPeople(item);
                return (
                  <View key={item._id} style={{ width, paddingHorizontal: hPad }}>
                    <TouchableOpacity
                      style={styles.approvalCard}
                      activeOpacity={0.8}
                      onPress={() => router.push({ pathname: '/screens/srDetail', params: { task: JSON.stringify(item) } } as any)}
                    >
                      {/* SR approvals are always service work, so isService
                          is hardcoded true here (this card has no
                          commissioning equivalent). */}
                      <AssetIdentityHeader task={item} isService taskPeople={approvalPeople} hideGensetModel />

                      {!!item.category && (
                        <View style={styles.approvalCategoryPill}>
                          <Cog size={18} color="#4B4B57" />
                          <Text style={styles.approvalCategoryPillText} numberOfLines={1}>
                            {item.category}{categoryInfo ? ` · ${categoryInfo.name}` : ''}
                          </Text>
                        </View>
                      )}

                      <View style={styles.approvalStatusRow}>
                        {statusPills.length > 0 ? (
                          <View style={styles.approvalStatusPillGroup}>
                            {statusPills.map((pill, idx) => (
                              <View key={idx} style={styles.approvalStatusInline}>
                                {pill.label.includes('Rejected') ? (
                                  <XCircle size={16} color={pill.text} />
                                ) : pill.label.includes('Pending') ? (
                                  <Clock size={16} color={pill.text} />
                                ) : (
                                  <CheckCircle2 size={16} color={pill.text} />
                                )}
                                <Text style={[styles.approvalStatusInlineText, { color: pill.text }]} numberOfLines={1}>
                                  {pill.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : <View />}
                        {!!item.date && <Text style={styles.approvalTime}>{relTime}</Text>}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Active Task — real commissioning + service active tasks from
            GET /api/me/dashboard, paged one at a time. Once that list is
            genuinely empty (not just still loading or erroring), this
            swaps to real recentCompleted cards instead — same carousel/
            pagination shape, just its own index and a "View Report" arrow
            (no accept action, since these are already done). Only when
            there's neither an active nor a recently-completed task does it
            fall back to the plain "All caught up!" empty state. */}
        <View style={[styles.sectionHeaderRow, { paddingHorizontal: hPad }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <Text style={styles.sectionTitle}>
              {showingCompleted ? 'Recents' : 'Active Task'}
            </Text>
            {/* Shows who the list below is currently filtered to — tapping
                the X clears selectedMemberChoice back to null, which shows
                every team member's tasks again (selectMember's own default). */}
            {!!selectedMemberChoice && (
              <View style={styles.memberFilterBadge}>
                <Text style={styles.memberFilterBadgeText} numberOfLines={1}>
                  {selectedMemberChoice === 'me' ? 'You' : teamAvatars.find((m) => m._id === selectedMemberChoice)?.name || ''}
                </Text>
                <TouchableOpacity onPress={() => selectMember(null)}>
                  <XCircle size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {activeCarouselList.length > 0 && (
            <PageController
              current={activeCarouselIndex + 1}
              total={activeCarouselList.length}
              onPrev={showingCompleted ? goToPrevCompleted : goToPrevTask}
              onNext={showingCompleted ? goToNextCompleted : goToNextTask}
            />
          )}
        </View>

        {activeTasksLoading ? null : activeTasksError ? (
          <View style={{ paddingHorizontal: hPad }}>
            <Text style={styles.teamStatusText}>{activeTasksError}</Text>
          </View>
        ) : activeCarouselList.length === 0 ? (
          <View style={{ paddingHorizontal: hPad }}>
            <EmptyActiveTaskCard />
          </View>
        ) : (
          // Real horizontal swipe, one full-width "page" per task, snapping
          // like a native carousel — the arrow buttons above stay in sync
          // via the activeCarouselIndex effect (scrollTo), and swiping
          // updates that same index on scroll end.
          <ScrollView
            ref={activeCarouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => {
              const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              if (showingCompleted) setCompletedCarouselIndex(newIndex);
              else setCarouselIndex(newIndex);
            }}
          >
            {activeCarouselList.map((task: any) => {
              // An area manager who has delegated this task down to one of
              // their dealers no longer acts on it themselves — Accept/
              // Start only show while it's still assigned directly to the
              // area manager (self-assigned or handed down from the RSM).
              const amDelegatedAway = isAreaManagerAssign && task.assignedTo?.userId !== profile?.userId;
              // Same self-assign parity for dealers: a dealer who assigned
              // this task to themselves (instead of one of their engineers)
              // works it exactly like an engineer/AM would — Accept/Start/
              // Complete — not the Assign/Reassign sheet, which only makes
              // sense for a task actually handed off to a team member.
              const isMyOwnTask = task.assignedTo?.userId === profile?.userId;
              return (
                <View key={task._id} style={{ width, paddingHorizontal: hPad }}>
                  <TaskPreviewCard
                    task={task}
                    effectiveStatus={taskStatusOverrides[task._id] || task.status}
                    isLoading={!!taskActionLoading[task._id]}
                    errorMsg={taskActionError[task._id]}
                    onArrowPress={amDelegatedAway ? undefined : () => handleArrowPress(task)}
                    // A dealer can only Accept a task genuinely assigned to
                    // them — accepting on behalf of an engineer isn't a real
                    // action (the backend rejects it: "not assigned to
                    // you"). Team tasks just show no action here at all
                    // while still ASSIGNED, until the engineer accepts it
                    // themselves.
                    onAcceptPress={showingCompleted || amDelegatedAway || (isDealer && !isMyOwnTask) ? undefined : () => handleAcceptActiveTask(task)}
                    onAssignPress={showingCompleted || isMyOwnTask ? undefined : (isDealer ? () => openAssignPicker(task) : undefined)}
                  />
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Insights — Weekly (3 stat pills + a per-day active/completed
            split bar) vs Overview (4 category cards), both driven off the
            same GET /api/me/dashboard payload already loaded above. */}
        <View style={[styles.sectionHeaderRow, { paddingHorizontal: hPad }]}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightsToggle}>
            <TouchableOpacity
              style={[styles.insightsToggleBtn, insightsTab === 'Weekly' && styles.insightsToggleBtnActive]}
              onPress={() => setInsightsTab('Weekly')}
            >
              <Text style={[styles.insightsToggleText, insightsTab === 'Weekly' && styles.insightsToggleTextActive]}>Weekly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.insightsToggleBtn, insightsTab === 'Overview' && styles.insightsToggleBtnActive]}
              onPress={() => setInsightsTab('Overview')}
            >
              <Text style={[styles.insightsToggleText, insightsTab === 'Overview' && styles.insightsToggleTextActive]}>Overview</Text>
            </TouchableOpacity>
          </View>
        </View>

        {insightsTab === 'Weekly' ? (
          <>
            <View style={[styles.insightStatRow, { paddingHorizontal: hPad }]}>
              <View style={styles.insightStatCard}>
                <View style={[styles.insightBadge, { backgroundColor: '#232323' }]}>
                  <Text style={styles.insightBadgeText}>{String(insightsTotal).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.insightStatLabel}>Total</Text>
              </View>
              <View style={styles.insightStatCard}>
                <View style={[styles.insightBadge, { backgroundColor: '#7C5CFC' }]}>
                  <Text style={styles.insightBadgeText}>{String(insightsActive).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.insightStatLabel}>Active</Text>
              </View>
              <View style={styles.insightStatCard}>
                <View style={[styles.insightBadge, { backgroundColor: '#16A34A' }]}>
                  <Text style={styles.insightBadgeText}>{String(insightsCompleted).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.insightStatLabel}>Completed</Text>
              </View>
              <View style={styles.insightStatCard}>
                <View style={[styles.insightBadge, { backgroundColor: '#3B82F6' }]}>
                  <Text style={styles.insightBadgeText}>{String(insightsClosed).padStart(2, '0')}</Text>
                </View>
                <Text style={styles.insightStatLabel}>Closed</Text>
              </View>
            </View>

            <View style={[styles.weekChartCard, { marginHorizontal: hPad }]}>
              <View style={styles.weekChartLegendRow}>
                <View style={styles.weekChartLegendItem}>
                  <View style={[styles.weekChartLegendDot, { backgroundColor: '#7C5CFC' }]} />
                  <Text style={styles.weekChartLegendText}>Active</Text>
                </View>
                <View style={styles.weekChartLegendItem}>
                  <View style={[styles.weekChartLegendDot, { backgroundColor: '#16A34A' }]} />
                  <Text style={styles.weekChartLegendText}>Completed</Text>
                </View>
                <View style={styles.weekChartLegendItem}>
                  <View style={[styles.weekChartLegendDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={styles.weekChartLegendText}>Closed</Text>
                </View>
              </View>

              <View style={styles.weekChartRow}>
                {WEEK_DAY_LABELS.map((label, idx) => {
                  const day = weeklyBreakdown[idx];
                  const dayTotal = day.active + day.completed + day.closed;
                  // At least 14px so a day with just 1-2 tasks still reads
                  // as a visible sliver rather than vanishing next to the
                  // week's peak day.
                  const fillHeightPx = dayTotal > 0 ? Math.max(14, Math.round((dayTotal / weeklyMaxTotal) * WEEK_BAR_HEIGHT)) : 0;
                  return (
                    <View key={label} style={styles.weekChartCol}>
                      {/* Plain day total (or a dot when there's nothing
                          that day) — not the old total/completed ratio. */}
                      <Text style={styles.weekChartValue}>{dayTotal > 0 ? dayTotal : '·'}</Text>
                      <WeekBar activeCount={day.active} completedCount={day.completed} closedCount={day.closed} fillHeightPx={fillHeightPx} />
                      <Text style={[styles.weekChartDayLabel, idx === todayIndex && styles.weekChartDayLabelToday]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.overviewTableCard, { marginHorizontal: hPad }]}>
            <View style={styles.overviewHeaderRow}>
              <View style={styles.overviewLabelCol} />
              <Text style={styles.overviewHeaderCell}>Active</Text>
              <Text style={styles.overviewHeaderCell}>Completed</Text>
              <Text style={styles.overviewHeaderCell}>Closed</Text>
            </View>

            <View style={styles.overviewDataRow}>
              <View style={styles.overviewLabelCol}>
                <View style={[styles.overviewRowIconCircle, { backgroundColor: '#F97316' }]}>
                  <FileText size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.overviewRowLabel}>Comm</Text>
              </View>
              <Text style={[styles.overviewDataCell, { color: '#000000' }]}>{commissioningCounts?.active || 0}</Text>
              <Text style={[styles.overviewDataCell, { color: '#F97316' }]}>{commissioningCounts?.completed || 0}</Text>
              <Text style={[styles.overviewDataCell, { color: '#7C2D12' }]}>{commissioningCounts?.closed || 0}</Text>
            </View>

            <View style={styles.overviewRowDivider} />

            <View style={styles.overviewDataRow}>
              <View style={styles.overviewLabelCol}>
                <View style={[styles.overviewRowIconCircle, { backgroundColor: '#1E1951' }]}>
                  <Settings size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.overviewRowLabel}>Service</Text>
              </View>
              <Text style={[styles.overviewDataCell, { color: '#000000' }]}>{serviceCounts?.active || 0}</Text>
              <Text style={[styles.overviewDataCell, { color: '#6D28D9' }]}>{serviceCounts?.completed || 0}</Text>
              <Text style={[styles.overviewDataCell, { color: '#5B21B6' }]}>{serviceCounts?.closed || 0}</Text>
            </View>
          </View>
        )}
      </ScrollView>

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

  // Pinned over the ScrollView, not a normal flex sibling below it — see
  // the comment at its call site for why.
  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 24,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  headerAvatarBorder: { borderWidth: 2, borderColor: '#FFFFFF' },
  greeting: { fontSize: 16, fontWeight: '400', color: '#000000' },
  userName: { fontSize: 20, fontWeight: '600', color: '#000000', marginTop: 2 },
  bellButton: {
    width: 55, height: 55, borderRadius: 27.5,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  bannerText: { fontSize: 32, fontWeight: '400', color: '#686868', lineHeight: 38 },
  bannerCountBold: { fontSize: 32, fontWeight: '600', color: '#000000' },
  // Was a flat gray pill with small, low-contrast text — easy to miss.
  // Now a warm amber warning banner (same visual language as the app's
  // other attention states, e.g. the "N missing" pill), bigger/bolder
  // text, so "no connection" actually reads as a status worth noticing.
  offlineDataBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    borderWidth: 1, borderColor: '#FCD34D',
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 12,
  },
  offlineDataBannerText: { fontSize: 13, fontWeight: '700', color: '#92400E', flexShrink: 1 },
  bannerActiveText: { fontSize: 32, fontWeight: '600', color: '#000000' },

  avatarWrapper: { width: 64, alignItems: 'center' },
  teamAvatarBorder: { borderWidth: 2, borderColor: '#FFFFFF' },
  // The currently-selected avatar in the tap-to-filter strip — matches the
  // reference design's orange ring around whichever person's SR
  // Approvals/Active Task are being shown below.
  teamAvatarSelected: { borderWidth: 2.5, borderColor: '#F26722' },
  countBadge: {
    position: 'absolute',
    top: -4, right: -4,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4,
    backgroundColor: '#FF7A3D',
    borderWidth: 2, borderColor: '#F6F6F6',
    justifyContent: 'center', alignItems: 'center',
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  // Dealers' extra badge — sits at the bottom corner (mirroring
  // countBadge's top corner), additive rather than replacing the count.
  handshakeBadge: {
    position: 'absolute',
    bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2563EB',
    borderWidth: 2, borderColor: '#F6F6F6',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarName: { fontSize: 12, fontWeight: '600', color: '#000000', marginTop: 6, maxWidth: 64, textAlign: 'center' },
  teamStatusText: { color: '#9CA3AF', fontSize: 14 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000000', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, fontWeight: '400', color: '#9CA3AF' },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#000000' },
  memberFilterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1E1951',
    borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 10,
    maxWidth: 120,
  },
  memberFilterBadgeText: { flexShrink: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  showAllLink: { fontSize: 14, fontWeight: '700', color: '#F26722' },
  // ─── SR Approvals ───
  approvalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    gap: 14,
  },
  approvalCategoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,

    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingVertical: 16, paddingHorizontal: 14,
  },
  approvalCategoryPillText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  approvalStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  approvalStatusPillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flexShrink: 1 },
  approvalStatusInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  approvalStatusInlineText: { fontSize: 14, fontWeight: '700' },
  approvalTime: { fontSize: 16, fontWeight: '700', color: '#000000' },

  // ─── Insights ───
  insightsToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 100,
    padding: 3,
  },
  insightsToggleBtn: {
    paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 100,
  },
  insightsToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  insightsToggleText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  insightsToggleTextActive: { color: '#000000', fontWeight: '700' },

  // No flex:1 here — each card sizes to its own label's width (Total is
  // short, Completed is long) instead of three forced-equal columns that
  // made the longest label wrap. Packed from the left with a fixed gap
  // rather than justify-between, so short labels don't get stretched apart.
  insightStatRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  // flex: 1 on each card — three equal-width cards that always fit the row,
  // instead of sizing purely off content (which let "Completed", the
  // widest label, push the row past the screen edge on narrower phones).
  insightStatCard: {
    flex: 1,
    alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  insightBadge: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
  },
  insightBadgeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  insightStatLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563' },

  weekChartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  weekChartLegendRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 18, marginBottom: 16 },
  weekChartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekChartLegendDot: { width: 8, height: 8, borderRadius: 4 },
  weekChartLegendText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  weekChartRow: { flexDirection: 'row' },
  weekChartCol: { flex: 1, alignItems: 'center', gap: 10 },
  weekChartValue: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  weekBar: { width: 12, borderRadius: 6 },
  weekChartDayLabel: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  weekChartDayLabelToday: { color: '#000000', fontWeight: '700' },

  overviewTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  overviewHeaderCell: { flex: 1, fontSize: 13, fontWeight: '600', color: '#9CA3AF', textAlign: 'center' },
  overviewDataRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  overviewLabelCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  overviewRowIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  overviewRowLabel: { fontSize: 14, fontWeight: '600', color: '#000000' },
  overviewDataCell: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  overviewRowDivider: { height: 1, backgroundColor: '#F3F4F6' },
});
