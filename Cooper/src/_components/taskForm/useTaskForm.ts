import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAssetById, updateAsset, saveCommissioningProgress, getCommissioningProgress, saveCommissioningReadings, saveValidationProgress } from '@/viewModel/commisionAPi';
import {
  SitePhoto, Part, SelectedPart, CheckItem, CheckItemStatus, NumericGroupItem,
  TextItem, LoadStage, ComplaintCategoryDef, ComplaintSubcategoryDef,
  ComplaintCodeDef, SelectedComplaintCode,
} from '@/models/taskForm.types';
import { ApiFaultCode, ApiPart } from '@/models/taskForm.types';
import { makeCheckItem, makeLoadStage } from './helpers';
import { useTaskFormApiData } from './hooks/useTaskFormApiData';
import { useTaskFormPhotos } from './hooks/useTaskFormPhotos';
import { useTaskFormOtp } from './hooks/useTaskFormOtp';

const TOTAL_STEPS = 8;

// Main orchestration hook for the commissioning task form.
// It connects the UI state, step navigation, API data loading, photo uploads, and OTP completion flow.
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
  // Tracks the active step in the multi-step commissioning form.
  const [currentStep, setCurrentStep] = useState(1);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  // Centralized helper for showing temporary success/error feedback to the user.
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const { apiFaultCodes, apiParts, faultCodesLoading, partsLoading, step3Saving, step3Error, step3Success, step4Saving, step4Error, step4Success, loadFaultCodes, loadParts, saveFaultCodes, savePartsUsed } = useTaskFormApiData({ taskId, showToast });
  const {
    sitePhotos,
    setSitePhotos,
    photoOptionsVisible,
    setPhotoOptionsVisible,
    runningHoursPhotos,
    setRunningHoursPhotos,
    step2PhotoOptionsVisible,
    setStep2PhotoOptionsVisible,
    photosUploading,
    photosUploadError,
    photosUploadSuccess,
    uploadedPhotoUrls,
    handleTakeSitePhoto,
    handleChooseSitePhotos,
    handleRemoveSitePhoto,
    handleTakeRunningHoursPhoto,
    handleChooseRunningHoursPhotos,
    handleRemoveRunningHoursPhoto,
    handleSaveAllPhotos,
  } = useTaskFormPhotos({ taskId, showToast });
  const {
    otpGenerated,
    generatedOtp,
    customerOtp,
    otpInputRefs,
    otpLoading,
    otpError,
    taskCompleted,
    handleGenerateOtp,
    handleRegenerateOtp,
    handleChangeCustomerOtpDigit,
    handleVerifyAndComplete,
  } = useTaskFormOtp({ taskId, showToast });

  useEffect(() => {
    if (currentStep === 3) {
      loadFaultCodes();
    }
    if (currentStep === 4) {
      loadParts();
    }
  }, [currentStep, loadFaultCodes, loadParts]);

  
  
  // ── Step 2 state — commissioning checks ──
// ── Step 2 state — commissioning checks ──
const [checksLoading, setChecksLoading] = useState(false);

// ── Step 2 state — VALIDATION checks (Revalidation task type only) ──
// ── Step 2 state — VALIDATION checks (Revalidation task type only) ──
// Note: prefixed with "val" to avoid clashing with existing Group A/B/C (A1, B1... etc)
// used by the default Commissioning Checks step. Backend payload uses plain keys (A1, B1...).
const [valA1, setValA1] = useState(''); const [valA1_comment, setValA1_comment] = useState('');
const [valA2, setValA2] = useState(''); // no comment
const [valA3, setValA3] = useState(''); const [valA3_comment, setValA3_comment] = useState('');

const [valB1, setValB1] = useState(''); const [valB1_comment, setValB1_comment] = useState('');
const [valB2, setValB2] = useState(''); const [valB2_comment, setValB2_comment] = useState('');
const [valB3, setValB3] = useState(''); const [valB3_comment, setValB3_comment] = useState('');

const [valC1, setValC1] = useState(''); const [valC1_comment, setValC1_comment] = useState('');
const [valC2, setValC2] = useState(''); // no comment
const [valC3, setValC3] = useState(''); const [valC3_comment, setValC3_comment] = useState('');
const [valC4, setValC4] = useState(''); const [valC4_comment, setValC4_comment] = useState('');

const [valD1, setValD1] = useState(''); const [valD1_comment, setValD1_comment] = useState('');
const [valD2, setValD2] = useState(''); const [valD2_comment, setValD2_comment] = useState('');
const [valD3, setValD3] = useState(''); const [valD3_comment, setValD3_comment] = useState('');
const [valD4, setValD4] = useState(''); const [valD4_comment, setValD4_comment] = useState('');
const [valD5, setValD5] = useState(''); const [valD5_comment, setValD5_comment] = useState('');

const [valE1, setValE1] = useState(''); const [valE1_comment, setValE1_comment] = useState('');
const [valE2, setValE2] = useState(''); const [valE2_comment, setValE2_comment] = useState('');
const [valE3, setValE3] = useState(''); const [valE3_comment, setValE3_comment] = useState('');

const [valF1, setValF1] = useState(''); const [valF1_comment, setValF1_comment] = useState('');
const [valF2, setValF2] = useState(''); const [valF2_comment, setValF2_comment] = useState('');
const [valF3, setValF3] = useState(''); // no comment (text field)
const [valF4, setValF4] = useState(''); const [valF4_comment, setValF4_comment] = useState('');
const [valF5, setValF5] = useState(''); const [valF5_comment, setValF5_comment] = useState('');
const [valF6, setValF6] = useState(''); const [valF6_comment, setValF6_comment] = useState('');
const [valF7, setValF7] = useState(''); const [valF7_comment, setValF7_comment] = useState('');

const [valG1, setValG1] = useState(''); const [valG1_comment, setValG1_comment] = useState('');
const [valG2, setValG2] = useState(''); const [valG2_comment, setValG2_comment] = useState('');
// Group A — Pre-Installation Checks
const [A1, setA1] = useState(''); const [A1_comment, setA1_comment] = useState('');
const [A2, setA2] = useState(''); const [A2_comment, setA2_comment] = useState('');
const [A3, setA3] = useState(''); const [A3_comment, setA3_comment] = useState('');
const [A4, setA4] = useState(''); const [A4_comment, setA4_comment] = useState('');
const [A5, setA5] = useState(''); const [A5_comment, setA5_comment] = useState('');
const [A6, setA6] = useState(''); const [A6_comment, setA6_comment] = useState('');
const [A7, setA7] = useState(''); const [A7_comment, setA7_comment] = useState('');
const [A8, setA8] = useState(''); const [A8_comment, setA8_comment] = useState('');
const [A9, setA9] = useState(''); const [A9_comment, setA9_comment] = useState('');
const [A10, setA10] = useState(''); const [A10_comment, setA10_comment] = useState('');
// A EB Mains numeric fields
const [A17, setA17] = useState(''); // Voltage R-N Phase
const [A18, setA18] = useState(''); // Voltage Y-N Phase
const [A19, setA19] = useState(''); // Voltage B-N Phase
const [A11, setA11] = useState(''); // Load R Phase
const [A12, setA12] = useState(''); // Load Y Phase
const [A13, setA13] = useState(''); // Load B Phase

// Group B — Commissioning Instructions
const [B1, setB1] = useState(''); const [B1_comment, setB1_comment] = useState('');
const [B2, setB2] = useState(''); const [B2_comment, setB2_comment] = useState('');
const [B3, setB3] = useState(''); const [B3_comment, setB3_comment] = useState('');
const [B4a, setB4a] = useState(''); const [B4a_comment, setB4a_comment] = useState('');
const [B4b, setB4b] = useState(''); const [B4b_comment, setB4b_comment] = useState('');
const [B4c, setB4c] = useState(''); const [B4c_comment, setB4c_comment] = useState('');
const [B4d, setB4d] = useState(''); const [B4d_comment, setB4d_comment] = useState('');
// B Phase Difference numeric
const [B5R, setB5R] = useState('');
const [B5Y, setB5Y] = useState('');
const [B5B, setB5B] = useState('');

