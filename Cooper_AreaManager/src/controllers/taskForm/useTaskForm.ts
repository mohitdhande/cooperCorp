import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../utils/tokenStore';
import {
  getAssetById, getCommissioningProgress, getCommissioningTaskDetail,
} from '../../viewModel/commisionAPi';
import { ApiFaultCode, ApiPart, SelectedComplaintCode, SelectedPart } from '../../models/taskForm.types';
import {
  ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS, PHASE_OPTIONS,
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

// The old steps 7 (Review) and 8 (Work Completion OTP) were folded into
// step 6 itself — the completion summary and OTP verification now render
// in place of step 6's photo-upload UI (see taskForm.tsx) instead of
// advancing the stepper, so there are only 6 real steps left.
export const TOTAL_STEPS = 6;

// ── Commissioning-checks (Group A/B/C/D/E) field definitions ──
// All Group A/B/C fields share one rule: a "<field>_comment" is only sent
// when the field's own value is "Not OK" and a comment was actually typed.
const GROUP_A_FIELDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A11', 'A12', 'A13'];
const GROUP_A_COMMENT_FIELDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A11', 'A12', 'A13'];
const GROUP_B_FIELDS = ['B1', 'B2', 'B3', 'B4a', 'B4b', 'B4c', 'B4d', 'B5R', 'B5Y', 'B5B'];
const GROUP_B_COMMENT_FIELDS = ['B1', 'B2', 'B3', 'B4a', 'B4b', 'B4c', 'B4d'];
const GROUP_C_FIELDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18'];
const GROUP_C_COMMENT_FIELDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C14', 'C15', 'C16', 'C17'];
const LOAD_STAGE_PREFIXES = ['D0', 'D25', 'D50', 'D75', 'D100'];
const LOAD_STAGE_SUFFIXES = ['LR', 'LY', 'LB', 'VR', 'VY', 'VB', 'F', 'BV', 'REM'];
const GROUP_D_FIELDS = LOAD_STAGE_PREFIXES.flatMap(p => LOAD_STAGE_SUFFIXES.map(s => `${p}${s}`));
const GROUP_E_FIELDS = ['E_runHrs'];

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

  const apiData = useTaskFormApiData({ taskId, showToast });
  const photos = useTaskFormPhotos({ taskId, showToast });
  const otp = useTaskFormOtp({ taskId, showToast, isEngineer });

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
        if (!cancelled) setTask(detail);
      } catch (error) {
        console.log('[Task Form] Failed to load task summary:', error);
      } finally {
        if (!cancelled) setTaskLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  useEffect(() => {
    if (currentStep === 3) apiData.loadFaultCodes();
    if (currentStep === 4) apiData.loadParts();
    // apiData's loaders are stable (useCallback with no deps), so this only
    // needs to react to step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ── Task type detection ──
  const taskTypeRaw = params.taskType || 'Re-Commissioning';
  const normalizedTaskType = taskTypeRaw.toLowerCase().replace(/[\s-]/g, '');
  const isRevalidation = normalizedTaskType === 'revalidation';
  const isPreCommissioning = normalizedTaskType === 'precommissioning';
  const isCommissioning = normalizedTaskType === 'commissioning';

  // Pre-Commissioning now goes through the exact same 6-step sequence as
  // Commissioning (Asset Info -> Checks -> Complaint Codes -> Parts ->
  // Readings -> Complete), including step 2's Group A/B/C checklist it used
  // to skip — so a Pre-Commissioning entry's checks/fault codes/parts are
  // captured the same way a Commissioning one's are, and can later be
  // carried over when Commissioning is created for the same asset.
  const stepSequence = useMemo(() => [1, 2, 3, 4, 5, 6], []);

  // ── Step 1 — asset fields ──
  const [gensetModel, setGensetModel] = useState('');
  const [gensetSrNumber, setGensetSrNumber] = useState('');
  const [engineModel, setEngineModel] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [engineKw, setEngineKw] = useState('');
  const [engineType, setEngineType] = useState('');
  const [engineFamily, setEngineFamily] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [application, setApplication] = useState('');

  const [altMake, setAltMake] = useState('');
  const [altModel, setAltModel] = useState('');
  const [altSn, setAltSn] = useState('');
  const [atsSn, setAtsSn] = useState('');
  const [batterySn, setBatterySn] = useState('');
  const [kva, setKva] = useState('');
  const [phase, setPhase] = useState('');
  const [panelType, setPanelType] = useState('');
  const [panelSn, setPanelSn] = useState('');
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

  // Asset's own activity history — only kept around to find a completed
  // Pre-Commissioning entry for this same asset, so a fresh Commissioning
  // task's step 2 checks can inherit its answers (see loadCommissioningChecks).
  const [assetHistory, setAssetHistory] = useState<any[]>([]);

  // Shared by both the live fetch below and its offline cache fallback —
  // same field population either way.
  const applyAssetData = useCallback((data: any) => {
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
    if (data.batterySerialNumber) setBatterySn(data.batterySerialNumber);
    if (data.kva) setKva(data.kva);
    if (data.phase) setPhase(data.phase);
    if (data.panelType) setPanelType(data.panelType);
    if (data.controlPanelSerialNumber) setPanelSn(data.controlPanelSerialNumber);
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
      if (Array.isArray(data.history)) setAssetHistory(data.history);
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
      await putOrQueue(`/api/assets/${assetId}`, body, `${SECTION_LABELS[section] || section} (Asset ${assetId})`, `asset_${section}_${assetId}`, isEngineer);
      setSectionSuccess(prev => ({ ...prev, [section]: true }));
    } catch (error: any) {
      setSectionError(prev => ({
        ...prev,
        [section]: parseApiError(error, 'Failed to save. Please try again.').message,
      }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [section]: false }));
    }
  }, [assetId, isEngineer]);

  const handleSaveGensetIdentification = useCallback(() => saveAssetSection('genset', {
    gensetModel, gensetNumber: gensetSrNumber, engineModel, engineNumber,
    kw: engineKw, engineType, engineFamily, fuelType, applicationMaterial: application,
  }), [saveAssetSection, gensetModel, gensetSrNumber, engineModel, engineNumber, engineKw, engineType, engineFamily, fuelType, application]);

  const handleSaveAlternatorPanel = useCallback(() => saveAssetSection('alternator', {
    alternatorMake: altMake, alternatorModel: altModel, alternatorSerialNumber: altSn,
    atsSerialNumber: atsSn, batterySerialNumber: batterySn, kva, phase, panelType,
    controlPanelSerialNumber: panelSn, cpcb: cpcbNorm,
    // loadUnbalance itself (the Yes/No answer) was never actually included
    // here before — only the percentage was, so the backend had no way to
    // tell "balanced" apart from "unbalanced but no % entered yet".
    loadUnbalance: loadUnbalance === 'Yes',
    loadUnbalancePercentage: loadUnbalance === 'Yes' && loadUnbalancePercentage ? Number(loadUnbalancePercentage) : null,
    loadUnbalanceComment: loadUnbalance === 'No' ? (loadUnbalanceComment || null) : null,
  }), [saveAssetSection, altMake, altModel, altSn, atsSn, batterySn, kva, phase, panelType, panelSn, cpcbNorm, loadUnbalance, loadUnbalancePercentage, loadUnbalanceComment]);

  const gensetMissingCount = [gensetModel, engineModel, engineFamily, fuelType, application].filter(v => !v).length;
  const altMissingCount = [
    altMake, altModel, altSn, atsSn, batterySn, kva, phase, panelType, panelSn, cpcbNorm, loadUnbalance,
  ].filter(v => !v).length;

  // ── Step 2 — commissioning checks (Group A/B/C/D/E) ──
  const [checksLoading, setChecksLoading] = useState(false);
  const [commissioningChecks, setCommissioningChecks] = useState<Record<string, string>>({});
  const updateCommissioningCheck = useCallback((key: string, value: string) => {
    setCommissioningChecks(prev => ({ ...prev, [key]: value }));
  }, []);

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
  const CHECK_GROUP_KEYS = ['groupA', 'groupB', 'groupC', 'groupD', 'groupE'];

  const loadCommissioningChecks = useCallback(async () => {
    if (!taskId) return;
    setChecksLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCommissioningProgress(token, taskId);
      let checks = data.commissioningChecks || {};

      // Inherit a completed Pre-Commissioning entry's own step-2 checks onto
      // a fresh Commissioning task for the same asset — only when this task
      // has no saved progress of its own yet, so it never overwrites real
      // work already done on this task.
      if (isCommissioning && Object.keys(checks).length === 0) {
        const priorTaskId = assetHistory.find(h => h.type === 'PRE_COMMISSIONING' && h.status === 'COMPLETED')?._id;
        if (priorTaskId) {
          try {
            const priorData = await getCommissioningProgress(token, priorTaskId);
            if (priorData.commissioningChecks) checks = priorData.commissioningChecks;
          } catch (priorError) {
            console.log('Failed to load prior Pre-Commissioning checks:', priorError);
          }
        }
      }

      const pendingGroups = await Promise.all(
        CHECK_GROUP_KEYS.map(group => getPendingBody(`checks_${group}_${taskId}`))
      );
      pendingGroups.forEach(pending => {
        if (pending?.commissioningChecks) checks = { ...checks, ...pending.commissioningChecks };
      });
      setCommissioningChecks(checks);
    } catch (error) {
      console.log('Failed to load commissioning checks:', error);
    } finally {
      setChecksLoading(false);
    }
  }, [taskId, isCommissioning, assetHistory]);

  const loadValidationChecks = useCallback(async () => {
    if (!taskId) return;
    setChecksLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getCommissioningProgress(token, taskId);
      let checks = data.validationChecks || {};
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
      if (isRevalidation) loadValidationChecks();
      else loadCommissioningChecks();
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
      if (!taskId) return;
      // Same shape saveCommissioningProgress sends — replicated directly
      // here (instead of calling that function) so a network failure can
      // fall through to putOrQueue's own queueing instead of throwing.
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/progress`,
        { commissioningChecks: payload },
        `Checks — ${groupKey} (Task ${taskId})`,
        `checks_${groupKey}_${taskId}`,
        isEngineer
      );
      showToast(queued ? 'Saved on this device — will sync later' : 'Saved successfully!', 'success');
      setSectionSuccess(prev => ({ ...prev, [groupKey]: true }));
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      showToast(msg, 'error');
      setSectionError(prev => ({ ...prev, [groupKey]: msg }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [groupKey]: false }));
    }
  }, [taskId, showToast, isEngineer]);

  const handleSaveGroupA = useCallback(
    () => saveGroupChecks('groupA', buildGroupPayload(GROUP_A_FIELDS, GROUP_A_COMMENT_FIELDS)),
    [saveGroupChecks, commissioningChecks]
  );
  const handleSaveGroupB = useCallback(
    () => saveGroupChecks('groupB', buildGroupPayload(GROUP_B_FIELDS, GROUP_B_COMMENT_FIELDS)),
    [saveGroupChecks, commissioningChecks]
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
  const handleSaveGroupE = useCallback(() => {
    const payload: Record<string, string> = {};
    GROUP_E_FIELDS.forEach(key => { if (commissioningChecks[key]) payload[key] = commissioningChecks[key]; });
    return saveGroupChecks('groupE', payload);
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

      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/progress`,
        { validationChecks: payload },
        `Validation Checks (Task ${taskId})`,
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
  }, [taskId, validationChecks, showToast, isEngineer]);

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

  const handleSaveFaultCodes = useCallback(
    () => apiData.saveFaultCodes(selectedComplaintCodes),
    [apiData, selectedComplaintCodes]
  );

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
        ? prev.map(p => (p.partId === part._id ? { ...p, quantity: p.quantity + 1 } : p))
        : [...prev, {
            partId: part._id, code: part.code, name: part.name, unit: part.unit,
            category: part.category, subCategory: part.subCategory, quantity: 1,
          }];
      debouncedSaveParts(next);
      return next;
    });
  }, [debouncedSaveParts]);

  const handleIncreaseQty = useCallback((partId: string) => {
    setSelectedParts(prev => {
      const next = prev.map(p => (p.partId === partId ? { ...p, quantity: p.quantity + 1 } : p));
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
      setReadings(next);

      if (r.savedBy) setReadingsSavedBy(r.savedBy);
      if (r.savedAt) setReadingsSavedAt(r.savedAt);
    } catch (error) {
      console.log('Failed to load genset readings:', error);
    }
  }, [taskId]);

  useEffect(() => {
    if (currentStep === 5 && taskId) loadGensetReadings();
  }, [currentStep, taskId, loadGensetReadings]);

  const handleSaveReadings = useCallback(async () => {
    setReadingsSaving(true);
    setReadingsError('');
    setReadingsSuccess(false);
    try {
      if (!taskId) return;

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

      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/readings`,
        { readings: body },
        `Electrical Readings (Task ${taskId})`,
        `readings_${taskId}`,
        isEngineer
      );

      setReadingsSavedBy({ name: assignedToName, role: assignedToRole });
      setReadingsSavedAt(now);
      setReadingsSuccess(true);
      showToast(queued ? 'Saved on this device — will sync later' : 'Readings saved successfully!', 'success');
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save readings. Please try again.').message;
      setReadingsError(msg);
      showToast(msg, 'error');
    } finally {
      setReadingsSaving(false);
    }
  }, [taskId, readings, assignedToName, assignedToRole, showToast, isEngineer]);

  // ── Completion summary (shown on step 6 itself once "Complete" succeeds,
  // not a separate step) ──
  // Fault-code/parts counts aren't a ready-made field from the API —
  // they're the length of the arrays the task detail endpoint returns.
  // completedAt is captured client-side (the moment this actually
  // resolves) since the API doesn't return a distinct completion
  // timestamp separate from the task's own scheduled date.
  type CompletionSummary = {
    date: string; faultCodesCount: number; partsUsedCount: number;
    assignedAt: string; completedAt: string;
  };
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [completionSummaryLoading, setCompletionSummaryLoading] = useState(false);

  // Step 6's "Complete" action: saves any unsaved photos, marks the task
  // complete (same status change the old flow only made after OTP
  // verification — now made here so the task shows as Completed in the
  // list right away), then loads the just-completed record for the
  // success summary shown in place of the photo-upload UI — currentStep
  // deliberately stays 6 (the stepper keeps that circle highlighted)
  // rather than advancing, per the Figma. OTP verification (step 8) still
  // happens afterward, independently, triggered by the summary's own
  // "OTP Verify" button.
  const handleCompletePhotosStep = useCallback(async () => {
    if (photos.sitePhotos.length > 0 && !photos.photosUploadSuccess) {
      const photosOk = await photos.handleSaveAllPhotos();
      if (!photosOk) return;
    }
    // Videos and PDFs upload separately (their own GCS flow, see
    // handleSaveAllVideos) — checked independently of the photo gate above
    // so a video/PDF still gets uploaded even on a run where photos were
    // already uploaded (or there weren't any) and the photo branch above
    // was skipped.
    if (photos.sitePhotos.some(p => p.mediaType === 'video' || p.mediaType === 'pdf') && !photos.videosUploadSuccess) {
      const videosOk = await photos.handleSaveAllVideos();
      if (!videosOk) return;
    }

    const completeOk = await otp.handleMarkComplete();
    if (!completeOk) return;

    setCompletionSummaryLoading(true);
    const now = new Date().toISOString();
    try {
      const token = await getToken();
      if (token && taskId) {
        const detail = await getCommissioningTaskDetail(token, taskId);
        setCompletionSummary({
          date: detail.date || detail.commissioningDate || now,
          faultCodesCount: (detail.faultCodes || []).length,
          partsUsedCount: (detail.partsUsed || []).length,
          assignedAt: detail.assignedAt || detail.date || now,
          completedAt: now,
        });
      }
    } catch (error) {
      // The task itself is already marked complete on the backend at this
      // point (handleMarkComplete succeeded above, and it can't be called a
      // second time — the backend rejects re-completing an already-completed
      // entry) — this fetch only enriches the success screen's stats, so a
      // failure here falls back to a same-instant summary instead of
      // leaving the screen stuck with nothing to show for a task that did
      // complete.
      console.log('Failed to load completion summary:', error);
      setCompletionSummary({ date: now, faultCodesCount: 0, partsUsedCount: 0, assignedAt: now, completedAt: now });
    } finally {
      setCompletionSummaryLoading(false);
    }
  }, [photos, otp, taskId]);

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
    userName, currentStep, setCurrentStep,
    task, taskLoading,

    toastVisible, toastMessage, toastType,

    // Step 1
    assetLoading, sectionSaving, sectionError, sectionSuccess, customerContactNumber,
    gensetModel, setGensetModel, gensetSrNumber, setGensetSrNumber, engineModel, setEngineModel,
    engineNumber, setEngineNumber, engineKw, setEngineKw, engineType, setEngineType, engineFamily, setEngineFamily,
    fuelType, setFuelType, application, setApplication,
    altMake, setAltMake, altModel, setAltModel, altSn, setAltSn, atsSn, setAtsSn,
    batterySn, setBatterySn, kva, setKva, phase, setPhase, panelType, setPanelType,
    panelSn, setPanelSn, cpcbNorm, setCpcbNorm, loadUnbalance, setLoadUnbalance,
    loadUnbalancePercentage, setLoadUnbalancePercentage,
    loadUnbalanceComment, setLoadUnbalanceComment,
    commissioningDate, setCommissioningDate,
    ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS, PHASE_OPTIONS,
    PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,
    gensetMissingCount, altMissingCount,
    handleSaveGensetIdentification, handleSaveAlternatorPanel,

    // Step 2
    checksLoading,
    commissioningChecks, updateCommissioningCheck,
    validationChecks, updateValidationCheck,
    handleSaveGroupA, handleSaveGroupB, handleSaveGroupC, handleSaveGroupD, handleSaveGroupE,
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

    // Step 6
    sitePhotos: photos.sitePhotos, photoOptionsVisible: photos.photoOptionsVisible,
    setPhotoOptionsVisible: photos.setPhotoOptionsVisible,
    handleTakeSitePhoto: photos.handleTakeSitePhoto, handleRecordSiteVideo: photos.handleRecordSiteVideo,
    handleChooseSitePhotos: photos.handleChooseSitePhotos,
    handleRemoveSitePhoto: photos.handleRemoveSitePhoto,
    handlePickPdf: photos.handlePickPdf,
    videosUploading: photos.videosUploading, videosUploadProgress: photos.videosUploadProgress,
    videosUploadError: photos.videosUploadError, videosUploadSuccess: photos.videosUploadSuccess,
    handleSaveAllVideos: photos.handleSaveAllVideos,
    runningHoursPhotos: photos.runningHoursPhotos,
    step2PhotoOptionsVisible: photos.step2PhotoOptionsVisible,
    setStep2PhotoOptionsVisible: photos.setStep2PhotoOptionsVisible,
    handleTakeRunningHoursPhoto: photos.handleTakeRunningHoursPhoto,
    handleRecordRunningHoursVideo: photos.handleRecordRunningHoursVideo,
    handleChooseRunningHoursPhotos: photos.handleChooseRunningHoursPhotos,
    handleRemoveRunningHoursPhoto: photos.handleRemoveRunningHoursPhoto,
    photosUploading: photos.photosUploading, photosUploadProgress: photos.photosUploadProgress, photosUploadError: photos.photosUploadError,
    photosUploadSuccess: photos.photosUploadSuccess, handleSaveAllPhotos: photos.handleSaveAllPhotos,
    markCompleteLoading: otp.markCompleteLoading, markCompleteError: otp.markCompleteError,
    handleCompletePhotosStep,

    // Step 7
    completionSummary, completionSummaryLoading,

    // Step 8
    otpGenerated: otp.otpGenerated, generatedOtp: otp.generatedOtp, customerOtp: otp.customerOtp,
    otpInputRefs: otp.otpInputRefs, otpLoading: otp.otpLoading, otpError: otp.otpError,
    taskCompleted: otp.taskCompleted,
    handleGenerateOtp: otp.handleGenerateOtp, handleRegenerateOtp: otp.handleRegenerateOtp,
    handleChangeCustomerOtpDigit: otp.handleChangeCustomerOtpDigit, handleVerifyAndComplete: otp.handleVerifyAndComplete,

    // Navigation
    goToCommissioningList, handleNext, handleBack,
  };
}
