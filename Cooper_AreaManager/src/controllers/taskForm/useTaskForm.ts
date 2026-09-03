import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../utils/tokenStore';
import {
  getAssetById, getCommissioningProgress, getCommissioningTaskDetail, getCommissioningPrefillChecks,
} from '../../viewModel/commisionAPi';
import { ApiFaultCode, ApiPart, SelectedComplaintCode, SelectedPart } from '../../models/taskForm.types';
import {
  ENGINE_TYPE_OPTIONS, ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS, PHASE_OPTIONS,
  PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,
} from '../../_components/srTaskForm/srDropdownOptions';
import { useTaskFormApiData } from './useTaskFormApiData';
import { useTaskFormPhotos } from './useTaskFormPhotos';
import { useTaskFormOtp } from './useTaskFormOtp';
import { parseApiError } from '../../utils/apiError';
import { cacheData, getCachedData } from '../../utils/offlineCache';
import { putOrQueue, isNetworkError } from '../../utils/syncEngine';
import { getPendingBody } from '../../utils/offlineQueue';
import { getRole, Role } from '../../constants/permissions';
import { formatAssetLabel } from '../../utils/reportFormatters';

// The old steps 7 (Review) and 8 (Work Completion OTP) were folded into
// step 6 itself — the completion summary and OTP verification now render
// in place of step 6's photo-upload UI (see taskForm.tsx) instead of
// advancing the stepper, so there are only 6 real steps left.
export const TOTAL_STEPS = 6;

// ── Commissioning-checks (Group A/B/C/D/E) field definitions ──
// All Group A/B/C fields share one rule: a "<field>_comment" is only sent
// when the field's own value is "Not OK" and a comment was actually typed.
// A6 split into A6a/A6b/A6c (3 separate Earthing sub-checks) — each one
// does use the Not-OK-comment pattern too, same as every other row here.
const GROUP_A_FIELDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6a', 'A6b', 'A6c', 'A7', 'A8', 'A9', 'A10', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A11', 'A12', 'A13'];
const GROUP_A_COMMENT_FIELDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6a', 'A6b', 'A6c', 'A7', 'A8', 'A9', 'A10', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A11', 'A12', 'A13'];
const GROUP_B_FIELDS = ['B1', 'B2', 'B3', 'B4a', 'B4b', 'B4c', 'B4d', 'B5R', 'B5Y', 'B5B'];
const GROUP_B_COMMENT_FIELDS = ['B1', 'B2', 'B3', 'B4a', 'B4b', 'B4c', 'B4d'];
const GROUP_C_FIELDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18'];
const GROUP_C_COMMENT_FIELDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C14', 'C15', 'C16', 'C17'];
const LOAD_STAGE_PREFIXES = ['D0', 'D25', 'D50', 'D75', 'D100'];
const LOAD_STAGE_SUFFIXES = ['LR', 'LY', 'LB', 'VR', 'VY', 'VB', 'F', 'BV', 'REM'];
const GROUP_D_FIELDS = LOAD_STAGE_PREFIXES.flatMap(p => LOAD_STAGE_SUFFIXES.map(s => `${p}${s}`));
// Confirmed real backend key: commissioningChecks.runningHours (a string,
// same as every other check field in this object) — sent for both plain
// Commissioning and Revalidation task types alike.
const GROUP_E_FIELDS = ['runningHours'];
// Customer Handover (Step 5) — confirmed real backend keys, E1-E7. Doesn't
// collide with Running Hours' own runningHours key above (different literal
// strings), even though both live under the same "E" letter. Comment
// fields use a "c" suffix (E1c, not E1_comment) — a different convention
// from every other group's own "_comment" suffix, so this section keeps
// its own payload-building instead of reusing buildGroupPayload.
const GROUP_F_FIELDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'];

// ── Validation-checks (Revalidation task type) fields ──
// Unlike commissioning checks, each field has its own trigger value for
// when a comment is required (e.g. "Replaced", "Arrested", "Not OK"...).
const VALIDATION_FIELDS = [
  'A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4', 'D5', 'E1', 'E2', 'E3',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'G1', 'G2',
];
const VALIDATION_COMMENT_TRIGGERS: Record<string, string> = {
  A1: 'Replaced', A2: 'Dusty', A3: 'Replaced',
  B1: 'Arrested', B2: 'Not OK', B3: 'Not OK',
  C1: 'Replaced', C3: 'Corrected', C4: 'Replaced',
  D1: 'Replaced', D2: 'Arrested', D3: 'Replaced', D4: 'Not OK', D5: 'Replaced',
  E1: 'Not OK', E2: 'Replaced', E3: 'Replaced',
  F1: 'Replaced', F2: 'Not OK', F4: 'Not OK', F5: 'Replaced', F6: 'Not OK', F7: 'Replaced',
  G1: 'Not OK', G2: 'Not OK',
};

const READINGS_NUMERIC_FIELDS = [
  'acVoltageRY', 'acVoltageYB', 'acVoltageBR', 'acAmpR', 'acAmpY', 'acAmpB',
  'loadKwR', 'loadKwY', 'loadKwB', 'totalKwLoad', 'loadPercentage',
  'rpm', 'frequency', 'dcVoltage', 'oilPressure', 'coolantTemperature', 'defLevelPercentage',
];