// Group C — CPCB IV+ ATS
const [C1, setC1] = useState(''); const [C1_comment, setC1_comment] = useState('');
const [C2, setC2] = useState(''); const [C2_comment, setC2_comment] = useState('');
const [C3, setC3] = useState(''); const [C3_comment, setC3_comment] = useState('');
const [C4, setC4] = useState(''); const [C4_comment, setC4_comment] = useState('');
const [C5, setC5] = useState(''); const [C5_comment, setC5_comment] = useState('');
const [C6, setC6] = useState(''); const [C6_comment, setC6_comment] = useState('');
const [C7, setC7] = useState(''); const [C7_comment, setC7_comment] = useState('');
const [C8, setC8] = useState(''); const [C8_comment, setC8_comment] = useState('');
const [C9, setC9] = useState(''); const [C9_comment, setC9_comment] = useState('');
const [C10, setC10] = useState(''); const [C10_comment, setC10_comment] = useState('');
const [C11, setC11] = useState(''); const [C11_comment, setC11_comment] = useState('');
const [C14, setC14] = useState(''); const [C14_comment, setC14_comment] = useState('');
const [C15, setC15] = useState(''); const [C15_comment, setC15_comment] = useState('');
const [C16, setC16] = useState(''); const [C16_comment, setC16_comment] = useState('');
const [C17, setC17] = useState(''); const [C17_comment, setC17_comment] = useState('');
// C numeric fields
const [C12, setC12] = useState(''); // Exhaust Temp Before
const [C13, setC13] = useState(''); // Exhaust Temp After
const [C18, setC18] = useState(''); // DEF Make

// Group D — Performance Trial
const [D0LR, setD0LR] = useState(''); const [D0LY, setD0LY] = useState(''); const [D0LB, setD0LB] = useState('');
const [D0VR, setD0VR] = useState(''); const [D0VY, setD0VY] = useState(''); const [D0VB, setD0VB] = useState('');
const [D0F, setD0F] = useState(''); const [D0BV, setD0BV] = useState(''); const [D0REM, setD0REM] = useState('');

const [D25LR, setD25LR] = useState(''); const [D25LY, setD25LY] = useState(''); const [D25LB, setD25LB] = useState('');
const [D25VR, setD25VR] = useState(''); const [D25VY, setD25VY] = useState(''); const [D25VB, setD25VB] = useState('');
const [D25F, setD25F] = useState(''); const [D25BV, setD25BV] = useState(''); const [D25REM, setD25REM] = useState('');

const [D50LR, setD50LR] = useState(''); const [D50LY, setD50LY] = useState(''); const [D50LB, setD50LB] = useState('');
const [D50VR, setD50VR] = useState(''); const [D50VY, setD50VY] = useState(''); const [D50VB, setD50VB] = useState('');
const [D50F, setD50F] = useState(''); const [D50BV, setD50BV] = useState(''); const [D50REM, setD50REM] = useState('');

const [D75LR, setD75LR] = useState(''); const [D75LY, setD75LY] = useState(''); const [D75LB, setD75LB] = useState('');
const [D75VR, setD75VR] = useState(''); const [D75VY, setD75VY] = useState(''); const [D75VB, setD75VB] = useState('');
const [D75F, setD75F] = useState(''); const [D75BV, setD75BV] = useState(''); const [D75REM, setD75REM] = useState('');

const [D100LR, setD100LR] = useState(''); const [D100LY, setD100LY] = useState(''); const [D100LB, setD100LB] = useState('');
const [D100VR, setD100VR] = useState(''); const [D100VY, setD100VY] = useState(''); const [D100VB, setD100VB] = useState('');
const [D100F, setD100F] = useState(''); const [D100BV, setD100BV] = useState(''); const [D100REM, setD100REM] = useState('');

// Group E — Running Hours
const [E_runHrs, setE_runHrs] = useState('');
const loadCommissioningChecks = async () => {
  if (!taskId) return;
  setChecksLoading(true);
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    const data = await getCommissioningProgress(token, taskId);
    const c = data.commissioningChecks || {};

    // Group A
    if (c.A1) setA1(c.A1); if (c.A1_comment) setA1_comment(c.A1_comment);
    if (c.A2) setA2(c.A2); if (c.A2_comment) setA2_comment(c.A2_comment);
    if (c.A3) setA3(c.A3); if (c.A3_comment) setA3_comment(c.A3_comment);
    if (c.A4) setA4(c.A4); if (c.A4_comment) setA4_comment(c.A4_comment);
    if (c.A5) setA5(c.A5); if (c.A5_comment) setA5_comment(c.A5_comment);
    if (c.A6) setA6(c.A6); if (c.A6_comment) setA6_comment(c.A6_comment);
    if (c.A7) setA7(c.A7); if (c.A7_comment) setA7_comment(c.A7_comment);
    if (c.A8) setA8(c.A8); if (c.A8_comment) setA8_comment(c.A8_comment);
    if (c.A9) setA9(c.A9); if (c.A9_comment) setA9_comment(c.A9_comment);
    if (c.A10) setA10(c.A10); if (c.A10_comment) setA10_comment(c.A10_comment);
    if (c.A17) setA17(c.A17); if (c.A18) setA18(c.A18); if (c.A19) setA19(c.A19);
    if (c.A11) setA11(c.A11); if (c.A12) setA12(c.A12); if (c.A13) setA13(c.A13);

    // Group B
    if (c.B1) setB1(c.B1); if (c.B1_comment) setB1_comment(c.B1_comment);
    if (c.B2) setB2(c.B2); if (c.B2_comment) setB2_comment(c.B2_comment);
    if (c.B3) setB3(c.B3); if (c.B3_comment) setB3_comment(c.B3_comment);
    if (c.B4a) setB4a(c.B4a); if (c.B4a_comment) setB4a_comment(c.B4a_comment);
    if (c.B4b) setB4b(c.B4b); if (c.B4b_comment) setB4b_comment(c.B4b_comment);
    if (c.B4c) setB4c(c.B4c); if (c.B4c_comment) setB4c_comment(c.B4c_comment);
    if (c.B4d) setB4d(c.B4d); if (c.B4d_comment) setB4d_comment(c.B4d_comment);
    if (c.B5R) setB5R(c.B5R); if (c.B5Y) setB5Y(c.B5Y); if (c.B5B) setB5B(c.B5B);

    // Group C
    if (c.C1) setC1(c.C1); if (c.C1_comment) setC1_comment(c.C1_comment);
    if (c.C2) setC2(c.C2); if (c.C2_comment) setC2_comment(c.C2_comment);
    if (c.C3) setC3(c.C3); if (c.C3_comment) setC3_comment(c.C3_comment);
    if (c.C4) setC4(c.C4); if (c.C4_comment) setC4_comment(c.C4_comment);
    if (c.C5) setC5(c.C5); if (c.C5_comment) setC5_comment(c.C5_comment);
    if (c.C6) setC6(c.C6); if (c.C6_comment) setC6_comment(c.C6_comment);
    if (c.C7) setC7(c.C7); if (c.C7_comment) setC7_comment(c.C7_comment);
    if (c.C8) setC8(c.C8); if (c.C8_comment) setC8_comment(c.C8_comment);
    if (c.C9) setC9(c.C9); if (c.C9_comment) setC9_comment(c.C9_comment);
    if (c.C10) setC10(c.C10); if (c.C10_comment) setC10_comment(c.C10_comment);
    if (c.C11) setC11(c.C11); if (c.C11_comment) setC11_comment(c.C11_comment);
    if (c.C12) setC12(c.C12); if (c.C13) setC13(c.C13);
    if (c.C14) setC14(c.C14); if (c.C14_comment) setC14_comment(c.C14_comment);
    if (c.C15) setC15(c.C15); if (c.C15_comment) setC15_comment(c.C15_comment);
    if (c.C16) setC16(c.C16); if (c.C16_comment) setC16_comment(c.C16_comment);
    if (c.C17) setC17(c.C17); if (c.C17_comment) setC17_comment(c.C17_comment);
    if (c.C18) setC18(c.C18);

    // Group D
    if (c.D0LR) setD0LR(c.D0LR); if (c.D0LY) setD0LY(c.D0LY); if (c.D0LB) setD0LB(c.D0LB);
    if (c.D0VR) setD0VR(c.D0VR); if (c.D0VY) setD0VY(c.D0VY); if (c.D0VB) setD0VB(c.D0VB);
    if (c.D0F) setD0F(c.D0F); if (c.D0BV) setD0BV(c.D0BV); if (c.D0REM) setD0REM(c.D0REM);

    if (c.D25LR) setD25LR(c.D25LR); if (c.D25LY) setD25LY(c.D25LY); if (c.D25LB) setD25LB(c.D25LB);
    if (c.D25VR) setD25VR(c.D25VR); if (c.D25VY) setD25VY(c.D25VY); if (c.D25VB) setD25VB(c.D25VB);
    if (c.D25F) setD25F(c.D25F); if (c.D25BV) setD25BV(c.D25BV); if (c.D25REM) setD25REM(c.D25REM);

    if (c.D50LR) setD50LR(c.D50LR); if (c.D50LY) setD50LY(c.D50LY); if (c.D50LB) setD50LB(c.D50LB);
    if (c.D50VR) setD50VR(c.D50VR); if (c.D50VY) setD50VY(c.D50VY); if (c.D50VB) setD50VB(c.D50VB);
    if (c.D50F) setD50F(c.D50F); if (c.D50BV) setD50BV(c.D50BV); if (c.D50REM) setD50REM(c.D50REM);

    if (c.D75LR) setD75LR(c.D75LR); if (c.D75LY) setD75LY(c.D75LY); if (c.D75LB) setD75LB(c.D75LB);
    if (c.D75VR) setD75VR(c.D75VR); if (c.D75VY) setD75VY(c.D75VY); if (c.D75VB) setD75VB(c.D75VB);
    if (c.D75F) setD75F(c.D75F); if (c.D75BV) setD75BV(c.D75BV); if (c.D75REM) setD75REM(c.D75REM);

    if (c.D100LR) setD100LR(c.D100LR); if (c.D100LY) setD100LY(c.D100LY); if (c.D100LB) setD100LB(c.D100LB);
    if (c.D100VR) setD100VR(c.D100VR); if (c.D100VY) setD100VY(c.D100VY); if (c.D100VB) setD100VB(c.D100VB);
    if (c.D100F) setD100F(c.D100F); if (c.D100BV) setD100BV(c.D100BV); if (c.D100REM) setD100REM(c.D100REM);

    // Group E
    if (c.E_runHrs) setE_runHrs(c.E_runHrs);

  } catch (error) {
    console.log('Failed to load commissioning checks:', error);
  } finally {
    setChecksLoading(false);
  }
};

