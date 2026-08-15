import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter } from 'expo-router';
import { UserProfile } from '../models/Login';
import { DashboardSummary } from '../models/dashboard.types';
import { TeamMember } from '../models/myTeam.types';
import {
  getDashboardSummary,
  reassignCommissioningTask, reassignServiceTask,
} from '../viewModel/commisionAPi';
import { getPermissions } from '../constants/permissions';
import { parseApiError } from '../utils/apiError';
import { formatTaskType } from '../utils/reportFormatters';
import { useTeam } from '../context/TeamContext';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError, putOrQueue } from '../utils/syncEngine';

// Backend doesn't send a greeting string — purely a function of the
// device's wall-clock hour at render time, same three-way split as any
// other "Good Morning/Afternoon/Evening" pattern.
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning!';
  if (hour < 17) return 'Good Afternoon!';
  return 'Good Evening!';
}

// Drives the post-login Dashboard screen off one consolidated fetch,
// GET /api/me/dashboard — replaces what used to be two separate calls
// (team roster via getDealers/getEngineers, active tasks via
// GET /api/me/tasks?status=active) since this endpoint already returns
// both (teamAvatars, activeTasks) plus the counts the header banner needs,
// in a single round trip.
export function useDashboardHomeController() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  // True when what's on screen is the last successfully-cached response,
  // not a fresh one — set whenever a live fetch fails with a genuine
  // network error and a cached copy was found to fall back to instead of
  // just showing an error screen. Cleared the moment a real fetch succeeds.
  const [showingCachedDashboard, setShowingCachedDashboard] = useState(false);

  // Unfiltered — the full team-wide lists straight off the API. What the
  // screen actually renders (activeTasks/recentCompletedTasks/approvalList
  // below) is these filtered down to whichever team member is selected.
  const [rawActiveTasks, setRawActiveTasks] = useState<any[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Shown in the same "Active Task" slot, swapped in only once activeTasks
  // is genuinely empty — real cards from recentCompleted, not just a
  // relabeled empty state.
  const [rawRecentCompletedTasks, setRawRecentCompletedTasks] = useState<any[]>([]);
  const [completedCarouselIndex, setCompletedCarouselIndex] = useState(0);

  const [approvalIndex, setApprovalIndex] = useState(0);

  // Which avatar in the team strip is "active" — null is the default
  // (nothing tapped yet): the SR Approvals/Active Task cards below show
  // the full team-wide aggregate, same as before this feature existed.
  // Tapping "You" narrows it to 'me' (the logged-in user's own tasks
  // specifically); tapping a team member narrows it to that member's
  // _id. Dealer/areaManager only in practice, since that's the only role
  // combo with a team strip to tap (hasMyTeam).
  const [selectedMemberChoice, setSelectedMemberChoice] = useState<string | 'me' | null>(null);

  const [taskStatusOverrides, setTaskStatusOverrides] = useState<Record<string, string>>({});
  const [taskActionLoading, setTaskActionLoading] = useState<Record<string, boolean>>({});
  const [taskActionError, setTaskActionError] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setProfile(JSON.parse(saved)); })
      .catch((error) => console.log('[Dashboard] Failed to load cached profile:', error));
  }, []);

  const permissions = profile ? getPermissions(profile.role) : null;
  // Dealers don't fill the form by default (canFillTaskForm: false) — once
  // a task is past ASSIGNED, their usual action is handing it off to one of
  // their engineers, so the arrow is replaced with the assign icon.
  // Exception: a task the dealer assigned to *themselves* is worked like an
  // engineer's own task instead (see isMyOwnTask in the Active Task
  // carousel below). Area managers CAN fill the form but also manage
  // dealers — same as commissioningTasksController.ts's
  // isDealer/isAreaManagerAssign split.
  const isDealer = !!permissions && !permissions.canFillTaskForm;
  const isAreaManagerAssign = !!permissions && permissions.canFillTaskForm && !!permissions.subordinateRole;

  // Shared across every screen with an assign picker — fetched once at the
  // app root (TeamContext) instead of this controller re-fetching its own
  // copy of the same roster.
  const { members: engineers, loading: engineersLoading } = useTeam();
  const [assignPickerTask, setAssignPickerTask] = useState<any | null>(null);
  const [assigningTask, setAssigningTask] = useState(false);

  // `silent` skips the full-screen LoadingOverlay — used by pull-to-refresh,
  // which shows its own native RefreshControl spinner instead so the two
  // don't stack on top of each other.
  // Shared by both the live-fetch success path and the offline cache
  // fallback below — same normalization either way, just a different
  // source for `data`.
  const applySummary = useCallback((data: DashboardSummary) => {
    const commissioning = (data.activeTasks?.commissioning || []).map((task: any) => ({ ...task, __kind: 'commissioning' }));
    const service = (data.activeTasks?.service || []).map((task: any) => ({ ...task, __kind: 'service' }));
    const completedCommissioning = (data.recentCompleted?.commissioning || []).map((task: any) => ({ ...task, __kind: 'commissioning' }));
    const completedService = (data.recentCompleted?.service || []).map((task: any) => ({ ...task, __kind: 'service' }));
    // summaryCounts (and its individual fields) can be missing from the
    // response entirely — normalized to 0 here, once, so every consumer
    // (Insights' Weekly/Overview cards, the "You have N active" banner)
    // can read it as always-defined instead of each needing its own `?.`.
    const summaryCounts = {
      myActive: data.summaryCounts?.myActive || 0,
      teamActive: data.summaryCounts?.teamActive || 0,
      overdue: data.summaryCounts?.overdue || 0,
      pendingApproval: data.summaryCounts?.pendingApproval || 0,
      completed: data.summaryCounts?.completed || 0,
    };
    setSummary({ ...data, summaryCounts });
    setRawActiveTasks([...commissioning, ...service]);
    setCarouselIndex(0);
    setRawRecentCompletedTasks([...completedCommissioning, ...completedService]);
    setCompletedCarouselIndex(0);
    setApprovalIndex(0);
  }, []);

  const fetchSummary = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!opts?.silent) setSummaryLoading(true);
    setSummaryError('');
    try {
      const token = await getToken();
      if (!token) return true;
      const data: DashboardSummary = await getDashboardSummary(token);
      applySummary(data);
      setShowingCachedDashboard(false);
      // No user-scoping needed on the cache key — logout already clears
      // all of AsyncStorage (see profileController.ts), so a stale
      // previous user's cached dashboard can never leak into a fresh
      // session.
      await cacheData('dashboard_summary', data);
      return true;
    } catch (error: any) {
      // A site with no signal at all — fall back to whatever this device
      // last saw rather than showing a blank error screen for something
      // as central as "what tasks do I have". A real server-side error
      // (500, malformed response, etc.) still falls through to the normal
      // error message below, since retrying that won't help and pretending
      // otherwise with stale data could hide a real problem.
      if (isNetworkError(error)) {
        const cached = await getCachedData<DashboardSummary>('dashboard_summary');
        if (cached) {
          applySummary(cached.data);
          setShowingCachedDashboard(true);
          return true;
        }
      }
      console.log('[Dashboard] Failed to load dashboard summary:', error);
      const { message } = parseApiError(error, 'Failed to load dashboard.');
      setSummaryError(message);
      return false;
    } finally {
      if (!opts?.silent) setSummaryLoading(false);
    }
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const ok = await fetchSummary({ silent: true });
    setRefreshing(false);
    if (!ok) Alert.alert('Error', 'Failed to refresh dashboard. Please try again.');
  }, [fetchSummary]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // "You have N active Tasks" — commissioning.active + service.active,
  // exactly the pair the backend's own `counts` block reports. Deliberately
  // NOT affected by selectedMemberId — this banner is always the whole
  // team's total, same as before this feature.
  const totalActiveCount = (summary?.counts.commissioning.active || 0) + (summary?.counts.service.active || 0);
  const teamAvatars = summary?.teamAvatars || [];
  const myActiveCount = summary?.summaryCounts.myActive || 0;

  // Tapping an avatar in the team strip — resets every carousel back to
  // its first card too, since the filtered list underneath it just
  // changed and the old index could now point past the end (or at a
  // completely different task). Pass null to go back to the unfiltered
  // team-wide aggregate.
  const selectMember = useCallback((choice: string | 'me' | null) => {
    // Tapping the same avatar that's already selected clears the filter
    // instead of re-selecting it — a second tap toggles back to the
    // unfiltered, team-wide view rather than requiring the separate X on
    // the filter badge.
    setSelectedMemberChoice((prev) => (prev === choice ? null : choice));
    setCarouselIndex(0);
    setCompletedCarouselIndex(0);
    setApprovalIndex(0);
  }, []);

  // 'me' resolves to the logged-in user's own id; null means no filter at
  // all (show everyone) rather than defaulting to "me".
  const selectedUserId = selectedMemberChoice === 'me' ? (profile?.userId ?? null) : selectedMemberChoice;
  // Defensive client-side status guard — the backend's /me/dashboard
  // activeTasks arrays have been observed including entries whose status
  // has already moved past "active" (e.g. a commissioning entry sitting at
  // COMPLETED, still pending AM approval). This carousel is meant to show
  // only genuinely in-flight work for both kinds, so it's filtered down to
  // exactly ASSIGNED/ACCEPTED/IN_PROGRESS here regardless of what the raw
  // response contains.
  const activeTasks = useMemo(() => {
    const inFlight = rawActiveTasks.filter((t) => ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(t.status));
    return selectedUserId ? inFlight.filter((t) => t.assignedTo?.userId === selectedUserId) : inFlight;
  }, [rawActiveTasks, selectedUserId]);
  // Deliberately NOT filtered by selectedUserId — when the selected person
  // has no active task of their own, the fallback shows recent completed
  // activity straight from the response as-is, not narrowed to just that
  // person (who may well have none, in which case there'd be nothing to
  // fall back to at all).
  const recentCompletedTasks = rawRecentCompletedTasks;
  // SR Approvals aren't typed with an assignee (DashboardApprovalItem is a
  // curated subset of the raw response) — same assignedTo.userId shape
  // every other task-like object in this app carries, filtered
  // defensively so a missing field just yields an empty list rather than
  // throwing.
  const approvalList = useMemo(() => {
    const all = summary?.approvalList || [];
    return selectedUserId ? all.filter((a: any) => a.assignedTo?.userId === selectedUserId) : all;
  }, [summary, selectedUserId]);

  const goToPrevTask = useCallback(() => {
    setCarouselIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNextTask = useCallback(() => {
    setCarouselIndex((i) => Math.min(activeTasks.length - 1, i + 1));
  }, [activeTasks.length]);

  const goToPrevCompleted = useCallback(() => {
    setCompletedCarouselIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNextCompleted = useCallback(() => {
    setCompletedCarouselIndex((i) => Math.min(recentCompletedTasks.length - 1, i + 1));
  }, [recentCompletedTasks.length]);

  const goToPrevApproval = useCallback(() => {
    setApprovalIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToNextApproval = useCallback(() => {
    setApprovalIndex((i) => Math.min(approvalList.length - 1, i + 1));
  }, [approvalList.length]);

  // Accept, right from the Active Task carousel card — dispatches to the
  // commissioning or service endpoint based on the __kind tag added when
  // the two halves of the dashboard response were combined above.
  const handleAcceptActiveTask = useCallback(async (task: any) => {
    const taskId = task._id;
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: true }));
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      const kind = task.__kind === 'service' ? 'service' : 'commissioning';
      await putOrQueue(`/api/${kind}/${taskId}/accept`, {}, `Accept task (${taskId})`, `${kind}_accept_${taskId}`);
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: 'ACCEPTED' }));
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to accept task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setTaskActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  // Start, from the same card — same dispatch-by-__kind pattern as accept.
  const handleStartActiveTask = useCallback(async (task: any) => {
    const taskId = task._id;
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: true }));
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      const kind = task.__kind === 'service' ? 'service' : 'commissioning';
      await putOrQueue(`/api/${kind}/${taskId}/start`, {}, `Start task (${taskId})`, `${kind}_start_${taskId}`);
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: 'IN_PROGRESS' }));
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to start task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setTaskActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  const goToTaskForm = useCallback((task: any) => {
    if (task.__kind === 'service') {
      router.push({
        pathname: '/screens/srTaskForm',
        params: {
          taskId: task._id,
          assetId: task.asset?._id || '',
          gensetNumber: task.asset?.gensetNumber || '',
          engineNumber: task.asset?.engineNumber || '',
        },
      } as any);
    } else {
      router.push({
        pathname: '/screens/taskForm',
        params: {
          taskId: task._id,
          assetId: task.asset?._id,
          taskType: formatTaskType(task.type),
          assignedToName: task.assignedTo?.name || '',
          assignedToRole: task.assignedTo?.role || '',
        },
      } as any);
    }
  }, [router]);

  // Recent-completed cards' arrow — "View Report", same target the
  // Commissioning/Services list screens' own Completed tab uses.
  const goToTaskReport = useCallback((task: any) => {
    router.push({
      pathname: task.__kind === 'service' ? '/screens/srTaskReport' : '/screens/taskReport',
      params: { task: JSON.stringify(task) },
    } as any);
  }, [router]);

  // The card's arrow button, once a task is past ASSIGNED (which the
  // separate accept action already covers): ACCEPTED starts it, IN_PROGRESS
  // goes straight into the real form (taskForm/srTaskForm by __kind),
  // COMPLETED/CLOSED (the recent-completed cards) opens its report — anything
  // else falls back to the list screen, same as the arrow's original
  // plain-navigation behavior.
  //
  // Service's own COMPLETED is the one exception: per the backend dev
  // guide it means OTP sign-off is still pending, not actually done, so it
  // stays an Active-tab card and its arrow must go back into srTaskForm
  // (which now auto-resumes at Step 5) rather than the read-only report —
  // there's nothing to "view" yet since the customer hasn't signed off.
  const handleArrowPress = useCallback((task: any) => {
    const effectiveStatus = taskStatusOverrides[task._id] || task.status;
    if (effectiveStatus === 'ACCEPTED') return handleStartActiveTask(task);
    if (effectiveStatus === 'IN_PROGRESS') return goToTaskForm(task);
    if (effectiveStatus === 'COMPLETED' && task.__kind === 'service') return goToTaskForm(task);
    if (effectiveStatus === 'COMPLETED' || effectiveStatus === 'CLOSED') return goToTaskReport(task);
    return router.push((task.__kind === 'service' ? '/screens/serviceTasks' : '/screens/commissioningTasks') as any);
  }, [taskStatusOverrides, handleStartActiveTask, goToTaskForm, goToTaskReport, router]);

  const openAssignPicker = useCallback((task: any) => {
    setAssignPickerTask(task);
  }, []);

  const closeAssignPicker = useCallback(() => {
    setAssignPickerTask(null);
  }, []);

  // Hands the task in `assignPickerTask` off to the chosen engineer/dealer —
  // dispatches by __kind since the Dashboard's list mixes commissioning and
  // service tasks. The sheet stays open with a spinner on its own Assign
  // button (assigningTask) while the call is in flight, so a failure can be
  // retried from the same sheet. Once reassigned the task no longer belongs
  // to this user, so the whole summary is re-fetched rather than
  // optimistically patched.
  const handleAssignTask = useCallback(async (engineer: TeamMember) => {
    if (!assignPickerTask) return;
    const taskId = assignPickerTask._id;
    setAssigningTask(true);
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      const token = await getToken();
      if (!token) return;
      if (assignPickerTask.__kind === 'service') {
        await reassignServiceTask(token, assignPickerTask.asset?._id, engineer._id);
      } else {
        await reassignCommissioningTask(token, assignPickerTask.asset?._id, assignPickerTask.type, engineer._id);
      }
      setAssignPickerTask(null);
      await fetchSummary();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to assign task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setAssigningTask(false);
    }
  }, [assignPickerTask, fetchSummary]);

  return {
    profile, permissions,
    greeting: getGreeting(),
    // Raw summary handed through as-is (rather than picking out yet more
    // individual scalars) — the Insights section reads counts.commissioning/
    // service and summaryCounts directly off it.
    summary,
    teamAvatars, myActiveCount,
    teamLoading: summaryLoading, teamError: summaryError,
    refreshing, onRefresh,
    selectedMemberChoice, selectMember,
    activeTasks, totalActiveCount, activeTasksLoading: summaryLoading, activeTasksError: summaryError,
    showingCachedDashboard,
    // Unfiltered — for the Insights weekly chart, which stays whole-team
    // regardless of avatar selection (only the Active Task/SR Approvals
    // cards above it are meant to filter).
    rawActiveTasks, rawRecentCompletedTasks,
    carouselIndex, setCarouselIndex, goToPrevTask, goToNextTask,
    recentCompletedTasks, completedCarouselIndex, setCompletedCarouselIndex, goToPrevCompleted, goToNextCompleted,
    approvalList, approvalIndex, setApprovalIndex, goToPrevApproval, goToNextApproval,
    taskStatusOverrides, taskActionLoading, taskActionError,
    handleAcceptActiveTask, handleArrowPress,
    isDealer, isAreaManagerAssign, subordinateRole: permissions?.subordinateRole ?? null,
    engineers, engineersLoading,
    assignPickerTask, openAssignPicker, closeAssignPicker, handleAssignTask, assigningTask,
  };
}
