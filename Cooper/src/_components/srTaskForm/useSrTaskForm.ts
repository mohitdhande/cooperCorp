import { useState, useRef, useEffect } from 'react';
import { ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFaultCodes, getParts, getAssetById, getServiceTaskById, saveServiceStepProgress,
  requestServiceWorkApproval, uploadServicePhotos, generateServiceOtp, verifyServiceOtp,
  completeServiceTask, updateAsset,
} from '../../viewModel/commisionAPi';
import { parseApiError } from '../../utils/apiError';
import { SERVICE_CATEGORIES } from '../srTaskForm/srDropdownOptions';
import { statusCardColors } from './SrTaskForm.styles';

// Owns all state, step navigation, and API orchestration for the SR/service
// task form, leaving the screen as pure JSX. Mirrors the controller-hook
// pattern used by useTaskForm.ts for the commissioning task form.
export function useSrTaskForm() {
  const params = useLocalSearchParams();

  const [notes, setNotes] = useState('');

  const [photosUploading, setPhotosUploading] = useState(false);
  const [photosUploadSuccess, setPhotosUploadSuccess] = useState(false);
  const [photosUploadError, setPhotosUploadError] = useState('');

  const handleSaveAllPhotos = async () => {
    if (sitePhotos.length === 0) {
      setPhotosUploadError('Please add at least one photo before saving.');
      return;
    }
    setPhotosUploading(true);
    setPhotosUploadError('');
    setPhotosUploadSuccess(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const response = await uploadServicePhotos(
        token,
        taskId,
        sitePhotos.map(p => ({ uri: p.uri, fileName: p.fileName }))
      );
      console.log('[SR Form] Photos uploaded, response:', JSON.stringify(response));

      setPhotosUploadSuccess(true);
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to upload photos. Please try again.').message;
      setPhotosUploadError(msg);
    } finally {
      setPhotosUploading(false);
    }
  };

  const [workApprovalStatus, setWorkApprovalStatus] = useState<'' | 'PENDING_AM' | 'PENDING_RSM' | 'CONFIRMED'>('');
  const [refreshing, setRefreshing] = useState(false);

  const [expandedCategory, setExpandedCategory] = useState('');
  const [selectedCategoryLetter, setSelectedCategoryLetter] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');

  const [step6Saving, setStep6Saving] = useState(false);
  const [step6Success, setStep6Success] = useState(false);
  const [step6Error, setStep6Error] = useState('');

  const toggleCategory = (letter: string) => {
    setExpandedCategory(prev => (prev === letter ? '' : letter));
  };

  const selectSubCategory = (letter: string, sub: string) => {
    setSelectedCategoryLetter(letter);
    setSelectedSubCategory(sub);
  };

  const handleSendForApproval = async () => {
    if (!selectedCategoryLetter || !selectedSubCategory) return;
    setStep6Saving(true);
    setStep6Error('');
    setStep6Success(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const body = { category: selectedCategoryLetter, subCategory: selectedSubCategory };
      console.log('[SR Form] PUT work-approval/request body:', JSON.stringify(body));
      const response = await requestServiceWorkApproval(token, taskId, body);
      console.log('[SR Form] PUT work-approval/request response:', JSON.stringify(response));

      setStep6Success(true);
      setWorkApprovalStatus(response?.workApproval?.status || 'PENDING_AM');
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to send for approval. Please try again.').message;
      setStep6Error(msg);
    } finally {
      setStep6Saving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const taskId = params.taskId as string;
      if (!token || !taskId) return;

      console.log('[SR Form] Pull-to-refresh — GET service task:', taskId);
      const serviceData = await getServiceTaskById(token, taskId);
      console.log('[SR Form] Pull-to-refresh response:', JSON.stringify(serviceData));

      if (serviceData?.category) setSelectedCategoryLetter(serviceData.category);
      if (serviceData?.subCategory) setSelectedSubCategory(serviceData.subCategory);
      if (serviceData?.workApproval?.status) {
        console.log('[SR Form] workApproval status now:', serviceData.workApproval.status);
        setWorkApprovalStatus(serviceData.workApproval.status);
      }
      if (serviceData?.notes != null) setNotes(serviceData.notes);
    } catch (error) {
      console.log('[SR Form] Pull-to-refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const [step5Saving, setStep5Saving] = useState(false);
  const [step5Success, setStep5Success] = useState(false);
  const [step5Error, setStep5Error] = useState('');

  const [userName, setUserName] = useState('');
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [apiFaultCodes, setApiFaultCodes] = useState<any[]>([]);
  const [faultCodesLoading, setFaultCodesLoading] = useState(false);
  const [apiParts, setApiParts] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  const [step2Saving, setStep2Saving] = useState(false);
  const [step2Success, setStep2Success] = useState(false);
  const [step2Error, setStep2Error] = useState('');

  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Success, setStep3Success] = useState(false);
  const [step3Error, setStep3Error] = useState('');

  // Maps UI state back to the API's expected shape: [{ codeId, observation, rootCause, correctiveAction }]
  const buildFaultCodesPayload = () =>
    selectedComplaintCodes.map((item) => ({
      codeId: item._id || item.codeId,
      observation: item.observation || '',
      rootCause: item.rootCause || '',
      correctiveAction: item.correctiveAction || '',
    }));

  // Maps UI state back to the API's expected shape: [{ partId, quantity }]
  const buildPartsUsedPayload = () =>
    selectedParts.map((part) => ({
      partId: part.partId || part._id,
      quantity: part.quantity,
    }));

  const handleSaveFaultCodes = async () => {
    setStep2Saving(true);
    setStep2Error('');
    setStep2Success(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const body = { faultCodes: buildFaultCodesPayload() };
      console.log('[SR Form] PUT save-progress (faultCodes) body:', JSON.stringify(body));
      const response = await saveServiceStepProgress(token, taskId, body);
      console.log('[SR Form] PUT save-progress (faultCodes) response:', JSON.stringify(response));

      setStep2Success(true);
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setStep2Error(msg);
    } finally {
      setStep2Saving(false);
    }
  };

  const handleSavePartsUsed = async () => {
    setStep3Saving(true);
    setStep3Error('');
    setStep3Success(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const body = { partsUsed: buildPartsUsedPayload() };
      console.log('[SR Form] PUT save-progress (partsUsed) body:', JSON.stringify(body));
      const response = await saveServiceStepProgress(token, taskId, body);
      console.log('[SR Form] PUT save-progress (partsUsed) response:', JSON.stringify(response));

      setStep3Success(true);
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setStep3Error(msg);
    } finally {
      setStep3Saving(false);
    }
  };

  const loadPreviousData = async () => {
    setInitialDataLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const assetId = params.assetId as string;
      const taskId = params.taskId as string;

      const [assetData, serviceData] = await Promise.all([
        assetId ? getAssetById(token, assetId) : Promise.resolve(null),
        taskId ? getServiceTaskById(token, taskId) : Promise.resolve(null),
      ]);

      console.log('[SR Form] GET asset response:', JSON.stringify(assetData));
      console.log('[SR Form] GET service task response:', JSON.stringify(serviceData));

      if (serviceData) {
        setNotes(serviceData.notes ?? '');
        if (serviceData.category) setSelectedCategoryLetter(serviceData.category);
        if (serviceData.subCategory) setSelectedSubCategory(serviceData.subCategory);
        if (serviceData.workApproval?.status) {
          console.log('[SR Form] Initial workApproval status:', serviceData.workApproval.status);
          setWorkApprovalStatus(serviceData.workApproval.status);
        }
      }   // ── Prefill STEP 1 from asset ──
      if (assetData) {
        setGensetModel(assetData.gensetModel ?? '');
        setGensetSrNumber(assetData.gensetNumber ?? (params.gensetNumber as string) ?? '');
        setEngineModel(assetData.engineModel ?? '');
        setEngineNumber(assetData.engineNumber ?? (params.engineNumber as string) ?? '');
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
        setLoadUnbalancePercentage(
          assetData.loadUnbalancePercentage != null ? String(assetData.loadUnbalancePercentage) : ''
        );
        setLoadUnbalanceComment(assetData.loadUnbalanceComment ?? '');

        setTypeOfService(assetData.serviceType ?? '');
        setWarrantyStatus(assetData.warrantyStatus ?? '');

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
        setCoolantLevel(assetData.coolantLevel ?? '');
        setCoolantTemp(assetData.coolantTemperature != null ? String(assetData.coolantTemperature) : '');
        setDefLevel(assetData.defLevelPercentage != null ? String(assetData.defLevelPercentage) : '');
      }

      // ── Prefill STEP 2 — Complaint / Fault Codes ──
      if (serviceData?.faultCodes?.length) {
        const mappedCodes = serviceData.faultCodes.map((entry: any, index: number) => ({
          uid: `${entry.codeId?._id || index}-${Date.now()}-${index}`,
          _id: entry.codeId?._id,
          code: entry.codeId?.code,
          priority: entry.codeId?.priority,
          title: entry.codeId?.description,
          categoryName: entry.codeId?.category,
          subcategoryName: entry.codeId?.subCategory,
          observation: entry.observation ?? '',
          rootCause: entry.rootCause ?? '',
          correctiveAction: entry.correctiveAction ?? '',
        }));
        setSelectedComplaintCodes(mappedCodes);
      }

      // ── Prefill STEP 3 — Parts Used ──
      if (serviceData?.partsUsed?.length) {
        const mappedParts = serviceData.partsUsed.map((entry: any) => ({
          partId: entry.partId?._id,
          _id: entry.partId?._id,
          code: entry.partId?.code,
          name: entry.partId?.name,
          unit: entry.partId?.unit,
          category: entry.partId?.category,
          subCategory: entry.partId?.subCategory,
          quantity: entry.quantity ?? 1,
        }));
        setSelectedParts(mappedParts);
      }
    } catch (error) {
      console.log('[SR Form] Failed to load previous data:', error);
    } finally {
      setInitialDataLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setStep5Saving(true);
    setStep5Error('');
    setStep5Success(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const body = { notes };
      console.log('[SR Form] PUT save-progress (notes) body:', JSON.stringify(body));
      const response = await saveServiceStepProgress(token, taskId, body);
      console.log('[SR Form] PUT save-progress (notes) response:', JSON.stringify(response));

      setStep5Success(true);
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setStep5Error(msg);
    } finally {
      setStep5Saving(false);
    }
  };

  const loadFaultCodesAndParts = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      setFaultCodesLoading(true);
      setPartsLoading(true);

      const [faultCodesData, partsData] = await Promise.all([
        getFaultCodes(token),
        getParts(token),
      ]);

      setApiFaultCodes(faultCodesData);
      setApiParts(partsData);
    } catch (error) {
      console.log('[SR Form] Failed to load fault codes / parts:', error);
    } finally {
      setFaultCodesLoading(false);
      setPartsLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('userData');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setUserName(user.name);
        setUserProfilePic(user.profilePic || null);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/screens/login');
          },
        },
      ]
    );
  };

  // ── Stepper ──
  const [currentStep, setCurrentStep] = useState(1);
  const [initialDataLoading, setInitialDataLoading] = useState(true);

  // ── STEP 1: Genset Identification ──
  const [gensetModel, setGensetModel] = useState('');
  const [gensetSrNumber, setGensetSrNumber] = useState('');
  const [engineModel, setEngineModel] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [engineKw, setEngineKw] = useState('');
  const [engineType, setEngineType] = useState('');
  const [engineFamily, setEngineFamily] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [application, setApplication] = useState('');

  // ── STEP 1: Alternator & Panel ──
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

  // ── STEP 1: Service ──
  const [typeOfService, setTypeOfService] = useState('');
  const [warrantyStatus, setWarrantyStatus] = useState('');

  // ── STEP 1: Electrical Readings ──
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

  // ── STEP 1: Engine Parameters ──
  const [rpm, setRpm] = useState('');
  const [frequency, setFrequency] = useState('');
  const [dcVoltage, setDcVoltage] = useState('');
  const [oilPressure, setOilPressure] = useState('');
  const [oilLevel, setOilLevel] = useState<'OK' | 'Not OK' | ''>('');
  const [coolantLevel, setCoolantLevel] = useState<'OK' | 'Not OK' | ''>('');
  const [coolantTemp, setCoolantTemp] = useState('');
  const [defLevel, setDefLevel] = useState('');

  // ── Per-section save state ──
  const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({});
  const [sectionError, setSectionError] = useState<Record<string, string>>({});

  // number-or-null helper for numeric API fields
  const toNum = (val: string): number | null => (val === '' || val === undefined ? null : Number(val));

  // Builds the full asset payload from ALL step-1 fields, since the API is one PUT for the whole record.
  const buildAssetPayload = () => ({
    loadUnbalance: loadUnbalance === 'Yes',
    gensetNumber: gensetSrNumber,
    engineNumber: engineNumber,
    applicationMaterial: application,
    engineFamily,
    engineModel,
    engineType,
    fuelType,
    gensetModel,
    kw: engineKw,
    alternatorMake: altMake,
    alternatorModel: altModel,
    alternatorSerialNumber: altSn,
    atsSerialNumber: atsSn,
    batterySerialNumber: batterySn,
    controlPanelSerialNumber: panelSn,
    cpcb: cpcbNorm,
    kva,
    loadUnbalanceComment: loadUnbalance === 'No' ? (loadUnbalanceComment || null) : null,
    loadUnbalancePercentage: loadUnbalance === 'Yes' ? toNum(loadUnbalancePercentage) : null,
    panelType,
    phase,
    serviceType: typeOfService,
    warrantyStatus,
    acAmpB: toNum(acAmpB),
    acAmpR: toNum(acAmpR),
    acAmpY: toNum(acAmpY),
    acVoltageBR: toNum(acVoltBR),
    acVoltageRY: toNum(acVoltRY),
    acVoltageYB: toNum(acVoltYB),
    loadKwB: toNum(loadKwB),
    loadKwR: toNum(loadKwR),
    loadKwY: toNum(loadKwY),
    loadPercentage: toNum(loadPercent),
    totalKwLoad: toNum(totalKw),
    coolantLevel,
    coolantTemperature: toNum(coolantTemp),
    dcVoltage: toNum(dcVoltage),
    defLevelPercentage: toNum(defLevel),
    frequency: toNum(frequency),
    oilLevel,
    oilPressure: toNum(oilPressure),
    rpm: toNum(rpm),
  });

  // Called by all 4 Step-1 Save buttons — same PUT, full payload, per-button loading/success state
  const handleSaveAssetSection = async (sectionKey: string) => {
    setSectionSaving(prev => ({ ...prev, [sectionKey]: true }));
    setSectionError(prev => ({ ...prev, [sectionKey]: '' }));
    setSectionSuccess(prev => ({ ...prev, [sectionKey]: false }));
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const assetId = params.assetId as string;
      if (!assetId) throw new Error('Missing asset ID');

      await updateAsset(token, assetId, buildAssetPayload());
      setSectionSuccess(prev => ({ ...prev, [sectionKey]: true }));
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setSectionError(prev => ({ ...prev, [sectionKey]: msg }));
    } finally {
      setSectionSaving(prev => ({ ...prev, [sectionKey]: false }));
    }
  };

  // ── STEP 2: Complaint Codes ──
  const [selectedComplaintCodes, setSelectedComplaintCodes] = useState<any[]>([]);
  const [complaintPickerVisible, setComplaintPickerVisible] = useState(false);

  const handleSelectComplaintCode = (code: any) => {
    setSelectedComplaintCodes(prev => [
      ...prev,
      {
        uid: `${code.code}-${Date.now()}`,
        ...code,
        title: code.description,
        categoryName: code.category,
        subcategoryName: code.subCategory,
        observation: '',
        rootCause: '',
        correctiveAction: '',
      },
    ]);
    setComplaintPickerVisible(false);
  };

  const [otpGenerated, setOtpGenerated] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string[]>(['', '', '', '']);
  const [customerOtp, setCustomerOtp] = useState<string[]>(['', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [taskCompleted, setTaskCompleted] = useState(false);
  const otpInputRefs = useRef<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleGenerateOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const response = await generateServiceOtp(token, taskId);
      const code = String(response?.code || '');
      console.log('[SR Form] Generated OTP:', code);

      setGeneratedOtp(code.split('').slice(0, 4));
      setOtpGenerated(true);
      setCustomerOtp(['', '', '', '']);
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to generate OTP. Please try again.').message;
      setOtpError(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegenerateOtp = () => {
    handleGenerateOtp();
  };

  const handleChangeCustomerOtpDigit = (index: number, text: string) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    setCustomerOtp(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleVerifyAndComplete = async () => {
    const code = customerOtp.join('');
    if (code.length < 4) return;

    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No auth token found');

      const taskId = params.taskId as string;
      if (!taskId) throw new Error('Missing task ID');

      const verifyResponse = await verifyServiceOtp(token, taskId, code);
      console.log('[SR Form] OTP verify response:', JSON.stringify(verifyResponse));

      if (verifyResponse?.verified) {
        const completeResponse = await completeServiceTask(token, taskId, { notes });
        console.log('[SR Form] Service task complete response:', JSON.stringify(completeResponse));
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
  };

  const selectedCategoryColor =
    SERVICE_CATEGORIES.find(c => c.letter === selectedCategoryLetter) ||
    { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' };
  const handleRemoveComplaintCode = (uid: string) =>
    setSelectedComplaintCodes(prev => prev.filter(item => item.uid !== uid));
  const handleChangeComplaintObservation = (uid: string, text: string) =>
    setSelectedComplaintCodes(prev => prev.map(item => item.uid === uid ? { ...item, observation: text } : item));
  const handleChangeComplaintRootCause = (uid: string, text: string) =>
    setSelectedComplaintCodes(prev => prev.map(item => item.uid === uid ? { ...item, rootCause: text } : item));
  const handleChangeComplaintCorrectiveAction = (uid: string, text: string) =>
    setSelectedComplaintCodes(prev => prev.map(item => item.uid === uid ? { ...item, correctiveAction: text } : item));
  const getStatusCardStyle = (variant: 'amber' | 'blue' | 'green') => [
    {
      borderRadius: 18,
      padding: 20,
      marginTop: 16,
      borderWidth: 1,
    },
    { backgroundColor: statusCardColors[variant].bg, borderColor: statusCardColors[variant].border },
  ];

  // ── STEP 3: Parts Used ──
  const [selectedParts, setSelectedParts] = useState<any[]>([]);
  const [partPickerVisible, setPartPickerVisible] = useState(false);

  const handleSelectPart = (part: any) => {
    const partId = part.partId || part._id;
    setSelectedParts(prev => {
      const exists = prev.find(p => p.partId === partId);
      if (exists) {
        return prev.map(p => p.partId === partId ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { ...part, partId, quantity: 1 }];
    });
    setPartPickerVisible(false);
  };
  const handleIncreaseQty = (partId: string) =>
    setSelectedParts(prev => prev.map(p => p.partId === partId ? { ...p, quantity: p.quantity + 1 } : p));
  const handleDecreaseQty = (partId: string) =>
    setSelectedParts(prev => prev.map(p => p.partId === partId && p.quantity > 1 ? { ...p, quantity: p.quantity - 1 } : p));
  const handleRemovePart = (partId: string) =>
    setSelectedParts(prev => prev.filter(p => p.partId !== partId));

  // ── STEP 4: Photos ──
  const [sitePhotos, setSitePhotos] = useState<{ id: string; uri: string; fileName: string }[]>([]);
  const [photoOptionsVisible, setPhotoOptionsVisible] = useState(false);

  const handleTakePhoto = async () => {
    setPhotoOptionsVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setSitePhotos(prev => [...prev, { id: `${Date.now()}`, uri: asset.uri, fileName: asset.fileName || `photo_${prev.length + 1}.jpg` }]);
    }
  };
  const handleChoosePhotos = async () => {
    setPhotoOptionsVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true });
    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map((asset, i) => ({
        id: `${Date.now()}-${i}`, uri: asset.uri, fileName: asset.fileName || `photo_${i + 1}.jpg`,
      }));
      setSitePhotos(prev => [...prev, ...newPhotos]);
    }
  };
  const handleRemovePhoto = (id: string) =>
    setSitePhotos(prev => prev.filter(p => p.id !== id));

  // ── Navigation ──
  const handleBack = () => setCurrentStep(prev => Math.max(1, prev - 1));
  const handleNext = () => setCurrentStep(prev => Math.min(6, prev + 1));
  const handleCancel = () => router.back();

  useEffect(() => {
    loadUser();
    loadFaultCodesAndParts();
    loadPreviousData();
  }, []);

  return {
    params,
    notes, setNotes,
    photosUploading, photosUploadSuccess, photosUploadError, handleSaveAllPhotos,
    workApprovalStatus,
    refreshing, onRefresh,
    expandedCategory, toggleCategory,
    selectedCategoryLetter, selectedSubCategory, selectSubCategory,
    step6Saving, step6Success, step6Error, handleSendForApproval,
    step5Saving, step5Success, step5Error, handleSaveNotes,
    userName, userProfilePic,
    apiFaultCodes, faultCodesLoading,
    apiParts, partsLoading,
    step2Saving, step2Success, step2Error, handleSaveFaultCodes,
    step3Saving, step3Success, step3Error, handleSavePartsUsed,
    handleLogout,
    currentStep, setCurrentStep,
    initialDataLoading,
    gensetModel, gensetSrNumber, engineModel, engineNumber, engineKw, engineType,
    engineFamily, fuelType, application,
    setGensetModel, setGensetSrNumber, setEngineModel, setEngineNumber, setEngineKw,
    setEngineType, setEngineFamily, setFuelType, setApplication,
    altMake, altModel, altSn, atsSn, batterySn, kva, phase, panelType, panelSn, cpcbNorm,
    loadUnbalance, loadUnbalancePercentage, loadUnbalanceComment,
    setAltMake, setAltModel, setAltSn, setAtsSn, setBatterySn, setKva, setPhase,
    setPanelType, setPanelSn, setCpcbNorm, setLoadUnbalance, setLoadUnbalancePercentage,
    setLoadUnbalanceComment,
    typeOfService, warrantyStatus, setTypeOfService, setWarrantyStatus,
    acVoltRY, acVoltYB, acVoltBR, acAmpR, acAmpY, acAmpB, loadKwR, loadKwY, loadKwB, totalKw, loadPercent,
    setAcVoltRY, setAcVoltYB, setAcVoltBR, setAcAmpR, setAcAmpY, setAcAmpB,
    setLoadKwR, setLoadKwY, setLoadKwB, setTotalKw, setLoadPercent,
    rpm, frequency, dcVoltage, oilPressure, oilLevel, coolantLevel, coolantTemp, defLevel,
    setRpm, setFrequency, setDcVoltage, setOilPressure, setOilLevel, setCoolantLevel,
    setCoolantTemp, setDefLevel,
    sectionSaving, sectionSuccess, sectionError, handleSaveAssetSection,
    selectedComplaintCodes, complaintPickerVisible, setComplaintPickerVisible,
    handleSelectComplaintCode, handleRemoveComplaintCode,
    handleChangeComplaintObservation, handleChangeComplaintRootCause, handleChangeComplaintCorrectiveAction,
    otpGenerated, generatedOtp, customerOtp, otpLoading, otpError, taskCompleted,
    otpInputRefs, scrollViewRef,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleOtpInputFocus, handleVerifyAndComplete,
    selectedCategoryColor, getStatusCardStyle,
    selectedParts, partPickerVisible, setPartPickerVisible,
    handleSelectPart, handleIncreaseQty, handleDecreaseQty, handleRemovePart,
    sitePhotos, photoOptionsVisible, setPhotoOptionsVisible,
    handleTakePhoto, handleChoosePhotos, handleRemovePhoto,
    handleBack, handleNext, handleCancel,
  };
}