const loadValidationChecks = async () => {
  if (!taskId) return;
  console.log('[VALIDATION] Loading saved validation checks for taskId:', taskId);
  setChecksLoading(true);
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    const data = await getCommissioningProgress(token, taskId);
    const v = data.validationChecks || {};
    console.log('[VALIDATION] validationChecks from API:', JSON.stringify(v));

    if (v.A1) setValA1(v.A1); if (v.A1_comment) setValA1_comment(v.A1_comment);
    if (v.A2) setValA2(v.A2);
    if (v.A3) setValA3(v.A3); if (v.A3_comment) setValA3_comment(v.A3_comment);

    if (v.B1) setValB1(v.B1); if (v.B1_comment) setValB1_comment(v.B1_comment);
    if (v.B2) setValB2(v.B2); if (v.B2_comment) setValB2_comment(v.B2_comment);
    if (v.B3) setValB3(v.B3); if (v.B3_comment) setValB3_comment(v.B3_comment);

    if (v.C1) setValC1(v.C1); if (v.C1_comment) setValC1_comment(v.C1_comment);
    if (v.C2) setValC2(v.C2);
    if (v.C3) setValC3(v.C3); if (v.C3_comment) setValC3_comment(v.C3_comment);
    if (v.C4) setValC4(v.C4); if (v.C4_comment) setValC4_comment(v.C4_comment);

    if (v.D1) setValD1(v.D1); if (v.D1_comment) setValD1_comment(v.D1_comment);
    if (v.D2) setValD2(v.D2); if (v.D2_comment) setValD2_comment(v.D2_comment);
    if (v.D3) setValD3(v.D3); if (v.D3_comment) setValD3_comment(v.D3_comment);
    if (v.D4) setValD4(v.D4); if (v.D4_comment) setValD4_comment(v.D4_comment);
    if (v.D5) setValD5(v.D5); if (v.D5_comment) setValD5_comment(v.D5_comment);

    if (v.E1) setValE1(v.E1); if (v.E1_comment) setValE1_comment(v.E1_comment);
    if (v.E2) setValE2(v.E2); if (v.E2_comment) setValE2_comment(v.E2_comment);
    if (v.E3) setValE3(v.E3); if (v.E3_comment) setValE3_comment(v.E3_comment);

    if (v.F1) setValF1(v.F1); if (v.F1_comment) setValF1_comment(v.F1_comment);
    if (v.F2) setValF2(v.F2); if (v.F2_comment) setValF2_comment(v.F2_comment);
    if (v.F3) setValF3(v.F3);
    if (v.F4) setValF4(v.F4); if (v.F4_comment) setValF4_comment(v.F4_comment);
    if (v.F5) setValF5(v.F5); if (v.F5_comment) setValF5_comment(v.F5_comment);
    if (v.F6) setValF6(v.F6); if (v.F6_comment) setValF6_comment(v.F6_comment);
    if (v.F7) setValF7(v.F7); if (v.F7_comment) setValF7_comment(v.F7_comment);

    if (v.G1) setValG1(v.G1); if (v.G1_comment) setValG1_comment(v.G1_comment);
    if (v.G2) setValG2(v.G2); if (v.G2_comment) setValG2_comment(v.G2_comment);

    console.log('[VALIDATION] ✅ Loaded validation checks into form state');
  } catch (error) {
    console.log('[VALIDATION] Failed to load validation checks:', error);
  } finally {
    setChecksLoading(false);
  }
};
const handleSaveValidationChecks = async () => {
  const section = 'validationChecks';
  console.log('[VALIDATION] Save Validation Checks pressed. taskId =', taskId);
  setSectionSaving(prev => ({ ...prev, [section]: true }));
  setSectionError(prev => ({ ...prev, [section]: '' }));
  setSectionSuccess(prev => ({ ...prev, [section]: false }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token || !taskId) return;

    // "negative" values that require a comment, per field
    const payload: Record<string, string> = {
      A1: valA1, ...(valA1 === 'Replaced' && valA1_comment ? { A1_comment: valA1_comment } : {}),
      A2: valA2, // no comment
      A3: valA3, ...(valA3 === 'Replaced' && valA3_comment ? { A3_comment: valA3_comment } : {}),

      B1: valB1, ...(valB1 === 'Arrested' && valB1_comment ? { B1_comment: valB1_comment } : {}),
      B2: valB2, ...(valB2 === 'Not OK' && valB2_comment ? { B2_comment: valB2_comment } : {}),
      B3: valB3, ...(valB3 === 'Not OK' && valB3_comment ? { B3_comment: valB3_comment } : {}),

      C1: valC1, ...(valC1 === 'Replaced' && valC1_comment ? { C1_comment: valC1_comment } : {}),
      C2: valC2, // no comment
      C3: valC3, ...(valC3 === 'Corrected' && valC3_comment ? { C3_comment: valC3_comment } : {}),
      C4: valC4, ...(valC4 === 'Replaced' && valC4_comment ? { C4_comment: valC4_comment } : {}),

      D1: valD1, ...(valD1 === 'Replaced' && valD1_comment ? { D1_comment: valD1_comment } : {}),
      D2: valD2, ...(valD2 === 'Arrested' && valD2_comment ? { D2_comment: valD2_comment } : {}),
      D3: valD3, ...(valD3 === 'Replaced' && valD3_comment ? { D3_comment: valD3_comment } : {}),
      D4: valD4, ...(valD4 === 'Not OK' && valD4_comment ? { D4_comment: valD4_comment } : {}),
      D5: valD5, ...(valD5 === 'Replaced' && valD5_comment ? { D5_comment: valD5_comment } : {}),

      E1: valE1, ...(valE1 === 'Not OK' && valE1_comment ? { E1_comment: valE1_comment } : {}),
      E2: valE2, ...(valE2 === 'Replaced' && valE2_comment ? { E2_comment: valE2_comment } : {}),
      E3: valE3, ...(valE3 === 'Replaced' && valE3_comment ? { E3_comment: valE3_comment } : {}),

      F1: valF1, ...(valF1 === 'Replaced' && valF1_comment ? { F1_comment: valF1_comment } : {}),
      F2: valF2, ...(valF2 === 'Not OK' && valF2_comment ? { F2_comment: valF2_comment } : {}),
      F3: valF3, // no comment (text field)
      F4: valF4, ...(valF4 === 'Not OK' && valF4_comment ? { F4_comment: valF4_comment } : {}),
      F5: valF5, ...(valF5 === 'Replaced' && valF5_comment ? { F5_comment: valF5_comment } : {}),
      F6: valF6, ...(valF6 === 'Not OK' && valF6_comment ? { F6_comment: valF6_comment } : {}),
      F7: valF7, ...(valF7 === 'Replaced' && valF7_comment ? { F7_comment: valF7_comment } : {}),

      G1: valG1, ...(valG1 === 'Not OK' && valG1_comment ? { G1_comment: valG1_comment } : {}),
      G2: valG2, ...(valG2 === 'Not OK' && valG2_comment ? { G2_comment: valG2_comment } : {}),
    };

    console.log('[VALIDATION] payload being sent:', JSON.stringify(payload));

    await saveValidationProgress(token, taskId, payload);
    console.log('[VALIDATION] ✅ Saved successfully');
    showToast('Validation checks saved!', 'success');
    setSectionSuccess(prev => ({ ...prev, [section]: true }));
  } catch (error: any) {
    console.log('[VALIDATION] ❌ Save FAILED:', error.response?.status, JSON.stringify(error.response?.data) || error.message);
    const msg = error.response?.data?.message || 'Failed to save. Please try again.';
    showToast(msg, 'error');
    setSectionError(prev => ({ ...prev, [section]: msg }));
  } finally {
    setSectionSaving(prev => ({ ...prev, [section]: false }));
  }
};

