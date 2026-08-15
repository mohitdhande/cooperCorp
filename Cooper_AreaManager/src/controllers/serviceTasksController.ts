import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter } from 'expo-router';
import {
  getMyTasksByStatus, getMyTeamData, reassignServiceTask,
} from '../viewModel/commisionAPi';
import { parseApiError } from '../utils/apiError';
import { flattenTeamTasks, bucketTaskStatus } from '../utils/reportFormatters';
import { getPermissions } from '../constants/permissions';
import { UserProfile } from '../models/Login';
import { TeamMember } from '../models/myTeam.types';
import { useAssetTaskSearch } from './useAssetTaskSearch';
import { useTeam } from '../context/TeamContext';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError, putOrQueue } from '../utils/syncEngine';

const PAGE_SIZE = 10;

type Tab = 'Active' | 'Completed' | 'Closed';

// Drives the redesigned Services task-list screen (reached from the bottom
// nav bar's Services icon) — the service/SR equivalent of
// commissioningTasksController.ts. Same backend contract, same
// TaskPreviewCard-based UI and page-jump pagination, just service tasks
// (data.service, not data.commissioning) and the srTaskForm/srTaskReport
// navigation targets already used by srJobCardsController.ts.
export function useServiceTasksController() {
  const router = useRouter();

  const [selectedTab, setSelectedTab] = useState<Tab>('Active');
  const [page, setPage] = useState(1);
  const [tasks, setTasks] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [taskStatusOverrides, setTaskStatusOverrides] = useState<Record<string, string>>({});
  const [taskActionLoading, setTaskActionLoading] = useState<Record<string, boolean>>({});
  const [taskActionError, setTaskActionError] = useState<Record<string, string>>({});

  // Every GET /api/me/tasks?status=... response carries counts for ALL
  // statuses (not just the one queried), so one fetch keeps every tab's
  // badge number current — no extra round trips needed for the other two.
  const [counts, setCounts] = useState({ active: 0, completed: 0, closed: 0 });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const permissions = profile ? getPermissions(profile.role) : null;
  // Dealers don't fill the form by default (canFillTaskForm: false) — their
  // usual action beyond Accept is handing the task off to one of their
  // engineers, so the arrow is replaced with ASSIGN. Exception: a task the
  // dealer assigned to *themselves* is worked like an engineer's own task
  // instead (see isMyOwnTask in serviceTasks.tsx's card-rendering loop).
  // Area managers CAN fill the form (canFillTaskForm: true) but also manage a subordinate role
  // (dealers) — they get an extra ASSIGN row alongside the still-functional
  // arrow, rather than the arrow being replaced.
  const isDealer = !!permissions && !permissions.canFillTaskForm;
  const isAreaManagerAssign = !!permissions && permissions.canFillTaskForm && !!permissions.subordinateRole;
  // Same "AM manages dealers" signal TeamContext uses to pick the assign
  // roster (getDealers vs getEngineers) — reused here to decide which
  // endpoint powers these tabs at all.
  const isAreaManager = permissions?.subordinateRole === 'dealer';

  // Shared across every screen with an assign picker — fetched once at the
  // app root (TeamContext) instead of this controller re-fetching its own
  // copy of the same roster.
  const { members: subordinates, loading: engineersLoading } = useTeam();

  // Both an area manager and a dealer can keep the task for themselves
  // instead of delegating it further down — same self-assign option
  // already added to commissioningTasksController.ts's reassign flow and
  // both New Job/New Service Job creation flows.
  const canSelfAssign = isAreaManagerAssign || isDealer;
  const engineers = useMemo<TeamMember[]>(() => {
    if (!canSelfAssign || !profile) return subordinates;
    const self: TeamMember = {
      _id: profile.userId,
      username: profile.username,
      name: `${profile.name} (You)`,
      role: profile.role,
      dealerName: isAreaManagerAssign ? 'Area Manager' : 'Dealer',
      email: '',
      mobile: '',
      createdAt: '',
      updatedAt: '',
      profilePic: profile.profilePic,
    };
    return [self, ...subordinates];
  }, [canSelfAssign, isAreaManagerAssign, profile, subordinates]);

  const [assignPickerTask, setAssignPickerTask] = useState<any | null>(null);
  const [assigningTask, setAssigningTask] = useState(false);

  // No dedicated task-search endpoint — looks up the asset via
  // /api/assets/search, then cross-references against whichever tasks are
  // already loaded for the current tab (same approach the old Job Cards
  // controllers used).
  const search = useAssetTaskSearch(tasks);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // GET /me/team has no ?status=/pagination of its own (always returns the
  // AM's whole reporting tree in one shot) — fetched once and cached here,
  // then bucketed/paginated client-side on every tab/page change instead of
  // re-hitting the network each time. Cleared (see handleAssignTask) after
  // any action that could move a task between people, so the next fetch
  // reflects the real current tree instead of a stale cached one.
  const teamDataRef = useRef<any>(null);

  // `silent` skips the full-screen LoadingOverlay — used by pull-to-refresh,
  // which shows its own native RefreshControl spinner instead so the two
  // don't stack on top of each other (same pattern dashboardHomeController's
  // own onRefresh uses).
  const fetchPage = useCallback(async (tab: Tab, pageNum: number, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const statusKey = tab.toLowerCase() as 'active' | 'completed' | 'closed';

      if (isAreaManager) {
        if (!teamDataRef.current) {
          teamDataRef.current = await getMyTeamData(token);
        }
        const all = flattenTeamTasks(teamDataRef.current, 'service');
        const cnts = { active: 0, completed: 0, closed: 0 };
        all.forEach((t) => { cnts[bucketTaskStatus(t.status, 'service')] += 1; });
        const filtered = all.filter((t) => bucketTaskStatus(t.status, 'service') === statusKey);
        setCounts(cnts);
        setTotalCount(filtered.length);
        setTasks(filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE));
      } else {
        // Engineer's own path — the isAreaManager team-roster branch above
        // is a dealer/AM-only view, out of scope for the engineer-focused
        // offline work.
        const cacheKey = `service_tasks_${statusKey}_${pageNum}`;
        let data: any;
        try {
          data = await getMyTasksByStatus(token, statusKey, pageNum, PAGE_SIZE);
          await cacheData(cacheKey, data);
        } catch (fetchErr: any) {
          if (!isNetworkError(fetchErr)) throw fetchErr;
          const cached = await getCachedData(cacheKey);
          if (!cached) throw fetchErr;
          data = cached.data;
        }
        setTasks(data.service || []);
        setTotalCount(data.counts?.service?.[statusKey] || 0);
        setCounts({
          active: data.counts?.service?.active || 0,
          completed: data.counts?.service?.completed || 0,
          closed: data.counts?.service?.closed || 0,
        });
      }
    } catch (err: any) {
      console.log('[Service Tasks] Failed to load tasks:', err);
      const { message } = parseApiError(err, 'Failed to load tasks.');
      setError(message);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [isAreaManager]);

  useEffect(() => {
    // Wait for the profile to load first — otherwise this would fire once
    // against GET /me/tasks before we even know the caller is an area
    // manager, then immediately again against GET /me/team once isAreaManager
    // resolves, wasting a request.
    if (!profile) return;
    fetchPage(selectedTab, page);
  }, [fetchPage, selectedTab, page, profile]);

  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setProfile(JSON.parse(saved)); })
      .catch((error) => console.log('[Service Tasks] Failed to load profile:', error));
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // The AM branch's /me/team tree is cached in teamDataRef and only ever
    // refetched when something explicitly invalidates it (e.g. a reassign)
    // — a manual pull-to-refresh is exactly that kind of explicit ask for
    // current data, so it's dropped here too, not just re-served stale.
    teamDataRef.current = null;
    await fetchPage(selectedTab, page, { silent: true });
    setRefreshing(false);
  }, [fetchPage, selectedTab, page]);

  const selectTab = useCallback((tab: Tab) => {
    setSelectedTab(tab);
    setPage(1);
  }, []);

  const goToPrevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const goToTaskForm = useCallback((task: any) => {
    router.push({
      pathname: '/screens/srTaskForm',
      params: {
        taskId: task._id,
        assetId: task.asset?._id || '',
        gensetNumber: task.asset?.gensetNumber || '',
        engineNumber: task.asset?.engineNumber || '',
      },
    } as any);
  }, [router]);

  const goToTaskReport = useCallback((task: any) => {
    router.push({
      pathname: '/screens/srTaskReport',
      params: { task: JSON.stringify(task) },
    } as any);
  }, [router]);

  // Active-tab tasks whose work-approval request is still awaiting the RSM
  // — tapping the card (not an action button, there's nothing to do here
  // yet) opens a read-only status screen instead of Start/Continue.
  const goToSrDetail = useCallback((task: any) => {
    router.push({
      pathname: '/screens/srDetail',
      params: { task: JSON.stringify(task) },
    } as any);
  }, [router]);

  // Each engineer's tasks are individually assigned to them (not a shared
  // pool multiple engineers pick from), so there's no other engineer to
  // race against here; queuing Accept/Start offline is safe the same way
  // the form saves are.
  const handleAcceptTask = useCallback(async (taskId: string) => {
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: true }));
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      await putOrQueue(`/api/service/${taskId}/accept`, {}, `Accept task (${taskId})`, `service_accept_${taskId}`);
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: 'ACCEPTED' }));
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to accept task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setTaskActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  const handleStartTask = useCallback(async (taskId: string) => {
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: true }));
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      await putOrQueue(`/api/service/${taskId}/start`, {}, `Start task (${taskId})`, `service_start_${taskId}`);
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: 'IN_PROGRESS' }));
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to start task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setTaskActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  const openAssignPicker = useCallback((task: any) => {
    setAssignPickerTask(task);
  }, []);

  const closeAssignPicker = useCallback(() => {
    setAssignPickerTask(null);
  }, []);

  // Hands the task in `assignPickerTask` off to the chosen engineer — the
  // sheet stays open with a spinner on its own Assign button (assigningTask)
  // while the call is in flight, so a failure can be retried from the same
  // sheet instead of silently closing. Once reassigned, the task no longer
  // belongs to this dealer, so the page is just re-fetched rather than
  // optimistically patched in place.
  const handleAssignTask = useCallback(async (engineer: TeamMember) => {
    if (!assignPickerTask) return;
    const taskId = assignPickerTask._id;
    const assetId = assignPickerTask.asset?._id;
    setAssigningTask(true);
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      const token = await getToken();
      if (!token) return;
      await reassignServiceTask(token, assetId, engineer._id);
      setAssignPickerTask(null);
      // The cached /me/team tree is now stale (this task moved to someone
      // else) — drop it so the refresh below re-fetches for real.
      teamDataRef.current = null;
      await fetchPage(selectedTab, page);
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to assign task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setAssigningTask(false);
    }
  }, [assignPickerTask, fetchPage, selectedTab, page]);

  // A dealer working their own self-assigned task now fills the form the
  // same as an engineer would (canFillTaskForm gates the role-level default,
  // not a specific task the dealer assigned to themselves — see isMyOwnTask
  // in serviceTasks.tsx) — matches commissioningTasksController.ts's arrow
  // handler shape, just service actions/routes.
  //
  // COMPLETED means OTP sign-off is still pending (not actually done, per
  // the backend dev guide) — its arrow goes back into srTaskForm (which
  // auto-resumes at Step 5) rather than the read-only report, since there's
  // nothing to view yet until the customer signs off.
  const handleArrowPress = useCallback((task: any) => {
    const effectiveStatus = taskStatusOverrides[task._id] || task.status;
    if (effectiveStatus === 'ACCEPTED') return handleStartTask(task._id);
    if (effectiveStatus === 'IN_PROGRESS' || effectiveStatus === 'COMPLETED') return goToTaskForm(task);
    return goToTaskReport(task);
  }, [taskStatusOverrides, handleStartTask, goToTaskForm, goToTaskReport]);

  return {
    selectedTab, selectTab,
    page, totalPages,
    tasks, totalCount, counts, isLoading, error,
    refreshing, onRefresh,
    goToPrevPage, goToNextPage,
    taskStatusOverrides, taskActionLoading, taskActionError,
    handleAcceptTask, handleArrowPress, goToSrDetail, goToTaskReport,
    isDealer, isAreaManagerAssign, subordinateRole: permissions?.subordinateRole ?? null,
    canCreate: !!permissions?.canCreateServiceRequest,
    profile,
    engineers, engineersLoading,
    assignPickerTask, openAssignPicker, closeAssignPicker, handleAssignTask, assigningTask,
    searchText: search.searchText, setSearchText: search.setSearchText,
    handleSearch: search.handleSearch, handleClearSearch: search.handleClearSearch,
    searchResults: search.results, isSearching: search.isSearching,
    searchError: search.searchError, searched: search.searched,
  };
}
