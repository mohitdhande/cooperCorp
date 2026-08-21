import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../utils/tokenStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  getAssetById, getServiceTaskById, getFaultCodes, getParts,
  uploadServicePhotos, uploadOneServiceVideoOrPdf, getGcsSignedUrls,
  getServiceCategoryConfig, finishServiceTask, getFreeServiceAvailability,
} from '../../viewModel/commisionAPi';
import { cacheData, getCachedData } from '../../utils/offlineCache';
import { putOrQueue, isNetworkError } from '../../utils/syncEngine';
import { getPendingBody } from '../../utils/offlineQueue';
import { ApiFaultCode, ApiPart, SelectedComplaintCode, SelectedPart, SitePhoto } from '../../models/taskForm.types';
import { UserProfile } from '../../models/Login';
import { getRole } from '../../constants/permissions';
import {
  ENGINE_TYPE_OPTIONS, ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS,
  PHASE_OPTIONS, PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,
  SERVICE_CATEGORY_META,
} from '../../_components/srTaskForm/srDropdownOptions';
import { parseApiError } from '../../utils/apiError';
import { getPhotoValidationError, partitionValidPhotos, getPdfValidationError } from '../../utils/photoValidation';
import { videoFileName } from '../../utils/reportFormatters';
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

const FALLBACK_CATEGORY_META = { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', description: '' };

export const SR_STEP_SEQUENCE = [1, 2, 3, 4, 5];

const toNum = (val: string): number | null => (val === '' || val === undefined ? null : Number(val));

// Main orchestration hook for the SR (service) task form — a 6-step wizard.
// Step 1's asset fields are genuinely heterogeneous (not a repeated
// checklist pattern like the commissioning form), so they stay as
// individual useState, matching how Cooper models them.
export function useSrTaskForm() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    taskId?: string; assetId?: string; gensetNumber?: string; engineNumber?: string;
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
  const [batterySn, setBatterySn] = useState('');
  const [kva, setKva] = useState('');
  const [phase, setPhase] = useState('');
  const [panelType, setPanelType] = useState('');
  const [panelSn, setPanelSn] = useState('');
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

  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({});
  const [sectionError, setSectionError] = useState<Record<string, string>>({});

  // Builds the full asset payload from ALL step-1 fields, since the API is
  // one PUT for the whole record — every section's Save button sends the
  // same full payload, just tracked with its own loading/success state.
  const buildAssetPayload = useCallback(() => ({
    loadUnbalance: loadUnbalance === 'Yes',
    gensetNumber: gensetSrNumber,
    engineNumber,
    applicationMaterial: application,
    engineFamily, engineModel, engineType, fuelType, gensetModel,
    kw: engineKw,
    alternatorMake: altMake, alternatorModel: altModel, alternatorSerialNumber: altSn,
    atsSerialNumber: atsSn, batterySerialNumber: batterySn, controlPanelSerialNumber: panelSn,
    cpcb: cpcbNorm, kva,
    loadUnbalanceComment: loadUnbalance === 'No' ? (loadUnbalanceComment || null) : null,
    loadUnbalancePercentage: loadUnbalance === 'Yes' ? toNum(loadUnbalancePercentage) : null,
    panelType, phase,
    acAmpB: toNum(acAmpB), acAmpR: toNum(acAmpR), acAmpY: toNum(acAmpY),
    acVoltageBR: toNum(acVoltBR), acVoltageRY: toNum(acVoltRY), acVoltageYB: toNum(acVoltYB),
    loadKwB: toNum(loadKwB), loadKwR: toNum(loadKwR), loadKwY: toNum(loadKwY),
    loadPercentage: toNum(loadPercent), totalKwLoad: toNum(totalKw),
    coolantLevel, coolantTemperature: toNum(coolantTemp),
    coolantLevelComment: coolantLevel === 'Not OK' ? (coolantLevelComment || null) : null,
    dcVoltage: toNum(dcVoltage), defLevelPercentage: toNum(defLevel),
    frequency: toNum(frequency), oilLevel, oilPressure: toNum(oilPressure), rpm: toNum(rpm),
    oilLevelComment: oilLevel === 'Not OK' ? (oilLevelComment || null) : null,
  }), [
    loadUnbalance, gensetSrNumber, engineNumber, application, engineFamily, engineModel, engineType,
    fuelType, gensetModel, engineKw, altMake, altModel, altSn, atsSn, batterySn, panelSn, cpcbNorm, kva,
    loadUnbalanceComment, loadUnbalancePercentage, panelType, phase,
    acAmpB, acAmpR, acAmpY, acVoltBR, acVoltRY, acVoltYB, loadKwB, loadKwR, loadKwY, loadPercent, totalKw,
    coolantLevel, coolantLevelComment, coolantTemp, dcVoltage, defLevel, frequency, oilLevel, oilLevelComment, oilPressure, rpm,
  ]);

  const handleSaveAssetSection = useCallback(async (sectionKey: string) => {
    setSectionSaving(prev => ({ ...prev, [sectionKey]: true }));
    setSectionError(prev => ({ ...prev, [sectionKey]: '' }));
    setSectionSuccess(prev => ({ ...prev, [sectionKey]: false }));
    try {
      if (!assetId) return;
      // Always the whole record (see buildAssetPayload's own comment) —
      // one dedupeKey covers every section's save button here, unlike
      // commissioning's per-section partial saves.
      await putOrQueue(`/api/assets/${assetId}`, buildAssetPayload(), `Asset details (Asset ${assetId})`, `sr_asset_${assetId}`, isEngineer);
      setSectionSuccess(prev => ({ ...prev, [sectionKey]: true }));
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to save. Please try again.');
      setSectionError(prev => ({ ...prev, [sectionKey]: message }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  }, [assetId, buildAssetPayload, isEngineer]);

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

  const handleSaveFaultCodes = useCallback(async () => {
    setStep2Saving(true);
    setStep2Error('');
    setStep2Success(false);
    try {
      if (!taskId) return;
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
        `Fault Codes (Task ${taskId})`,
        `sr_faultcodes_${taskId}`,
        isEngineer
      );
      setStep2Success(true);
    } catch (error: any) {
      setStep2Error(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setStep2Saving(false);
    }
  }, [taskId, selectedComplaintCodes, isEngineer]);

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
      await putOrQueue(
        `/api/service/${taskId}/save-progress`,
        { partsUsed: parts.map((part) => ({ partId: part.partId, quantity: part.quantity })) },
        `Parts Used (Task ${taskId})`,
        `sr_parts_${taskId}`,
        isEngineer
      );
      setStep3Success(true);
    } catch (error: any) {
      setStep3Error(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setStep3Saving(false);
    }
  }, [taskId, selectedParts, isEngineer]);

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
        ? prev.map(p => (p.partId === part._id ? { ...p, quantity: p.quantity + 1 } : p))
        : [...prev, {
            partId: part._id, code: part.code, name: part.name, unit: part.unit,
            category: part.category, subCategory: part.subCategory, quantity: 1,
          }];
      debouncedSaveParts(next);
      return next;
    });
    setPartPickerVisible(false);
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

  // ── Step 4: Photos & Video ──
  const [sitePhotos, setSitePhotos] = useState<SitePhoto[]>([]);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);

  function toSitePhoto(item: QueueItem): SitePhoto {
    return { id: item.localId, uri: item.uri, fileName: item.fileName, mediaType: item.kind === 'photo' ? 'image' : item.kind, fileSize: item.fileSize };
  }

  const mediaUploaders = useMemo(() => ({
    uploadPhoto: async (file: { uri: string; fileName: string }, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      await uploadServicePhotos(token, taskId, [file], onProgress, signal);
    },
    uploadVideoOrPdf: async (file: { uri: string; fileName: string }, onProgress: (percent: number) => void, signal: AbortSignal) => {
      const token = await getToken();
      if (!token || !taskId) throw new Error('Not authenticated.');
      await uploadOneServiceVideoOrPdf(token, taskId, file, onProgress, signal);
    },
  }), [taskId]);

  const mediaQueue = useMediaUploadQueue(
    mediaUploaders,
    useCallback((item: QueueItem) => setSitePhotos((prev) => [...prev, toSitePhoto(item)]), [])
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
  // the backend, so picked PDFs are tagged mediaType: 'pdf' and ride the
  // same GCS-sign + confirm flow as videos (uploadOneServiceVideoOrPdf).
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

  // Shows whatever was already uploaded in an earlier session — called once
  // when the task detail first loads (see loadPreviousData below), so
  // reopening a task you'd already added photos/videos/PDFs to doesn't look
  // empty just because this session's own sitePhotos state starts fresh.
  // Unlike commissioning, service keeps photos and videos in two separate
  // server fields already (photosUrls/videosUrls) — PDFs still ride the
  // videos field, split out by their .pdf extension, same as
  // srTaskReportController.ts's own read-side split. Photos need a signed
  // URL to actually render as a thumbnail (private GCS bucket); video/PDF
  // rows only ever show a filename/icon, so the raw URL is fine for those.
  const hydrateSitePhotos = useCallback(async (photosUrls: string[], videosUrls: string[]) => {
    if (photosUrls.length === 0 && videosUrls.length === 0) return;
    const realVideoUrls = videosUrls.filter((url) => !url.toLowerCase().split('?')[0].endsWith('.pdf'));
    const pdfUrls = videosUrls.filter((url) => url.toLowerCase().split('?')[0].endsWith('.pdf'));

    let signedPhotoUrls: Record<string, string> = {};
    if (photosUrls.length > 0) {
      try {
        const token = await getToken();
        if (token) signedPhotoUrls = await getGcsSignedUrls(token, photosUrls);
      } catch (error) {
        console.log('[SR Task Form Photos] Failed to sign previously-uploaded photo URLs:', error);
      }
    }

    const hydrated: SitePhoto[] = [
      ...photosUrls.map((url) => ({ id: url, uri: signedPhotoUrls[url] || url, fileName: videoFileName(url), mediaType: 'image' as const })),
      ...realVideoUrls.map((url) => ({ id: url, uri: url, fileName: videoFileName(url), mediaType: 'video' as const })),
      ...pdfUrls.map((url) => ({ id: url, uri: url, fileName: videoFileName(url), mediaType: 'pdf' as const })),
    ];
    setSitePhotos((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      return [...prev, ...hydrated.filter((p) => !existingIds.has(p.id))];
    });
  }, []);

  // ── Step 5: Notes ──
  const [notes, setNotes] = useState('');

  // Step 3's own Work Notes + Suggestion Comment + Voice of Customer fields.
  // workNotes is deliberately its own always-blank-at-mount state, not an
  // editor for `notes` above — `notes` pre-fills from whatever was already
  // saved for this task, and this field shouldn't show up pre-filled with
  // that.
  const [workNotes, setWorkNotes] = useState('');
  const [suggestionComment, setSuggestionComment] = useState('');
  const [voiceOfCustomerName, setVoiceOfCustomerName] = useState('');
  const [voiceOfCustomerRating, setVoiceOfCustomerRating] = useState(0);
  const [voiceOfCustomerRemark, setVoiceOfCustomerRemark] = useState('');

  const [step5Saving, setStep5Saving] = useState(false);
  const [step5Success, setStep5Success] = useState(false);
  const [step5Error, setStep5Error] = useState('');

  const handleSaveNotes = useCallback(async () => {
    setStep5Saving(true);
    setStep5Error('');
    setStep5Success(false);
    try {
      if (!taskId) return;
      await putOrQueue(`/api/service/${taskId}/save-progress`, { notes }, `Notes (Task ${taskId})`, `sr_notes_${taskId}`, isEngineer);
      setStep5Success(true);
    } catch (error: any) {
      setStep5Error(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setStep5Saving(false);
    }
  }, [taskId, notes, isEngineer]);

  // ── Step 5 (formerly step 6): Category & Approval — the state/variable
  // names below still say "step6" (not renamed to avoid a wide, purely
  // cosmetic diff), but this is the screen's Step 5 now. ──
  const [expandedCategory, setExpandedCategory] = useState('');
  const [selectedCategoryLetter, setSelectedCategoryLetter] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
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
  const categoryPresetAtCreation = !!task?.category && !!task?.subCategory;
  // B/C/D/E's actual designed flow: dealer/AM set category at creation but
  // defer the sub-type to the engineer — distinct from categoryPresetAtCreation
  // above (both set) and from picking live in the unlocked accordion (neither
  // set). Drives a third Step 6 view: category locked, sub-type picker only.
  const categoryOnlyPresetAtCreation = !!task?.category && !task?.subCategory;
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

  // Step 3's Notes/Suggestion Comment/Voice of Customer fields, sent
  // together in the Complete/Send-for-Approval call's body — shared between
  // both flows below rather than duplicated. Each key only appears when
  // there's actually something to send, matching the empty-guard pattern
  // the commissioning form's own suggestionComment already uses.
  const buildFinishExtras = useCallback(() => {
    const extras: Record<string, any> = {};
    const trimmedNotes = workNotes.trim();
    const trimmedSuggestion = suggestionComment.trim();
    const trimmedRemark = voiceOfCustomerRemark.trim();
    const trimmedCustomerName = voiceOfCustomerName.trim();
    if (trimmedNotes) extras.notes = trimmedNotes;
    if (trimmedSuggestion) extras.suggestionComment = trimmedSuggestion;
    if (trimmedCustomerName || voiceOfCustomerRating || trimmedRemark) {
      extras.customerFeedback = {
        customerName: trimmedCustomerName,
        rating: voiceOfCustomerRating,
        comment: trimmedRemark,
        submittedAt: new Date().toISOString(),
      };
    }
    return extras;
  }, [workNotes, suggestionComment, voiceOfCustomerName, voiceOfCustomerRating, voiceOfCustomerRemark]);

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
  }, [taskId, assetId, selectedCategoryLetter, selectedSubCategory, billingType, buildFinishExtras, router]);

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
      } catch (error) {
        console.log('[SR Task Form] Failed to load category config:', error);
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
  // upload here, right before completing, same as the commissioning form's
  // pattern.
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
      const token = await getToken();
      if (!token || !taskId) return;
      await finishServiceTask(token, taskId, {
        category: selectedCategoryLetter, subCategory: selectedSubCategory,
        ...(billingTypeRequired ? { billingType } : {}),
        ...buildFinishExtras(),
      });
      // Navigates straight to the report screen on success, same as
      // commissioning's own Complete action — OTP sign-off, Approval
      // Status, and Close Ticket all live there now, not back on this form.
      router.replace({
        pathname: '/screens/srTaskReport',
        params: { task: JSON.stringify({ _id: taskId, assetId }) },
      } as any);
    } catch (error: any) {
      setFinishError(parseApiError(error, 'Failed to complete this service. Please try again.').message);
    } finally {
      setFinishing(false);
    }
  }, [taskId, assetId, selectedCategoryLetter, selectedSubCategory, categoryOnlyPresetAtCreation, billingType, buildFinishExtras, router]);

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
        // hydrateSitePhotos's own comment above.
        if (serviceData.photos?.length || serviceData.videos?.length) {
          hydrateSitePhotos(serviceData.photos || [], serviceData.videos || []);
        }
        // Reopening a task that's already COMPLETED — this form no longer
        // has anything to show once past that point (OTP sign-off/Approval
        // Status/Close Ticket all live on srTaskReport.tsx now), but the
        // dashboard/list arrow-press routing already sends COMPLETED tasks
        // there directly. Landing on Step 5's read-only category display
        // instead of Step 1 is still the more sensible fallback if this
        // screen is ever reached with one some other way.
        if (serviceData.status === 'COMPLETED') setCurrentStep(5);
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
        setBatterySn(assetData.batterySerialNumber ?? '');
        setKva(assetData.kva ?? '');
        setPhase(assetData.phase ?? '');
        setPanelType(assetData.panelType ?? '');
        setPanelSn(assetData.controlPanelSerialNumber ?? '');
        setCpcbNorm(assetData.cpcb ?? '');
        setLoadUnbalance(assetData.loadUnbalance ? 'Yes' : 'No');
        setLoadUnbalancePercentage(assetData.loadUnbalancePercentage != null ? String(assetData.loadUnbalancePercentage) : '');
        setLoadUnbalanceComment(assetData.loadUnbalanceComment ?? '');

        setAcVoltRY(assetData.acVoltageRY != null ? String(assetData.acVoltageRY) : '');
        setAcVoltYB(assetData.acVoltageYB != null ? String(assetData.acVoltageYB) : '');
        setAcVoltBR(assetData.acVoltageBR != null ? String(assetData.acVoltageBR) : '');
        setAcAmpR(assetData.acAmpR != null ? String(assetData.acAmpR) : '');
        setAcAmpY(assetData.acAmpY != null ? String(assetData.acAmpY) : '');
        setAcAmpB(assetData.acAmpB != null ? String(assetData.acAmpB) : '');
        setLoadKwR(assetData.loadKwR != null ? String(assetData.loadKwR) : '');
        setLoadKwY(assetData.loadKwY != null ? String(assetData.loadKwY) : '');
        setLoadKwB(assetData.loadKwB != null ? String(assetData.loadKwB) : '');
        setTotalKw(assetData.totalKwLoad != null ? String(assetData.totalKwLoad) : '');
        setLoadPercent(assetData.loadPercentage != null ? String(assetData.loadPercentage) : '');

        setRpm(assetData.rpm != null ? String(assetData.rpm) : '');
        setFrequency(assetData.frequency != null ? String(assetData.frequency) : '');
        setDcVoltage(assetData.dcVoltage != null ? String(assetData.dcVoltage) : '');
        setOilPressure(assetData.oilPressure != null ? String(assetData.oilPressure) : '');
        setOilLevel(assetData.oilLevel ?? '');
        setOilLevelComment(assetData.oilLevelComment ?? '');
        setCoolantLevel(assetData.coolantLevel ?? '');
        setCoolantLevelComment(assetData.coolantLevelComment ?? '');
        setCoolantTemp(assetData.coolantTemperature != null ? String(assetData.coolantTemperature) : '');
        setDefLevel(assetData.defLevelPercentage != null ? String(assetData.defLevelPercentage) : '');
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
    } catch (error) {
      console.log('[SR Task Form] Failed to load fault codes / parts:', error);
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
  const handleNext = useCallback(() => setCurrentStep(prev => Math.min(5, prev + 1)), []);
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
    batterySn, setBatterySn, kva, setKva, phase, setPhase, panelType, setPanelType,
    panelSn, setPanelSn, cpcbNorm, setCpcbNorm, loadUnbalance, setLoadUnbalance,
    loadUnbalancePercentage, setLoadUnbalancePercentage, loadUnbalanceComment, setLoadUnbalanceComment,
    acVoltRY, setAcVoltRY, acVoltYB, setAcVoltYB, acVoltBR, setAcVoltBR,
    acAmpR, setAcAmpR, acAmpY, setAcAmpY, acAmpB, setAcAmpB,
    loadKwR, setLoadKwR, loadKwY, setLoadKwY, loadKwB, setLoadKwB,
    totalKw, setTotalKw, loadPercent, setLoadPercent,
    rpm, setRpm, frequency, setFrequency, dcVoltage, setDcVoltage, oilPressure, setOilPressure,
    oilLevel, setOilLevel, oilLevelComment, setOilLevelComment,
    coolantLevel, setCoolantLevel, coolantLevelComment, setCoolantLevelComment,
    coolantTemp, setCoolantTemp, defLevel, setDefLevel,
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

    // Step 5
    notes, setNotes, step5Saving, step5Success, step5Error, handleSaveNotes,
    workNotes, setWorkNotes,
    suggestionComment, setSuggestionComment,
    voiceOfCustomerName, setVoiceOfCustomerName,
    voiceOfCustomerRating, setVoiceOfCustomerRating,
    voiceOfCustomerRemark, setVoiceOfCustomerRemark,

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