const saveGroupChecks = async (groupKey: string, checks: Record<string, string>) => {
  setSectionSaving(prev => ({ ...prev, [groupKey]: true }));
  setSectionError(prev => ({ ...prev, [groupKey]: '' }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token || !taskId) return;
    await saveCommissioningProgress(token, taskId, checks);
    showToast('Saved successfully!', 'success');
    setSectionSuccess(prev => ({ ...prev, [groupKey]: true }));
  } catch (error: any) {
    const msg = error.response?.data?.message || 'Failed to save. Please try again.';
    showToast(msg, 'error');
    setSectionError(prev => ({ ...prev, [groupKey]: msg }));
  } finally {
    setSectionSaving(prev => ({ ...prev, [groupKey]: false }));
  }
};

const handleSaveGroupA = () => saveGroupChecks('groupA', {
  A1, ...(A1.toLowerCase() === 'not ok' && A1_comment ? { A1_comment } : {}),
  A2, ...(A2.toLowerCase() === 'not ok' && A2_comment ? { A2_comment } : {}),
  A3, ...(A3.toLowerCase() === 'not ok' && A3_comment ? { A3_comment } : {}),
  A4, ...(A4.toLowerCase() === 'not ok' && A4_comment ? { A4_comment } : {}),
  A5, ...(A5.toLowerCase() === 'not ok' && A5_comment ? { A5_comment } : {}),
  A6, ...(A6.toLowerCase() === 'not ok' && A6_comment ? { A6_comment } : {}),
  A7, ...(A7.toLowerCase() === 'not ok' && A7_comment ? { A7_comment } : {}),
  A8, ...(A8.toLowerCase() === 'not ok' && A8_comment ? { A8_comment } : {}),
  A9, ...(A9.toLowerCase() === 'not ok' && A9_comment ? { A9_comment } : {}),
  A10, ...(A10.toLowerCase() === 'not ok' && A10_comment ? { A10_comment } : {}),
  ...(A17 ? { A17 } : {}),
  ...(A18 ? { A18 } : {}),
  ...(A19 ? { A19 } : {}),
  ...(A11 ? { A11 } : {}),
  ...(A12 ? { A12 } : {}),
  ...(A13 ? { A13 } : {}),
});

const handleSaveGroupB = () => saveGroupChecks('groupB', {
  B1, ...(B1.toLowerCase() === 'not ok' && B1_comment ? { B1_comment } : {}),
  B2, ...(B2.toLowerCase() === 'not ok' && B2_comment ? { B2_comment } : {}),
  B3, ...(B3.toLowerCase() === 'not ok' && B3_comment ? { B3_comment } : {}),
  B4a, ...(B4a.toLowerCase() === 'not ok' && B4a_comment ? { B4a_comment } : {}),
  B4b, ...(B4b.toLowerCase() === 'not ok' && B4b_comment ? { B4b_comment } : {}),
  B4c, ...(B4c.toLowerCase() === 'not ok' && B4c_comment ? { B4c_comment } : {}),
  B4d, ...(B4d.toLowerCase() === 'not ok' && B4d_comment ? { B4d_comment } : {}),
  ...(B5R ? { B5R } : {}),
  ...(B5Y ? { B5Y } : {}),
  ...(B5B ? { B5B } : {}),
});

const handleSaveGroupC = () => saveGroupChecks('groupC', {
  C1, ...(C1.toLowerCase() === 'not ok' && C1_comment ? { C1_comment } : {}),
  C2, ...(C2.toLowerCase() === 'not ok' && C2_comment ? { C2_comment } : {}),
  C3, ...(C3.toLowerCase() === 'not ok' && C3_comment ? { C3_comment } : {}),
  C4, ...(C4.toLowerCase() === 'not ok' && C4_comment ? { C4_comment } : {}),
  C5, ...(C5.toLowerCase() === 'not ok' && C5_comment ? { C5_comment } : {}),
  C6, ...(C6.toLowerCase() === 'not ok' && C6_comment ? { C6_comment } : {}),
  C7, ...(C7.toLowerCase() === 'not ok' && C7_comment ? { C7_comment } : {}),
  C8, ...(C8.toLowerCase() === 'not ok' && C8_comment ? { C8_comment } : {}),
  C9, ...(C9.toLowerCase() === 'not ok' && C9_comment ? { C9_comment } : {}),
  C10, ...(C10.toLowerCase() === 'not ok' && C10_comment ? { C10_comment } : {}),
  C11, ...(C11.toLowerCase() === 'not ok' && C11_comment ? { C11_comment } : {}),
  C14, ...(C14.toLowerCase() === 'not ok' && C14_comment ? { C14_comment } : {}),
  C15, ...(C15.toLowerCase() === 'not ok' && C15_comment ? { C15_comment } : {}),
  C16, ...(C16.toLowerCase() === 'not ok' && C16_comment ? { C16_comment } : {}),
  C17, ...(C17.toLowerCase() === 'not ok' && C17_comment ? { C17_comment } : {}),
  ...(C12 ? { C12 } : {}),
  ...(C13 ? { C13 } : {}),
  ...(C18 ? { C18 } : {}),
});

const handleSaveGroupD = () => saveGroupChecks('groupD', {
  ...(D0LR ? { D0LR } : {}), ...(D0LY ? { D0LY } : {}), ...(D0LB ? { D0LB } : {}),
  ...(D0VR ? { D0VR } : {}), ...(D0VY ? { D0VY } : {}), ...(D0VB ? { D0VB } : {}),
  ...(D0F ? { D0F } : {}), ...(D0BV ? { D0BV } : {}), ...(D0REM ? { D0REM } : {}),
  ...(D25LR ? { D25LR } : {}), ...(D25LY ? { D25LY } : {}), ...(D25LB ? { D25LB } : {}),
  ...(D25VR ? { D25VR } : {}), ...(D25VY ? { D25VY } : {}), ...(D25VB ? { D25VB } : {}),
  ...(D25F ? { D25F } : {}), ...(D25BV ? { D25BV } : {}), ...(D25REM ? { D25REM } : {}),
  ...(D50LR ? { D50LR } : {}), ...(D50LY ? { D50LY } : {}), ...(D50LB ? { D50LB } : {}),
  ...(D50VR ? { D50VR } : {}), ...(D50VY ? { D50VY } : {}), ...(D50VB ? { D50VB } : {}),
  ...(D50F ? { D50F } : {}), ...(D50BV ? { D50BV } : {}), ...(D50REM ? { D50REM } : {}),
  ...(D75LR ? { D75LR } : {}), ...(D75LY ? { D75LY } : {}), ...(D75LB ? { D75LB } : {}),
  ...(D75VR ? { D75VR } : {}), ...(D75VY ? { D75VY } : {}), ...(D75VB ? { D75VB } : {}),
  ...(D75F ? { D75F } : {}), ...(D75BV ? { D75BV } : {}), ...(D75REM ? { D75REM } : {}),
  ...(D100LR ? { D100LR } : {}), ...(D100LY ? { D100LY } : {}), ...(D100LB ? { D100LB } : {}),
  ...(D100VR ? { D100VR } : {}), ...(D100VY ? { D100VY } : {}), ...(D100VB ? { D100VB } : {}),
  ...(D100F ? { D100F } : {}), ...(D100BV ? { D100BV } : {}), ...(D100REM ? { D100REM } : {}),
});

