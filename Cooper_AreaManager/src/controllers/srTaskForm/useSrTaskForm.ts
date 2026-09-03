import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../utils/tokenStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  getAssetById, getServiceTaskById, getFaultCodes, getParts,
  uploadOneServiceMedia, updateServiceMediaTag, getGcsSignedUrls,
  getServiceCategoryConfig, finishServiceTask, getFreeServiceAvailability,
} from '../../viewModel/commisionAPi';
import { cacheData, getCachedData } from '../../utils/offlineCache';
import { putOrQueue, isNetworkError } from '../../utils/syncEngine';
import { getPendingBody } from '../../utils/offlineQueue';
import { enqueuePendingMedia } from '../../utils/pendingMediaQueue';
import { logLocationForAction } from '../../utils/locationLogger';
import { ApiFaultCode, ApiPart, SelectedComplaintCode, SelectedPart, SitePhoto, MediaType, MediaLocation } from '../../models/taskForm.types';
import { UserProfile } from '../../models/Login';
import { getRole } from '../../constants/permissions';
import {
  ENGINE_TYPE_OPTIONS, ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS,
  PHASE_OPTIONS, PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,
  SERVICE_CATEGORY_META,
} from '../../_components/srTaskForm/srDropdownOptions';
import { parseApiError } from '../../utils/apiError';
import { getPhotoValidationError, partitionValidPhotos, getPdfValidationError } from '../../utils/photoValidation';
import { videoFileName, formatAssetLabel } from '../../utils/reportFormatters';
import { useMediaUploadQueue, QueueItem, PickedAsset } from '../shared/useMediaUploadQueue';

// GET /api/service/category-config's per-category shape, merged with the
// local SERVICE_CATEGORY_META (colors/description — not part of that
// response). Same idea as newServiceJobController.ts's own ServiceCategory,
// kept as a separate local type since this is a different screen/flow.
export type FinishCategory = {
  letter: string;
  title: string;
  subCategories: string[];
  bg: string; border: string; text: string; description: string;
};

// GET /api/service/free-service-availability's per-window item — same shape
// newServiceJobController.ts uses, kept as a local type since this is a
// different screen/flow.
type FreeServiceItem = {
  no: number; label: string; status: string; canCreate: boolean; reason: string;
};

// Global, not per-task — the category/sub-category config is the same
// backend-wide reference list for every service task, same idea as
// this file's own faultCodes/parts cache keys.
const CATEGORY_CONFIG_CACHE_KEY = 'serviceCategoryConfig';

