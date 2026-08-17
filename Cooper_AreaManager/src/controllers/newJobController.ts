import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  searchAssets, getAssetById, getCommissioningAvailableActions, createCommissioningEntry,
  searchGensetSapAssets, acceptCommissioningTask, getCommissioningPrefillChecks, saveCommissioningProgress,
} from '../viewModel/commisionAPi';
import { AssetDetail, AvailableActionsResponse, GensetSapAsset } from '../models/commissioningRecords.types';
import { TeamMember } from '../models/myTeam.types';
import { UserProfile } from '../models/Login';
import { getPermissions } from '../constants/permissions';
import { parseApiError } from '../utils/apiError';
import { useTeam } from '../context/TeamContext';

// Matches the reference design's Date/Due Date fields (07/27/2026) — this
// is a DISPLAY string only. Every other date field this API returns
// elsewhere (task.date, task.dueDate, ...) is ISO, so the actual request
// body converts back to ISO rather than sending this literal string.
function formatTodayMMDDYYYY() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// COMMISSIONING inherits Pre-Commissioning's own checks; RE_COMMISSIONING
// inherits the prior Commissioning's. Every other action type has no
// earlier stage to carry forward from.
function prefillSourceType(actionType: string): string | null {
  if (actionType === 'COMMISSIONING') return 'PRE_COMMISSIONING';
  if (actionType === 'RE_COMMISSIONING') return 'COMMISSIONING';
  return null;
}