// Main orchestration hook for the commissioning task form. Connects step
// navigation, asset/checklist/readings state, and the API/photo/OTP sub-hooks.
export function useTaskForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    taskId?: string;
    assetId?: string;
    taskType?: string;
    assignedToName?: string;
    assignedToRole?: string;
    gensetNumber?: string;
    engineNumber?: string;
  }>();
  const assetId = params.assetId || '';
  const taskId = params.taskId || '';
  const assignedToName = params.assignedToName || '';
  const assignedToRole = params.assignedToRole || '';

  const [currentStep, setCurrentStep] = useState(1);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  // Offline queueing (putOrQueue below) is scoped to engineer only — dealer/
  // area_manager can also reach this form (per permissions.ts), but a
  // network failure should surface to them immediately rather than silently
  // queue, per explicit product decision. Defaults to 'engineer' (offline
  // enabled) until the real role loads from AsyncStorage, since that read
  // resolves near-instantly from the cache written at login — same pattern
  // as taskReportController.ts's own role load.
  const [role, setRole] = useState<Role>('engineer');
  const isEngineer = role === 'engineer';
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setRole(getRole(JSON.parse(saved).role)); })
      .catch((error) => console.log('[Task Form] Failed to load role:', error));
  }, []);

  // Seeded from the task list's own nav params (see goToTaskForm in
  // commissioningTasksController.ts/dashboardHomeController.ts) — an
  // instant-render fallback so these two fields show immediately instead of
  // sitting blank until loadAssetData's own fetch (or its offline cache
  // fallback) resolves. loadAssetData still overwrites them the moment it
  // gets a real answer, same as every other field applyAssetData sets.
  // Declared up here (not down with the rest of Step 1's asset fields)
  // since apiData/photos/otp below all need them already available for
  // their own putOrQueue descriptions (see formatAssetLabel).
  const [gensetSrNumber, setGensetSrNumber] = useState(params.gensetNumber || '');
  const [engineNumber, setEngineNumber] = useState(params.engineNumber || '');

  const apiData = useTaskFormApiData({ taskId, showToast, isEngineer, gensetNumber: gensetSrNumber, engineNumber });
  const photos = useTaskFormPhotos({ taskId, isEngineer });
  const otp = useTaskFormOtp({ taskId, showToast, isEngineer, gensetNumber: gensetSrNumber, engineNumber });

  // Step 6's own optional freetext field, sent as suggestionComment in the
  // Complete Task call below — not part of any of the other step-save
  // endpoints, only ever submitted once, at completion.
  const [suggestionComment, setSuggestionComment] = useState('');

  // Full task detail (asset genset/engine numbers, assignment chain) for the
  // task-summary header — the route params only carry a few flat fields
  // (taskId/assetId/taskType/assignedToName/assignedToRole), not the asset
  // sub-object or reassignment history, so this fetches it once on mount
  // the same way taskReport.tsx already does.
  const [task, setTask] = useState<any>(null);
  const [taskLoading, setTaskLoading] = useState(true);
  useEffect(() => {
    if (!taskId) { setTaskLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const detail = await getCommissioningTaskDetail(token, taskId);
        if (!cancelled) {
          setTask(detail);
          // Shows whatever was already uploaded in an earlier session —
          // see hydrateSitePhotos's own comment in useTaskFormPhotos.ts.
          // detail.media replaces the old detail.photos (unified media[]
          // model, Sep 2026 backend migration).
          if (Array.isArray(detail?.media) && detail.media.length > 0) {
            photos.hydrateSitePhotos(detail.media);
          }
        }
      } catch (error) {
        console.log('[Task Form] Failed to load task summary:', error);
      } finally {
        if (!cancelled) setTaskLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId, photos.hydrateSitePhotos]);

  // Both lists load once, right when the form opens — not gated to their
  // own step (currentStep === 3/4) like before. Waiting for the user to
  // actually reach a step meant that, if they went offline before ever
  // opening it, that list had never been fetched (or cached) at all —
  // e.g. reaching Step 4 offline after only ever visiting Step 3 online
  // left the parts picker empty even though fault codes worked fine.
  // Loading both up front matches the SR form's own loadFaultCodesAndParts,
  // which never had this gap.
  useEffect(() => {
    apiData.loadFaultCodes();
    apiData.loadParts();
    // apiData's loaders are stable (useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Task type detection ──
  const taskTypeRaw = params.taskType || 'Re-Commissioning';
  const normalizedTaskType = taskTypeRaw.toLowerCase().replace(/[\s-]/g, '');
  const isRevalidation = normalizedTaskType === 'revalidation';
  const isPreCommissioning = normalizedTaskType === 'precommissioning';
  const isCommissioning = normalizedTaskType === 'commissioning';
  const isReCommissioning = normalizedTaskType === 'recommissioning';

  // Pre-Commissioning now goes through the exact same 6-step sequence as
  // Commissioning (Asset Info -> Checks -> Complaint Codes -> Parts ->
  // Readings -> Complete), including step 2's Group A/B/C checklist it used
  // to skip — so a Pre-Commissioning entry's checks/fault codes/parts are
  // captured the same way a Commissioning one's are, and can later be
  // carried over when Commissioning is created for the same asset.
  const stepSequence = useMemo(() => [1, 2, 3, 4, 5, 6], []);

  // ── Step 1 — asset fields ──
  const [gensetModel, setGensetModel] = useState('');
  // The raw, untouched asset fetch result — kept separately from the
  // individual editable fields below (gensetSrNumber etc., which the user
  // can change in Step 1) purely so TaskSummaryHeader's identity pill has
  // one single object to read (gensetNumber/engineNumber/gensetModel/
  // dispatchDate/...) instead of this hook having to thread a new override
  // prop through every caller each time the header wants to show one more
  // field of it.
  const [assetDetail, setAssetDetail] = useState<any>(null);
  const [engineModel, setEngineModel] = useState('');

  const [engineKw, setEngineKw] = useState('');
  const [engineType, setEngineType] = useState('');
  const [engineFamily, setEngineFamily] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [application, setApplication] = useState('');

  const [altMake, setAltMake] = useState('');
  const [altModel, setAltModel] = useState('');
  const [altSn, setAltSn] = useState('');
  const [atsSn, setAtsSn] = useState('');
  // Was a single "Battery S/N" field — now Battery Type plus two separate
  // serial numbers (a genset can have 2 batteries). Confirmed backend keys:
  // batteryType, battery1SerialNumber (batterySn — "Battery 1 S/N"),
  // battery2SerialNumber (battery2Sn).
  const [batteryType, setBatteryType] = useState('');
  const [batterySn, setBatterySn] = useState('');
  const [battery2Sn, setBattery2Sn] = useState('');
  const [kva, setKva] = useState('');
  const [phase, setPhase] = useState('');
  const [panelType, setPanelType] = useState('');
  const [panelSn, setPanelSn] = useState('');
  // Confirmed backend keys: controllerType, controllerSerialNumber (controllerSr).
  const [controllerType, setControllerType] = useState('');
  const [controllerSr, setControllerSr] = useState('');
  const [cpcbNorm, setCpcbNorm] = useState('');
  const [loadUnbalance, setLoadUnbalance] = useState<'Yes' | 'No' | null>(null);
  const [loadUnbalancePercentage, setLoadUnbalancePercentage] = useState('');
  const [loadUnbalanceComment, setLoadUnbalanceComment] = useState('');

  const [commissioningDate, setCommissioningDate] = useState('');

  // Shown on the OTP verification card ("OTP SENT TO ...") — same
  // primaryContactNumber field AssetLocationContact reads elsewhere,
  // captured here since this screen otherwise only pulls the individual
  // genset/engine fields out of the asset fetch below, not the whole thing.
  const [customerContactNumber, setCustomerContactNumber] = useState('');
  const [assetLoading, setAssetLoading] = useState(false);
  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
  const [sectionError, setSectionError] = useState<Record<string, string>>({});
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({});

  // Shared by both the live fetch below and its offline cache fallback —
  // same field population either way.
  const applyAssetData = useCallback((data: any) => {
    setAssetDetail(data);
    if (data.gensetModel) setGensetModel(data.gensetModel);
    if (data.gensetNumber) setGensetSrNumber(data.gensetNumber);
    if (data.engineModel) setEngineModel(data.engineModel);
    if (data.engineNumber) setEngineNumber(data.engineNumber);
    if (data.kw) setEngineKw(data.kw);
    if (data.engineType) setEngineType(data.engineType);
    if (data.engineFamily) setEngineFamily(data.engineFamily);
    if (data.fuelType) setFuelType(data.fuelType);
    if (data.applicationMaterial) setApplication(data.applicationMaterial);
    if (data.primaryContactNumber) setCustomerContactNumber(data.primaryContactNumber);

    if (data.alternatorMake) setAltMake(data.alternatorMake);
    if (data.alternatorModel) setAltModel(data.alternatorModel);
    if (data.alternatorSerialNumber) setAltSn(data.alternatorSerialNumber);
    if (data.atsSerialNumber) setAtsSn(data.atsSerialNumber);
    if (data.batteryType) setBatteryType(data.batteryType);
    if (data.battery1SerialNumber) setBatterySn(data.battery1SerialNumber);
    if (data.battery2SerialNumber) setBattery2Sn(data.battery2SerialNumber);
    if (data.kva) setKva(data.kva);
    if (data.phase) setPhase(data.phase);
    if (data.panelType) setPanelType(data.panelType);
    if (data.controlPanelSerialNumber) setPanelSn(data.controlPanelSerialNumber);
    if (data.controllerType) setControllerType(data.controllerType);
    if (data.controllerSerialNumber) setControllerSr(data.controllerSerialNumber);
    if (data.cpcb) setCpcbNorm(data.cpcb);
    // data.loadUnbalance is a plain boolean on the backend, defaulting to
    // false for a genset that's never actually had this asked — treating
    // "!== undefined" as "answered" pre-selected No on every asset that
    // simply hadn't been touched yet. Only trust it as a real answer when
    // there's actual corroborating data: true is unambiguous (Mongoose
    // booleans don't default to true), No is only inferred from an actual
    // saved comment. Otherwise leave it unselected.
    if (data.loadUnbalance === true) setLoadUnbalance('Yes');
    else if (data.loadUnbalanceComment) setLoadUnbalance('No');
    if (data.loadUnbalancePercentage !== undefined) setLoadUnbalancePercentage(String(data.loadUnbalancePercentage));
    if (data.loadUnbalanceComment) setLoadUnbalanceComment(data.loadUnbalanceComment);
  }, []);

  // A section saved while offline sits queued (not yet on the server) until
  // the next sync — overlaying its body on top of whatever this fetch
  // returns is what stops re-opening this screen before that sync runs
  // from reverting the field back to the stale pre-edit server value.
  // Never applied to what gets cached below — the cache stays the real
  // last-known-good server snapshot, only the in-memory form state gets
  // the local edit layered on top.
  const withPendingAssetEdits = useCallback(async (data: any) => {
    const [gensetPending, alternatorPending] = await Promise.all([
      getPendingBody(`asset_genset_${assetId}`),
      getPendingBody(`asset_alternator_${assetId}`),
    ]);
    return { ...data, ...gensetPending, ...alternatorPending };
  }, [assetId]);

  const loadAssetData = useCallback(async () => {
    setAssetLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getAssetById(token, assetId);
      await cacheData(`asset_${assetId}`, data);
      applyAssetData(await withPendingAssetEdits(data));
    } catch (error: any) {
      // No signal at the site — fall back to whatever this device last
      // loaded for this asset, so the engineer can keep filling the form
      // they were already on instead of hitting a dead end. A real
      // server error still just logs and leaves the form at its defaults.
      if (isNetworkError(error)) {
        const cached = await getCachedData(`asset_${assetId}`);
        if (cached) applyAssetData(await withPendingAssetEdits(cached.data));
      }
      console.log('Failed to load asset:', error);
    } finally {
      setAssetLoading(false);
    }
  }, [assetId, applyAssetData, withPendingAssetEdits]);

  useEffect(() => {
    if (assetId) loadAssetData();
  }, [assetId, loadAssetData]);

  const SECTION_LABELS: Record<string, string> = { genset: 'Genset Identification', alternator: 'Alternator & Panel Details' };

  // On a genuine network failure, putOrQueue saves this section's edit to
  // the on-device sync queue instead of throwing — treated as a success
  // here (the section still shows as saved) rather than an error, since
  // nothing was actually lost. The top-of-screen PendingSyncBanner is what
  // tells the engineer it's not on the server yet.
  const saveAssetSection = useCallback(async (section: string, body: Record<string, any>) => {
    setSectionSaving(prev => ({ ...prev, [section]: true }));
    setSectionError(prev => ({ ...prev, [section]: '' }));
    setSectionSuccess(prev => ({ ...prev, [section]: false }));
    try {
      if (!assetId) return;
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, assetId);
      await putOrQueue(`/api/assets/${assetId}`, body, `${SECTION_LABELS[section] || section} (${assetLabel})`, `asset_${section}_${assetId}`, isEngineer);
      setSectionSuccess(prev => ({ ...prev, [section]: true }));
    } catch (error: any) {
      setSectionError(prev => ({
        ...prev,
        [section]: parseApiError(error, 'Failed to save. Please try again.').message,
      }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [section]: false }));
    }
  }, [assetId, isEngineer, gensetSrNumber, engineNumber]);

  const handleSaveGensetIdentification = useCallback(() => saveAssetSection('genset', {
    gensetModel, gensetNumber: gensetSrNumber, engineModel, engineNumber,
    kw: engineKw, engineType, engineFamily, fuelType, applicationMaterial: application, cpcb: cpcbNorm,
    atsSerialNumber: atsSn,
  }), [saveAssetSection, gensetModel, gensetSrNumber, engineModel, engineNumber, engineKw, engineType, engineFamily, fuelType, application, cpcbNorm, atsSn]);

  // loadUnbalance/loadUnbalancePercentage/loadUnbalanceComment used to be
  // sent here as part of the Asset record — confirmed real destination is
  // actually commissioningChecks.B_loadUnbalance/B_loadUnbalancePercentage
  // instead (Group B, as strings — "Yes"/"75", same convention every other
  // check field already uses), sent via handleSaveGroupB below. Not
  // included in this payload anymore; see handleSaveLoadAndPhaseCheck,
  // which every place that saves this shared Yes/No + percentage value
  // (both this card's own Save button and Step 2's "Load & Phase Check")
  // now goes through instead of calling this function alone.
  const handleSaveAlternatorPanel = useCallback(() => saveAssetSection('alternator', {
    alternatorMake: altMake, alternatorModel: altModel, alternatorSerialNumber: altSn,
    batteryType, battery1SerialNumber: batterySn, battery2SerialNumber: battery2Sn,
    kva, phase, panelType,
    controlPanelSerialNumber: panelSn,
    controllerType, controllerSerialNumber: controllerSr,
  }), [saveAssetSection, altMake, altModel, altSn, batteryType, batterySn, battery2Sn, kva, phase, panelType, panelSn, controllerType, controllerSr]);

  // cpcbNorm and atsSn moved here from Alternator & Panel — both fields now
  // live on the Genset Identification card, so their "missing" count and
  // save payload moved with them.
  const gensetMissingCount = [gensetModel, engineModel, engineFamily, fuelType, application, cpcbNorm, atsSn].filter(v => !v).length;
  const altMissingCount = [
    altMake, altModel, altSn, batteryType, batterySn, battery2Sn, kva, phase, panelType, panelSn,
    controllerType, controllerSr, loadUnbalance,
  ].filter(v => !v).length;

  // ── Step 2 — commissioning checks (Group A/B/C/D/E) ──
  const [checksLoading, setChecksLoading] = useState(false);
  const [commissioningChecks, setCommissioningChecks] = useState<Record<string, string>>({});
  const updateCommissioningCheck = useCallback((key: string, value: string) => {
    setCommissioningChecks(prev => ({ ...prev, [key]: value }));
  }, []);

  // Fallback for a Commissioning/Re-Commissioning task that reached Step 2
  // with no checks of its own and wasn't pre-filled at creation (an older
  // task from before that existed, or the write-after-create step failed) —
  // fetched silently so the "load as starting point" card only shows once
  // there's real data behind it, applied on demand via handleLoadPrefillChecks
  // rather than overwriting the form automatically.
  const [prefillChecks, setPrefillChecks] = useState<Record<string, string> | null>(null);
  const handleLoadPrefillChecks = useCallback(() => {
    setCommissioningChecks(prev => ({ ...prefillChecks, ...prev }));
    setPrefillChecks(null);
  }, [prefillChecks]);

  // ── Step 2 — validation checks (Revalidation task type only) ──
  const [validationChecks, setValidationChecks] = useState<Record<string, string>>({});
  const updateValidationCheck = useCallback((key: string, value: string) => {
    setValidationChecks(prev => ({ ...prev, [key]: value }));
  }, []);

  // Each check group (A-E) queues under its own dedupeKey while offline —
  // same "don't let a fresh-but-stale GET revert an unsynced edit" problem
  // as the asset sections above, layered group by group since the backend
  // returns every group's fields merged into one flat commissioningChecks
  // object.
  const CHECK_GROUP_KEYS = ['groupA', 'groupB', 'groupC', 'groupD', 'groupE', 'groupF'];

  const loadCommissioningChecks = useCallback(async () => {
    if (!taskId) return;
    setChecksLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      // New Job's own create flow already writes a completed
      // Pre-Commissioning entry's checks onto a fresh Commissioning task at
      // creation time (see newJobController.ts's handleCreateJob) — no
      // client-side lookup/merge needed here just to display them.
      const data = await getCommissioningProgress(token, taskId);
      let checks = data.commissioningChecks || {};

      const pendingGroups = await Promise.all(
        CHECK_GROUP_KEYS.map(group => getPendingBody(`checks_${group}_${taskId}`))
      );
      pendingGroups.forEach(pending => {
        if (pending?.commissioningChecks) checks = { ...checks, ...pending.commissioningChecks };
      });
      setCommissioningChecks(checks);

      // Confirmed real key: commissioningChecks.B_loadUnbalance (Group B,
      // alongside B1-B5B) — takes precedence over whatever the Asset
      // record's own loadUnbalance was hydrated to (see loadAssetDetail),
      // since that's no longer where handleSaveGroupB/
      // handleSaveLoadAndPhaseCheck actually save it.
      if (checks.B_loadUnbalance !== undefined) {
        setLoadUnbalance(checks.B_loadUnbalance === 'Yes' ? 'Yes' : 'No');
        setLoadUnbalancePercentage(checks.B_loadUnbalancePercentage ?? '');
      }

      // Always check (silently) whether the source entry has checks worth
      // offering as a "load as starting point" card — shown regardless of
      // whether this task already has its own checks, so it also works as
      // a reset-to-source option, not just a one-time-empty fallback. Only
      // relevant for Commissioning (source: Pre-Commissioning) and
      // Re-Commissioning (source: Commissioning); every other type has no
      // earlier stage to pull from.
      if ((isCommissioning || isReCommissioning) && assetId) {
        const srcType = isCommissioning ? 'PRE_COMMISSIONING' : 'COMMISSIONING';
        try {
          const prefillData = await getCommissioningPrefillChecks(token, assetId, srcType);
          const fetched = prefillData?.commissioningChecks;
          if (fetched && Object.values(fetched).some((v) => !!v)) setPrefillChecks(fetched);
        } catch (prefillError) {
          console.log('Failed to check for prefill checks:', prefillError);
        }
      }
    } catch (error) {
      console.log('Failed to load commissioning checks:', error);
    } finally {
      setChecksLoading(false);
    }
  }, [taskId, isCommissioning, isReCommissioning, assetId]);

  const loadValidationChecks = useCallback(async () => {
    if (!taskId) return;
    setChecksLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCommissioningProgress(token, taskId);
      const raw = data.validationChecks || {};
      // This app always saves/reads validationChecks flat — {A1: 'Ok',
      // A1_comment: '...'} — but the field is a free-form Mixed blob, and
      // the web app's OWN per-item shape is a small object instead —
      // validationChecks[id] = { value, comment } (see mobile-
      // revalidation-and-service-changes.md §1.1's own
      // "validationChecks[item.id].comment" reference). A task last
      // touched from the website can have that nested shape sitting in
      // the same field this reads, which crashed the checklist screen
      // entirely before (see FormToggleRows.tsx's own fix) and — even
      // once that crash was fixed — still just showed as unanswered,
      // since a { value, comment } object never matched a plain-string
      // toggle option. Normalizing each key independently here means a
      // task can have some items answered via the website (nested) and
      // others via this app (flat) and both still display correctly.
      let checks: Record<string, string> = {};
      Object.entries(raw).forEach(([key, val]: [string, any]) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          if (val.value !== undefined && val.value !== null) checks[key] = String(val.value);
          if (val.comment !== undefined && val.comment !== null) checks[`${key}_comment`] = String(val.comment);
        } else if (val !== undefined && val !== null) {
          checks[key] = String(val);
        }
      });
      const pending = await getPendingBody(`validation_${taskId}`);
      if (pending?.validationChecks) checks = { ...checks, ...pending.validationChecks };
      setValidationChecks(checks);
    } catch (error) {
      console.log('Failed to load validation checks:', error);
    } finally {
      setChecksLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (currentStep === 2 && taskId) {
      if (isRevalidation) {
        loadValidationChecks();
        // Running Hours lives under commissioningChecks.runningHours even
        // for a Revalidation task (same backend key as plain Commissioning,
        // just shown on Step 5 instead of Step 2 — see runningHoursCard's
        // own comment in taskForm.tsx) — without this, commissioningChecks
        // never gets fetched at all for this task type, so a previously
        // saved Running Hours value would never show up again on reload.
        loadCommissioningChecks();
      } else {
        loadCommissioningChecks();
      }
    }
  }, [currentStep, taskId, isRevalidation, loadCommissioningChecks, loadValidationChecks]);

  const buildGroupPayload = (fields: string[], commentFields: string[]) => {
    const payload: Record<string, string> = {};
    fields.forEach(key => {
      if (commissioningChecks[key]) payload[key] = commissioningChecks[key];
    });
    commentFields.forEach(key => {
      const comment = commissioningChecks[`${key}_comment`];
      if (commissioningChecks[key]?.toLowerCase() === 'not ok' && comment) {
        payload[`${key}_comment`] = comment;
      }
    });
    return payload;
  };

  const saveGroupChecks = useCallback(async (groupKey: string, payload: Record<string, string>) => {
    setSectionSaving(prev => ({ ...prev, [groupKey]: true }));
    setSectionError(prev => ({ ...prev, [groupKey]: '' }));
    try {
      if (!taskId) {
        console.log(`[Commissioning] saveGroupChecks(${groupKey}) aborted — no taskId yet`);
        return;
      }
      console.log(`[Commissioning] saveGroupChecks(${groupKey}) sending:`, JSON.stringify({ commissioningChecks: payload }));
      // Same shape saveCommissioningProgress sends — replicated directly
      // here (instead of calling that function) so a network failure can
      // fall through to putOrQueue's own queueing instead of throwing.
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/progress`,
        { commissioningChecks: payload },
        `Checks — ${groupKey} (${assetLabel})`,
        `checks_${groupKey}_${taskId}`,
        isEngineer
      );
      console.log(`[Commissioning] saveGroupChecks(${groupKey}) result — queued:`, queued);
      showToast(queued ? 'Saved on this device — will sync later' : 'Saved successfully!', 'success');
      setSectionSuccess(prev => ({ ...prev, [groupKey]: true }));
    } catch (error: any) {
      console.log(`[Commissioning] saveGroupChecks(${groupKey}) FAILED:`, error?.message || error);
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      showToast(msg, 'error');
      setSectionError(prev => ({ ...prev, [groupKey]: msg }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [groupKey]: false }));
    }
  }, [taskId, showToast, isEngineer, gensetSrNumber, engineNumber]);

  const handleSaveGroupA = useCallback(
    () => saveGroupChecks('groupA', buildGroupPayload(GROUP_A_FIELDS, GROUP_A_COMMENT_FIELDS)),
    [saveGroupChecks, commissioningChecks]
  );
  // Confirmed real keys: commissioningChecks.B_loadUnbalance /
  // B_loadUnbalancePercentage — strings ("Yes"/"75"), same convention
  // every other check field already uses, part of Group B alongside
  // B1-B5B rather than a separate boolean/number on the Asset record.
  const handleSaveGroupB = useCallback(() => {
    const payload = buildGroupPayload(GROUP_B_FIELDS, GROUP_B_COMMENT_FIELDS);
    if (loadUnbalance) payload.B_loadUnbalance = loadUnbalance;
    if (loadUnbalance === 'Yes' && loadUnbalancePercentage) payload.B_loadUnbalancePercentage = loadUnbalancePercentage;
    return saveGroupChecks('groupB', payload);
  }, [saveGroupChecks, commissioningChecks, loadUnbalance, loadUnbalancePercentage]);
  // The "Load & Phase Check" card's single Save button — it shows Load
  // Unbalance (now part of Group B's own payload, see handleSaveGroupB
  // above) and Phase Difference Genset A (also Group B) together. Also
  // reused by Step 1's own "Alternator & Panel" Save button, since both
  // cards edit the same shared loadUnbalance/loadUnbalancePercentage
  // value and both need it to actually reach the server. Each half still
  // tracks its own saving/success/error under its own key
  // ('alternator'/'groupB') — this just runs them together; the
  // Alternator & Panel and Group B cards elsewhere keep showing the same
  // saved state either save updates.
  const handleSaveLoadAndPhaseCheck = useCallback(
    () => Promise.all([handleSaveAlternatorPanel(), handleSaveGroupB()]),
    [handleSaveAlternatorPanel, handleSaveGroupB]
  );
  const handleSaveGroupC = useCallback(
    () => saveGroupChecks('groupC', buildGroupPayload(GROUP_C_FIELDS, GROUP_C_COMMENT_FIELDS)),
    [saveGroupChecks, commissioningChecks]
  );
  const handleSaveGroupD = useCallback(() => {
    const payload: Record<string, string> = {};
    GROUP_D_FIELDS.forEach(key => { if (commissioningChecks[key]) payload[key] = commissioningChecks[key]; });
    return saveGroupChecks('groupD', payload);
  }, [saveGroupChecks, commissioningChecks]);
  // Running Hours — for Revalidation, confirmed real contract (mobile-
  // revalidation-and-service-changes.md §1.6-1.7) is a plain top-level
  // `runningHours` field via PUT /api/commissioning/:id/readings, NOT
  // nested under commissioningChecks via /progress (the shape below,
  // which stays exactly as-is for plain Commissioning/Re-Commissioning/
  // Pre-Commissioning — those keep using GROUP_E_FIELDS/saveGroupChecks
  // unchanged). Both branches share the same 'groupE' sectionSaving/
  // sectionSuccess/sectionError keys, so runningHoursCard's existing
  // Save-button/GroupHeader indicator keeps working for either path
  // without taskForm.tsx needing any JSX change.
  const handleSaveGroupE = useCallback(async () => {
    if (isRevalidation) {
      setSectionSaving(prev => ({ ...prev, groupE: true }));
      setSectionError(prev => ({ ...prev, groupE: '' }));
      setSectionSuccess(prev => ({ ...prev, groupE: false }));
      try {
        if (!taskId) return;
        const value = commissioningChecks.runningHours;
        const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
        const { queued } = await putOrQueue(
          `/api/commissioning/${taskId}/readings`,
          { runningHours: value ? Number(value) : null },
          `Running Hours (${assetLabel})`,
          `reval_runningHours_${taskId}`,
          isEngineer
        );
        setSectionSuccess(prev => ({ ...prev, groupE: true }));
        showToast(queued ? 'Saved on this device — will sync later' : 'Saved successfully!', 'success');
      } catch (error: any) {
        const msg = parseApiError(error, 'Failed to save. Please try again.').message;
        setSectionError(prev => ({ ...prev, groupE: msg }));
        showToast(msg, 'error');
      } finally {
        setSectionSaving(prev => ({ ...prev, groupE: false }));
      }
      return;
    }
    const payload: Record<string, string> = {};
    GROUP_E_FIELDS.forEach(key => { if (commissioningChecks[key]) payload[key] = commissioningChecks[key]; });
    return saveGroupChecks('groupE', payload);
  }, [saveGroupChecks, commissioningChecks, isRevalidation, taskId, gensetSrNumber, engineNumber, isEngineer, showToast]);
  const handleSaveCustomerHandover = useCallback(() => {
    const payload: Record<string, string> = {};
    GROUP_F_FIELDS.forEach(key => {
      if (commissioningChecks[key]) payload[key] = commissioningChecks[key];
      // "c" suffix, not "_comment" — this section's own confirmed
      // convention, only sent once the row's actually marked "No".
      const comment = commissioningChecks[`${key}c`];
      if (commissioningChecks[key] === 'No' && comment) payload[`${key}c`] = comment;
    });
    return saveGroupChecks('groupF', payload);
  }, [saveGroupChecks, commissioningChecks]);

  const handleSaveValidationChecks = useCallback(async () => {
    const section = 'validationChecks';
    setSectionSaving(prev => ({ ...prev, [section]: true }));
    setSectionError(prev => ({ ...prev, [section]: '' }));
    setSectionSuccess(prev => ({ ...prev, [section]: false }));
    try {
      if (!taskId) return;

      const payload: Record<string, string> = {};
      VALIDATION_FIELDS.forEach(key => { if (validationChecks[key]) payload[key] = validationChecks[key]; });
      Object.entries(VALIDATION_COMMENT_TRIGGERS).forEach(([key, trigger]) => {
        const comment = validationChecks[`${key}_comment`];
        if (validationChecks[key] === trigger && comment) payload[`${key}_comment`] = comment;
      });

      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/progress`,
        { validationChecks: payload },
        `Validation Checks (${assetLabel})`,
        `validation_${taskId}`,
        isEngineer
      );
      showToast(queued ? 'Saved on this device — will sync later' : 'Validation checks saved!', 'success');
      setSectionSuccess(prev => ({ ...prev, [section]: true }));
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      showToast(msg, 'error');
      setSectionError(prev => ({ ...prev, [section]: msg }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [section]: false }));
    }
  }, [taskId, validationChecks, showToast, isEngineer, gensetSrNumber, engineNumber]);

  // ── Step 3 — complaint codes ──
  const [selectedComplaintCodes, setSelectedComplaintCodes] = useState<SelectedComplaintCode[]>([]);
  const [complaintPickerVisible, setComplaintPickerVisible] = useState(false);
  let complaintCodeSeq = 0;

  const handleOpenComplaintPicker = useCallback(() => setComplaintPickerVisible(true), []);
  const handleCloseComplaintPicker = useCallback(() => setComplaintPickerVisible(false), []);

  const handleSelectComplaintCode = useCallback((faultCode: ApiFaultCode) => {
    complaintCodeSeq += 1;
    const newEntry: SelectedComplaintCode = {
      uid: `cc_${Date.now()}_${complaintCodeSeq}`,
      codeId: faultCode._id,
      categoryName: faultCode.category,
      subcategoryName: faultCode.subCategory,
      code: faultCode.code,
      priority: faultCode.priority,
      title: faultCode.description,
      observation: '',
      rootCause: '',
      correctiveAction: '',
      isNew: true,
    };
    setSelectedComplaintCodes(prev => [...prev, newEntry]);
    setComplaintPickerVisible(false);
  }, []);

  const handleRemoveComplaintCode = useCallback((uid: string) => {
    setSelectedComplaintCodes(prev => prev.filter(item => item.uid !== uid));
  }, []);

  const handleChangeComplaintObservation = useCallback((uid: string, text: string) => {
    setSelectedComplaintCodes(prev => prev.map(item => (item.uid === uid ? { ...item, observation: text } : item)));
  }, []);

  const handleChangeComplaintRootCause = useCallback((uid: string, text: string) => {
    setSelectedComplaintCodes(prev => prev.map(item => (item.uid === uid ? { ...item, rootCause: text } : item)));
  }, []);

  const handleChangeComplaintCorrectiveAction = useCallback((uid: string, text: string) => {
    setSelectedComplaintCodes(prev => prev.map(item => (item.uid === uid ? { ...item, correctiveAction: text } : item)));
  }, []);

  // Clears isNew on every code once the save actually succeeds — without
  // this, a freshly-added code's isNew stays stuck true forever (nothing
  // else ever resets it), so ComplaintCodeCard's own
  // useState(!!item.isNew) re-opens it editable every time this step
  // remounts (e.g. leaving for a later step and coming back), even though
  // it was already saved and should show its read-only summary until the
  // pencil is tapped.
  const handleSaveFaultCodes = useCallback(async () => {
    const success = await apiData.saveFaultCodes(selectedComplaintCodes);
    if (success) {
      setSelectedComplaintCodes(prev => prev.map(item => (item.isNew ? { ...item, isNew: false } : item)));
    }
  }, [apiData, selectedComplaintCodes]);

  // ── Step 4 — parts used ──
  const [partPickerVisible, setPartPickerVisible] = useState(false);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);

  // Adding a part, changing its quantity, or removing it all persist right
  // away — no separate per-card save button. savePartsUsed always sends
  // the whole list (there's no single-item endpoint), so it just runs
  // again on every change with whatever the list looks like at that point.
  //
  // Debounced, not called straight from each handler — tapping +/- fast
  // (e.g. bumping a quantity from 1 to 5) used to fire a full save on every
  // single tap, each an independent in-flight request carrying whatever
  // quantity existed at that instant. With several of those racing the
  // network at once, they can land out of order or have one fail under
  // concurrent load — showing a real error toast even though the visible
  // quantity (state updates instantly, unaffected by the debounce) was
  // already correct. Waiting for a short pause after the last change and
  // sending one request with the final list fixes both: no more racing
  // requests, and far fewer network calls overall.
  const savePartsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSaveParts = useCallback((parts: SelectedPart[]) => {
    if (savePartsDebounceRef.current) clearTimeout(savePartsDebounceRef.current);
    savePartsDebounceRef.current = setTimeout(() => {
      savePartsDebounceRef.current = null;
      apiData.savePartsUsed(parts);
    }, 600);
  }, [apiData]);
  useEffect(() => () => {
    if (savePartsDebounceRef.current) clearTimeout(savePartsDebounceRef.current);
  }, []);

  const handleSelectPart = useCallback((part: ApiPart) => {
    setSelectedParts(prev => {
      const existing = prev.find(p => p.partId === part._id);
      const next = existing
        // Capped at maxQty (if set) — same soft client-side guardrail as
        // the +/- stepper below, so re-picking an already-added part can't
        // silently bypass the cap.
        ? prev.map(p => (p.partId === part._id
            ? { ...p, quantity: p.maxQty ? Math.min(p.quantity + 1, p.maxQty) : p.quantity + 1 }
            : p))
        : [...prev, {
            partId: part._id, componentNumber: part.componentNumber, description: part.description,
            engineFamily: part.engineFamily, cpcbNorm: part.cpcbNorm, maxQty: part.maxQty, quantity: 1,
          }];
      debouncedSaveParts(next);
      return next;
    });
  }, [debouncedSaveParts]);

  const handleIncreaseQty = useCallback((partId: string) => {
    setSelectedParts(prev => {
      // maxQty is a soft cap, not enforced server-side — see
      // SelectedPartCard's own comment for the full reasoning.
      const next = prev.map(p => (p.partId === partId
        ? { ...p, quantity: p.maxQty ? Math.min(p.quantity + 1, p.maxQty) : p.quantity + 1 }
        : p));
      debouncedSaveParts(next);
      return next;
    });
  }, [debouncedSaveParts]);

  const handleDecreaseQty = useCallback((partId: string) => {
    setSelectedParts(prev => {
      const next = prev.map(p => (p.partId === partId ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p));
      debouncedSaveParts(next);
      return next;
    });
  }, [debouncedSaveParts]);

  const handleRemovePart = useCallback((partId: string) => {
    setSelectedParts(prev => {
      const next = prev.filter(p => p.partId !== partId);
      debouncedSaveParts(next);
      return next;
    });
  }, [debouncedSaveParts]);

  const handleSavePartsUsed = useCallback(() => apiData.savePartsUsed(selectedParts), [apiData, selectedParts]);

  // ── Step 5 — genset commissioning readings ──
  const [readings, setReadings] = useState<Record<string, string>>({});
  const updateReading = useCallback((key: string, value: string) => {
    setReadings(prev => ({ ...prev, [key]: value }));
  }, []);
  // Total Load KW (was its own manually-typed field) is now always just
  // Load KW R + Y + B added together — recomputed live as any of the three
  // change, including right after loadGensetReadings hydrates a previously
  // saved reading, so it can never drift from the sum. Written into
  // `readings` itself (not just derived at render time) so it's still
  // actually included in handleSaveReadings' payload — READINGS_NUMERIC_
  // FIELDS reads totalKwLoad from here the same as every other field.
  useEffect(() => {
    const { loadKwR, loadKwY, loadKwB } = readings;
    const allEmpty = !loadKwR && !loadKwY && !loadKwB;
    const total = allEmpty ? '' : String((parseFloat(loadKwR) || 0) + (parseFloat(loadKwY) || 0) + (parseFloat(loadKwB) || 0));
    if (readings.totalKwLoad !== total) {
      setReadings(prev => ({ ...prev, totalKwLoad: total }));
    }
  }, [readings.loadKwR, readings.loadKwY, readings.loadKwB]);

  // Load (%) — also read-only now, computed off Total Load KW and the
  // genset's own KVA Rating (Alternator & Panel card): a genset's rated
  // real-power output is its KVA × 0.8 (the standard assumed power
  // factor), so "what % of capacity is it currently loaded to" is
  // (Total Load KW ÷ (KVA × 0.8)) × 100 — Total Load KW divided by rated
  // capacity, not the other way round. Left blank rather than 0/NaN
  // whenever either input is missing or KVA is 0 (can't divide by it).
  useEffect(() => {
    const ratedKw = (parseFloat(kva) || 0) * 0.8;
    const percentage = (!kva || !readings.totalKwLoad || ratedKw === 0)
      ? ''
      : String(Math.round(((parseFloat(readings.totalKwLoad) || 0) / ratedKw) * 100 * 100) / 100);
    if (readings.loadPercentage !== percentage) {
      setReadings(prev => ({ ...prev, loadPercentage: percentage }));
    }
  }, [readings.totalKwLoad, kva]);
  const [readingsSavedBy, setReadingsSavedBy] = useState<{ name: string; role: string } | null>(null);
  const [readingsSavedAt, setReadingsSavedAt] = useState<string | null>(null);
  const [readingsSaving, setReadingsSaving] = useState(false);
  const [readingsError, setReadingsError] = useState('');
  const [readingsSuccess, setReadingsSuccess] = useState(false);

  const loadGensetReadings = useCallback(async () => {
    if (!taskId) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCommissioningProgress(token, taskId);
      const pending = await getPendingBody(`readings_${taskId}`);
      const r = { ...(data.gensetReadings || {}), ...(pending?.readings || {}) };
      if (!data.gensetReadings && !pending?.readings) return;

      const next: Record<string, string> = {};
      READINGS_NUMERIC_FIELDS.forEach(key => {
        if (r[key] !== undefined) next[key] = String(r[key]);
      });
      if (r.oilLevel) next.oilLevel = r.oilLevel;
      if (r.oilLevelComment) next.oilLevelComment = r.oilLevelComment;
      if (r.coolantLevel) next.coolantLevel = r.coolantLevel;
      if (r.coolantLevelComment) next.coolantLevelComment = r.coolantLevelComment;

      // Revalidation reads back from its own independent fields (see
      // handleSaveEngineParametersReval/handleSaveGensetElectricalReadingsReval/
      // handleSaveGroupE/handleSaveLoadUnbalanceReval) instead of the
      // shared gensetReadings blob above — merged into the same `readings`
      // state object since engineParametersCard/the Genset Electrical
      // Readings card both read every field from vm.readings[key]
      // regardless of which backend field it actually came from. Plain
      // Commissioning/Re-Commissioning/Pre-Commissioning is untouched —
      // this block only runs for Revalidation.
      if (isRevalidation) {
        const ep = data.engineParameters || {};
        const er = data.gensetElectricalReadings || {};
        [...READINGS_NUMERIC_FIELDS].forEach(key => {
          if (ep[key] !== undefined) next[key] = String(ep[key]);
          if (er[key] !== undefined) next[key] = String(er[key]);
        });
        if (ep.oilLevel) next.oilLevel = ep.oilLevel;
        if (ep.oilLevelComment) next.oilLevelComment = ep.oilLevelComment;
        if (ep.coolantLevel) next.coolantLevel = ep.coolantLevel;
        if (ep.coolantLevelComment) next.coolantLevelComment = ep.coolantLevelComment;

        // Takes precedence over the Asset record's own loadUnbalance
        // (hydrated separately, see loadAssetDetail's own comment) — for
        // Revalidation, CommissioningEntry.loadUnbalance is now the
        // authoritative value since that's what handleSaveLoadUnbalanceReval
        // actually writes to.
        if (data.loadUnbalance === true) setLoadUnbalance('Yes');
        else if (data.loadUnbalance === false) setLoadUnbalance('No');
        if (data.loadUnbalancePercentage !== undefined) setLoadUnbalancePercentage(String(data.loadUnbalancePercentage));

        // Running Hours moved off commissioningChecks entirely for
        // Revalidation (superseded — see handleSaveGroupE's own comment) —
        // overlaid onto the same commissioningChecks.runningHours key the
        // (unchanged) runningHoursCard UI already reads, so this card
        // shows the real, current value without needing its own JSX.
        if (data.runningHours !== undefined) {
          setCommissioningChecks(prev => ({ ...prev, runningHours: String(data.runningHours) }));
        }
      }

      setReadings(next);

      if (r.savedBy) setReadingsSavedBy(r.savedBy);
      if (r.savedAt) setReadingsSavedAt(r.savedAt);
    } catch (error) {
      console.log('Failed to load genset readings:', error);
    }
  }, [taskId, isRevalidation]);

  useEffect(() => {
    // Step 2 now shows Engine Parameters (moved there, above Performance
    // Trial) while Electrical Readings stays on Step 5 — both read from
    // this same `readings` state, so it must be loaded by the time either
    // step is reached, not just on Step 5.
    if ((currentStep === 2 || currentStep === 5) && taskId) loadGensetReadings();
  }, [currentStep, taskId, loadGensetReadings]);

  // Returns whether the save actually succeeded — Engine Parameters and
  // Genset Electrical Readings are two halves of this same combined save
  // (one call saves both), but they sit on different steps and the screen
  // needs to know when ITS OWN card's Save button specifically succeeded,
  // to collapse only that one rather than both (see taskForm.tsx's own
  // engineParamsCollapsed/readingsCollapsed — this used to be a single
  // shared readingsExpanded, which collapsed both cards together the
  // moment either was saved, even one on a step the user hadn't reached
  // yet).
  const handleSaveReadings = useCallback(async (): Promise<boolean> => {
    setReadingsSaving(true);
    setReadingsError('');
    setReadingsSuccess(false);
    try {
      if (!taskId) return false;

      const now = new Date().toISOString();
      const oilLevel = readings.oilLevel || '';
      const coolantLevel = readings.coolantLevel || '';

      const body: Record<string, any> = { savedBy: { name: assignedToName, role: assignedToRole }, savedAt: now, commissioningId: taskId };
      READINGS_NUMERIC_FIELDS.forEach(key => {
        body[key] = readings[key] ? Number(readings[key]) : undefined;
      });
      body.oilLevel = oilLevel || undefined;
      if (oilLevel.toUpperCase() === 'NOT OK' && readings.oilLevelComment) body.oilLevelComment = readings.oilLevelComment;
      body.coolantLevel = coolantLevel || undefined;
      if (coolantLevel.toUpperCase() === 'NOT OK' && readings.coolantLevelComment) body.coolantLevelComment = readings.coolantLevelComment;

      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/readings`,
        { readings: body },
        `Genset Electrical Readings (${assetLabel})`,
        `readings_${taskId}`,
        isEngineer
      );

      setReadingsSavedBy({ name: assignedToName, role: assignedToRole });
      setReadingsSavedAt(now);
      setReadingsSuccess(true);
      showToast(queued ? 'Saved on this device — will sync later' : 'Readings saved successfully!', 'success');
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save readings. Please try again.').message;
      setReadingsError(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setReadingsSaving(false);
    }
  }, [taskId, readings, assignedToName, assignedToRole, showToast, isEngineer, gensetSrNumber, engineNumber]);

  // Revalidation-only counterparts to handleSaveReadings above — confirmed
  // real contract (mobile-revalidation-and-service-changes.md §1.5-1.7):
  // Engine Parameters and Genset Electrical Reading are independent slices
  // (engineParameters / gensetElectricalReadings) on the SAME
  // /api/commissioning/:id/readings endpoint handleSaveReadings already
  // uses, not the shared `readings` (gensetReadings) blob that stays
  // exactly as-is for plain Commissioning/Re-Commissioning/Pre-
  // Commissioning. Deliberately reuse the same readingsSaving/
  // readingsError/readingsSuccess state handleSaveReadings uses (not a new
  // sectionSuccess key) so engineParametersCard's/the Genset Electrical
  // Readings card's existing Save-button/GroupHeader indicators keep
  // working exactly as they already do for the non-revalidation case,
  // without taskForm.tsx needing any JSX changes for these two.
  const handleSaveEngineParametersReval = useCallback(async (): Promise<boolean> => {
    setReadingsSaving(true);
    setReadingsError('');
    setReadingsSuccess(false);
    try {
      if (!taskId) return false;
      const oilLevel = readings.oilLevel || '';
      const coolantLevel = readings.coolantLevel || '';
      const now = new Date().toISOString();

      const body: Record<string, any> = {};
      (['rpm', 'frequency', 'dcVoltage', 'oilPressure', 'coolantTemperature', 'defLevelPercentage'] as const).forEach(key => {
        body[key] = readings[key] ? Number(readings[key]) : undefined;
      });
      body.oilLevel = oilLevel || undefined;
      if (oilLevel.toUpperCase() === 'NOT OK' && readings.oilLevelComment) body.oilLevelComment = readings.oilLevelComment;
      body.coolantLevel = coolantLevel || undefined;
      if (coolantLevel.toUpperCase() === 'NOT OK' && readings.coolantLevelComment) body.coolantLevelComment = readings.coolantLevelComment;

      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/readings`,
        { engineParameters: body },
        `Engine Parameters (${assetLabel})`,
        `reval_engineParams_${taskId}`,
        isEngineer
      );

      setReadingsSavedBy({ name: assignedToName, role: assignedToRole });
      setReadingsSavedAt(now);
      setReadingsSuccess(true);
      showToast(queued ? 'Saved on this device — will sync later' : 'Saved successfully!', 'success');
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setReadingsError(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setReadingsSaving(false);
    }
  }, [taskId, readings, assignedToName, assignedToRole, showToast, isEngineer, gensetSrNumber, engineNumber]);

  const handleSaveGensetElectricalReadingsReval = useCallback(async (): Promise<boolean> => {
    setReadingsSaving(true);
    setReadingsError('');
    setReadingsSuccess(false);
    try {
      if (!taskId) return false;
      const now = new Date().toISOString();

      const body: Record<string, any> = {};
      (['acVoltageRY', 'acVoltageYB', 'acVoltageBR', 'acAmpR', 'acAmpY', 'acAmpB', 'loadKwR', 'loadKwY', 'loadKwB', 'totalKwLoad', 'loadPercentage'] as const).forEach(key => {
        body[key] = readings[key] ? Number(readings[key]) : undefined;
      });

      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/readings`,
        { gensetElectricalReadings: body },
        `Genset Electrical Reading (${assetLabel})`,
        `reval_electrical_${taskId}`,
        isEngineer
      );

      setReadingsSavedBy({ name: assignedToName, role: assignedToRole });
      setReadingsSavedAt(now);
      setReadingsSuccess(true);
      showToast(queued ? 'Saved on this device — will sync later' : 'Saved successfully!', 'success');
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setReadingsError(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setReadingsSaving(false);
    }
  }, [taskId, readings, assignedToName, assignedToRole, showToast, isEngineer, gensetSrNumber, engineNumber]);

  // Load Unbalance — Revalidation's own dedicated Step 5 card (a separate
  // JSX block, only ever rendered when isRevalidation, unlike Engine
  // Parameters/Genset Electrical Reading above which share JSX with the
  // non-revalidation flow) — so this always sends the new confirmed
  // contract unconditionally, no isRevalidation branch needed here. Uses
  // its own 'loadUnbalanceReval' section key rather than reusing
  // handleSaveAlternatorPanel's 'alternator' key, so this card's own
  // Save-button/GroupHeader indicator reflects whether THIS save actually
  // succeeded instead of showing Step 1's Alternator & Panel card's
  // unrelated save state. handleSaveAlternatorPanel itself is untouched —
  // Step 1's own Alternator & Panel card keeps saving loadUnbalance to the
  // Asset record exactly as it already does, for every task type.
  const handleSaveLoadUnbalanceReval = useCallback(async (): Promise<boolean> => {
    const sectionKey = 'loadUnbalanceReval';
    setSectionSaving(prev => ({ ...prev, [sectionKey]: true }));
    setSectionError(prev => ({ ...prev, [sectionKey]: '' }));
    setSectionSuccess(prev => ({ ...prev, [sectionKey]: false }));
    try {
      if (!taskId) return false;
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      const body: Record<string, any> = { loadUnbalance: loadUnbalance === 'Yes' };
      if (loadUnbalance === 'Yes') body.loadUnbalancePercentage = loadUnbalancePercentage ? Number(loadUnbalancePercentage) : undefined;
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/readings`,
        body,
        `Load Unbalance (${assetLabel})`,
        `reval_loadUnbalance_${taskId}`,
        isEngineer
      );
      setSectionSuccess(prev => ({ ...prev, [sectionKey]: true }));
      showToast(queued ? 'Saved on this device — will sync later' : 'Saved successfully!', 'success');
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setSectionError(prev => ({ ...prev, [sectionKey]: msg }));
      showToast(msg, 'error');
      return false;
    } finally {
      setSectionSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  }, [taskId, loadUnbalance, loadUnbalancePercentage, isEngineer, gensetSrNumber, engineNumber, showToast]);

  // Step 6's "Complete" action: every photo/video/PDF has already uploaded
  // immediately when it was picked (see useTaskFormPhotos/
  // MediaUploadOverlay) — this just marks the task complete and navigates
  // to the View Report screen, which now owns the OTP verification step
  // (its own "Verify Client OTP" footer).
  const handleCompletePhotosStep = useCallback(async () => {
    const completeOk = await otp.handleMarkComplete(suggestionComment);
    if (!completeOk) return;

    router.replace({
      pathname: '/screens/taskReport',
      params: { task: JSON.stringify({ _id: taskId, assetId }) },
    } as any);
  }, [otp, taskId, assetId, router, suggestionComment]);

  // ── Profile (for the shared AppBar) ──
  const [userName, setUserName] = useState('');
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setUserName(JSON.parse(saved).name || ''); })
      .catch((error) => console.log('[Task Form] Failed to load profile:', error));
    // Role is loaded separately, earlier in this hook (see isEngineer above)
    // — kept as its own effect rather than merged into this one so it runs
    // before useTaskFormOtp is constructed, not after.
  }, []);

  // ── Navigation ──
  // Where the completion success screen's "DONE" button lands — this form
  // is commissioning-only (the SR/service equivalent is srTaskForm.tsx),
  // so it always goes to the Commissioning list, not a task-type branch.
  const goToCommissioningList = useCallback(() => router.replace('/screens/commissioningTasks' as any), [router]);

  const handleNext = useCallback(() => {
    const idx = stepSequence.indexOf(currentStep);
    if (idx !== -1 && idx < stepSequence.length - 1) {
      setCurrentStep(stepSequence[idx + 1]);
    } else {
      Alert.alert('Done', 'This was the final step.');
    }
  }, [currentStep, stepSequence]);

  // Only moves to the previous step — never falls through to exiting the
  // form. Leaving the form is the header chevron's (goToCommissioningList)
  // job specifically so this button's meaning stays consistent everywhere
  // it appears (step 1 included, where it's simply a no-op).
  const handleBack = useCallback(() => {
    const idx = stepSequence.indexOf(currentStep);
    if (idx > 0) setCurrentStep(stepSequence[idx - 1]);
  }, [currentStep, stepSequence]);

  return {
    router, params, TOTAL_STEPS, stepSequence,
    isRevalidation, isPreCommissioning,
    // Already display-ready (formatTaskType at the call site turns the
    // backend's PRE_COMMISSIONING/COMMISSIONING/RE_COMMISSIONING/
    // REVALIDATION into "Pre-Commissioning" etc.) — used for the header
    // title instead of a hardcoded "Commissioning".
    taskTypeLabel: taskTypeRaw,
    userName, currentStep, setCurrentStep,
    task, taskLoading,

    toastVisible, toastMessage, toastType,

    // Step 1
    assetLoading, sectionSaving, sectionError, sectionSuccess, customerContactNumber,
    gensetModel, setGensetModel, gensetSrNumber, setGensetSrNumber, assetDetail, engineModel, setEngineModel,
    engineNumber, setEngineNumber, engineKw, setEngineKw, engineType, setEngineType, engineFamily, setEngineFamily,
    fuelType, setFuelType, application, setApplication,
    altMake, setAltMake, altModel, setAltModel, altSn, setAltSn, atsSn, setAtsSn,
    batteryType, setBatteryType, batterySn, setBatterySn, battery2Sn, setBattery2Sn,
    kva, setKva, phase, setPhase, panelType, setPanelType,
    panelSn, setPanelSn, controllerType, setControllerType, controllerSr, setControllerSr,
    cpcbNorm, setCpcbNorm, loadUnbalance, setLoadUnbalance,
    loadUnbalancePercentage, setLoadUnbalancePercentage,
    loadUnbalanceComment, setLoadUnbalanceComment,
    commissioningDate, setCommissioningDate,
    ENGINE_TYPE_OPTIONS, ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS, PHASE_OPTIONS,
    PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,
    gensetMissingCount, altMissingCount,
    handleSaveGensetIdentification, handleSaveAlternatorPanel,

    // Step 2
    checksLoading,
    commissioningChecks, updateCommissioningCheck,
    prefillChecks, handleLoadPrefillChecks,
    validationChecks, updateValidationCheck,
    handleSaveGroupA, handleSaveGroupB, handleSaveGroupC, handleSaveGroupD, handleSaveGroupE,
    handleSaveLoadAndPhaseCheck,
    handleSaveCustomerHandover,
    handleSaveValidationChecks,

    // Step 3
    apiFaultCodes: apiData.apiFaultCodes, faultCodesLoading: apiData.faultCodesLoading,
    step3Saving: apiData.step3Saving, step3Error: apiData.step3Error, step3Success: apiData.step3Success,
    selectedComplaintCodes, complaintPickerVisible,
    handleOpenComplaintPicker, handleCloseComplaintPicker, handleSelectComplaintCode,
    handleRemoveComplaintCode, handleChangeComplaintObservation, handleChangeComplaintRootCause,
    handleChangeComplaintCorrectiveAction, handleSaveFaultCodes,

    // Step 4
    apiParts: apiData.apiParts, partsLoading: apiData.partsLoading,
    step4Saving: apiData.step4Saving, step4Error: apiData.step4Error, step4Success: apiData.step4Success,
    partPickerVisible, setPartPickerVisible, selectedParts,
    handleSelectPart, handleIncreaseQty, handleDecreaseQty, handleRemovePart, handleSavePartsUsed,

    // Step 5
    readings, updateReading,
    readingsSavedBy, readingsSavedAt, readingsSaving, readingsError, readingsSuccess,
    handleSaveReadings,
    handleSaveEngineParametersReval, handleSaveGensetElectricalReadingsReval, handleSaveLoadUnbalanceReval,

    // Step 6
    sitePhotos: photos.sitePhotos, photoOptionsVisible: photos.photoOptionsVisible,
    setPhotoOptionsVisible: photos.setPhotoOptionsVisible,
    handleTakeSitePhoto: photos.handleTakeSitePhoto, handleRecordSiteVideo: photos.handleRecordSiteVideo,
    handleChooseSitePhotos: photos.handleChooseSitePhotos,
    handleRemoveSitePhoto: photos.handleRemoveSitePhoto,
    handlePickPdf: photos.handlePickPdf,
    runningHoursPhotos: photos.runningHoursPhotos,
    step2PhotoOptionsVisible: photos.step2PhotoOptionsVisible,
    setStep2PhotoOptionsVisible: photos.setStep2PhotoOptionsVisible,
    handleTakeRunningHoursPhoto: photos.handleTakeRunningHoursPhoto,
    handleChooseRunningHoursPhotos: photos.handleChooseRunningHoursPhotos,
    handleRemoveRunningHoursPhoto: photos.handleRemoveRunningHoursPhoto,
    handleUpdateMediaTag: photos.handleUpdateMediaTag,
    // Real-time upload state/controls for MediaUploadOverlay — one queue
    // per list (Step 2 running-hours, Step 6 site), see useMediaUploadQueue.
    siteUploadQueue: photos.siteQueue, runningHoursUploadQueue: photos.runningHoursQueue,
    markCompleteLoading: otp.markCompleteLoading, markCompleteError: otp.markCompleteError,
    suggestionComment, setSuggestionComment,
    handleCompletePhotosStep,

    // Navigation
    goToCommissioningList, handleNext, handleBack,
  };
}
