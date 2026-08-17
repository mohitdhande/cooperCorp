import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../utils/tokenStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  getAssetById, getServiceTaskById, getFaultCodes, getParts,
  uploadServicePhotos, uploadServiceVideos,
  generateServiceOtp, verifyServiceOtp, closeServiceTask,
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
  const [photosUploading, setPhotosUploading] = useState(false);
  const [photosUploadProgress, setPhotosUploadProgress] = useState(0);
  const [photosUploadSuccess, setPhotosUploadSuccess] = useState(false);
  const [photosUploadError, setPhotosUploadError] = useState('');
  const [videosUploading, setVideosUploading] = useState(false);
  const [videosUploadProgress, setVideosUploadProgress] = useState(0);
  const [videosUploadSuccess, setVideosUploadSuccess] = useState(false);
  const [videosUploadError, setVideosUploadError] = useState('');

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
        setSitePhotos(prev => [...prev, {
          id: `${Date.now()}`,
          uri: asset.uri,
          fileName: asset.fileName || `${isVideo ? 'video' : 'photo'}_${prev.length + 1}.${isVideo ? 'mp4' : 'jpg'}`,
          mediaType: isVideo ? 'video' : 'image',
          fileSize: asset.fileSize,
        }]);
      }
    } catch (error) {
      // A native picker/camera failure would otherwise fail silently — the
      // button tap would just do nothing with no feedback.
      console.log('[SR Task Form Photos] Camera failed:', error);
      Alert.alert('Camera unavailable', 'Could not open the camera. Please try again.');
    }
  }, []);

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
        const newPhotos = valid.map((asset, i) => {
          const isVideo = asset.type === 'video';
          return {
            id: `${Date.now()}-${i}`,
            uri: asset.uri,
            fileName: asset.fileName || `${isVideo ? 'video' : 'photo'}_${i + 1}.${isVideo ? 'mp4' : 'jpg'}`,
            mediaType: (isVideo ? 'video' : 'image') as 'image' | 'video',
            fileSize: asset.fileSize,
          };
        });
        setSitePhotos(prev => [...prev, ...newPhotos]);
        if (skippedMessage) Alert.alert('Some items were skipped', skippedMessage);
      }
    } catch (error) {
      console.log('[SR Task Form Photos] Gallery picker failed:', error);
      Alert.alert('Gallery unavailable', 'Could not open the gallery. Please try again.');
    }
  }, []);

  // Documents card's own picker — device storage only (no camera option;
  // a PDF can't be "captured"). No dedicated document endpoint exists on
  // the backend, so picked PDFs are tagged mediaType: 'pdf' and ride the
  // same photo-only multipart call as images (handleSaveAllPhotos below) —
  // uploadServicePhotos already maps a .pdf extension to application/pdf.
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
      const newPdfs = valid.map((asset, i) => ({
        id: `${Date.now()}-${i}`,
        uri: asset.uri,
        fileName: asset.name || `document_${i + 1}.pdf`,
        mediaType: 'pdf' as const,
        fileSize: asset.size,
      }));
      setSitePhotos(prev => [...prev, ...newPdfs]);

      const skippedCount = result.assets.length - valid.length;
      if (skippedCount > 0) {
        Alert.alert('Some files were skipped', `${skippedCount} file${skippedCount > 1 ? 's were' : ' was'} skipped: ${Array.from(reasons).join(' ')}`);
      }
    } catch (error) {
      console.log('[SR Task Form Photos] PDF picker failed:', error);
      Alert.alert('Storage unavailable', 'Could not open device storage. Please try again.');
    }
  }, []);

  const handleRemovePhoto = useCallback((id: string) => {
    setSitePhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  // Returns a boolean so handleFinishService (below) can gate on it — no
  // separate save button for photos anymore, this is only ever called from
  // there now, right before completing.
  const handleSaveAllPhotos = useCallback(async () => {
    // Videos AND PDFs go through their own handleSaveAllVideos (GCS
    // upload+confirm flow, no multipart endpoint for either) — excluded
    // here so they aren't sent to this image-only upload call. See
    // SitePhoto.mediaType.
    const photosOnly = sitePhotos.filter(p => p.mediaType !== 'video' && p.mediaType !== 'pdf');
    // No photos is a no-op success now, not a blocking error — same
    // optional-by-default treatment as handleSaveAllVideos below. A
    // video/PDF-only submission (no actual photo) should never get stuck
    // behind a "please add a photo" requirement.
    if (photosOnly.length === 0) return true;
    setPhotosUploading(true);
    setPhotosUploadProgress(0);
    setPhotosUploadError('');
    setPhotosUploadSuccess(false);
    try {
      const token = await getToken();
      if (!token || !taskId) return false;
      await uploadServicePhotos(token, taskId, photosOnly.map(p => ({ uri: p.uri, fileName: p.fileName })), setPhotosUploadProgress);
      setPhotosUploadSuccess(true);
      return true;
    } catch (error: any) {
      setPhotosUploadError(parseApiError(error, 'Failed to upload photos. Please try again.').message);
      return false;
    } finally {
      setPhotosUploading(false);
    }
  }, [taskId, sitePhotos]);

  // Videos (and PDFs — see below) are optional (unlike photos, which are
  // required before finishing) — none added is just a no-op success, not
  // an error. Each file uploads to GCS and confirms individually inside
  // uploadServiceVideos, so a failure partway through still keeps whatever
  // confirmed successfully; the remaining (still-local) items stay in
  // sitePhotos for the user to retry via the same Complete tap.
  //
  // PDFs ride this exact same GCS-sign + confirm flow as videos (per
  // request: same array, same URL mechanism the backend uses for videos —
  // not the photos multipart endpoint) — they land in task.videos
  // alongside real videos, distinguishable there only by their .pdf
  // extension. The Report/Detail screens split them back out by extension
  // into their own Documents section.
  const handleSaveAllVideos = useCallback(async () => {
    const videosOnly = sitePhotos.filter(p => p.mediaType === 'video' || p.mediaType === 'pdf');
    if (videosOnly.length === 0) return true;
    setVideosUploading(true);
    setVideosUploadProgress(0);
    setVideosUploadError('');
    setVideosUploadSuccess(false);
    try {
      const token = await getToken();
      if (!token || !taskId) return false;
      await uploadServiceVideos(token, taskId, videosOnly.map(v => ({ uri: v.uri, fileName: v.fileName })), setVideosUploadProgress);
      setVideosUploadSuccess(true);
      return true;
    } catch (error: any) {
      setVideosUploadError(parseApiError(error, 'Failed to upload video. Please try again.').message);
      return false;
    } finally {
      setVideosUploading(false);
    }
  }, [taskId, sitePhotos]);

  // ── Step 5: Notes ──
  const [notes, setNotes] = useState('');
  // The "COMMENT (OPTIONAL)" box shown right above Complete Task is a fresh
  // per-completion comment, not an editor for `notes` above (which holds
  // whatever was already saved for this task and is also what the read-only
  // "Submitted" Notes summary displays after Complete Task). Keeping it a
  // separate, always-blank-at-mount state is what stops it from showing up
  // pre-filled with old/unrelated saved text. Synced into `notes` right
  // after a successful Complete Task so the summary view reflects it.
  const [completionComment, setCompletionComment] = useState('');
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
  const [workApprovalStatus, setWorkApprovalStatus] = useState<'' | 'PENDING_AM' | 'PENDING_RSM' | 'CONFIRMED'>('');
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

  const handleSendForApproval = useCallback(async () => {
    if (!selectedCategoryLetter || !selectedSubCategory) return;
    // Same Billing Type rule as the engineer's own version below — this
    // flow's category accordion lets any category's sub-type be picked,
    // unlike the engineer's locked-category branch, so this isn't scoped
    // to categoryOnlyPresetAtCreation here.
    const billingTypeRequired = (selectedCategoryLetter === 'B' && ['Breakdown', 'BIS'].includes(selectedSubCategory))
      || (selectedCategoryLetter === 'E' && selectedSubCategory === 'AMC Out Of Scope');
    if (billingTypeRequired && !billingType) return;
    // Same as the engineer's own handleFinishService — photos/videos (Step
    // 4) have no save button of their own, they upload right before
    // completing. This was missing here entirely: AM's Complete Task went
    // straight to /finish, so any photos/videos added in Step 4 were never
    // actually uploaded — nothing to show later on the report screen.
    //
    // Both handleSaveAllPhotos/handleSaveAllVideos are now no-ops when
    // given an empty list, so calling them unconditionally would be
    // harmless — still gated here purely to skip the redundant call/state
    // churn when there's nothing of that kind to upload. PDFs count as
    // "videos" for this split (see SitePhoto.mediaType) since they ride
    // handleSaveAllVideos's GCS flow, not the photos multipart call.
    if (sitePhotos.some((p) => p.mediaType !== 'video' && p.mediaType !== 'pdf') && !photosUploadSuccess) {
      const photosOk = await handleSaveAllPhotos();
      if (!photosOk) return;
    }
    if (sitePhotos.some((p) => p.mediaType === 'video' || p.mediaType === 'pdf') && !videosUploadSuccess) {
      const videosOk = await handleSaveAllVideos();
      if (!videosOk) return;
    }
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
      const response = await finishServiceTask(token, taskId, {
        category: selectedCategoryLetter, subCategory: selectedSubCategory, notes: completionComment,
        ...(billingTypeRequired ? { billingType } : {}),
      });
      setStep6Success(true);
      // Categories that never need work approval (A/F/G, or B/C without
      // Goodwill) never get a workApproval object back — defaulting that
      // to 'PENDING_AM' left Close Ticket waiting on an approval that was
      // never going to happen. No workApproval means nothing to wait for.
      setWorkApprovalStatus(response?.workApproval?.status || 'CONFIRMED');
      setTask((prev: any) => ({ ...prev, ...response }));
      // Keeps the read-only "Submitted" Notes summary (which reads `notes`,
      // not `completionComment`) in sync with what was actually just sent.
      setNotes(completionComment);

      // Deliberately NOT calling completeServiceTask (/service/:id/complete)
      // here — per the backend dev guide, that's a separate, optional
      // "mark work done" call, not part of this flow. The entry's real
      // "done" signal for service is reaching CLIENT_APPROVED via customer
      // OTP verify (handleVerifyAndComplete below) — nothing here should
      // force a further status change, and the task correctly stays in the
      // Active tab (via bucketTaskStatus) until that happens.
    } catch (error: any) {
      setStep6Error(parseApiError(error, 'Failed to send for approval. Please try again.').message);
    } finally {
      setStep6Saving(false);
    }
  }, [taskId, selectedCategoryLetter, selectedSubCategory, billingType, completionComment, sitePhotos, photosUploadSuccess, handleSaveAllPhotos, videosUploadSuccess, handleSaveAllVideos]);

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
    // Both handleSaveAllPhotos/handleSaveAllVideos are no-ops when given an
    // empty list, so this gating is purely to skip a redundant call — not
    // a requirement. PDFs count as "videos" here (see SitePhoto.mediaType),
    // since they ride handleSaveAllVideos's GCS flow, not the photos
    // multipart call.
    if (sitePhotos.some(p => p.mediaType !== 'video' && p.mediaType !== 'pdf') && !photosUploadSuccess) {
      const photosOk = await handleSaveAllPhotos();
      if (!photosOk) return;
    }
    if (sitePhotos.some(p => p.mediaType === 'video' || p.mediaType === 'pdf') && !videosUploadSuccess) {
      const videosOk = await handleSaveAllVideos();
      if (!videosOk) return;
    }
    setFinishing(true);
    setFinishError('');
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      const response = await finishServiceTask(token, taskId, {
        category: selectedCategoryLetter, subCategory: selectedSubCategory, notes: completionComment,
        ...(billingTypeRequired ? { billingType } : {}),
      });
      setTask((prev: any) => ({ ...prev, ...response }));
      // Keeps the read-only "Submitted" Notes summary (which reads `notes`,
      // not `completionComment`) in sync with what was actually just sent.
      setNotes(completionComment);
    } catch (error: any) {
      setFinishError(parseApiError(error, 'Failed to complete this service. Please try again.').message);
    } finally {
      setFinishing(false);
    }
  }, [taskId, selectedCategoryLetter, selectedSubCategory, categoryOnlyPresetAtCreation, billingType, completionComment, sitePhotos, photosUploadSuccess, handleSaveAllPhotos, videosUploadSuccess, handleSaveAllVideos]);

  // ── OTP completion (available once workApprovalStatus === 'CONFIRMED') ──
  const [otpGenerated, setOtpGenerated] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string[]>(['', '', '', '']);
  const [customerOtp, setCustomerOtp] = useState<string[]>(['', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(false);
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const scrollViewRef = useRef<any>(null);

  const handleGenerateOtp = useCallback(async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      const response = await generateServiceOtp(token, taskId);
      const code = String(response?.code || '');
      setGeneratedOtp(code.split('').slice(0, 4));
      setOtpGenerated(true);
      setCustomerOtp(['', '', '', '']);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to generate OTP. Please try again.');
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  }, [taskId]);

  const handleRegenerateOtp = useCallback(() => { handleGenerateOtp(); }, [handleGenerateOtp]);

  const handleChangeCustomerOtpDigit = useCallback((index: number, text: string) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    setCustomerOtp(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) otpInputRefs.current[index + 1]?.focus();
  }, []);

  const handleVerifyAndComplete = useCallback(async () => {
    const code = customerOtp.join('');
    if (code.length < 4) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      const verifyResponse = await verifyServiceOtp(token, taskId, code);
      // Per the backend dev guide, a successful verify returns the full
      // updated entry (status flips to CLIENT_APPROVED, completionOtp.
      // verified becomes true) — merge it into task state so anything
      // reading vm.task directly (e.g. Close Ticket's own gate) reflects
      // the real server state, not just this session's local flag.
      if (verifyResponse?.verified || verifyResponse?.status === 'CLIENT_APPROVED') {
        setTask((prev: any) => ({ ...prev, ...verifyResponse }));
        setTaskCompleted(true);
      } else {
        setOtpError('OTP verification failed. Please check the code and try again.');
      }
    } catch (error: any) {
      const { code: errorCode, message } = parseApiError(error, 'Failed to verify OTP. Please try again.');
      if (errorCode === 'OTP_LOCKED') {
        // Too many failed attempts — force the customer-facing OTP back to
        // "not generated" so the only way forward is a fresh code.
        setOtpGenerated(false);
        setCustomerOtp(['', '', '', '']);
        setGeneratedOtp(['', '', '', '']);
      }
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  }, [taskId, customerOtp]);

  // ── Close Ticket (available once the OTP-verified completion screen is showing) ──
  const [closingTicket, setClosingTicket] = useState(false);
  const [closeTicketError, setCloseTicketError] = useState('');

  const handleCloseTicket = useCallback(async () => {
    setClosingTicket(true);
    setCloseTicketError('');
    try {
      const token = await getToken();
      if (!token || !taskId) return;
      await closeServiceTask(token, taskId);
      router.replace('/screens/serviceTasks' as any);
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to close this ticket. Please try again.');
      setCloseTicketError(message);
    } finally {
      setClosingTicket(false);
    }
  }, [taskId, router]);

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
        // Same fallback handleSendForApproval uses: categories that never
        // need work approval (A/F/G, or B/C without Goodwill) never get a
        // workApproval object back from the backend at all. Without this,
        // reopening an already-COMPLETED task in one of those categories
        // left workApprovalStatus stuck at its default '' forever, which
        // both kept the AM's Step 5 stuck showing the pre-Complete category
        // picker (gated on workApprovalStatus === '') and left Close Ticket
        // permanently disabled (gated on workApprovalStatus === 'CONFIRMED').
        if (serviceData.status === 'COMPLETED') {
          setWorkApprovalStatus(serviceData.workApproval?.status || 'CONFIRMED');
        } else if (serviceData.workApproval?.status) {
          setWorkApprovalStatus(serviceData.workApproval.status);
        }
        // Reopening a task that's already COMPLETED (OTP still pending) —
        // e.g. tapping the Active-tab card's arrow again — should land
        // straight on Step 5's post-Complete view (Customer Sign-off/
        // Approval Status/Close Ticket), not back at Step 1's asset form.
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
  }, [assetId, taskId, params.gensetNumber, params.engineNumber]);

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
      // Same A/F/G (no workApproval object) fallback as loadPreviousData.
      if (serviceData?.status === 'COMPLETED') {
        setWorkApprovalStatus(serviceData.workApproval?.status || 'CONFIRMED');
      } else if (serviceData?.workApproval?.status) {
        setWorkApprovalStatus(serviceData.workApproval.status);
      }
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

  // Polls while Step 5's waiting banner is showing (CompletedWaitingBanner,
  // gated on workApprovalStatus === PENDING_AM/PENDING_RSM in the screen) —
  // this is the AM/engineer's own "sitting and watching" screen, so an
  // approve/reject decision made elsewhere should clear the banner within
  // one tick instead of requiring the user to pull-to-refresh themselves.
  // Same silent-refetch shape as onRefresh but without the pull-to-refresh
  // spinner toggle.
  useEffect(() => {
    if (workApprovalStatus !== 'PENDING_AM' && workApprovalStatus !== 'PENDING_RSM') return;
    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        if (!token || !taskId) return;
        const serviceData = await getServiceTaskById(token, taskId);
        if (serviceData) setTask((prev: any) => ({ ...prev, ...serviceData }));
        if (serviceData?.workApproval?.status) setWorkApprovalStatus(serviceData.workApproval.status);
      } catch (error) {
        console.log('[SR Task Form] Approval status poll failed:', error);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [workApprovalStatus, taskId]);

  // ── Navigation ──
  const handleBack = useCallback(() => setCurrentStep(prev => Math.max(1, prev - 1)), []);
  const handleNext = useCallback(() => setCurrentStep(prev => Math.min(5, prev + 1)), []);
  // A plain back() pops to whichever list screen sent us here without
  // refetching it — fine most of the time, but once OTP has been verified
  // this session (status just moved COMPLETED -> CLIENT_APPROVED) that
  // screen would keep showing this card as OTP-pending until a manual
  // pull-to-refresh. Same reason handleCloseTicket replaces rather than
  // goes back — force a fresh Services list load in that one case instead.
  const handleCancel = useCallback(() => {
    if (taskCompleted) {
      router.replace('/screens/serviceTasks' as any);
    } else {
      router.back();
    }
  }, [router, taskCompleted]);
  // Where the completion success screen's "DONE" button lands — this form
  // is service-only (the commissioning equivalent is taskForm.tsx), so it
  // always goes to the Services list.
  const goToServiceList = useCallback(() => router.replace('/screens/serviceTasks' as any), [router]);

  return {
    params, currentStep, setCurrentStep, initialDataLoading, refreshing, onRefresh, profile, task, isEngineer,

    // Step 1
    gensetModel, setGensetModel, gensetSrNumber, setGensetSrNumber, engineModel, setEngineModel,
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
    photosUploading, photosUploadProgress, photosUploadSuccess, photosUploadError, handleSaveAllPhotos,
    videosUploading, videosUploadProgress, videosUploadSuccess, videosUploadError, handleSaveAllVideos,

    // Step 5
    notes, setNotes, completionComment, setCompletionComment, step5Saving, step5Success, step5Error, handleSaveNotes,

    // Step 6
    expandedCategory, selectedCategoryLetter, selectedSubCategory, workApprovalStatus,
    toggleCategory, selectSubCategory, step6Saving, step6Success, step6Error, handleSendForApproval,
    categoryPresetAtCreation, categoryOnlyPresetAtCreation,
    billingType, setBillingType,

    // Step 6 — engineer-only Complete/finish flow
    categoryConfig, categoryConfigLoading, finishing, finishError, handleFinishService,
    freeServiceEligible, freeServiceBlockedReason, freeServiceLoading,

    // OTP
    otpGenerated, generatedOtp, customerOtp, otpLoading, otpError, taskCompleted, otpInputRefs, scrollViewRef,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleVerifyAndComplete,

    // Close Ticket
    closingTicket, closeTicketError, handleCloseTicket,

    // Navigation
    handleBack, handleNext, handleCancel, goToServiceList,
  };
}
