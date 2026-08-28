import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getMyTasksByStatus, getMyTeamData, reassignCommissioningTask,
} from '../viewModel/commisionAPi';
import { formatTaskType, flattenTeamTasks, bucketTaskStatus, formatAssetLabel } from '../utils/reportFormatters';
import { parseApiError } from '../utils/apiError';
import { getPermissions } from '../constants/permissions';
import { UserProfile } from '../models/Login';
import { TeamMember } from '../models/myTeam.types';
import { useAssetTaskSearch } from './useAssetTaskSearch';
import { useTeam } from '../context/TeamContext';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError, putOrQueue } from '../utils/syncEngine';
import { deriveQueuedTaskStatusOverrides } from '../utils/offlineQueue';

const PAGE_SIZE = 10;

type Tab = 'Active' | 'Completed' | 'Closed';

// Drives the redesigned Commissioning task-list screen (reached from the
// Dashboard's Active Task card arrow). Same backend contract as
// commsJobCardsController.ts (same GET /api/me/tasks?status=... endpoint,
// same accept/start actions, same taskForm/taskReport navigation targets)
// but a different pagination interaction — this screen page-jumps (fetch
// replaces the visible page of 10) instead of commsJobCardsController.ts's
// infinite-scroll-append, so it's a separate controller rather than a
// modification of that one (jobCards.tsx's existing behavior stays intact).
export function useCommissioningTasksController() {
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
  // instead (see isMyOwnTask below, in the card-rendering loop). Area
  // managers CAN fill the form (canFillTaskForm: true) but also manage a subordinate role
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
  // instead of delegating it further down — matches the reference design's
  // own "(You)" entry at the top of the assign sheet, shown for both roles.
  // Prepended here rather than injected in the roster itself (TeamContext.
  // members), since that list is also the source of truth for other things
  // (e.g. subordinate counts) that shouldn't include the assigner themselves.
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

  const fetchPage = useCallback(async (tab: Tab, pageNum: number) => {
    setIsLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const statusKey = tab.toLowerCase() as 'active' | 'completed' | 'closed';

      if (isAreaManager) {
        if (!teamDataRef.current) {
          teamDataRef.current = await getMyTeamData(token);
        }
        const all = flattenTeamTasks(teamDataRef.current, 'commissioning');
        const cnts = { active: 0, completed: 0, closed: 0 };
        all.forEach((t) => { cnts[bucketTaskStatus(t.status)] += 1; });
        const filtered = all.filter((t) => bucketTaskStatus(t.status) === statusKey);
        setCounts(cnts);
        setTotalCount(filtered.length);
        setTasks(filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE));
      } else {
        // Engineer's own path (isAreaManager's own team-roster branch above
        // has no offline fallback — that's a dealer/AM-only view, out of
        // scope for the engineer-focused offline work).
        const cacheKey = `commissioning_tasks_${statusKey}_${pageNum}`;
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
        const commissioningTasks = data.commissioning || [];
        setTasks(commissioningTasks);
        setTotalCount(data.counts?.commissioning?.[statusKey] || 0);
        setCounts({
          active: data.counts?.commissioning?.active || 0,
          completed: data.counts?.commissioning?.completed || 0,
          closed: data.counts?.commissioning?.closed || 0,
        });

        // Reconstructs the accept/start status bump from the durable queue
        // (see deriveQueuedTaskStatusOverrides' own comment) — without this,
        // this screen would lose it on a bottom-nav remount the same way
        // the Dashboard did.
        const queuedOverrides = await deriveQueuedTaskStatusOverrides(commissioningTasks);
        if (Object.keys(queuedOverrides).length > 0) {
          setTaskStatusOverrides((prev) => ({ ...queuedOverrides, ...prev }));
        }
      }
    } catch (err: any) {
      console.log('[Commissioning Tasks] Failed to load tasks:', err);
      const { message } = parseApiError(err, 'Failed to load tasks.');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAreaManager]);

  // useFocusEffect (not a plain useEffect) — refires both on mount/tab/page
  // change AND every time this screen regains focus, e.g. coming back from
  // View Report after verifying a customer's OTP. Without this, the list
  // only ever fetched once and kept showing a task under Completed even
  // after its status had already moved to Closed server-side, since nothing
  // told this screen to look again.
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
      .catch((error) => console.log('[Commissioning Tasks] Failed to load profile:', error));
  }, []);

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
      pathname: '/screens/taskForm',
      params: {
        taskId: task._id,
        assetId: task.asset?._id,
        taskType: formatTaskType(task.type),
        assignedToName: task.assignedTo?.name || '',
        assignedToRole: task.assignedTo?.role || '',
        // Already sitting right here in the task list's own data — passed
        // through so the form can show them immediately (and offline,
        // before/without its own getAssetById call) instead of coming up
        // blank until a live fetch succeeds.
        gensetNumber: task.asset?.gensetNumber || '',
        engineNumber: task.asset?.engineNumber || '',
      },
    } as any);
  }, [router]);

  const goToTaskReport = useCallback((task: any) => {
    router.push({
      pathname: '/screens/taskReport',
      params: { task: JSON.stringify(task) },
    } as any);
  }, [router]);

  // Each engineer's tasks are individually assigned to them (not a shared
  // pool multiple engineers pick from — see AGENTS.md's role model), so
  // there's no other engineer to race against here; queuing Accept/Start
  // offline is safe the same way the form saves are.
  const handleAcceptTask = useCallback(async (taskId: string) => {
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: true }));
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      const task = tasks.find((t) => t._id === taskId);
      const assetLabel = formatAssetLabel(task?.asset?.gensetNumber, task?.asset?.engineNumber, taskId);
      await putOrQueue(`/api/commissioning/${taskId}/accept`, {}, `Accept task (${assetLabel})`, `commissioning_accept_${taskId}`);
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
      const task = tasks.find((t) => t._id === taskId);
      const assetLabel = formatAssetLabel(task?.asset?.gensetNumber, task?.asset?.engineNumber, taskId);
      await putOrQueue(`/api/commissioning/${taskId}/start`, {}, `Start task (${assetLabel})`, `commissioning_start_${taskId}`);
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
    const type = assignPickerTask.type;
    setAssigningTask(true);
    setTaskActionError((prev) => ({ ...prev, [taskId]: '' }));
    try {
      const token = await getToken();
      if (!token) return;
      await reassignCommissioningTask(token, assetId, type, engineer._id);
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

  // TaskPreviewCard's arrow button — Accept now lives on the separate thumb
  // button instead, so this only ever needs to handle ACCEPTED->start,
  // IN_PROGRESS->continue into the form, and COMPLETED/CLOSED->view report.
  const handleArrowPress = useCallback((task: any) => {
    const effectiveStatus = taskStatusOverrides[task._id] || task.status;
    if (effectiveStatus === 'ACCEPTED') return handleStartTask(task._id);
    if (effectiveStatus === 'IN_PROGRESS') return goToTaskForm(task);
    return goToTaskReport(task);
  }, [taskStatusOverrides, handleStartTask, goToTaskForm, goToTaskReport]);

  return {
    selectedTab, selectTab,
    page, totalPages,
    tasks, totalCount, counts, isLoading, error,
    goToPrevPage, goToNextPage,
    taskStatusOverrides, taskActionLoading, taskActionError,
    handleAcceptTask, handleArrowPress,
    isDealer, isAreaManagerAssign, subordinateRole: permissions?.subordinateRole ?? null,
    canCreate: !!permissions?.canCreateCommissioning,
    profile,
    engineers, engineersLoading,
    assignPickerTask, openAssignPicker, closeAssignPicker, handleAssignTask, assigningTask,
    searchText: search.searchText, setSearchText: search.setSearchText,
    handleSearch: search.handleSearch, handleClearSearch: search.handleClearSearch,
    searchResults: search.results, isSearching: search.isSearching,
    searchError: search.searchError, searched: search.searched,
  };
}