// Drives the "New Job" screen (reached from Commissioning's + icon, dealer/
// areaManager only): search an asset by genset/engine S/N, show its detail
// + whichever commissioning actions are currently available for it, then
// tapping an action opens a "Create Job Card" step — date, an assignee
// picked from the subordinate roster, optional notes, then Create.
export function useNewJobController() {
  const router = useRouter();
  // Set by createAssetCommission.tsx after a successful Confirm & Create —
  // rather than dropping the user onto the Commissioning list, it comes
  // back here with the just-created asset's own genset S/N so this screen
  // re-searches it immediately and lands on the normal "asset found, here
  // are its available Actions" view, same as if they'd typed it in fresh.
  const params = useLocalSearchParams<{ initialSearch?: string }>();

  const [searchText, setSearchText] = useState('');
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [availableActions, setAvailableActions] = useState<AvailableActionsResponse | null>(null);

  // Fallback path: only populated once /api/assets/search comes back empty
  // — a genset can have real SAP dispatch/commissioning history without an
  // Asset ever having been created for it in this app yet.
  const [sapAsset, setSapAsset] = useState<GensetSapAsset | null>(null);

  // Shared across every screen with an assign picker — fetched once at the
  // app root (TeamContext) instead of this controller re-fetching its own
  // copy of the same roster. AssignEngineerModal does its own internal name
  // search over this raw roster — no separate filtered/search state needed.
  const { members: subordinates, loading: engineersLoading } = useTeam();

  // Needed only to decide whether to prepend the "(You)" self-assign entry
  // below — this screen otherwise has no reason to know who's logged in.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setProfile(JSON.parse(saved)); })
      .catch((error) => console.log('[New Job] Failed to load profile:', error));
  }, []);
  const isAreaManagerAssign = !!profile && getPermissions(profile.role).canFillTaskForm && !!getPermissions(profile.role).subordinateRole;
  const isDealer = !!profile && !getPermissions(profile.role).canFillTaskForm;

  // Both an area manager and a dealer can create a job and just keep it
  // for themselves instead of delegating it further down. Matches the
  // reference design's own "(You)" entry at the top of the assign sheet,
  // shown for both roles, and the same self-assign option already added
  // to the reassign flow in commissioningTasksController.ts.
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

  // The "Create Job Card" step's own fields — only meaningful while
  // assignPickerActionType is set (i.e. an action was tapped).
  const [assignPickerActionType, setAssignPickerActionType] = useState<string | null>(null);
  const [jobDate, setJobDate] = useState(formatTodayMMDDYYYY());
  const [selectedAssignee, setSelectedAssignee] = useState<TeamMember | null>(null);
  // Assign To opens this as its own bottom-sheet-style picker instead of an
  // inline search+list, matching the reference design's compact form.
  const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [assigneeError, setAssigneeError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // The source entry's own checks (Pre-Commissioning for a Commissioning
  // action, Commissioning for a Re-Commissioning one) — fetched in the
  // background as soon as the Create Job Card opens, then written onto the
  // newly created entry in handleCreateJob. There's no backend auto-copy;
  // the client is responsible for both the fetch and the write.
  const [preCommEntry, setPreCommEntry] = useState<Record<string, string> | null>(null);

  // No dedicated "get task info by S/N" endpoint — searches the asset by
  // genset/engine S/N (same /api/assets/search the task-list screens use),
  // takes the first match, then loads its full detail + available actions
  // in parallel. Client contact info specifically only exists on the full
  // detail response, not the search result.
  // Accepts an explicit query so the auto-search-on-arrival effect below
  // can fire immediately with the just-navigated-in value, instead of
  // relying on searchText's state update landing before this runs (setState
  // isn't synchronous, so calling this right after setSearchText(...) in
  // the same effect would otherwise still see the old, empty searchText).
  const handleSearch = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? searchText).trim();
    if (!query) return;

    setSearched(true);
    setIsSearching(true);
    setSearchError('');
    setAsset(null);
    setAvailableActions(null);
    setSapAsset(null);
    try {
      const token = await getToken();
      if (!token) return;

      const results = await searchAssets(token, query);
      console.log('[New Job] Asset search results:', Array.isArray(results) ? results.map((r: any) => r._id) : results);
      if (Array.isArray(results) && results.length > 0) {
        const matchId = results[0]._id;
        console.log('[New Job] Using matched asset id:', matchId, '(of', results.length, 'result(s))');
        setAssetLoading(true);
        const [detail, actions] = await Promise.all([
          getAssetById(token, matchId),
          getCommissioningAvailableActions(token, matchId),
        ]);
        console.log('[New Job] Asset detail _id:', detail?._id, '| history length:', detail?.history?.length ?? 'undefined', '| history:', JSON.stringify(detail?.history));
        setAsset(detail);
        setAvailableActions(actions);
        return;
      }

      // No Asset exists for this genset/engine S/N yet — check whether it
      // at least has a historical SAP dispatch/commissioning record before
      // reporting "not found".
      const sapResults = await searchGensetSapAssets(token, query);
      if (Array.isArray(sapResults) && sapResults.length > 0) {
        setSapAsset(sapResults[0]);
      }
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to search. Please try again.');
      setSearchError(message);
    } finally {
      setIsSearching(false);
      setAssetLoading(false);
    }
  }, [searchText]);

  const handleClearSearch = useCallback(() => {
    setSearchText('');
    setSearched(false);
    setSearchError('');
    setAsset(null);
    setAvailableActions(null);
    setSapAsset(null);
  }, []);

  // Fires once, only when arriving with a pre-filled query from Confirm &
  // Create above — a plain screen visit (no param) never auto-searches.
  useEffect(() => {
    if (params.initialSearch) {
      setSearchText(params.initialSearch);
      handleSearch(params.initialSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.initialSearch]);

  // Resets the form fields fresh each time a (possibly different) action is
  // tapped, rather than carrying over whatever was left from a cancelled
  // attempt at a different action type.
  const openAssignPicker = useCallback((actionType: string) => {
    setAssignPickerActionType(actionType);
    setJobDate(formatTodayMMDDYYYY());
    setSelectedAssignee(null);
    setAssigneePickerVisible(false);
    setNotes('');
    setNotesError('');
    setAssigneeError('');
    setCreateError('');
    setPreCommEntry(null);

    // Background fetch, not awaited — a failure here just means no
    // pre-fill; it never blocks the Create Job Card from opening.
    const srcType = prefillSourceType(actionType);
    if (srcType && asset) {
      (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const result = await getCommissioningPrefillChecks(token, asset._id, srcType);
          setPreCommEntry(result?.commissioningChecks || null);
        } catch {
          setPreCommEntry(null);
        }
      })();
    }
  }, [asset]);

  const handleCancelAssign = useCallback(() => {
    setAssignPickerActionType(null);
  }, []);

  const openAssigneePicker = useCallback(() => setAssigneePickerVisible(true), []);
  const closeAssigneePicker = useCallback(() => setAssigneePickerVisible(false), []);

  const handleSelectAssignee = useCallback((member: TeamMember) => {
    setSelectedAssignee(member);
    setAssigneeError('');
    setAssigneePickerVisible(false);
  }, []);

  const handleCreateJob = useCallback(async () => {
    if (!asset || !assignPickerActionType) return;

    // Assign To and Notes are both required — matches the backend contract
    // (it rejects an empty notes body; an assignee is obviously mandatory
    // too), checked together so tapping Create with both empty shows both
    // inline errors at once instead of stopping at the first one.
    let hasError = false;
    if (!selectedAssignee) {
      setAssigneeError('Please select an assignee');
      hasError = true;
    } else {
      setAssigneeError('');
    }
    if (!notes.trim()) {
      setNotesError('Notes are required');
      hasError = true;
    } else {
      setNotesError('');
    }
    if (hasError || !selectedAssignee) return;

    setCreating(true);
    setCreateError('');
    try {
      const token = await getToken();
      if (!token) return;
      const created = await createCommissioningEntry(token, {
        assetId: asset._id,
        type: assignPickerActionType,
        date: new Date().toISOString(),
        assignedToId: selectedAssignee._id,
        notes: notes.trim(),
      });
      const createdId = created?._id || created?.commissioning?._id || created?.data?._id;

      // There's no backend auto-copy — the client fetched the source
      // entry's checks when the Create Job Card opened (see
      // openAssignPicker) and is responsible for writing them onto the
      // newly created entry itself. Best-effort: the entry was already
      // created successfully either way.
      if (createdId && preCommEntry && Object.values(preCommEntry).some((v) => !!v)) {
        try {
          await saveCommissioningProgress(token, createdId, preCommEntry);
        } catch (prefillError) {
          console.log('[New Job] Failed to write pre-fill checks:', prefillError);
        }
      }

      // A dealer assigning this job to themselves has already implicitly
      // "accepted" it — there's no one else who'd do that step for them,
      // unlike a task handed to an engineer. Skips straight past ASSIGNED
      // so they can go directly to Start instead of an extra, redundant
      // Accept tap on a task they just created for themselves. Best-effort:
      // a failure here shouldn't block navigating away from a job that was
      // otherwise created successfully — it just leaves the task sitting at
      // ASSIGNED, no different from the pre-self-assign behavior.
      if (isDealer && selectedAssignee._id === profile?.userId && createdId) {
        try {
          await acceptCommissioningTask(token, createdId);
        } catch (acceptError) {
          console.log('[New Job] Self-assign auto-accept failed:', acceptError);
        }
      }
      router.replace('/screens/commissioningTasks' as any);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to create job. Please try again.');
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, [asset, assignPickerActionType, selectedAssignee, notes, preCommEntry, router, isDealer, profile]);

  // An asset that's already been serviced shouldn't be commissioned again —
  // asset.history mixes commissioning-type entries (PRE_COMMISSIONING/
  // COMMISSIONING/REVALIDATION/RE_COMMISSIONING, no srNumber) with service
  // entries, which carry a real SR number — that's the only signal
  // currently available to tell the two apart, since there's no dedicated
  // "has this asset been serviced" endpoint. If this turns out not to
  // reliably flag serviced assets once tested against real data, this is
  // the check to revisit.
  const assetHasBeenServiced = !!asset?.history?.some((h: any) => !!h.srNumber);

  return {
    searchText, setSearchText, handleSearch, handleClearSearch, searched, isSearching, searchError,
    asset, assetLoading, availableActions, assetHasBeenServiced,
    sapAsset,
    engineers, engineersLoading,
    assignPickerActionType, openAssignPicker, handleCancelAssign,
    jobDate,
    selectedAssignee, handleSelectAssignee,
    assigneePickerVisible, openAssigneePicker, closeAssigneePicker,
    notes, setNotes, notesError, assigneeError,
    preCommEntry,
    handleCreateJob, creating, createError,
  };
}