const handleSaveGroupE = () => saveGroupChecks('groupE', {
  ...(E_runHrs ? { E_runHrs } : {}),
});
// ── Task type detection ──
const taskTypeRaw = params.taskType || 'Re-Commissioning';
const normalizedTaskType = taskTypeRaw.toLowerCase().replace(/[\s-]/g, '');
const isRevalidation = normalizedTaskType === 'revalidation';
const isPreCommissioning = normalizedTaskType === 'precommissioning';

// Pre-Commissioning skips step 2 entirely (7 steps total).
// Revalidation keeps step 2 but with different content (8 steps total).
// Commissioning / Re-Commissioning use the default flow (8 steps total).
const stepSequence = useMemo(() => {
  return isPreCommissioning ? [1, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
}, [isPreCommissioning]);

console.log('[FORM] taskType =', taskTypeRaw, '| isRevalidation =', isRevalidation, '| isPreCommissioning =', isPreCommissioning, '| stepSequence =', stepSequence);
 
// ── Step 5 state — Genset Commissioning Readings ──
const [acVoltageRY, setAcVoltageRY] = useState('');
const [acVoltageYB, setAcVoltageYB] = useState('');
const [acVoltageBR, setAcVoltageBR] = useState('');
const [acAmpR, setAcAmpR] = useState('');
const [acAmpY, setAcAmpY] = useState('');
const [acAmpB, setAcAmpB] = useState('');
const [loadKwR, setLoadKwR] = useState('');
const [loadKwY, setLoadKwY] = useState('');
const [loadKwB, setLoadKwB] = useState('');
const [totalKwLoad, setTotalKwLoad] = useState('');
const [loadPercentage, setLoadPercentage] = useState('');
const [rpm, setRpm] = useState('');
const [frequency, setFrequency] = useState('');
const [dcVoltage, setDcVoltage] = useState('');
const [oilPressure, setOilPressure] = useState('');
const [coolantTemperature, setCoolantTemperature] = useState('');
const [defLevelPercentage, setDefLevelPercentage] = useState('');
const [oilLevel, setOilLevel] = useState('');
const [oilLevelComment, setOilLevelComment] = useState('');
const [coolantLevel, setCoolantLevel] = useState('');
const [coolantLevelComment, setCoolantLevelComment] = useState('');

// Readings saved info (from API response)
const [readingsSavedBy, setReadingsSavedBy] = useState<{ name: string; role: string } | null>(null);
const [readingsSavedAt, setReadingsSavedAt] = useState<string | null>(null);
const [readingsSaving, setReadingsSaving] = useState(false);
const [readingsError, setReadingsError] = useState('');
const [readingsSuccess, setReadingsSuccess] = useState(false);


const [customerName, setCustomerName] = useState('');
const [customerFeedback, setCustomerFeedback] = useState('');
const [partPickerVisible, setPartPickerVisible] = useState(false);
const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);

  // Engine Parameters — OK/Not OK checks
  const [oilLevelCheck, setOilLevelCheck] = useState<CheckItem>(makeCheckItem('oilLevel', 'Oil Level'));
  const [coolantLevelCheck, setCoolantLevelCheck] = useState<CheckItem>(makeCheckItem('coolantLevel', 'Coolant Level'));

  const [step5Saved, setStep5Saved] = useState(false);
  const [assetLoading, setAssetLoading] = useState(false);
const [sectionSaving, setSectionSaving] = useState<Record<string, boolean>>({});
const [sectionError, setSectionError] = useState<Record<string, string>>({});
const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({});

  const [userName, setUserName] = useState('');


  // ── Step 1 form state ──
  const [gensetModel, setGensetModel] = useState('');
  const [gensetSrNumber, setGensetSrNumber] = useState('H2318920');
  const [engineModel, setEngineModel] = useState('');
  const [engineNumber, setEngineNumber] = useState('K2209213');
  const [engineKw, setEngineKw] = useState('ad');
  const [engineType, setEngineType] = useState('NA 3000');
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

  const [typeOfService, setTypeOfService] = useState('');
  const [warrantyStatus, setWarrantyStatus] = useState('');
   const [commissioningDate, setCommissioningDate] = useState('06/20/2026');
    
  const normalizeStatus = (val: string): 'OK' | 'NOT_OK' | 'NA' | null => {
  if (!val) return null;
  const upper = val.toUpperCase();
  if (upper === 'OK') return 'OK';
  if (upper === 'NOT OK') return 'NOT_OK';
  if (upper === 'N/A') return 'NA';
  return null;
};

const loadGensetReadings = async () => {
  if (!taskId) return;
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const data = await getCommissioningProgress(token, taskId);
    const r = data.gensetReadings;
    if (!r) return; // no previous readings — leave fields empty

    if (r.acVoltageRY !== undefined) setAcVoltageRY(String(r.acVoltageRY));
    if (r.acVoltageYB !== undefined) setAcVoltageYB(String(r.acVoltageYB));
    if (r.acVoltageBR !== undefined) setAcVoltageBR(String(r.acVoltageBR));
    if (r.acAmpR !== undefined) setAcAmpR(String(r.acAmpR));
    if (r.acAmpY !== undefined) setAcAmpY(String(r.acAmpY));
    if (r.acAmpB !== undefined) setAcAmpB(String(r.acAmpB));
    if (r.loadKwR !== undefined) setLoadKwR(String(r.loadKwR));
    if (r.loadKwY !== undefined) setLoadKwY(String(r.loadKwY));
    if (r.loadKwB !== undefined) setLoadKwB(String(r.loadKwB));
    if (r.totalKwLoad !== undefined) setTotalKwLoad(String(r.totalKwLoad));
    if (r.loadPercentage !== undefined) setLoadPercentage(String(r.loadPercentage));
    if (r.rpm !== undefined) setRpm(String(r.rpm));
    if (r.frequency !== undefined) setFrequency(String(r.frequency));
    if (r.dcVoltage !== undefined) setDcVoltage(String(r.dcVoltage));
    if (r.oilPressure !== undefined) setOilPressure(String(r.oilPressure));
    if (r.coolantTemperature !== undefined) setCoolantTemperature(String(r.coolantTemperature));
    if (r.defLevelPercentage !== undefined) setDefLevelPercentage(String(r.defLevelPercentage));
    if (r.oilLevel) setOilLevel(r.oilLevel);
    if (r.oilLevelComment) setOilLevelComment(r.oilLevelComment);
    if (r.coolantLevel) setCoolantLevel(r.coolantLevel);
    if (r.coolantLevelComment) setCoolantLevelComment(r.coolantLevelComment);

    // Saved by info for display
    if (r.savedBy) setReadingsSavedBy(r.savedBy);
    if (r.savedAt) setReadingsSavedAt(r.savedAt);

  } catch (error) {
    console.log('Failed to load genset readings:', error);
  }
};