const FALLBACK_CATEGORY_META = { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', description: '' };

export const SR_STEP_SEQUENCE = [1, 2, 3, 4, 5, 6];

const toNum = (val: string): number | null => (val === '' || val === undefined ? null : Number(val));

// Main orchestration hook for the SR (service) task form — a 6-step wizard.
// Step 1's asset fields are genuinely heterogeneous (not a repeated
// checklist pattern like the commissioning form), so they stay as
// individual useState, matching how Cooper models them.
export function useSrTaskForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    taskId?: string; assetId?: string; gensetNumber?: string; engineNumber?: string;
    category?: string; subCategory?: string;
  }>();
  const taskId = params.taskId || '';
  const assetId = params.assetId || '';

  const [currentStep, setCurrentStep] = useState(1);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // The raw service task record (createdBy/assignedTo/reassignments) for
  // TaskSummaryHeader's assignment-chain avatars — same shape commissioning
  // tasks use, via getTaskPeople() in reportFormatters.ts.
  const [task, setTask] = useState<any>(null);

  // ── Profile (for the shared AppBar) ──
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setProfile(JSON.parse(saved)); })
      .catch((error) => console.log('[SR Task Form] Failed to load profile:', error));
  }, []);

  // Step 5 (formerly step 6, renumbered once step 5/Notes was removed)
  // diverges by role: engineers get the newer Complete/finish-API flow
  // below; area_manager keeps the existing Send-for-Approval/OTP flow
  // untouched, so this only ever gates that one branch.
  const isEngineer = !!profile && getRole(profile.role) === 'engineer';

  // ── Step 1: Genset Identification ──
  const [gensetModel, setGensetModel] = useState('');
  const [gensetSrNumber, setGensetSrNumber] = useState('');
  // The raw, untouched asset fetch result — kept separately from the
  // individual editable fields below (gensetSrNumber etc., which the user
  // can change in Step 1) purely so TaskSummaryHeader's identity pill has
  // one single object to read (gensetNumber/engineNumber/gensetModel/
  // dispatchDate/...) instead of this hook having to thread a new override
  // prop through every caller each time the header wants to show one more
  // field of it.
  const [assetDetail, setAssetDetail] = useState<any>(null);
  const [engineModel, setEngineModel] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [engineKw, setEngineKw] = useState('');
  const [engineType, setEngineType] = useState('');
  const [engineFamily, setEngineFamily] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [application, setApplication] = useState('');

  // ── Step 1: Alternator & Panel ──
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
  const [loadUnbalance, setLoadUnbalance] = useState<'Yes' | 'No' | ''>('');
  const [loadUnbalancePercentage, setLoadUnbalancePercentage] = useState('');
  const [loadUnbalanceComment, setLoadUnbalanceComment] = useState('');

  // ── Step 1: Electrical Readings ──
  const [acVoltRY, setAcVoltRY] = useState('');
  const [acVoltYB, setAcVoltYB] = useState('');
  const [acVoltBR, setAcVoltBR] = useState('');
  const [acAmpR, setAcAmpR] = useState('');
  const [acAmpY, setAcAmpY] = useState('');
  const [acAmpB, setAcAmpB] = useState('');
  const [loadKwR, setLoadKwR] = useState('');
  const [loadKwY, setLoadKwY] = useState('');
  const [loadKwB, setLoadKwB] = useState('');
  const [totalKw, setTotalKw] = useState('');
  const [loadPercent, setLoadPercent] = useState('');
  // Total Load KW (was its own manually-typed field) is now always just
  // Load KW R + Y + B added together — recomputed live as any of the three
  // change, including right after a previously saved reading is hydrated
  // (loadPreviousData), so it can never drift from the sum.
  useEffect(() => {
    const allEmpty = !loadKwR && !loadKwY && !loadKwB;
    const total = allEmpty ? '' : String((parseFloat(loadKwR) || 0) + (parseFloat(loadKwY) || 0) + (parseFloat(loadKwB) || 0));
    setTotalKw((prev) => (prev !== total ? total : prev));
  }, [loadKwR, loadKwY, loadKwB]);

  // Load (%) — also read-only, computed off Total Load KW and the
  // genset's own KVA Rating: a genset's rated real-power output is its
  // KVA × 0.8 (the standard assumed power factor), so "what % of capacity
  // is it currently loaded to" is (Total Load KW ÷ (KVA × 0.8)) × 100 —
  // Total Load KW divided by rated capacity, not the other way round.
  // Left blank rather than 0/NaN whenever either input is missing or KVA
  // is 0 (can't divide by it).
  useEffect(() => {
    const ratedKw = (parseFloat(kva) || 0) * 0.8;
    const percentage = (!kva || !totalKw || ratedKw === 0)
      ? ''
      : String(Math.round(((parseFloat(totalKw) || 0) / ratedKw) * 100 * 100) / 100);
    setLoadPercent((prev) => (prev !== percentage ? percentage : prev));
  }, [totalKw, kva]);

  // ── Step 1: Engine Parameters ──
  const [rpm, setRpm] = useState('');
  const [frequency, setFrequency] = useState('');
  const [dcVoltage, setDcVoltage] = useState('');
  const [oilPressure, setOilPressure] = useState('');
  const [oilLevel, setOilLevel] = useState<'OK' | 'Not OK' | ''>('');
  const [oilLevelComment, setOilLevelComment] = useState('');
  const [coolantLevel, setCoolantLevel] = useState<'OK' | 'Not OK' | ''>('');
  const [coolantLevelComment, setCoolantLevelComment] = useState('');
  const [coolantTemp, setCoolantTemp] = useState('');
  const [defLevel, setDefLevel] = useState('');
  // Confirmed real backend shape (mobile-service-complete-changes.md §3):
  // NOT part of the Asset record, and NOT nested under commissioningChecks
  // either (an earlier, since-superseded assumption) — a plain top-level
  // `runningHours: number` field on the service entry itself, saved via
  // PUT /api/service/:id/readings (see handleSaveRunningHours below).
  const [runningHours, setRunningHours] = useState('');

  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({});
  const [sectionError, setSectionError] = useState<Record<string, string>>({});

  // Builds the full asset payload from Step-1's ASSET-level fields only —
  // Engine Parameters, Genset Electrical Reading, Running Hours, and Load
  // Unbalance all moved OFF this (and off the Asset record entirely) onto
  // the service task's own /readings endpoint below (per the confirmed
  // mobile-service-complete-changes.md contract) — they used to ride
  // along in this same payload, sent to /api/assets/:id, which was never
  // the right record for any of them.
  const buildAssetPayload = useCallback(() => ({
    gensetNumber: gensetSrNumber,
    engineNumber,
    applicationMaterial: application,
    engineFamily, engineModel, engineType, fuelType, gensetModel,
    kw: engineKw,
    alternatorMake: altMake, alternatorModel: altModel, alternatorSerialNumber: altSn,
    atsSerialNumber: atsSn,
    batteryType, battery1SerialNumber: batterySn, battery2SerialNumber: battery2Sn,
    controlPanelSerialNumber: panelSn,
    controllerType, controllerSerialNumber: controllerSr,
    cpcb: cpcbNorm, kva,
    panelType, phase,
  }), [
    gensetSrNumber, engineNumber, application, engineFamily, engineModel, engineType,
    fuelType, gensetModel, engineKw, altMake, altModel, altSn, atsSn, batteryType, batterySn, battery2Sn,
    panelSn, controllerType, controllerSr, cpcbNorm, kva, panelType, phase,
  ]);

  const handleSaveAssetSection = useCallback(async (sectionKey: string) => {
    console.log(`[Service] handleSaveAssetSection(${sectionKey}) tapped, assetId =`, assetId);
    setSectionSaving(prev => ({ ...prev, [sectionKey]: true }));
    setSectionError(prev => ({ ...prev, [sectionKey]: '' }));
    setSectionSuccess(prev => ({ ...prev, [sectionKey]: false }));
    try {
      if (!assetId) {
        console.log(`[Service] handleSaveAssetSection(${sectionKey}) aborted — no assetId yet`);
        return;
      }
      // Always the whole record (see buildAssetPayload's own comment) —
      // one dedupeKey covers every section's save button here, unlike
      // commissioning's per-section partial saves.
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, assetId);
      const payload = buildAssetPayload();
      console.log(`[Service] handleSaveAssetSection(${sectionKey}) sending to /api/assets/${assetId}:`, JSON.stringify(payload));
      const { queued } = await putOrQueue(`/api/assets/${assetId}`, payload, `Asset details (${assetLabel})`, `sr_asset_${assetId}`, isEngineer);
      console.log(`[Service] handleSaveAssetSection(${sectionKey}) result — queued:`, queued);
      setSectionSuccess(prev => ({ ...prev, [sectionKey]: true }));
    } catch (error: any) {
      console.log(`[Service] handleSaveAssetSection(${sectionKey}) FAILED — status:`, error?.response?.status, 'data:', JSON.stringify(error?.response?.data), 'message:', error?.message);
      const { message } = parseApiError(error, 'Failed to save. Please try again.');
      setSectionError(prev => ({ ...prev, [sectionKey]: message }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  }, [assetId, buildAssetPayload, isEngineer, gensetSrNumber, engineNumber]);

  // Shared by all four /readings-based saves below (Engine Parameters,
  // Genset Electrical Reading, Running Hours, Load Unbalance) — one
  // endpoint, four independent optional slices (mobile-service-complete-
  // changes.md v1.1 §6): only the top-level keys actually present in
  // `body` are touched server-side, so each card's own Save button can
  // call this with just its own slice without clobbering the other
  // cards' unsaved edits.
  const saveServiceReadings = useCallback(async (
    sectionKey: string,
    body: {
      engineParameters?: Record<string, unknown>;
      gensetElectricalReadings?: Record<string, unknown>;
      runningHours?: number | null;
      loadUnbalance?: boolean;
      loadUnbalancePercentage?: number | null;
    },
    label: string,
  ) => {
    setSectionSaving(prev => ({ ...prev, [sectionKey]: true }));
    setSectionError(prev => ({ ...prev, [sectionKey]: '' }));
    setSectionSuccess(prev => ({ ...prev, [sectionKey]: false }));
    try {
      if (!taskId) return;
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      console.log(`[Service] saveServiceReadings(${sectionKey}) sending to /api/service/${taskId}/readings:`, JSON.stringify(body));
      const { queued } = await putOrQueue(
        `/api/service/${taskId}/readings`,
        body,
        `${label} (${assetLabel})`,
        `sr_readings_${sectionKey}_${taskId}`,
        isEngineer
      );
      console.log(`[Service] saveServiceReadings(${sectionKey}) result — queued:`, queued);
      setSectionSuccess(prev => ({ ...prev, [sectionKey]: true }));
    } catch (error: any) {
      console.log(`[Service] saveServiceReadings(${sectionKey}) FAILED — status:`, error?.response?.status, 'data:', JSON.stringify(error?.response?.data), 'message:', error?.message);
      const { message } = parseApiError(error, 'Failed to save. Please try again.');
      setSectionError(prev => ({ ...prev, [sectionKey]: message }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  }, [taskId, isEngineer, gensetSrNumber, engineNumber]);

  // Engine Parameters — confirmed to live on the service entry's own
  // `engineParameters` field (mobile-service-complete-changes.md v1.1 §2),
  // sent whole (not merged field-by-field). Electrical Reading fields are
  // deliberately NOT included here — they moved to their own field/save
  // below (§3) after briefly being merged into this one mid-cycle.
  const handleSaveEngineParams = useCallback(() => saveServiceReadings('engineParams', {
    engineParameters: {
      rpm: toNum(rpm), frequency: toNum(frequency), dcVoltage: toNum(dcVoltage),
      oilPressure: toNum(oilPressure), coolantTemperature: toNum(coolantTemp), defLevelPercentage: toNum(defLevel),
      oilLevel, oilLevelComment: oilLevel === 'Not OK' ? (oilLevelComment || null) : null,
      coolantLevel, coolantLevelComment: coolantLevel === 'Not OK' ? (coolantLevelComment || null) : null,
    },
  }, 'Engine Parameters'), [saveServiceReadings, rpm, frequency, dcVoltage, oilPressure, coolantTemp, defLevel, oilLevel, oilLevelComment, coolantLevel, coolantLevelComment]);

  // Genset Electrical Reading — NEW as of mobile-service-complete-
  // changes.md v1.1 §3: its own top-level `gensetElectricalReadings` field
  // on the service entry, fully independent from Engine Parameters (own
  // save call, own dedupeKey, own success/error state). This used to ride
  // along inside buildAssetPayload/handleSaveAssetSection('electrical'),
  // sent to /api/assets/:id — that was never the right record for it, per
  // this same document's earlier v1.0 §2 for Engine Parameters. Total Load
  // KW / Load % are computed client-side already (see the totalKw/
  // loadPercent effects above) — sent as plain numbers alongside the 9 raw
  // inputs, not recomputed server-side.
  const handleSaveGensetElectricalReadings = useCallback(() => saveServiceReadings('electrical', {
    gensetElectricalReadings: {
      acVoltageRY: toNum(acVoltRY), acVoltageYB: toNum(acVoltYB), acVoltageBR: toNum(acVoltBR),
      acAmpR: toNum(acAmpR), acAmpY: toNum(acAmpY), acAmpB: toNum(acAmpB),
      loadKwR: toNum(loadKwR), loadKwY: toNum(loadKwY), loadKwB: toNum(loadKwB),
      totalKwLoad: toNum(totalKw), loadPercentage: toNum(loadPercent),
    },
  }, 'Genset Electrical Reading'), [saveServiceReadings, acVoltRY, acVoltYB, acVoltBR, acAmpR, acAmpY, acAmpB, loadKwR, loadKwY, loadKwB, totalKw, loadPercent]);

  // Running Hours — confirmed real backend shape (mobile-service-complete-
  // changes.md §3): a plain top-level number, not nested under
  // commissioningChecks (an earlier, since-superseded assumption).
  const handleSaveRunningHours = useCallback(
    () => saveServiceReadings('runningHours', { runningHours: toNum(runningHours) as number | null }, 'Running Hours'),
    [saveServiceReadings, runningHours]
  );

  // Load Unbalance — confirmed to live on the service entry's own top-level
  // loadUnbalance/loadUnbalancePercentage (mobile-service-complete-
  // changes.md §4), not the Asset record. Percentage is only sent when
  // Yes — the server force-clears it to undefined whenever loadUnbalance
  // is false regardless of what's sent, so there's no need to explicitly
  // send a clearing value here, just omit it.
  const handleSaveLoadUnbalance = useCallback(() => saveServiceReadings('loadUnbalance', {
    loadUnbalance: loadUnbalance === 'Yes',
    ...(loadUnbalance === 'Yes' ? { loadUnbalancePercentage: toNum(loadUnbalancePercentage) as number | null } : {}),
  }, 'Load Unbalance'), [saveServiceReadings, loadUnbalance, loadUnbalancePercentage]);

  // ── Step 2: Complaint / Fault Codes ──
  const [apiFaultCodes, setApiFaultCodes] = useState<ApiFaultCode[]>([]);
  const [faultCodesLoading, setFaultCodesLoading] = useState(false);
  const [selectedComplaintCodes, setSelectedComplaintCodes] = useState<SelectedComplaintCode[]>([]);
  const [complaintPickerVisible, setComplaintPickerVisible] = useState(false);
  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Success, setStep2Success] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  const handleSelectComplaintCode = useCallback((code: ApiFaultCode) => {
    setSelectedComplaintCodes(prev => [...prev, {
      uid: `${code.code}-${Date.now()}`,
      codeId: code._id,
      code: code.code,
      priority: code.priority,
      title: code.description,
      categoryName: code.category,
      subcategoryName: code.subCategory,
      observation: '',
      rootCause: '',
      correctiveAction: '',
      isNew: true,
    }]);
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

  // Clears isNew on every code once the save actually succeeds — see the
  // matching comment on useTaskForm.ts's own handleSaveFaultCodes for why
  // (without this, ComplaintCodeCard re-opens an already-saved code
  // editable every time this step remounts).
  const handleSaveFaultCodes = useCallback(async () => {
    setStep2Saving(true);
    setStep2Error('');
    setStep2Success(false);
    try {
      if (!taskId) return;
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      await putOrQueue(
        `/api/service/${taskId}/save-progress`,
        {
          faultCodes: selectedComplaintCodes.map((item) => ({
            codeId: item.codeId,
            observation: item.observation || '',
            rootCause: item.rootCause || '',
            correctiveAction: item.correctiveAction || '',
          })),
        },
        `Fault Codes (${assetLabel})`,
        `sr_faultcodes_${taskId}`,
        isEngineer
      );
      setStep2Success(true);
      setSelectedComplaintCodes(prev => prev.map(item => (item.isNew ? { ...item, isNew: false } : item)));
    } catch (error: any) {
      setStep2Error(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setStep2Saving(false);
    }
  }, [taskId, selectedComplaintCodes, isEngineer, gensetSrNumber, engineNumber]);

  // ── Step 3: Parts Used ──
  const [apiParts, setApiParts] = useState<ApiPart[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [partPickerVisible, setPartPickerVisible] = useState(false);
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Success, setStep3Success] = useState(false);
  const [step3Error, setStep3Error] = useState('');

  // Takes an explicit list (the freshly-computed one from whichever handler
  // just changed it) rather than reading selectedParts from closure, so it
  // can be called from inside a setState updater without a stale value.
  const handleSavePartsUsed = useCallback(async (partsOverride?: SelectedPart[]) => {
    const parts = partsOverride ?? selectedParts;
    setStep3Saving(true);
    setStep3Error('');
    setStep3Success(false);
    try {
      if (!taskId) return;
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      await putOrQueue(
        `/api/service/${taskId}/save-progress`,
        { partsUsed: parts.map((part) => ({ partId: part.partId, quantity: part.quantity })) },
        `Parts Used (${assetLabel})`,
        `sr_parts_${taskId}`,
        isEngineer
      );
      setStep3Success(true);
    } catch (error: any) {
      setStep3Error(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setStep3Saving(false);
    }
  }, [taskId, selectedParts, isEngineer, gensetSrNumber, engineNumber]);

  // Adding a part, changing its quantity, or removing it all persist right
  // away — no separate per-card save button.
  //
  // Debounced, not called straight from each handler — tapping +/- fast
  // used to fire a full save on every single tap, each an independent
  // in-flight request carrying whatever quantity existed at that instant.
  // With several of those racing the network at once, they can land out of
  // order or have one fail under concurrent load — showing a real error
  // toast even though the visible quantity (state updates instantly,
  // unaffected by the debounce) was already correct. Waiting for a short
  // pause after the last change and sending one request with the final
  // list fixes both: no more racing requests, and far fewer network calls.
  const savePartsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSaveParts = useCallback((parts: SelectedPart[]) => {
    if (savePartsDebounceRef.current) clearTimeout(savePartsDebounceRef.current);
    savePartsDebounceRef.current = setTimeout(() => {
      savePartsDebounceRef.current = null;
      handleSavePartsUsed(parts);
    }, 600);
  }, [handleSavePartsUsed]);
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
    setPartPickerVisible(false);
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

  // ── Step 4: Photos & Video ──
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);

  // gcsUrl/type only ever missing if onItemSucceeded somehow fired before
  // they were resolved — shouldn't happen (see the matching comment on
  // taskForm/useTaskFormPhotos.ts's own toSitePhoto), fallback kept anyway.
  function toSitePhoto(item: QueueItem): SitePhoto {
    return {
      id: item.gcsUrl || item.localId,
      uri: item.uri,
      fileName: item.fileName,
      mediaType: item.kind === 'photo' ? 'image' : item.kind,
      fileSize: item.fileSize,
      gcsUrl: item.gcsUrl,
      type: item.type,
      tags: item.tags || [],
      location: item.location,
    };
  }

  // Every media type now rides the same uploadOneServiceMedia call
  // (unified media[] model) — see its own comment in commisionAPi.ts for
  // why this is unconfirmed against a real Service dev guide, mirrored
  // exactly from Commissioning's confirmed shape regardless.
  const mediaUploaders = useMemo(() => ({
    uploadPhoto: async (file: { uri: string; fileName: string }, type: MediaType, location: MediaLocation | undefined, tags: string[] | undefined, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      return uploadOneServiceMedia(token, taskId, file, type, location, tags, onProgress, signal);
    },
    uploadVideoOrPdf: async (file: { uri: string; fileName: string }, type: MediaType, location: MediaLocation | undefined, tags: string[] | undefined, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      return uploadOneServiceMedia(token, taskId, file, type, location, tags, onProgress, signal);
    },
  }), [taskId]);

  const persistMediaFailure = useCallback((item: QueueItem) => enqueuePendingMedia({
    sourceUri: item.uri, fileName: item.fileName, fileSize: item.fileSize,
    mediaKind: item.kind, source: item.source, formKind: 'service', taskId, target: 'site',
  }), [taskId]);

  const mediaQueue = useMediaUploadQueue(
    mediaUploaders,
    useCallback((item: QueueItem) => setSitePhotos((prev) => [...prev, toSitePhoto(item)]), []),
    isEngineer,
    persistMediaFailure
  );

  // Android's native camera intent can't mix photo and video capture in
  // one launch (ACTION_IMAGE_CAPTURE vs ACTION_VIDEO_CAPTURE are separate
  // intents) — passing mediaTypes: ['images', 'videos'] to launchCameraAsync
  // silently falls back to photo-only there, with no video toggle shown.
  // So "Take Photo" and "Record Video" are two distinct camera launches,
  // each requesting only its own type; this works on iOS too.
  const captureFromCamera = useCallback(async (mediaType: 'images' | 'videos') => {
    try {
      // The options sheet Modal (fade-out) is still tearing down its own
      // native window when the button's onPress fires — launching the
      // camera activity while that's still in flight is what causes a
      // black-screen flash on some Android devices before the camera
      // actually appears. A short pause here lets the Modal's close
      // animation finish first, same fix as taskForm.tsx's own
      // captureFromCamera (useTaskFormPhotos.ts).
      await new Promise((resolve) => setTimeout(resolve, 350));

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', `Camera access is required to ${mediaType === 'videos' ? 'record a video' : 'take a photo'}.`);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: [mediaType],
        videoMaxDuration: 60,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const validationError = getPhotoValidationError(asset);
        if (validationError) {
          Alert.alert(mediaType === 'videos' ? 'Video not allowed' : 'Photo not allowed', validationError);
          return;
        }
        const isVideo = mediaType === 'videos';
        const picked: PickedAsset = {
          uri: asset.uri,
          fileName: asset.fileName || `${isVideo ? 'video' : 'photo'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          fileSize: asset.fileSize,
          kind: isVideo ? 'video' : 'photo',
          source: 'camera',
        };
        mediaQueue.startBatch([picked]);
      }
    } catch (error) {
      // A native picker/camera failure would otherwise fail silently — the
      // button tap would just do nothing with no feedback.
      console.log('[SR Task Form Photos] Camera failed:', error);
      Alert.alert('Camera unavailable', 'Could not open the camera. Please try again.');
    }
  }, [mediaQueue]);

  const handleTakePhoto = useCallback(async () => {
    setPhotoOptionsVisible(false);
    await captureFromCamera('images');
  }, [captureFromCamera]);

  const handleRecordVideo = useCallback(async () => {
    setPhotoOptionsVisible(false);
    await captureFromCamera('videos');
  }, [captureFromCamera]);

  // One combined gallery picker for both photos and videos — the sheet
  // offers a single "Choose Photo / Video from Gallery" row rather than
  // separate photo/video gallery options, so this needs to accept either
  // media type in one launch and sort the result by each asset's own
  // `type` (already handled below, unchanged from when this was
  // photos-only — a mixed-type result already worked, it just never
  // received one before mediaTypes included 'videos' too).
  const handleChoosePhotos = useCallback(async () => {
    setPhotoOptionsVisible(false);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Gallery access is required to choose photos or videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.7,
        allowsMultipleSelection: true,
      });
      if (!result.canceled && result.assets) {
        const { valid, skippedMessage } = partitionValidPhotos(result.assets);
        const picked: PickedAsset[] = valid.map((asset, i) => {
          const isVideo = asset.type === 'video';
          return {
            uri: asset.uri,
            fileName: asset.fileName || `${isVideo ? 'video' : 'photo'}_${Date.now()}_${i}.${isVideo ? 'mp4' : 'jpg'}`,
            fileSize: asset.fileSize,
            kind: isVideo ? 'video' as const : 'photo' as const,
            source: 'gallery' as const,
          };
        });
        if (picked.length > 0) mediaQueue.startBatch(picked);
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[SR Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the gallery. Please try again.');
    }
  }, [mediaQueue]);

  // Documents card's own picker — device storage only (no camera option;
  // a PDF can't be "captured"). No dedicated document endpoint exists on
  // the backend, so picked PDFs are tagged type: 'pdf' and ride the same
  // GCS-sign + confirm flow as everything else (uploadOneServiceMedia).
  const handlePickPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets) return;

      const valid: DocumentPicker.DocumentPickerAsset[] = [];
      const reasons = new Set<string>();
      for (const asset of result.assets) {
        const error = getPdfValidationError(asset);
        if (error) reasons.add(error);
        else valid.push(asset);
      }
      const picked: PickedAsset[] = valid.map((asset, i) => ({
        uri: asset.uri,
        fileName: asset.name || `document_${i + 1}.pdf`,
        fileSize: asset.size,
        kind: 'pdf',
        source: 'gallery',
      }));
      if (picked.length > 0) mediaQueue.startBatch(picked);

      const skippedCount = result.assets.length - valid.length;
      if (skippedCount > 0) {
        Alert.alert('Some files were skipped', `${skippedCount} file${skippedCount > 1 ? 's were' : ' was'} skipped: ${Array.from(reasons).join(' ')}`);
      }
    } catch (error) {
      console.log('[SR Task Form Photos] PDF picker failed:', error);
      Alert.alert('Storage unavailable', 'Could not open device storage. Please try again.');
    }
  }, [mediaQueue]);

  const handleRemovePhoto = useCallback((id: string) => {
    setSitePhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  // Running Hours' own photo — same pairing taskForm.tsx's commissioning
  // form has for its Running Hours step (one photo, uploaded through the
  // exact same generic photo endpoint as every other site photo — there's
  // no dedicated "running hours" field on the backend for either form, so
  // this is a client-side-only grouping, same known limitation already
  // flagged and accepted for commissioning: once saved, it rides the same
  // flat photosUrls array as everything else and can't be told apart from
  // a regular site photo on reload). Reuses mediaUploaders (same
  // upload endpoints) — only which local list a successful item lands in
  // differs, same pattern as commissioning's siteQueue/runningHoursQueue
  // split.
  const [runningHoursPhotos, setRunningHoursPhotos] = useState<SitePhoto[]>([]);
  const [runningHoursPhotoOptionsVisible, setRunningHoursPhotoOptionsVisible] = useState(false);

  const persistRunningHoursFailure = useCallback((item: QueueItem) => enqueuePendingMedia({
    sourceUri: item.uri, fileName: item.fileName, fileSize: item.fileSize,
    mediaKind: item.kind, source: item.source, formKind: 'service', taskId, target: 'runningHours',
  }), [taskId]);

  // Confirms pre-tagged 'Running Hours' by default — see the matching
  // comment on taskForm/useTaskFormPhotos.ts's own runningHoursQueue.
  const runningHoursQueue = useMediaUploadQueue(
    mediaUploaders,
    useCallback((item: QueueItem) => setRunningHoursPhotos((prev) => [...prev, toSitePhoto(item)]), []),
    isEngineer,
    persistRunningHoursFailure,
    ['Running Hours']
  );

  // Exactly one running-hours photo — PhotosVideoCard's own maxItems={1}
  // hides its Add trigger once one exists, but these are guarded directly
  // too, same as taskForm.tsx's own handleTakeRunningHoursPhoto/
  // handleChooseRunningHoursPhotos.
  const handleTakeRunningHoursPhoto = useCallback(async () => {
    setRunningHoursPhotoOptionsVisible(false);
    if (runningHoursPhotos.length >= 1) {
      Alert.alert('Only one photo allowed', 'Remove the current running-hours photo before adding a different one.');
      return;
    }
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const validationError = getPhotoValidationError(asset);
        if (validationError) {
          Alert.alert('Photo not allowed', validationError);
          return;
        }
        const picked: PickedAsset = {
          uri: asset.uri,
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
          fileSize: asset.fileSize,
          kind: 'photo',
          source: 'camera',
        };
        runningHoursQueue.startBatch([picked]);
      }
    } catch (error) {
      console.log('[SR Task Form Photos] Running-hours camera failed:', error);
      Alert.alert('Camera unavailable', 'Could not open the camera. Please try again.');
    }
  }, [runningHoursQueue, runningHoursPhotos]);

  const handleChooseRunningHoursPhotos = useCallback(async () => {
    setRunningHoursPhotoOptionsVisible(false);
    if (runningHoursPhotos.length >= 1) {
      Alert.alert('Only one photo allowed', 'Remove the current running-hours photo before adding a different one.');
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Gallery access is required to choose a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: false,
      });
      if (!result.canceled) {
        const { valid, skippedMessage } = partitionValidPhotos(result.assets);
        const picked: PickedAsset[] = valid.slice(0, 1).map((asset, index) => ({
          uri: asset.uri,
          fileName: asset.uri.split('/').pop() || `photo_${Date.now()}_${index}.jpg`,
          fileSize: asset.fileSize,
          kind: 'photo',
          source: 'gallery',
        }));
        if (picked.length > 0) runningHoursQueue.startBatch(picked);
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[SR Task Form Photos] Running-hours gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the photo gallery. Please try again.');
    }
  }, [runningHoursQueue, runningHoursPhotos]);

  const handleRemoveRunningHoursPhoto = useCallback((id: string) => {
    setRunningHoursPhotos(prev => prev.filter(photo => photo.id !== id));
  }, []);

  // Shows whatever was already uploaded in an earlier session — called once
  // when the task detail first loads (see loadPreviousData below), so
  // reopening a task you'd already added photos/videos/PDFs to doesn't look
  // empty just because this session's own sitePhotos state starts fresh.
  // Reads the unified task.media array directly and filters by each item's
  // own .type — replaces the old two-separate-fields (photosUrls/
  // videosUrls) + extension-guessing read. An item tagged 'Running Hours'
  // (the fixed default runningHoursQueue always confirms with) hydrates
  // into runningHoursPhotos instead of the general site list — see the
  // matching comment on taskForm/useTaskFormPhotos.ts's own
  // hydrateSitePhotos. Photos need a signed URL to actually render as a
  // thumbnail (private GCS bucket); video/PDF rows only ever show a
  // filename/icon, so the raw gcsUrl is fine for those.
  const hydrateSitePhotos = useCallback(async (media: { type: string; gcsUrl: string; tags?: string[]; location?: MediaLocation }[]) => {
    if (!media || media.length === 0) return;
    const isRunningHours = (m: { tags?: string[] }) => !!m.tags?.includes('Running Hours');
    const runningHoursItems = media.filter(isRunningHours);
    const siteMedia = media.filter((m) => !isRunningHours(m));

    const photoItems = siteMedia.filter((m) => m.type === 'photo' || m.type === 'image');
    const videoItems = siteMedia.filter((m) => m.type === 'video');
    const pdfItems = siteMedia.filter((m) => m.type === 'pdf');
    const runningHoursPhotoItems = runningHoursItems.filter((m) => m.type === 'photo' || m.type === 'image');

    const allPhotoUrls = [...photoItems, ...runningHoursPhotoItems].map((m) => m.gcsUrl);
    let signedPhotoUrls: Record<string, string> = {};
    if (allPhotoUrls.length > 0) {
      try {
        const token = await getToken();
        if (token) signedPhotoUrls = await getGcsSignedUrls(token, allPhotoUrls);
      } catch (error) {
        console.log('[SR Task Form Photos] Failed to sign previously-uploaded photo URLs:', error);
      }
    }

    const hydrated: SitePhoto[] = [
      ...photoItems.map((m) => ({ id: m.gcsUrl, uri: signedPhotoUrls[m.gcsUrl] || m.gcsUrl, fileName: videoFileName(m.gcsUrl), mediaType: 'image' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location })),
      ...videoItems.map((m) => ({ id: m.gcsUrl, uri: m.gcsUrl, fileName: videoFileName(m.gcsUrl), mediaType: 'video' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location })),
      ...pdfItems.map((m) => ({ id: m.gcsUrl, uri: m.gcsUrl, fileName: videoFileName(m.gcsUrl), mediaType: 'pdf' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location })),
    ];
    setSitePhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...hydrated.filter((p) => !existingIds.has(p.id))];
    });

    const hydratedRunningHours: SitePhoto[] = runningHoursPhotoItems.map((m) => ({
      id: m.gcsUrl, uri: signedPhotoUrls[m.gcsUrl] || m.gcsUrl, fileName: videoFileName(m.gcsUrl),
      mediaType: 'image' as const, gcsUrl: m.gcsUrl, type: m.type as MediaType, tags: m.tags || [], location: m.location,
    }));
    if (hydratedRunningHours.length > 0) {
      setRunningHoursPhotos((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...hydratedRunningHours.filter((p) => !existingIds.has(p.id))];
      });
    }
  }, []);

  // Updates the tag(s) on an already-uploaded item, matched by gcsUrl.
  const handleUpdateMediaTag = useCallback(async (gcsUrl: string, tags: string[]) => {
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      await updateServiceMediaTag(token, taskId, gcsUrl, tags);
      const applyTag = (photos: SitePhoto[]) => photos.map((p) => (p.gcsUrl === gcsUrl ? { ...p, tags } : p));
      setSitePhotos(applyTag);
      setRunningHoursPhotos(applyTag);
    } catch (error) {
      console.log('[SR Task Form Photos] Failed to update media tag:', error);
      Alert.alert('Failed to update tag', 'Please try again.');
    }
  }, [taskId]);

  // ── Step 5: Notes ──
  const [notes, setNotes] = useState('');

  // Suggestion Comment — shown on Step 5, right above the Complete/Send-for-
  // Approval button, not an editor for `notes` above.
  const [suggestionComment, setSuggestionComment] = useState('');

  const [step5Saving, setStep5Saving] = useState(false);
  const [step5Success, setStep5Success] = useState(false);
  const [step5Error, setStep5Error] = useState('');

  const handleSaveNotes = useCallback(async () => {
    setStep5Saving(true);
    setStep5Error('');
    setStep5Success(false);
    try {
      if (!taskId) return;
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      await putOrQueue(`/api/service/${taskId}/save-progress`, { notes }, `Notes (${assetLabel})`, `sr_notes_${taskId}`, isEngineer);
      setStep5Success(true);
    } catch (error: any) {
      setStep5Error(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setStep5Saving(false);
    }
  }, [taskId, notes, isEngineer, gensetSrNumber, engineNumber]);

  // ── Step 5 (formerly step 6): Category & Approval — the state/variable
  // names below still say "step6" (not renamed to avoid a wide, purely
  // cosmetic diff), but this is the screen's Step 5 now. ──
  const [expandedCategory, setExpandedCategory] = useState('');
  // Seeded from the task list's own nav params (see goToTaskForm in
  // dashboardHomeController.ts/serviceTasksController.ts) — an
  // instant-render fallback for the engineer's locked-category Step 5
  // card, so it shows immediately (and offline, before/without
  // loadPreviousData's own fetch or its cache) instead of sitting
  // completely blank until a real answer arrives. loadPreviousData still
  // overwrites these the moment it gets one, same as every other field.
  const [selectedCategoryLetter, setSelectedCategoryLetter] = useState(params.category || '');
  const [selectedSubCategory, setSelectedSubCategory] = useState(params.subCategory || '');
  // Engineer-only: was category/subCategory already set (by the dealer, at
  // creation) before this screen ever loaded — distinct from
  // selectedCategoryLetter/selectedSubCategory themselves, which the
  // engineer's own in-progress picker also writes to. Read-only card shows
  // only for the former; picking live must never flip into that state.
  // Derived live off `task` (not a one-time flag set only in
  // loadPreviousData) so it can never desync from onRefresh/pull-to-refresh,
  // which re-fetches `task` on its own and previously left a stale flag
  // behind — the actual bug behind B/C/D/E sometimes falling back to the
  // unlocked full accordion after a refresh.
  //
  // Falls back to the nav params (task?.category ?? params.category) only
  // while `task` itself hasn't loaded yet — offline, before loadPreviousData
  // ever resolves (live or cached), `task` stays null and this used to
  // read as "nothing preset", showing the unlocked accordion even though
  // the category genuinely was preset at creation (selectedCategoryLetter/
  // selectedSubCategory above already showed the right values, just from
  // the wrong UI branch). The `task` fallback still wins the moment it
  // loads, real or cached, so this stays exactly as resilient to the
  // refresh-desync bug above as before.
  const presetCategory = task ? task.category : params.category;
  const presetSubCategory = task ? task.subCategory : params.subCategory;
  const categoryPresetAtCreation = !!presetCategory && !!presetSubCategory;
  // B/C/D/E's actual designed flow: dealer/AM set category at creation but
  // defer the sub-type to the engineer — distinct from categoryPresetAtCreation
  // above (both set) and from picking live in the unlocked accordion (neither
  // set). Drives a third Step 6 view: category locked, sub-type picker only.
  const categoryOnlyPresetAtCreation = !!presetCategory && !presetSubCategory;
  const [step6Saving, setStep6Saving] = useState(false);
  const [step6Success, setStep6Success] = useState(false);
  const [step6Error, setStep6Error] = useState('');
  // Billing Type — a second required pick that only applies to category B
  // (Warranty Repair) once the sub-type is "Breakdown" or "BIS". No
  // standalone save of its own — sent along with category/subCategory in
  // the single Complete/Send-for-Approval call, same as the sub-type pick
  // itself. Shared between the engineer's Complete flow and the
  // area_manager's Send-for-Approval flow below.
  const [billingType, setBillingType] = useState('');

  const toggleCategory = useCallback((letter: string) => {
    setExpandedCategory(prev => (prev === letter ? '' : letter));
  }, []);
  const selectSubCategory = useCallback((letter: string, sub: string) => {
    setSelectedCategoryLetter(letter);
    setSelectedSubCategory(sub);
  }, []);

  // Step 5's Suggestion Comment field, sent in the Complete/Send-for-Approval
  // call's body — shared between both flows below rather than duplicated.
  // Only appears when there's actually something to send, matching the
  // empty-guard pattern the commissioning form's own suggestionComment
  // already uses.
  const buildFinishExtras = useCallback(() => {
    const extras: Record<string, any> = {};
    const trimmedSuggestion = suggestionComment.trim();
    if (trimmedSuggestion) extras.suggestionComment = trimmedSuggestion;
    return extras;
  }, [suggestionComment]);

  const handleSendForApproval = useCallback(async () => {
    if (!selectedCategoryLetter || !selectedSubCategory) return;
    // Same Billing Type rule as the engineer's own version below — this
    // flow's category accordion lets any category's sub-type be picked,
    // unlike the engineer's locked-category branch, so this isn't scoped
    // to categoryOnlyPresetAtCreation here.
    const billingTypeRequired = (selectedCategoryLetter === 'B' && ['Breakdown', 'BIS'].includes(selectedSubCategory))
      || (selectedCategoryLetter === 'E' && selectedSubCategory === 'AMC Out Of Scope');
    if (billingTypeRequired && !billingType) return;
    // Photos/videos/PDFs already uploaded immediately when picked (see
    // mediaQueue/MediaUploadOverlay) — nothing left to upload here.
    // This dealer/AM action calls finishServiceTask directly (not
    // putOrQueue — see that function's own comment), so it needs its own
    // explicit location capture rather than getting it for free the way
    // every putOrQueue-backed action does.
    logLocationForAction(`Send For Approval (${formatAssetLabel(gensetSrNumber, engineNumber, taskId)})`);
    setStep6Saving(true);
    setStep6Error('');
    setStep6Success(false);
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      // Calls the same /finish endpoint the engineer's own Complete Task
      // uses (finishServiceTask below), not /work-approval/request —
      // /work-approval/request only submits the work-approval sub-object
      // and never actually moves the entry's own status off IN_PROGRESS,
      // which left AM's Complete Task looking like it did nothing (status
      // stayed IN_PROGRESS instead of COMPLETED). /finish is the call that
      // marks the entry COMPLETED and auto-seeds partApproval/workApproval,
      // and area_manager is one of its allowed roles per the dev guide.
      await finishServiceTask(token, taskId, {
        category: selectedCategoryLetter, subCategory: selectedSubCategory,
        ...(billingTypeRequired ? { billingType } : {}),
        ...buildFinishExtras(),
      });
      setStep6Success(true);
      // Deliberately NOT calling completeServiceTask (/service/:id/complete)
      // here — per the backend dev guide, that's a separate, optional
      // "mark work done" call, not part of this flow. The entry's real
      // "done" signal for service is reaching CLIENT_APPROVED via customer
      // OTP verify, which now happens on srTaskReport.tsx — nothing here
      // should force a further status change, and the task correctly stays
      // in the Active tab (via bucketTaskStatus) until that happens.
      //
      // Navigates straight to the report screen on success, same as
      // commissioning's own Complete action — OTP sign-off, Approval
      // Status, and Close Ticket all live there now, not back on this form.
      router.replace({
        pathname: '/screens/srTaskReport',
        params: { task: JSON.stringify({ _id: taskId, assetId }) },
      } as any);
    } catch (error: any) {
      setStep6Error(parseApiError(error, 'Failed to send for approval. Please try again.').message);
    } finally {
      setStep6Saving(false);
    }
  }, [taskId, assetId, selectedCategoryLetter, selectedSubCategory, billingType, buildFinishExtras, router, gensetSrNumber, engineNumber]);

  // ── Engineer-only Step 5 (formerly step 6): Complete via finish API ──
  // Category/sub-category come from the same selectedCategoryLetter/
  // selectedSubCategory state the accordion above uses — loadPreviousData
  // already pre-fills them when the dealer set category/subCategory at
  // creation, so `!!selectedCategoryLetter` after load doubles as "was this
  // already assigned" without a separate flag.
  const [categoryConfig, setCategoryConfig] = useState<FinishCategory[]>([]);
  const [categoryConfigLoading, setCategoryConfigLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');

  useEffect(() => {
    if (!isEngineer) return;
    (async () => {
      setCategoryConfigLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getServiceCategoryConfig(token);
        const list: FinishCategory[] = Array.isArray(data?.categories)
          ? data.categories.map((c: { letter: string; title: string; subCategories: string[] }) => ({
              ...c,
              ...(SERVICE_CATEGORY_META[c.letter] || FALLBACK_CATEGORY_META),
            }))
          : [];
        setCategoryConfig(list);
        await cacheData(CATEGORY_CONFIG_CACHE_KEY, list);
      } catch (error) {
        console.log('[SR Task Form] Failed to load category config:', error);
        // Offline — fall back to whatever this device last saw, so the
        // engineer's own Complete step still has categories/sub-categories
        // to pick from instead of coming up empty.
        if (isNetworkError(error)) {
          const cached = await getCachedData<FinishCategory[]>(CATEGORY_CONFIG_CACHE_KEY);
          if (cached) setCategoryConfig(cached.data);
        }
      } finally {
        setCategoryConfigLoading(false);
      }
    })();
  }, [isEngineer]);

  // Free Service (category A) eligibility — fetched eagerly alongside the
  // category list rather than on-select like newServiceJob.tsx, since here
  // it needs to gate the *category row itself* (disabled + reason, matching
  // the reference design) instead of just its sub-list.
  const [freeServiceItems, setFreeServiceItems] = useState<FreeServiceItem[]>([]);
  const [freeServiceLoading, setFreeServiceLoading] = useState(false);

  useEffect(() => {
    if (!isEngineer || !assetId) return;
    (async () => {
      setFreeServiceLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const items = await getFreeServiceAvailability(token, assetId);
        setFreeServiceItems(Array.isArray(items) ? items : []);
      } catch (error) {
        console.log('[SR Task Form] Failed to load free service availability:', error);
      } finally {
        setFreeServiceLoading(false);
      }
    })();
  }, [isEngineer, assetId]);

  const freeServiceEligible = freeServiceLoading || freeServiceItems.some((item) => item.canCreate);
  const freeServiceBlockedReason = freeServiceItems.find((item) => !item.canCreate)?.reason || 'Not available for this asset';

  // Complete calls finishServiceTask — the one call that marks the entry
  // COMPLETED and (server-side) seeds partApproval/workApproval as
  // applicable. Only category/subCategory go in the body; fault codes and
  // parts were already persisted earlier via save-progress in Steps 2-3.
  // Photos and videos (Step 4) have no save button of their own — they
  // upload immediately when picked (MediaUploadOverlay), same as the
  // commissioning form's pattern, so there's nothing left to upload here.
  const handleFinishService = useCallback(async () => {
    if (!selectedCategoryLetter || !selectedSubCategory) return;
    // Billing Type is only required for category B (Warranty Repair) once
    // Breakdown/BIS is the picked sub-type, or category E (CAMC) once "AMC
    // Out Of Scope" is picked — and only in the categoryOnlyPresetAtCreation
    // branch, the only one with a Billing Type field for the user to
    // actually fill in. Must match the screen's own needsBillingType
    // exactly — if this stayed narrower than what's rendered, a category-E
    // AMC Out Of Scope pick would let Complete fire before Billing Type was
    // actually filled in.
    const billingTypeRequired = categoryOnlyPresetAtCreation && (
      (selectedCategoryLetter === 'B' && ['Breakdown', 'BIS'].includes(selectedSubCategory))
      || (selectedCategoryLetter === 'E' && selectedSubCategory === 'AMC Out Of Scope')
    );
    if (billingTypeRequired && !billingType) return;
    // Photos/videos/PDFs already uploaded immediately when picked (see
    // mediaQueue/MediaUploadOverlay) — nothing left to upload here.
    setFinishing(true);
    setFinishError('');
    try {
      if (!taskId) return;
      // Queued like every other engineer save in this form — this is the
      // one action (including the Suggestion Comment bundled into it via
      // buildFinishExtras) that was still calling the API directly, so it
      // failed outright offline instead of syncing later like everything
      // else. Matches useTaskFormOtp.ts's handleMarkComplete on the
      // commissioning side exactly.
      const assetLabel = formatAssetLabel(gensetSrNumber, engineNumber, taskId);
      // Location is captured only at Start, photo upload, and Complete —
      // see the same note in syncEngine.ts's own putOrQueue.
      logLocationForAction(`Complete Service (${assetLabel})`);
      await putOrQueue(
        `/api/service/${taskId}/finish`,
        {
          category: selectedCategoryLetter, subCategory: selectedSubCategory,
          ...(billingTypeRequired ? { billingType } : {}),
          ...buildFinishExtras(),
        },
        `Complete Service (${assetLabel})`,
        `service_finish_${taskId}`,
        isEngineer
      );
      // Navigates straight to the report screen either way (queued or
      // synced live), same as commissioning's own Complete action — OTP
      // sign-off, Approval Status, and Close Ticket all live there now,
      // not back on this form.
      router.replace({
        pathname: '/screens/srTaskReport',
        params: { task: JSON.stringify({ _id: taskId, assetId }) },
      } as any);
    } catch (error: any) {
      setFinishError(parseApiError(error, 'Failed to complete this service. Please try again.').message);
    } finally {
      setFinishing(false);
    }
  }, [taskId, assetId, selectedCategoryLetter, selectedSubCategory, categoryOnlyPresetAtCreation, billingType, buildFinishExtras, router, isEngineer, gensetSrNumber, engineNumber]);

  // OTP generate/verify and Close Ticket both moved to srTaskReport.tsx —
  // handleFinishService/handleSendForApproval below navigate straight there
  // on success, matching commissioning's own pattern. scrollViewRef is kept
  // (Step 5's own comment field still uses it for keyboard scrolling).
  const scrollViewRef = useRef<any>(null);

  // ── Data loading ──
  const loadPreviousData = useCallback(async () => {
    setInitialDataLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      // No signal at the site — fall back to whatever this device last
      // loaded for this task/asset instead of leaving the form entirely
      // blank. Everything below already treats a null assetData/serviceData
      // as "nothing to prefill", so substituting the cached copies here
      // needs no other change to the rest of this function.
      let assetData: any = null;
      let serviceData: any = null;
      const cacheKey = `sr_task_${taskId || assetId}`;
      try {
        const [freshAsset, freshService] = await Promise.all([
          assetId ? getAssetById(token, assetId) : Promise.resolve(null),
          taskId ? getServiceTaskById(token, taskId) : Promise.resolve(null),
        ]);
        assetData = freshAsset;
        serviceData = freshService;
        await cacheData(cacheKey, { assetData, serviceData });
      } catch (fetchError: any) {
        if (!isNetworkError(fetchError)) throw fetchError;
        const cached = await getCachedData<{ assetData: any; serviceData: any }>(cacheKey);
        if (cached) {
          assetData = cached.data.assetData;
          serviceData = cached.data.serviceData;
        }
      }

      if (serviceData) {
        setTask(serviceData);
        setNotes(serviceData.notes ?? '');
        if (serviceData.category) setSelectedCategoryLetter(serviceData.category);
        if (serviceData.subCategory) setSelectedSubCategory(serviceData.subCategory);
        // Shows whatever was already uploaded in an earlier session — see
        // hydrateSitePhotos's own comment above. serviceData.media replaces
        // the old separate photos/videos fields (unified media[] model).
        if (serviceData.media?.length) {
          hydrateSitePhotos(serviceData.media);
        }
        // Reopening a task that's already COMPLETED — this form no longer
        // has anything to show once past that point (OTP sign-off/Approval
        // Status/Close Ticket all live on srTaskReport.tsx now), but the
        // dashboard/list arrow-press routing already sends COMPLETED tasks
        // there directly. Landing on Step 6's read-only category display
        // instead of Step 1 is still the more sensible fallback if this
        // screen is ever reached with one some other way.
        if (serviceData.status === 'COMPLETED') setCurrentStep(6);
      }

      // A section saved while offline (buildAssetPayload sends the whole
      // record under one dedupeKey here, unlike commissioning's per-section
      // split) sits queued until the next sync — overlay it on top of
      // whatever this fetch/cache returned so re-opening this screen before
      // that sync runs doesn't revert fields back to the stale pre-edit
      // server value. Only affects what gets written into form state below,
      // never the cache snapshot cached further up.
      if (assetData) {
        const pendingAsset = await getPendingBody(`sr_asset_${assetId}`);
        if (pendingAsset) assetData = { ...assetData, ...pendingAsset };
      }

      // Engine Parameters / Genset Electrical Reading / Running Hours /
      // Load Unbalance all live on the service entry itself
      // (engineParameters / gensetElectricalReadings / runningHours /
      // loadUnbalance + loadUnbalancePercentage), not the Asset record —
      // see saveServiceReadings above. Same "don't revert an unsynced
      // offline edit" overlay pattern as assetData below, one per
      // dedupeKey since each card saves independently.
      {
        let engineReadings = serviceData?.engineParameters || {};
        const pendingEngineReadings = await getPendingBody(`sr_readings_engineParams_${taskId}`);
        if (pendingEngineReadings?.engineParameters) engineReadings = { ...engineReadings, ...pendingEngineReadings.engineParameters };
        // savedBy/savedAt/serviceEntryId are write-only stamps the server
        // adds onto whatever was sent — strip them back out before they'd
        // otherwise land in editable form state.
        const { savedBy: _savedBy, savedAt: _savedAt, serviceEntryId: _seId, ...cleanEngineReadings } = engineReadings;
        setRpm(cleanEngineReadings.rpm != null ? String(cleanEngineReadings.rpm) : '');
        setFrequency(cleanEngineReadings.frequency != null ? String(cleanEngineReadings.frequency) : '');
        setDcVoltage(cleanEngineReadings.dcVoltage != null ? String(cleanEngineReadings.dcVoltage) : '');
        setOilPressure(cleanEngineReadings.oilPressure != null ? String(cleanEngineReadings.oilPressure) : '');
        setOilLevel(cleanEngineReadings.oilLevel ?? '');
        setOilLevelComment(cleanEngineReadings.oilLevelComment ?? '');
        setCoolantLevel(cleanEngineReadings.coolantLevel ?? '');
        setCoolantLevelComment(cleanEngineReadings.coolantLevelComment ?? '');
        setCoolantTemp(cleanEngineReadings.coolantTemperature != null ? String(cleanEngineReadings.coolantTemperature) : '');
        setDefLevel(cleanEngineReadings.defLevelPercentage != null ? String(cleanEngineReadings.defLevelPercentage) : '');

        let electricalReadings = serviceData?.gensetElectricalReadings || {};
        const pendingElectricalReadings = await getPendingBody(`sr_readings_electrical_${taskId}`);
        if (pendingElectricalReadings?.gensetElectricalReadings) electricalReadings = { ...electricalReadings, ...pendingElectricalReadings.gensetElectricalReadings };
        const { savedBy: _elSavedBy, savedAt: _elSavedAt, serviceEntryId: _elSeId, ...cleanElectricalReadings } = electricalReadings;
        setAcVoltRY(cleanElectricalReadings.acVoltageRY != null ? String(cleanElectricalReadings.acVoltageRY) : '');
        setAcVoltYB(cleanElectricalReadings.acVoltageYB != null ? String(cleanElectricalReadings.acVoltageYB) : '');
        setAcVoltBR(cleanElectricalReadings.acVoltageBR != null ? String(cleanElectricalReadings.acVoltageBR) : '');
        setAcAmpR(cleanElectricalReadings.acAmpR != null ? String(cleanElectricalReadings.acAmpR) : '');
        setAcAmpY(cleanElectricalReadings.acAmpY != null ? String(cleanElectricalReadings.acAmpY) : '');
        setAcAmpB(cleanElectricalReadings.acAmpB != null ? String(cleanElectricalReadings.acAmpB) : '');
        setLoadKwR(cleanElectricalReadings.loadKwR != null ? String(cleanElectricalReadings.loadKwR) : '');
        setLoadKwY(cleanElectricalReadings.loadKwY != null ? String(cleanElectricalReadings.loadKwY) : '');
        setLoadKwB(cleanElectricalReadings.loadKwB != null ? String(cleanElectricalReadings.loadKwB) : '');
        // Total Load KW / Load % are NOT set here — they're recomputed
        // live client-side from loadKwR/Y/B + kva (see the effects near
        // the top of this hook), matching the doc's own "computed
        // client-side, not independently editable" rule. Setting them
        // from the server's last-saved snapshot here would just get
        // immediately overwritten by that recompute anyway.

        let runningHoursValue = serviceData?.runningHours;
        const pendingRunningHours = await getPendingBody(`sr_readings_runningHours_${taskId}`);
        if (pendingRunningHours?.runningHours != null) runningHoursValue = pendingRunningHours.runningHours;
        setRunningHours(runningHoursValue != null ? String(runningHoursValue) : '');

        let loadUnbalanceValue = serviceData?.loadUnbalance;
        let loadUnbalancePercentageValue = serviceData?.loadUnbalancePercentage;
        const pendingLoadUnbalance = await getPendingBody(`sr_readings_loadUnbalance_${taskId}`);
        if (pendingLoadUnbalance) {
          if ('loadUnbalance' in pendingLoadUnbalance) loadUnbalanceValue = pendingLoadUnbalance.loadUnbalance;
          if ('loadUnbalancePercentage' in pendingLoadUnbalance) loadUnbalancePercentageValue = pendingLoadUnbalance.loadUnbalancePercentage;
        }
        setLoadUnbalance(loadUnbalanceValue ? 'Yes' : 'No');
        setLoadUnbalancePercentage(loadUnbalancePercentageValue != null ? String(loadUnbalancePercentageValue) : '');
      }

      if (assetData) {
        setAssetDetail(assetData);
        setGensetModel(assetData.gensetModel ?? '');
        setGensetSrNumber(assetData.gensetNumber ?? params.gensetNumber ?? '');
        setEngineModel(assetData.engineModel ?? '');
        setEngineNumber(assetData.engineNumber ?? params.engineNumber ?? '');
        setEngineKw(assetData.kw != null ? String(assetData.kw) : '');
        setEngineType(assetData.engineType ?? '');
        setEngineFamily(assetData.engineFamily ?? '');
        setFuelType(assetData.fuelType ?? '');
        setApplication(assetData.applicationMaterial ?? '');

        setAltMake(assetData.alternatorMake ?? '');
        setAltModel(assetData.alternatorModel ?? '');
        setAltSn(assetData.alternatorSerialNumber ?? '');
        setAtsSn(assetData.atsSerialNumber ?? '');
        setBatteryType(assetData.batteryType ?? '');
        setBatterySn(assetData.battery1SerialNumber ?? '');
        setBattery2Sn(assetData.battery2SerialNumber ?? '');
        setKva(assetData.kva ?? '');
        setPhase(assetData.phase ?? '');
        setPanelType(assetData.panelType ?? '');
        setPanelSn(assetData.controlPanelSerialNumber ?? '');
        setControllerType(assetData.controllerType ?? '');
        setControllerSr(assetData.controllerSerialNumber ?? '');
        setCpcbNorm(assetData.cpcb ?? '');
      }

      if (serviceData?.faultCodes?.length) {
        setSelectedComplaintCodes(serviceData.faultCodes.map((entry: any, index: number) => ({
          uid: `${entry.codeId?._id || index}-${Date.now()}-${index}`,
          codeId: entry.codeId?._id,
          code: entry.codeId?.code,
          priority: entry.codeId?.priority,
          title: entry.codeId?.description,
          categoryName: entry.codeId?.category,
          subcategoryName: entry.codeId?.subCategory,
          observation: entry.observation ?? '',
          rootCause: entry.rootCause ?? '',
          correctiveAction: entry.correctiveAction ?? '',
        })));
      }

      if (serviceData?.partsUsed?.length) {
        setSelectedParts(serviceData.partsUsed.map((entry: any) => ({
          partId: entry.partId?._id,
          code: entry.partId?.code,
          name: entry.partId?.name,
          unit: entry.partId?.unit,
          category: entry.partId?.category,
          subCategory: entry.partId?.subCategory,
          quantity: entry.quantity ?? 1,
        })));
      }
    } catch (error) {
      console.log('[SR Task Form] Failed to load previous data:', error);
    } finally {
      setInitialDataLoading(false);
    }
  }, [assetId, taskId, params.gensetNumber, params.engineNumber, hydrateSitePhotos]);

  const loadFaultCodesAndParts = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      setFaultCodesLoading(true);
      setPartsLoading(true);
      const [faultCodesData, partsData] = await Promise.all([getFaultCodes(token), getParts(token)]);
      setApiFaultCodes(faultCodesData);
      setApiParts(partsData);
      // Same cache the commissioning form's useTaskFormApiData.ts writes to —
      // one shared "last known good" copy of these backend-wide lists serves
      // both forms offline.
      await Promise.all([cacheData('faultCodes', faultCodesData), cacheData('parts', partsData)]);
    } catch (error) {
      console.log('[SR Task Form] Failed to load fault codes / parts:', error);
      if (isNetworkError(error)) {
        const [cachedFaultCodes, cachedParts] = await Promise.all([
          getCachedData<ApiFaultCode[]>('faultCodes'),
          getCachedData<ApiPart[]>('parts'),
        ]);
        if (cachedFaultCodes) setApiFaultCodes(cachedFaultCodes.data);
        if (cachedParts) setApiParts(cachedParts.data);
      }
    } finally {
      setFaultCodesLoading(false);
      setPartsLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      const serviceData = await getServiceTaskById(token, taskId);
      if (serviceData) setTask((prev: any) => ({ ...prev, ...serviceData }));
      if (serviceData?.category) setSelectedCategoryLetter(serviceData.category);
      if (serviceData?.subCategory) setSelectedSubCategory(serviceData.subCategory);
      if (serviceData?.notes != null) setNotes(serviceData.notes);
    } catch (error) {
      console.log('[SR Task Form] Pull-to-refresh failed:', error);
      Alert.alert('Error', 'Failed to refresh. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadPreviousData();
    loadFaultCodesAndParts();
    // Both loaders read fresh closures over assetId/taskId internally and
    // are only meant to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The approval-status polling that used to live here (for the removed
  // Step 5 waiting banner) moved to srTaskReportController.ts, which polls
  // the same way while task.workApproval.status is PENDING_AM/PENDING_RSM.

  // ── Navigation ──
  const handleBack = useCallback(() => setCurrentStep(prev => Math.max(1, prev - 1)), []);
  const handleNext = useCallback(() => setCurrentStep(prev => Math.min(6, prev + 1)), []);
  // OTP verification (and the special-cased "force a fresh list reload"
  // this used to need once it happened mid-session) both moved to
  // srTaskReport.tsx — this screen never changes the task's status past
  // COMPLETED itself, so a plain back() is always correct here now.
  const handleCancel = useCallback(() => router.back(), [router]);
  // Where the completion success screen's "DONE" button lands — this form
  // is service-only (the commissioning equivalent is taskForm.tsx), so it
  // always goes to the Services list.
  const goToServiceList = useCallback(() => router.replace('/screens/serviceTasks' as any), [router]);

  return {
    params, currentStep, setCurrentStep, initialDataLoading, refreshing, onRefresh, profile, task, isEngineer,

    // Step 1
    gensetModel, setGensetModel, gensetSrNumber, setGensetSrNumber, assetDetail, engineModel, setEngineModel,
    engineNumber, setEngineNumber, engineKw, setEngineKw, engineType, setEngineType, engineFamily, setEngineFamily,
    fuelType, setFuelType, application, setApplication,
    altMake, setAltMake, altModel, setAltModel, altSn, setAltSn, atsSn, setAtsSn,
    batteryType, setBatteryType, batterySn, setBatterySn, battery2Sn, setBattery2Sn,
    kva, setKva, phase, setPhase, panelType, setPanelType,
    panelSn, setPanelSn, controllerType, setControllerType, controllerSr, setControllerSr,
    cpcbNorm, setCpcbNorm, loadUnbalance, setLoadUnbalance,
    loadUnbalancePercentage, setLoadUnbalancePercentage, loadUnbalanceComment, setLoadUnbalanceComment,
    acVoltRY, setAcVoltRY, acVoltYB, setAcVoltYB, acVoltBR, setAcVoltBR,
    acAmpR, setAcAmpR, acAmpY, setAcAmpY, acAmpB, setAcAmpB,
    loadKwR, setLoadKwR, loadKwY, setLoadKwY, loadKwB, setLoadKwB,
    totalKw, setTotalKw, loadPercent, setLoadPercent,
    rpm, setRpm, frequency, setFrequency, dcVoltage, setDcVoltage, oilPressure, setOilPressure,
    oilLevel, setOilLevel, oilLevelComment, setOilLevelComment,
    coolantLevel, setCoolantLevel, coolantLevelComment, setCoolantLevelComment,
    coolantTemp, setCoolantTemp, defLevel, setDefLevel,
    runningHours, setRunningHours, handleSaveRunningHours,
    handleSaveEngineParams, handleSaveGensetElectricalReadings, handleSaveLoadUnbalance,
    sectionSaving, sectionSuccess, sectionError, handleSaveAssetSection,
    ENGINE_TYPE_OPTIONS, ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS,
    PHASE_OPTIONS, PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,

    // Step 2
    apiFaultCodes, faultCodesLoading, selectedComplaintCodes, complaintPickerVisible, setComplaintPickerVisible,
    handleSelectComplaintCode, handleRemoveComplaintCode, handleChangeComplaintObservation,
    handleChangeComplaintRootCause, handleChangeComplaintCorrectiveAction,
    step2Saving, step2Success, step2Error, handleSaveFaultCodes,

    // Step 3
    apiParts, partsLoading, selectedParts, partPickerVisible, setPartPickerVisible,
    handleSelectPart, handleIncreaseQty, handleDecreaseQty, handleRemovePart,
    step3Saving, step3Success, step3Error, handleSavePartsUsed,

    // Step 4
    sitePhotos, photoOptionsVisible, setPhotoOptionsVisible, handleTakePhoto, handleRecordVideo, handleChoosePhotos, handlePickPdf, handleRemovePhoto,
    // Real-time upload state/controls for MediaUploadOverlay, see useMediaUploadQueue.
    mediaUploadQueue: mediaQueue,
    // Running Hours' own single photo — see its own comment above.
    runningHoursPhotos, runningHoursPhotoOptionsVisible, setRunningHoursPhotoOptionsVisible,
    handleTakeRunningHoursPhoto, handleChooseRunningHoursPhotos, handleRemoveRunningHoursPhoto,
    runningHoursUploadQueue: runningHoursQueue,
    handleUpdateMediaTag,

    // Step 5
    notes, setNotes, step5Saving, step5Success, step5Error, handleSaveNotes,
    suggestionComment, setSuggestionComment,

    // Step 6
    expandedCategory, selectedCategoryLetter, selectedSubCategory,
    toggleCategory, selectSubCategory, step6Saving, step6Success, step6Error, handleSendForApproval,
    categoryPresetAtCreation, categoryOnlyPresetAtCreation,
    billingType, setBillingType,

    // Step 6 — engineer-only Complete/finish flow
    categoryConfig, categoryConfigLoading, finishing, finishError, handleFinishService,
    freeServiceEligible, freeServiceBlockedReason, freeServiceLoading,
    scrollViewRef,

    // Navigation
    handleBack, handleNext, handleCancel, goToServiceList,
  };
}
