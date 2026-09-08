import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getMyTasksByStatus, getMyTeamData, reassignServiceTask,
} from '../viewModel/commisionAPi';
import { parseApiError } from '../utils/apiError';
import { flattenTeamTasks, resolveTaskStatusGroup, formatAssetLabel, sortTasksForTab } from '../utils/reportFormatters';
import { getPermissions } from '../constants/permissions';
import { UserProfile } from '../models/Login';
import { TeamMember } from '../models/myTeam.types';
import { useAssetTaskSearch } from './useAssetTaskSearch';
import { useTeam } from '../context/TeamContext';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError, putOrQueue } from '../utils/syncEngine';
import { logLocationForAction, registerLocationOffWarning, checkLocationBlocked } from '../utils/locationLogger';
import { handleLocationOffWarning, showLocationOffAlert } from '../utils/locationOffAlert';
import { useToast } from '../utils/useToast';
import { deriveQueuedTaskStatusOverrides } from '../utils/offlineQueue';

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

  const { toastMessage, toastType, toastVisible, showToast } = useToast();
  // Shows once per screen visit, the first time Start (the one
  // location-needing action on this list) finds location services off —
  // see locationLogger.ts's own comment on registerLocationOffWarning.
  useEffect(() => {
    registerLocationOffWarning((reason) => handleLocationOffWarning(reason, showToast));
    return () => registerLocationOffWarning(null);
  }, [showToast]);

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
        // Same cache-on-success, fall-back-to-cache-on-network-failure
        // pattern as the engineer branch below — see
        // commissioningTasksController.ts's own fetchPage for the full
        // reasoning (this branch previously had no offline fallback at
        // all, so an area manager with a weak/no signal saw "No internet
        // connection" every single time useFocusEffect refired this fetch,
        // with no cached data shown). Shares the same 'team_data' cache
        // key as Commissioning's own fetchPage — both read the identical
        // /me/team response, so either screen's fresh fetch keeps the
        // other's fallback up to date too.
        if (!teamDataRef.current) {
          try {
            teamDataRef.current = await getMyTeamData(token);
            await cacheData('team_data', teamDataRef.current);
          } catch (fetchErr: any) {
            if (!isNetworkError(fetchErr)) throw fetchErr;
            const cached = await getCachedData('team_data');
            if (!cached) throw fetchErr;
            teamDataRef.current = cached.data;
          }
        }
        // Deduped by _id per mobile-service-list-api.md §4 — the same task
        // can legitimately appear more than once in the raw /me/team shape
        // (e.g. surfaced under both myTasks and a dealer's ownTasks), and
        // this previously counted/showed it twice.
        const seenIds = new Set<string>();
        const all = flattenTeamTasks(teamDataRef.current, 'service').filter((t) => {
          if (seenIds.has(t._id)) return false;
          seenIds.add(t._id);
          return true;
        });
        const cnts = { active: 0, completed: 0, closed: 0 };
        // resolveTaskStatusGroup prefers the server's own task.statusGroup
        // over this app's local bucketTaskStatus guess — per
        // mobile-service-list-api.md §5, this exact Service mapping
        // (whether COMPLETED counts as active or completed) has already
        // changed once on the backend, which is precisely the scenario a
        // hardcoded local guess can't keep up with on its own.
        all.forEach((t) => { cnts[resolveTaskStatusGroup(t, 'service')] += 1; });
        // Active: oldest-assigned first, newest last. Completed/Closed:
        // most-recently-finished first. Sorted before slicing so page
        // boundaries land on the right tasks, not just the right count.
        const filtered = sortTasksForTab(all.filter((t) => resolveTaskStatusGroup(t, 'service') === statusKey), statusKey);
        setCounts(cnts);
        setTotalCount(filtered.length);
        setTasks(filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE));
      } else {
        // Engineer/dealer's own path — same cache-fallback shape as the
        // area manager branch above, just keyed per status/page since this
        // one's server-paginated instead of one whole-tree fetch.
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
        // Same ordering rule as the area_manager branch above — this page
        // is already server-paginated, so this only orders what's actually
        // on it, not the full list across pages.
        const serviceTasks = sortTasksForTab(data.service || [], statusKey);
        setTasks(serviceTasks);
        setTotalCount(data.counts?.service?.[statusKey] || 0);
        setCounts({
          active: data.counts?.service?.active || 0,
          completed: data.counts?.service?.completed || 0,
          closed: data.counts?.service?.closed || 0,
        });

        // Reconstructs the accept/start status bump from the durable queue
        // (see deriveQueuedTaskStatusOverrides' own comment) — without this,
        // this screen would lose it on a bottom-nav remount the same way
        // the Dashboard did. __kind is tagged here only for this lookup —
        // putOrQueue's dedupeKeys for service tasks are prefixed "service_",
        // not the default "commissioning_" this helper otherwise assumes.
        const queuedOverrides = await deriveQueuedTaskStatusOverrides(
          serviceTasks.map((t: any) => ({ ...t, __kind: 'service' }))
        );
        if (Object.keys(queuedOverrides).length > 0) {
          setTaskStatusOverrides((prev) => ({ ...queuedOverrides, ...prev }));
        }
      }
    } catch (err: any) {
      console.log('[Service Tasks] Failed to load tasks:', err);
      const { message } = parseApiError(err, 'Failed to load tasks.');
      setError(message);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [isAreaManager]);

  // useFocusEffect (not a plain useEffect) — refires both on mount/tab/page
  // change AND every time this screen regains focus, e.g. coming back from
  // View Report after closing a ticket. Without this, the list only ever
  // fetched once and kept showing a task under Completed even after its
  // status had already moved to Closed server-side, since nothing told
  // this screen to look again. Same fix as commissioningTasksController.ts.
  useFocusEffect(
    useCallback(() => {
      // Wait for the profile to load first — otherwise this would fire once
      // against GET /me/tasks before we even know the caller is an area
      // manager, then immediately again against GET /me/team once isAreaManager
      // resolves, wasting a request.
      if (!profile) return;
      // The AM branch's /me/team tree is cached in teamDataRef — dropped
      // here too, not just in onRefresh, so regaining focus actually
      // re-fetches instead of re-bucketing the same stale tree (a no-op
      // for the engineer path below, which never populates this ref).
      teamDataRef.current = null;
      fetchPage(selectedTab, page);
    }, [fetchPage, selectedTab, page, profile])
  );

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
        // Already sitting right here in the task list's own data — instant
        // offline render for Step 5's locked-category card, same reasoning
        // as gensetNumber/engineNumber above.
        category: task.category || '',
        subCategory: task.subCategory || '',
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
      const task = tasks.find((t) => t._id === taskId);
      const assetLabel = formatAssetLabel(task?.asset?.gensetNumber, task?.asset?.engineNumber, taskId);
      await putOrQueue(`/api/service/${taskId}/accept`, {}, `Accept task (${assetLabel})`, `service_accept_${taskId}`);
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: 'ACCEPTED' }));
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to accept task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setTaskActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [tasks]);

  const handleStartTask = useCallback(async (taskId: string) => {
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: true }));
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      // Same hard gate as a photo upload (checkLocationBlocked's own
      // comment) — Start needs a real location, not just a best-effort one.
      // Checked before the API call is even made: if GPS/permission is
      // off, nothing is sent to the server at all, just the Turn On/Open
      // Settings alert. Only a weak/no GPS *fix* still lets Start through.
      const blockReason = await checkLocationBlocked();
      if (blockReason) {
        showLocationOffAlert(blockReason);
        return;
      }
      const task = tasks.find((t) => t._id === taskId);
      const assetLabel = formatAssetLabel(task?.asset?.gensetNumber, task?.asset?.engineNumber, taskId);
      // Location is captured only at Start, photo upload, and Complete —
      // see the same note in syncEngine.ts's own putOrQueue.
      logLocationForAction(`Start task (${assetLabel})`);
      await putOrQueue(`/api/service/${taskId}/start`, {}, `Start task (${assetLabel})`, `service_start_${taskId}`);
      setTaskStatusOverrides((prev) => ({ ...prev, [taskId]: 'IN_PROGRESS' }));
    } catch (err: any) {
      const { message } = parseApiError(err, 'Failed to start task. Please try again.');
      setTaskActionError((prev) => ({ ...prev, [taskId]: message }));
    } finally {
      setTaskActionLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [tasks]);

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
  // COMPLETED now goes to the read-only report (goToTaskReport), same as
  // commissioning — OTP sign-off and Close Service both moved there off
  // srTaskForm.tsx, so there's no longer anything left to do back in the
  // form once the entry is COMPLETED.
  const handleArrowPress = useCallback((task: any) => {
    const effectiveStatus = taskStatusOverrides[task._id] || task.status;
    if (effectiveStatus === 'ACCEPTED') return handleStartTask(task._id);
    if (effectiveStatus === 'IN_PROGRESS') return goToTaskForm(task);
    return goToTaskReport(task);
  }, [taskStatusOverrides, handleStartTask, goToTaskForm, goToTaskReport]);

  return {
    toastMessage, toastType, toastVisible,
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