const handleSaveReadings = async () => {
  setReadingsSaving(true);
  setReadingsError('');
  setReadingsSuccess(false);
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token || !taskId) return;

    const now = new Date().toISOString();

    await saveCommissioningReadings(token, taskId, {
      acVoltageRY: acVoltageRY ? Number(acVoltageRY) : undefined,
      acVoltageYB: acVoltageYB ? Number(acVoltageYB) : undefined,
      acVoltageBR: acVoltageBR ? Number(acVoltageBR) : undefined,
      acAmpR: acAmpR ? Number(acAmpR) : undefined,
      acAmpY: acAmpY ? Number(acAmpY) : undefined,
      acAmpB: acAmpB ? Number(acAmpB) : undefined,
      loadKwR: loadKwR ? Number(loadKwR) : undefined,
      loadKwY: loadKwY ? Number(loadKwY) : undefined,
      loadKwB: loadKwB ? Number(loadKwB) : undefined,
      totalKwLoad: totalKwLoad ? Number(totalKwLoad) : undefined,
      loadPercentage: loadPercentage ? Number(loadPercentage) : undefined,
      rpm: rpm ? Number(rpm) : undefined,
      frequency: frequency ? Number(frequency) : undefined,
      dcVoltage: dcVoltage ? Number(dcVoltage) : undefined,
      oilPressure: oilPressure ? Number(oilPressure) : undefined,
      coolantTemperature: coolantTemperature ? Number(coolantTemperature) : undefined,
      defLevelPercentage: defLevelPercentage ? Number(defLevelPercentage) : undefined,
      oilLevel: oilLevel || undefined,
      ...(oilLevel.toUpperCase() === 'NOT OK' && oilLevelComment
        ? { oilLevelComment }
        : {}),
      coolantLevel: coolantLevel || undefined,
      ...(coolantLevel.toUpperCase() === 'NOT OK' && coolantLevelComment
        ? { coolantLevelComment }
        : {}),
      savedBy: {
        name: assignedToName,
        role: assignedToRole,
      },
      savedAt: now,
      commissioningId: taskId,
    });

    // Update displayed saved info locally after success
    setReadingsSavedBy({ name: assignedToName, role: assignedToRole });
    setReadingsSavedAt(now);
    setReadingsSuccess(true);
    showToast('Readings saved successfully!', 'success');

  } catch (error: any) {
    const msg = error.response?.data?.message || 'Failed to save readings. Please try again.';
    setReadingsError(msg);
    showToast(msg, 'error');
  } finally {
    setReadingsSaving(false);
  }
};
useEffect(() => {
  if (assetId) {
    loadAssetData();
  }
}, [assetId]);


useEffect(() => {
  if (currentStep === 2 && taskId) {
    if (isRevalidation) {
      console.log('[FORM] Step 2 landed — task is Revalidation, loading VALIDATION checks');
      loadValidationChecks();
    } else {
      console.log('[FORM] Step 2 landed — loading COMMISSIONING checks');
      loadCommissioningChecks();
    }
  }
  if (currentStep === 5 && taskId) {
    loadGensetReadings();
  }
  if (currentStep === 8) {
    console.log('[STEP8] Landed on step 8. taskId =', taskId);
  }
}, [currentStep]);

const loadAssetData = async () => {
  setAssetLoading(true);
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const data = await getAssetById(token, assetId);

    // Populate Genset Identification fields
    if (data.gensetModel) setGensetModel(data.gensetModel);
    if (data.gensetNumber) setGensetSrNumber(data.gensetNumber);
    if (data.engineModel) setEngineModel(data.engineModel);
    if (data.engineNumber) setEngineNumber(data.engineNumber);
    if (data.kw) setEngineKw(data.kw);
    if (data.engineType) setEngineType(data.engineType);
    if (data.engineFamily) setEngineFamily(data.engineFamily);
    if (data.fuelType) setFuelType(data.fuelType);
    if (data.applicationMaterial) setApplication(data.applicationMaterial);

    // Populate Alternator & Panel fields
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
    if (data.loadUnbalance !== undefined) setLoadUnbalance(data.loadUnbalance ? 'Yes' : 'No');
    if (data.loadUnbalancePercentage !== undefined) setLoadUnbalancePercentage(String(data.loadUnbalancePercentage));

    // Populate Service fields
    if (data.serviceType) setTypeOfService(data.serviceType);
    if (data.warrantyStatus) setWarrantyStatus(data.warrantyStatus);

  } catch (error) {
    console.log('Failed to load asset:', error);
  } finally {
    setAssetLoading(false);
  }
};
const handleSaveGensetIdentification = async () => {
  const section = 'genset';
  setSectionSaving(prev => ({ ...prev, [section]: true }));
  setSectionError(prev => ({ ...prev, [section]: '' }));
  setSectionSuccess(prev => ({ ...prev, [section]: false }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token || !assetId) return;

    await updateAsset(token, assetId, {
      gensetModel,
      gensetNumber: gensetSrNumber,
      engineModel,
      engineNumber,
      kw: engineKw,
      engineType,
      engineFamily,
      fuelType,
      applicationMaterial: application,
    });

    setSectionSuccess(prev => ({ ...prev, [section]: true }));
  } catch (error: any) {
    setSectionError(prev => ({
      ...prev,
      [section]: error.response?.data?.message || 'Failed to save. Please try again.',
    }));
  } finally {
    setSectionSaving(prev => ({ ...prev, [section]: false }));
  }
};

const handleSaveAlternatorPanel = async () => {
  const section = 'alternator';
  setSectionSaving(prev => ({ ...prev, [section]: true }));
  setSectionError(prev => ({ ...prev, [section]: '' }));
  setSectionSuccess(prev => ({ ...prev, [section]: false }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token || !assetId) return;

    await updateAsset(token, assetId, {
      alternatorMake: altMake,
      alternatorModel: altModel,
      alternatorSerialNumber: altSn,
      atsSerialNumber: atsSn,
      batterySerialNumber: batterySn,
      kva,
      phase,
      panelType,
      controlPanelSerialNumber: panelSn,
      cpcb: cpcbNorm,
      loadUnbalanceComment: null,
      loadUnbalancePercentage: loadUnbalancePercentage ? Number(loadUnbalancePercentage) : undefined,
    });

    setSectionSuccess(prev => ({ ...prev, [section]: true }));
  } catch (error: any) {
    setSectionError(prev => ({
      ...prev,
      [section]: error.response?.data?.message || 'Failed to save. Please try again.',
    }));
  } finally {
    setSectionSaving(prev => ({ ...prev, [section]: false }));
  }
};

const handleSaveService = async () => {
  const section = 'service';
  setSectionSaving(prev => ({ ...prev, [section]: true }));
  setSectionError(prev => ({ ...prev, [section]: '' }));
  setSectionSuccess(prev => ({ ...prev, [section]: false }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token || !assetId) return;

    await updateAsset(token, assetId, {
      serviceType: typeOfService,
      warrantyStatus,
    });

    setSectionSuccess(prev => ({ ...prev, [section]: true }));
  } catch (error: any) {
    setSectionError(prev => ({
      ...prev,
      [section]: error.response?.data?.message || 'Failed to save. Please try again.',
    }));
  } finally {
    setSectionSaving(prev => ({ ...prev, [section]: false }));
  }
};




 

 



  

 
const [loadUnbalancePercentage, setLoadUnbalancePercentage] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  // ── Step 3 form state (Complaint Codes) ──
  const [selectedComplaintCodes, setSelectedComplaintCodes] = useState<SelectedComplaintCode[]>([]);
  const [complaintPickerVisible, setComplaintPickerVisible] = useState(false);

const handleSelectPart = (part: ApiPart) => {
  setSelectedParts(prev => {
    const existing = prev.find(p => p.partId === part._id);
    if (existing) {
      return prev.map(p => p.partId === part._id
        ? { ...p, quantity: p.quantity + 1 }
        : p
      );
    }
    return [...prev, {
      partId: part._id,
      code: part.code,
      name: part.name,
      unit: part.unit,
      category: part.category,
      subCategory: part.subCategory,
      quantity: 1,
    }];
  });
};

const handleIncreaseQty = (partId: string) => {
  setSelectedParts(prev => prev.map(p => p.partId === partId
    ? { ...p, quantity: p.quantity + 1 } : p));
};

const handleDecreaseQty = (partId: string) => {
  setSelectedParts(prev => prev.map(p => p.partId === partId
    ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p));
};

const handleRemovePart = (partId: string) => {
  setSelectedParts(prev => prev.filter(p => p.partId !== partId));
};

const generateRandomOtp = (): string[] => {
  return Array.from({ length: 4 }, () => String(Math.floor(Math.random() * 10)));
};



const handleSaveFaultCodes = async () => {
  await saveFaultCodes(selectedComplaintCodes);
};

