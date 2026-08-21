import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter } from 'expo-router';
import {
  searchAssets, getAssetById, createServiceEntry,
  getFreeServiceAvailability, searchCommissioningSap,
  getServiceCategoryConfig, acceptServiceTask,
} from '../viewModel/commisionAPi';
import { AssetDetail, GensetSapAsset } from '../models/commissioningRecords.types';
import { TeamMember } from '../models/myTeam.types';
import { UserProfile } from '../models/Login';
import { getPermissions } from '../constants/permissions';
import { parseApiError } from '../utils/apiError';
import { SERVICE_CATEGORY_META } from '../_components/srTaskForm/srDropdownOptions';
import { useTeam } from '../context/TeamContext';

// GET /api/service/category-config's per-category shape — `title` and
// `subCategories` are the real source of truth for the taxonomy (this is
// what caught category C's wrong local sub-list); colors/description/the
// Step-6-deferral flag aren't part of that response, so they're merged in
// from SERVICE_CATEGORY_META by letter.
export type ServiceCategory = {
  letter: string;
  title: string;
  subCategories: string[];
  bg: string; border: string; text: string; description: string;
  subCategoryAtStep6?: boolean;
};

const FALLBACK_META = { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', description: '' };

// GET /api/service/free-service-availability's per-window item — backend
// has already done the commissioning-date + window/grace-period math, so
// `canCreate` is the only field the UI needs to check for enabling a row.
export type FreeServiceItem = {
  no: number;
  label: string;
  status: string;
  canCreate: boolean;
  reason: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  graceEnd?: string | null;
  commissioningDate?: string | null;
};

// Matches the reference design's Date/Due Date fields (07/27/2026) — this
// is a DISPLAY string only. Every other date field this API returns
// elsewhere (task.date, task.dueDate, ...) is ISO, so the actual request
// body converts back to ISO rather than sending this literal string.
function formatTodayDDMMYYYY() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// POST /api/service wants `date`/`dueDate` as plain "YYYY-MM-DD" (no time
// component, per its documented request body) — not a full ISO timestamp.
function toDateOnly(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Due Date is free-typed as dd/mm/yyyy (no picker/mask yet) — parsed back
// to plain "YYYY-MM-DD" for the request body; returns null (silently
// omitted, rather than sending garbage) if it isn't a complete, valid date.
function parseDDMMYYYYToDateOnly(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Drives the "New Service Job" screen (reached from Services' + icon,
// dealer/areaManager only): search an asset by genset/engine S/N, show its
// detail, then a single "New Service Request" action opens a "Create Job
// Card" step — title, date, an assignee search+pick from the subordinate
// roster, optional due date/notes, then Create. Unlike Commissioning's
// New Job, there's no backend "available actions" concept for service
// (no PRE_COMMISSIONING/COMMISSIONING-style type enum), so the single
// action is always offered rather than fetched.
export function useNewServiceJobController() {
  const router = useRouter();

  const [searchText, setSearchText] = useState('');
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);

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
      .catch((error) => console.log('[New Service Job] Failed to load profile:', error));
  }, []);
  const isAreaManagerAssign = !!profile && getPermissions(profile.role).canFillTaskForm && !!getPermissions(profile.role).subordinateRole;
  const isDealer = !!profile && !getPermissions(profile.role).canFillTaskForm;

  // Both an area manager and a dealer can create an SR and just keep it
  // for themselves instead of delegating it further down — same
  // self-assign option already added to New Job's and the reassign flow's
  // own assign pickers.
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

  // The Category/Sub-category taxonomy — fetched once on mount, per the
  // screen's own documented call sequence, rather than hardcoded.
  const [categoryConfig, setCategoryConfig] = useState<ServiceCategory[]>([]);
  const [categoryConfigLoading, setCategoryConfigLoading] = useState(false);
  const [categoryConfigError, setCategoryConfigError] = useState('');

  // The New Service Request form's own fields — shown inline as soon as a
  // commissioned asset is found (no separate "tap an action" step anymore;
  // reset happens in handleSearch whenever a fresh asset match comes in).
  const [jobTitle, setJobTitle] = useState('');
  const [jobDate, setJobDate] = useState(formatTodayDDMMYYYY());
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [subCategory, setSubCategory] = useState('');
  // Only asked for Cooper AMC/CAMC (letters D/E) — those are the two
  // categories financed through a bank tie-up.
  const [financingBank, setFinancingBank] = useState('');
  const [freeServiceItems, setFreeServiceItems] = useState<FreeServiceItem[]>([]);
  const [freeServiceLoading, setFreeServiceLoading] = useState(false);
  const [freeServiceError, setFreeServiceError] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<TeamMember | null>(null);
  // Assign To opens this as its own bottom-sheet-style picker instead of an
  // inline search+list, matching newJob.tsx's precedent.
  const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    (async () => {
      setCategoryConfigLoading(true);
      setCategoryConfigError('');
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getServiceCategoryConfig(token);
        const list: ServiceCategory[] = Array.isArray(data?.categories)
          ? data.categories.map((c: { letter: string; title: string; subCategories: string[] }) => ({
              ...c,
              ...(SERVICE_CATEGORY_META[c.letter] || FALLBACK_META),
            }))
          : [];
        setCategoryConfig(list);
      } catch (error) {
        console.log('[New Service Job] Failed to load category config:', error);
        setCategoryConfigError('Failed to load categories.');
      } finally {
        setCategoryConfigLoading(false);
      }
    })();
  }, []);


  // No dedicated "get task info by S/N" endpoint — searches the asset by
  // genset/engine S/N (same /api/assets/search the task-list screens use),
  // takes the first match, then loads its full detail. Client contact info
  // specifically only exists on the full detail response, not the search
  // result.
  const handleSearch = useCallback(async () => {
    const query = searchText.trim();
    if (!query) return;

    setSearched(true);
    setIsSearching(true);
    setSearchError('');
    setAsset(null);
    setSapAsset(null);
    try {
      const token = await getToken();
      if (!token) return;

      const results = await searchAssets(token, query);
      if (Array.isArray(results) && results.length > 0) {
        const matchId = results[0]._id;
        setAssetLoading(true);
        const detail = await getAssetById(token, matchId);
        setAsset(detail);

        // Fresh form for this asset — no separate "tap an action" step
        // anymore, the form shows inline as soon as the asset is found (and
        // commissioned), so this is the one place left to reset it rather
        // than carrying over whatever was left from a previous search.
        setJobTitle('');
        setJobDate(formatTodayDDMMYYYY());
        setCategory(null);
        setSubCategory('');
        setFinancingBank('');
        setFreeServiceItems([]);
        setFreeServiceError('');
        setSelectedAssignee(null);
        setAssigneePickerVisible(false);
        setDueDate('');
        setNotes('');
        setPerformedBy('');
        setCreateError('');
        return;
      }

      // No Asset exists for this genset/engine S/N yet — check whether it
      // at least has a historical SAP dispatch/commissioning record before
      // reporting "not found".
      const sapResults = await searchCommissioningSap(token, query);
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
    setSapAsset(null);
  }, []);

  const openAssigneePicker = useCallback(() => setAssigneePickerVisible(true), []);
  const closeAssigneePicker = useCallback(() => setAssigneePickerVisible(false), []);

  const handleSelectAssignee = useCallback((member: TeamMember) => {
    setSelectedAssignee(member);
    setAssigneePickerVisible(false);
  }, []);

  // Picking a category resets sub-category — the sub-list belongs to
  // whichever category is selected, so a leftover pick from the previous
  // category would silently be wrong otherwise.
  const handleSelectCategory = useCallback((cat: ServiceCategory) => {
    setCategory(cat);
    setSubCategory('');
    if (cat.letter !== 'D' && cat.letter !== 'E') setFinancingBank('');
  }, []);

  const handleSelectSubCategory = useCallback((sub: string) => {
    setSubCategory(sub);
  }, []);

  // Free Service's 4 sub-categories aren't a static list — which ones are
  // actually due right now depends on this asset's commissioning date, so
  // the backend computes it fresh each time Free Service is selected.
  useEffect(() => {
    if (category?.title !== 'Free Service' || !asset?._id) return;
    (async () => {
      setFreeServiceLoading(true);
      setFreeServiceError('');
      try {
        const token = await getToken();
        if (!token) return;
        const items = await getFreeServiceAvailability(token, asset._id);
        setFreeServiceItems(Array.isArray(items) ? items : []);
      } catch (error: any) {
        const { message } = parseApiError(error, 'Failed to load free service availability.');
        setFreeServiceError(message);
      } finally {
        setFreeServiceLoading(false);
      }
    })();
  }, [category, asset?._id]);

  // Sub-category is only required up front for categories that don't defer
  // it to Step 6 — Warranty Repair/Out Of Warranty/AMC/CAMC skip it here.
  const needsSubCategoryNow = !!category && !category.subCategoryAtStep6;

  const handleCreateJob = useCallback(async () => {
    if (!asset || !jobTitle.trim() || !category || (needsSubCategoryNow && !subCategory) || !selectedAssignee) return;
    setCreating(true);
    setCreateError('');
    try {
      const token = await getToken();
      if (!token) return;
      const dueDateOnly = dueDate.trim() ? parseDDMMYYYYToDateOnly(dueDate) : null;
      const created = await createServiceEntry(token, {
        assetId: asset._id,
        title: jobTitle.trim(),
        date: toDateOnly(new Date()),
        assignedToId: selectedAssignee._id,
        // Backend's category-config uses the letter (A/B/C/D...), not the
        // display name — matches its documented request body exactly.
        category: category.letter,
        ...(subCategory ? { subCategory } : {}),
        ...(financingBank ? { bankName: financingBank } : {}),
        ...(dueDateOnly ? { dueDate: dueDateOnly } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(performedBy.trim() ? { performedBy: performedBy.trim() } : {}),
      });
      // A dealer assigning this job to themselves has already implicitly
      // "accepted" it — same reasoning as newJobController.ts's commissioning
      // equivalent. Best-effort: a failure here shouldn't block navigating
      // away from a job that was otherwise created successfully.
      if (isDealer && selectedAssignee._id === profile?.userId) {
        const createdId = created?._id || created?.service?._id || created?.data?._id;
        if (createdId) {
          try {
            await acceptServiceTask(token, createdId);
          } catch (acceptError) {
            console.log('[New Service Job] Self-assign auto-accept failed:', acceptError);
          }
        }
      }
      router.replace('/screens/serviceTasks' as any);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to create job. Please try again.');
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, [asset, jobTitle, category, needsSubCategoryNow, subCategory, selectedAssignee, dueDate, notes, performedBy, router, isDealer, profile]);

  return {
    searchText, setSearchText, handleSearch, handleClearSearch, searched, isSearching, searchError,
    asset, assetLoading, sapAsset,
    engineers, engineersLoading,
    jobTitle, setJobTitle,
    jobDate,
    category, handleSelectCategory,
    categoryConfig, categoryConfigLoading, categoryConfigError,
    subCategory, handleSelectSubCategory, needsSubCategoryNow,
    financingBank, setFinancingBank,
    freeServiceItems, freeServiceLoading, freeServiceError,
    selectedAssignee, handleSelectAssignee,
    assigneePickerVisible, openAssigneePicker, closeAssigneePicker,
    dueDate, setDueDate, notes, setNotes, performedBy, setPerformedBy,
    handleCreateJob, creating, createError,
  };
}