const handleSavePartsUsed = async () => {
  await savePartsUsed(selectedParts);
};




  // Electrical Readings
 

  const ENGINE_FAMILY_OPTIONS = [
    'Cyl', 'V Twin', '3Cycl Bosch', '3 Cyl Stanadyne', '4 Cyl 4.5 Ltr',
    '6 Cyl 6.8 Ltr', '6 Cyl 7.8 Ltr', 'Escort Kubota', 'VECV',
  ];
  const FUEL_TYPE_OPTIONS = ['Diesel', 'CNG', 'LNG', 'LPG', 'PNG', 'Biogas'];
  const APPLICATION_OPTIONS = [
    'Genset', 'G-Drive', 'Fire Pump', 'Marine', 'APU',
    'Pump Set', 'Tractor', 'Compressor', 'Lighting Tower',
  ];
  const PHASE_OPTIONS = ['Single Phase', 'Three Phase'];
  const PANEL_TYPE_OPTIONS = ['STD', 'ASAS', 'AMF', 'SYNC'];
  const CPCB_NORM_OPTIONS = ['CPCB I', 'CPCB II', 'CPCB IV+'];
  const TYPE_OF_SERVICE_OPTIONS = ['Warranty', 'Paid'];
  const WARRANTY_STATUS_OPTIONS = ['Under Warranty', 'Out of Warranty'];

  // ── Step 2 form state ──

 
  const complaintCodeUidRef = React.useRef(0);

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────



  // ─────────────────────────────────────────────────────────
  // NAVIGATION HANDLERS
  // ─────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/screens/login');
        },
      },
    ]);
  };

  const goToMyTasks = () => {
    router.push('/screens/commissioningTasks');
  };

const handleNext = () => {
    const idx = stepSequence.indexOf(currentStep);
    console.log('[FORM] handleNext — current step:', currentStep, '| index in sequence:', idx);
    if (idx !== -1 && idx < stepSequence.length - 1) {
      const nextStep = stepSequence[idx + 1];
      console.log('[FORM] Moving to step:', nextStep);
      setCurrentStep(nextStep);
    } else {
      Alert.alert('Done', 'This was the final step.');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleBack = () => {
    const idx = stepSequence.indexOf(currentStep);
    console.log('[FORM] handleBack — current step:', currentStep, '| index in sequence:', idx);
    if (idx > 0) {
      const prevStep = stepSequence[idx - 1];
      console.log('[FORM] Moving back to step:', prevStep);
      setCurrentStep(prevStep);
    } else {
      router.back();
    }
  };

  // ─────────────────────────────────────────────────────────
  // STEP 1 HELPERS
  // ─────────────────────────────────────────────────────────

  const gensetMissingCount = [
    gensetModel, engineModel, engineFamily, fuelType, application,
  ].filter(v => !v).length;

  const altMissingCount = [
    altMake, altModel, altSn, atsSn, batterySn, kva, phase, panelType, panelSn, cpcbNorm,
    loadUnbalance,
  ].filter(v => !v).length;

  const serviceMissingCount = [
    typeOfService, warrantyStatus,
  ].filter(v => !v).length;

  const handleSaveSection = (sectionName: string) => {
    Alert.alert('Saved', `${sectionName} saved locally.`);
  };

  // ─────────────────────────────────────────────────────────
  // STEP 2 GENERIC HELPERS
  // ─────────────────────────────────────────────────────────

 





 


  // ─────────────────────────────────────────────────────────
  // STEP 3 HELPERS (Complaint Codes)
  // ─────────────────────────────────────────────────────────

  const handleOpenComplaintPicker = () => {
    setComplaintPickerVisible(true);
  };

  const handleCloseComplaintPicker = () => {
    setComplaintPickerVisible(false);
  };

  // For PRE_COMM, steps 3 & 4 become steps 2 & 3 (no commissioning checks step)
const isPreComm = params.taskType === 'PRE_COMM';
const effectiveStep = (step: number) => {
  if (!isPreComm) return step;
  // Shift: step 2 = complaint codes, step 3 = parts used
  if (step === 2) return 3; // render step 3 content at step 2
  if (step === 3) return 4; // render step 4 content at step 3
  return step;
};

const handleSelectComplaintCode = (faultCode: ApiFaultCode) => {
  complaintCodeUidRef.current += 1;
  const newEntry: SelectedComplaintCode = {
    uid: `cc_${complaintCodeUidRef.current}`,
    codeId: faultCode._id,
    categoryName: faultCode.category,
    subcategoryName: faultCode.subCategory,
    code: faultCode.code,
    priority: faultCode.priority,
    title: faultCode.description,
    observation: '',
    rootCause: '',
  };
  setSelectedComplaintCodes(prev => [...prev, newEntry]);
  setComplaintPickerVisible(false);
};

  const handleRemoveComplaintCode = (uid: string) => {
    setSelectedComplaintCodes(prev => prev.filter(item => item.uid !== uid));
  };

  const handleChangeComplaintObservation = (uid: string, text: string) => {
    setSelectedComplaintCodes(prev =>
      prev.map(item => (item.uid === uid ? { ...item, observation: text } : item))
    );
  };

  const handleChangeComplaintRootCause = (uid: string, text: string) => {
    setSelectedComplaintCodes(prev =>
      prev.map(item => (item.uid === uid ? { ...item, rootCause: text } : item))
    );
  };

  // ─────────────────────────────────────────────────────────
  // STEP 5 HELPERS (Genset Commissioning Readings)
  // ─────────────────────────────────────────────────────────

  const updateSingleCheckItem = (
    item: CheckItem,
    setItem: React.Dispatch<React.SetStateAction<CheckItem>>,
    updates: Partial<CheckItem>
  ) => {
    setItem({ ...item, ...updates });
    setStep5Saved(false);
  };

  const handleSetSingleCheckStatus = (
    item: CheckItem,
    setItem: React.Dispatch<React.SetStateAction<CheckItem>>,
    status: CheckItemStatus
  ) => {
    updateSingleCheckItem(item, setItem, { status });
  };

  const handleSaveSingleCheckComment = (
    item: CheckItem,
    setItem: React.Dispatch<React.SetStateAction<CheckItem>>
  ) => {
    updateSingleCheckItem(item, setItem, { itemSaved: true, editingComment: false });
  };

  const handleEditSingleCheckComment = (
    item: CheckItem,
    setItem: React.Dispatch<React.SetStateAction<CheckItem>>
  ) => {
    setItem({ ...item, editingComment: true });
  };

  const handleSaveStep5Readings = () => {
    setStep5Saved(true);
  };


   const loadUser = async () => {
  try {
    const savedUser = await AsyncStorage.getItem('userData');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setUserName(user.name);
    }
  } catch (error) {
    console.log(error);
  }
};

useEffect(() => {
  loadUser();
}, []);
return {
  apiFaultCodes, faultCodesLoading,
apiParts, partsLoading,
step3Saving, step3Error, step3Success, handleSaveFaultCodes,
step4Saving, step4Error, step4Success, handleSavePartsUsed,
  otpLoading, otpError, taskCompleted,

  assetLoading,
  sectionSaving,
  sectionError,
  sectionSuccess,
  loadUnbalancePercentage,
  setLoadUnbalancePercentage,
  handleSaveGensetIdentification,
  handleSaveAlternatorPanel,
  handleSaveService,
   router, params, TOTAL_STEPS, stepSequence,
    isRevalidation, isPreCommissioning,
    userName, currentStep, setCurrentStep,isPreComm ,

    // Step 1
gensetModel, setGensetModel, gensetSrNumber, setGensetSrNumber, engineModel, setEngineModel,
    engineNumber, setEngineNumber, engineKw, setEngineKw, engineType, setEngineType, engineFamily, setEngineFamily,
    fuelType, setFuelType, application, setApplication,
    altMake, setAltMake, altModel, setAltModel, altSn, setAltSn, atsSn, setAtsSn,
    batterySn, setBatterySn, kva, setKva, phase, setPhase, panelType, setPanelType,
    panelSn, setPanelSn, cpcbNorm, setCpcbNorm, loadUnbalance, setLoadUnbalance,
    typeOfService, setTypeOfService, warrantyStatus, setWarrantyStatus,
    commissioningDate, setCommissioningDate,
    ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS, PHASE_OPTIONS,
    PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS, TYPE_OF_SERVICE_OPTIONS, WARRANTY_STATUS_OPTIONS,
    gensetMissingCount, altMissingCount, serviceMissingCount, handleSaveSection,

    
    // Step 3
    selectedComplaintCodes, setSelectedComplaintCodes, complaintPickerVisible, setComplaintPickerVisible,
    handleOpenComplaintPicker, handleCloseComplaintPicker, handleSelectComplaintCode,
    handleRemoveComplaintCode, handleChangeComplaintObservation, handleChangeComplaintRootCause,

    // Step 4
    partPickerVisible, setPartPickerVisible, selectedParts, setSelectedParts,
    handleSelectPart, handleIncreaseQty, handleDecreaseQty, handleRemovePart,


// Step 5
acVoltageRY, setAcVoltageRY,
acVoltageYB, setAcVoltageYB,
acVoltageBR, setAcVoltageBR,
acAmpR, setAcAmpR,
acAmpY, setAcAmpY,
acAmpB, setAcAmpB,
loadKwR, setLoadKwR,
loadKwY, setLoadKwY,
loadKwB, setLoadKwB,
totalKwLoad, setTotalKwLoad,
loadPercentage, setLoadPercentage,
rpm, setRpm,
frequency, setFrequency,
dcVoltage, setDcVoltage,
oilPressure, setOilPressure,
coolantTemperature, setCoolantTemperature,
defLevelPercentage, setDefLevelPercentage,
oilLevel, setOilLevel,
oilLevelComment, setOilLevelComment,
coolantLevel, setCoolantLevel,
coolantLevelComment, setCoolantLevelComment,
readingsSavedBy,
readingsSavedAt,
readingsSaving,
readingsError,
readingsSuccess,
handleSaveReadings,
   // Step 6
    sitePhotos, setSitePhotos, photoOptionsVisible, setPhotoOptionsVisible,
    handleTakeSitePhoto, handleChooseSitePhotos, handleRemoveSitePhoto,

    // Step 2 — Running Hours photos + combined photo upload
    runningHoursPhotos, setRunningHoursPhotos,
    step2PhotoOptionsVisible, setStep2PhotoOptionsVisible,
    handleTakeRunningHoursPhoto, handleChooseRunningHoursPhotos, handleRemoveRunningHoursPhoto,
    photosUploading, photosUploadError, photosUploadSuccess, uploadedPhotoUrls,
    handleSaveAllPhotos,

    // Step 7
    customerName, setCustomerName, customerFeedback, setCustomerFeedback,

    // Step 8
    otpGenerated, generatedOtp, customerOtp, otpInputRefs,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleVerifyAndComplete,

    // Navigation
    handleLogout, goToMyTasks, handleNext, handleCancel, handleBack,
      // ...existing returns...
  checksLoading,
  toastVisible, toastMessage, toastType,

  // Group A
  A1, setA1, A1_comment, setA1_comment,
  A2, setA2, A2_comment, setA2_comment,
  A3, setA3, A3_comment, setA3_comment,
  A4, setA4, A4_comment, setA4_comment,
  A5, setA5, A5_comment, setA5_comment,
  A6, setA6, A6_comment, setA6_comment,
  A7, setA7, A7_comment, setA7_comment,
  A8, setA8, A8_comment, setA8_comment,
  A9, setA9, A9_comment, setA9_comment,
  A10, setA10, A10_comment, setA10_comment,
  A17, setA17, A18, setA18, A19, setA19,
  A11, setA11, A12, setA12, A13, setA13,

  // Group B
  B1, setB1, B1_comment, setB1_comment,
  B2, setB2, B2_comment, setB2_comment,
  B3, setB3, B3_comment, setB3_comment,
  B4a, setB4a, B4a_comment, setB4a_comment,
  B4b, setB4b, B4b_comment, setB4b_comment,
  B4c, setB4c, B4c_comment, setB4c_comment,
  B4d, setB4d, B4d_comment, setB4d_comment,
  B5R, setB5R, B5Y, setB5Y, B5B, setB5B,

  // Group C
  C1, setC1, C1_comment, setC1_comment,
  C2, setC2, C2_comment, setC2_comment,
  C3, setC3, C3_comment, setC3_comment,
  C4, setC4, C4_comment, setC4_comment,
  C5, setC5, C5_comment, setC5_comment,
  C6, setC6, C6_comment, setC6_comment,
  C7, setC7, C7_comment, setC7_comment,
  C8, setC8, C8_comment, setC8_comment,
  C9, setC9, C9_comment, setC9_comment,
  C10, setC10, C10_comment, setC10_comment,
  C11, setC11, C11_comment, setC11_comment,
  C12, setC12, C13, setC13, C18, setC18,
  C14, setC14, C14_comment, setC14_comment,
  C15, setC15, C15_comment, setC15_comment,
  C16, setC16, C16_comment, setC16_comment,
  C17, setC17, C17_comment, setC17_comment,

  // Group D
  D0LR, setD0LR, D0LY, setD0LY, D0LB, setD0LB,
  D0VR, setD0VR, D0VY, setD0VY, D0VB, setD0VB,
  D0F, setD0F, D0BV, setD0BV, D0REM, setD0REM,
  D25LR, setD25LR, D25LY, setD25LY, D25LB, setD25LB,
  D25VR, setD25VR, D25VY, setD25VY, D25VB, setD25VB,
  D25F, setD25F, D25BV, setD25BV, D25REM, setD25REM,
  D50LR, setD50LR, D50LY, setD50LY, D50LB, setD50LB,
  D50VR, setD50VR, D50VY, setD50VY, D50VB, setD50VB,
  D50F, setD50F, D50BV, setD50BV, D50REM, setD50REM,
  D75LR, setD75LR, D75LY, setD75LY, D75LB, setD75LB,
  D75VR, setD75VR, D75VY, setD75VY, D75VB, setD75VB,
  D75F, setD75F, D75BV, setD75BV, D75REM, setD75REM,
  D100LR, setD100LR, D100LY, setD100LY, D100LB, setD100LB,
  D100VR, setD100VR, D100VY, setD100VY, D100VB, setD100VB,
  D100F, setD100F, D100BV, setD100BV, D100REM, setD100REM,

  // Group E
  E_runHrs, setE_runHrs,

  // Handlers
 // Handlers
  normalizeStatus,
  handleSaveGroupA,
  handleSaveGroupB,
  handleSaveGroupC,
  handleSaveGroupD,
  handleSaveGroupE,

  // Validation Checks (Revalidation task type)
// Validation Checks (Revalidation task type)
  valA1, setValA1, valA1_comment, setValA1_comment,
  valA2, setValA2,
  valA3, setValA3, valA3_comment, setValA3_comment,

  valB1, setValB1, valB1_comment, setValB1_comment,
  valB2, setValB2, valB2_comment, setValB2_comment,
  valB3, setValB3, valB3_comment, setValB3_comment,

  valC1, setValC1, valC1_comment, setValC1_comment,
  valC2, setValC2,
  valC3, setValC3, valC3_comment, setValC3_comment,
  valC4, setValC4, valC4_comment, setValC4_comment,

  valD1, setValD1, valD1_comment, setValD1_comment,
  valD2, setValD2, valD2_comment, setValD2_comment,
  valD3, setValD3, valD3_comment, setValD3_comment,
  valD4, setValD4, valD4_comment, setValD4_comment,
  valD5, setValD5, valD5_comment, setValD5_comment,

  valE1, setValE1, valE1_comment, setValE1_comment,
  valE2, setValE2, valE2_comment, setValE2_comment,
  valE3, setValE3, valE3_comment, setValE3_comment,

  valF1, setValF1, valF1_comment, setValF1_comment,
  valF2, setValF2, valF2_comment, setValF2_comment,
  valF3, setValF3,
  valF4, setValF4, valF4_comment, setValF4_comment,
  valF5, setValF5, valF5_comment, setValF5_comment,
  valF6, setValF6, valF6_comment, setValF6_comment,
  valF7, setValF7, valF7_comment, setValF7_comment,

  valG1, setValG1, valG1_comment, setValG1_comment,
  valG2, setValG2, valG2_comment, setValG2_comment,

  handleSaveValidationChecks,
  };
}
 
  
