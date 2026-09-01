import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions, Modal, Pressable, Alert } from 'react-native';
// expo-image (not RN's own Image) for these report photo thumbnails —
// disk-caches by URL, so reopening a report or scrolling back to a photo
// you've already loaded doesn't re-download the same signed GCS URL again.
import { Image } from 'expo-image';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, FileDown, CheckCheck, FileText, Play, Video as VideoIcon, X, Key, Check } from 'lucide-react-native';
import { CheckRow, InfoRow } from '../../_components/ReportRows';
import { ReportSectionCard } from '../../_components/shared/ReportSectionCard';
import { NotesBulletList } from '../../_components/shared/NotesBulletList';
import { ActivityHistoryCard } from '../../_components/shared/ActivityHistoryCard';
import { AssetIdentityHeader } from '../../_components/shared/AssetIdentityHeader';
import { PhotoLightboxModal } from '../../_components/shared/PhotoLightboxModal';
import { VideoPlayerModal } from '../../_components/shared/VideoPlayerModal';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { useTaskReportController } from '../../controllers/taskReportController';
import {
  val, formatDate, formatAddress, getPriorityColor, getPriorityTextColor, TASK_TYPE_BADGE, DEFAULT_TASK_TYPE_BADGE, videoFileName, getTaskPeople,
} from '../../utils/reportFormatters';
import { safeJsonParse } from '../../utils/safeJsonParse';

const REF_WIDTH = 420;

const formatTaskType = (type: string) => {
  if (!type) return '';
  const map: Record<string, string> = {
    RE_COMMISSIONING: 'Re-Commissioning',
    REVALIDATION: 'Revalidation',
    COMMISSIONING: 'Commissioning',
    PRE_COMMISSIONING: 'Pre-Commissioning',
  };
  return map[type] || type.replace(/_/g, ' ');
};

// Same {label,color} convention TaskPreviewCard's statusPill uses — green
// once done, orange for everything still moving.
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: '#DCFCE7', text: '#15803D' },
  CLOSED: { bg: '#E5E7EB', text: '#4B5563' },
  IN_PROGRESS: { bg: '#FFE3D4', text: '#FB7C42' },
  ACCEPTED: { bg: '#FFE3D4', text: '#FB7C42' },
  ASSIGNED: { bg: '#FFE3D4', text: '#FB7C42' },
};

// Same peach->light radial gradient backdrop as Dashboard/Commissioning
// (duplicated, not extracted — small, screen-specific visual).
function ScreenBackground() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [size, setSize] = React.useState({ width: windowWidth, height: windowHeight });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <Svg width={size.width} height={size.height}>
        <Defs>
          <RadialGradient id="taskReportBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#taskReportBg)" />
      </Svg>
    </View>
  );
}

// ── Commissioning Checks group definitions ──
const COMMISSIONING_GROUP_A = [
  ['A1', 'Genset Installation'],
  ['A2', 'No obstruction to cooling air inlet and air outlet'],
  ['A3', 'All canopy doors open fully for service access'],
  ['A4', 'DG set room ventilation (if installed in a room)'],
  ['A5', 'Fitment of exhaust silencer and exhaust piping'],
  // Split into 3 sub-checks, matching taskForm.tsx's own Step 2 — A6a/A6b/
  // A6c are the confirmed real backend field keys for these.
  ['A6a', 'A. 1 Nos earthing pits for Genset and Control Panel Body'],
  ['A6b', 'B. 2 Nos. of earthing pits for Neutral'],
  ['A6c', 'C. 1 Nos. of earthing pits for Alternator Body'],
  ['A7', 'Visually check all fasteners'],
  ['A8', 'Visually check wiring connections in control panel'],
  ['A9', '230V supply for battery charger (if external charger fitted)'],
  ['A10', 'Visually check all connectors and actuators on engine'],
];

const COMMISSIONING_GROUP_B = [
  ['B1', 'Lub Oil Level'],
  ['B2', 'Fuel Level'],
  ['B3', 'Coolant Level'],
  ['B4a', 'Oil Leakage'],
  ['B4b', 'Coolant Leakage'],
  ['B4c', 'Fuel Leakage'],
  ['B4d', 'Air Leakage'],
];

const COMMISSIONING_GROUP_C = [
  ['C1', 'DEF / ADD Blue Tank Fitment & Level'],
  ['C2', 'Urea Supply & Return Line Fitment'],
  ['C3', 'DOC/POC/ATS Fitment/Connections'],
  ['C4', 'Exh. Gas Temp. Sensor Connections'],
  ['C5', 'NOx Sensor Connections'],
  ['C6', 'EGR / ECU Fitment & Connections'],
  ['C7', 'Engine ECM Fitment & Connections'],
  ['C8', 'Buzzer / Flasher Working'],
  ['C9', 'Ambient Temp. Sensor Fitment & Connections'],
  ['C10', 'Exhaust Smoke Colour'],
  ['C11', 'Wiring Harness & Connections'],
  ['C14', 'Supply Module Fitment & Connection'],
  ['C15', 'Dosing Module Fitment & Connection'],
  ['C16', 'ATS Control Module Fitment & Connections'],
  ['C17', 'ATS System Working'],
];

// Customer Handover (Step 5) — shown with an "E" badge to match
// taskForm.tsx. Confirmed real backend keys: E1-E7, Yes/No values, "c"-
// suffixed comments (E1c, not E1_comment) — passed to renderCheckGroup
// below via its own commentSuffix param.
const COMMISSIONING_GROUP_F = [
  ['E1', 'Demonstrate operation of Genset — Starting & stopping.'],
  ['E2', 'Demonstrate daily checks of Genset.'],
  ['E3', 'Demonstrate AMF panel operation (if applicable).'],
  ['E4', 'Demonstrate how to put load on DG set.'],
  ['E5', "Explain Do's & Don'ts of DG set."],
  ['E6', 'Explain ATS function & DEF filling process.'],
  ['E7', 'Use Low Sulphur Diesel only as per standard specified.'],
];

const VALIDATION_GROUP_A = [
  ['A1', 'Air Cleaner Condition'],
  ['A2', 'Environment Condition'],
  ['A3', 'Hoses Condition'],
];
const VALIDATION_GROUP_B = [
  ['B1', 'Exhaust Leakage'],
  ['B2', 'Visible Exhaust Smoke Level'],
  ['B3', 'Exhaust Bellow Free Fitment'],
];
const VALIDATION_GROUP_C = [
  ['C1', 'Lub Oil Level'],
  ['C2', 'Brand and Grade of Oil Used'],
  ['C3', 'Oil Leakage'],
  ['C4', 'Lub Oil Filter'],
];
const VALIDATION_GROUP_D = [
  ['D1', 'Coolant Level and Condition'],
  ['D2', 'Coolant Leakage'],
  ['D3', 'Belt Condition'],
  ['D4', 'Radiator Condition and Cleanliness'],
  ['D5', 'Condition of all Hoses and Clamps'],
];
const VALIDATION_GROUP_E = [
  ['E1', 'Fuel Tank Cleanliness'],
  ['E2', 'Condition of Fuel Hoses and Leakages'],
  ['E3', 'Fuel Filter'],
];
const VALIDATION_GROUP_F = [
  ['F1', 'Battery'],
  ['F2', 'Electrolyte Level and Terminal Condition of Battery'],
  ['F3', 'Battery Voltage in DC'],
  ['F4', 'Voltage Drop at Battery During Cranking Within 9V'],
  ['F5', 'Functioning of Charging Alternator'],
  ['F6', 'Tightness of All S/W & Sensors'],
  ['F7', 'Functions of ESU (HWT, LLOP, CLS LFL)'],
];
const VALIDATION_GROUP_G = [
  ['G1', 'Abnormal Sound from Engine'],
  ['G2', 'Overall Condition of Engine and Alternator'],
];

const renderCheckGroup = (letter: string, title: string, items: string[][], checks: Record<string, any>, commentSuffix = '_comment') => (
  <View key={letter} style={{ marginBottom: 18 }}>
    <View style={styles.groupHeaderRow}>
      <View style={styles.groupLetterCircle}>
        <Text style={styles.groupLetterText}>{letter}</Text>
      </View>
      <Text style={styles.groupHeaderTitle}>{title}</Text>
    </View>
    {items.map(([key, label]) => (
      <CheckRow key={key} label={label} value={checks[key]} comment={checks[`${key}${commentSuffix}`]} />
    ))}
  </View>
);

const LOAD_STAGES = [
  { prefix: 'D0', label: '0% Load' },
  { prefix: 'D25', label: '25% Load' },
  { prefix: 'D50', label: '50% Load' },
  { prefix: 'D75', label: '75% Load' },
  { prefix: 'D100', label: '100% Load' },
];

// Full commissioning task report — genset/engine/alternator identification,
// commissioning or validation checks, complaint codes, parts, readings,
// photos, customer feedback, and work-completion status.
export default function TaskReportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);
  const params = useLocalSearchParams<{ task: string }>();
  const initialTask = safeJsonParse<any>(params.task) ?? null;

  const {
    task, asset: a, isLoading, refreshing, onRefresh, detailError, isOffline,
    photos, signedPhotoUrls, photosSigning,
    runningHoursPhotoUrl,
    videos, videoModalVisible, videoUri, videoError, handlePlayVideo, closeVideoModal,
    documents, documentOpeningUrl, documentError, handleViewDocument,
    downloadingReport, downloadReportError, handleDownloadReport,
    canClose, closingTicket, closeTicketError, handleCloseTicket,
    isOtpPending, completionOtp,
    otpSheetOpen, openOtpSheet, closeOtpSheet, otpStep,
    otpGenerated, generatedOtp, customerOtp, otpInputRefs, otpLoading, otpError,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleVerifyOtp,
    remark, setRemark, remarkSaving, remarkError, handleSaveRemark,
  } = useTaskReportController(initialTask);

  const [gensetExpanded, setGensetExpanded] = useState(true);
  const [engineExpanded, setEngineExpanded] = useState(false);
  const [alternatorExpanded, setAlternatorExpanded] = useState(false);
  const [checksExpanded, setChecksExpanded] = useState(false);
  const [runningHoursExpanded, setRunningHoursExpanded] = useState(false);
  const [customerHandoverExpanded, setCustomerHandoverExpanded] = useState(false);
  const [complaintExpanded, setComplaintExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [videosExpanded, setVideosExpanded] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!initialTask) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No task data found.</Text>
      </SafeAreaView>
    );
  }

  const rawType = (task.type || '').toUpperCase();
  const isRevalidation = rawType === 'REVALIDATION';
  const isPreCommissioning = rawType.includes('PRE');

  const commissioningChecks = task.commissioningChecks || {};
  const validationChecks = task.validationChecks || {};
  const faultCodes = task.faultCodes || [];
  const partsUsed = task.partsUsed || [];
  const gensetReadings = task.gensetReadings || null;
  const notes = task.notes || '';
  // Saved via the OTP sheet's own optional Step 3 (PUT /:id/feedback) once
  // the customer's OTP is verified — field name not yet confirmed against
  // a real response, so this checks the likely shapes.
  const feedbackComment = task.feedback?.comment || task.customerFeedback?.comment || task.remark || '';

  const typeBadge = TASK_TYPE_BADGE[task.type] || DEFAULT_TASK_TYPE_BADGE;
  const statusColor = STATUS_COLOR[task.status] || STATUS_COLOR.ASSIGNED;
  const typeLabel = formatTaskType(task.type);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />

      {isLoading && <LoadingOverlay message="Loading full report..." />}

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{typeLabel || 'Commissioning'}</Text>
        <TouchableOpacity style={styles.headerDownloadButton} onPress={handleDownloadReport} disabled={downloadingReport}>
          {downloadingReport ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FileDown size={20} color="#FFFFFF" />}
        </TouchableOpacity>
      </View>
      {!!downloadReportError && (
        <View style={[styles.detailErrorBanner, { marginHorizontal: hPad, marginBottom: 12 }]}>
          <Text style={styles.detailErrorBannerText}>{downloadReportError}</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: canClose || isOtpPending ? 130 : 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        {/* Surfaces a failed detail fetch instead of silently leaving the
            screen on stale nav-param data — pull down to retry. */}
        {!!detailError && (
          <View style={[styles.detailErrorBanner, { marginBottom: 16 }]}>
            <Text style={styles.detailErrorBannerText}>{detailError} Pull down to retry.</Text>
          </View>
        )}

        <View style={styles.identityCard}>
          <AssetIdentityHeader
            task={task}
            isService={false}
            taskPeople={getTaskPeople(task)}
            assetOverride={a}
          />
          <View style={styles.identityPillRow}>
            <View style={[styles.identityPill, { backgroundColor: typeBadge.bg }]}>
              <Text style={[styles.identityPillText, { color: typeBadge.text }]}>{typeLabel}</Text>
            </View>
            <View style={[styles.identityPill, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.identityPillText, { color: statusColor.text }]}>
                {val(task.status).charAt(0) + val(task.status).slice(1).toLowerCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <ActivityHistoryCard task={task} />
        </View>

        <ReportSectionCard title="Genset Identification" expanded={gensetExpanded} onToggle={() => setGensetExpanded(!gensetExpanded)}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>GENSET S/N</Text>
              <Text style={styles.fieldValue}>{val(a.gensetNumber)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>MODEL</Text>
              <Text style={styles.fieldValue}>{val(a.gensetModel)}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>KVA</Text>
              <Text style={styles.fieldValue}>{val(a.kva)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>KW</Text>
              <Text style={styles.fieldValue}>{val(a.kw)}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>PHASE</Text>
              <Text style={styles.fieldValue}>{val(a.phase)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>FUEL TYPE</Text>
              <Text style={styles.fieldValue}>{val(a.fuelType)}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>APPLICATION</Text>
              <Text style={styles.fieldValue}>{val(a.applicationMaterial)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>CPCB</Text>
              <Text style={styles.fieldValue}>{val(a.cpcb)}</Text>
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>DISPATCH DATE</Text>
              <Text style={styles.fieldValue}>{formatDate(a.dispatchDate)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>CLIENT</Text>
              <Text style={styles.fieldValue}>{val(a.clientName)}</Text>
            </View>
          </View>

          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>CLIENT CODE</Text>
            <Text style={styles.fieldValue}>{val(a.clientCode)}</Text>
          </View>

          <View style={styles.fieldFull}>
            <Text style={styles.fieldLabel}>ADDRESS</Text>
            <Text style={styles.fieldValue}>{formatAddress(a.address)}</Text>
          </View>
        </ReportSectionCard>

        <ReportSectionCard title="Engine Parameters" expanded={engineExpanded} onToggle={() => setEngineExpanded(!engineExpanded)}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ENGINE S/N</Text>
              <Text style={styles.fieldValue}>{val(a.engineNumber)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>MODEL</Text>
              <Text style={styles.fieldValue}>{val(a.engineModel)}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ENGINE TYPE</Text>
              <Text style={styles.fieldValue}>{val(a.engineType)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ENGINE FAMILY</Text>
              <Text style={styles.fieldValue}>{val(a.engineFamily)}</Text>
            </View>
          </View>
        </ReportSectionCard>

        <ReportSectionCard title="Alternator & Panel" expanded={alternatorExpanded} onToggle={() => setAlternatorExpanded(!alternatorExpanded)}>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ALT. MAKE</Text>
              <Text style={styles.fieldValue}>{val(a.alternatorMake)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ALT. MODEL</Text>
              <Text style={styles.fieldValue}>{val(a.alternatorModel)}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ALT. S/N</Text>
              <Text style={styles.fieldValue}>{val(a.alternatorSerialNumber)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>ATS S/N</Text>
              <Text style={styles.fieldValue}>{val(a.atsSerialNumber)}</Text>
            </View>
          </View>
          {/* Battery S/N was a single field — now Battery Type plus two
          separate serial numbers (battery1SerialNumber/battery2SerialNumber
          — the old batterySerialNumber key is no longer what's saved).
          Controller Type/S/R are new fields too. */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>BATTERY TYPE</Text>
              <Text style={styles.fieldValue}>{val(a.batteryType)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>BATTERY 1 S/N</Text>
              <Text style={styles.fieldValue}>{val(a.battery1SerialNumber)}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>BATTERY 2 S/N</Text>
              <Text style={styles.fieldValue}>{val(a.battery2SerialNumber)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>PANEL S/N</Text>
              <Text style={styles.fieldValue}>{val(a.controlPanelSerialNumber)}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>PANEL TYPE</Text>
              <Text style={styles.fieldValue}>{val(a.panelType)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>CONTROLLER TYPE</Text>
              <Text style={styles.fieldValue}>{val(a.controllerType)}</Text>
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>CONTROLLER S/R</Text>
              <Text style={styles.fieldValue}>{val(a.controllerSerialNumber)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>LOAD UNBALANCE</Text>
              <Text style={styles.fieldValue}>{a.loadUnbalance === true ? 'Yes' : a.loadUnbalance === false ? 'No' : '--'}</Text>
            </View>
          </View>
          {a.loadUnbalance && (
            <View style={styles.fieldFull}>
              <Text style={styles.fieldLabel}>UNBALANCE %</Text>
              <Text style={styles.fieldValue}>{val(a.loadUnbalancePercentage)}</Text>
            </View>
          )}
        </ReportSectionCard>

        <ReportSectionCard
            title={isRevalidation ? 'Validation Checks' : 'Commissioning Checks'}
            expanded={checksExpanded}
            onToggle={() => setChecksExpanded(!checksExpanded)}
          >
            {isRevalidation ? (
              <>
                {renderCheckGroup('A', 'Air Intake System', VALIDATION_GROUP_A, validationChecks)}
                {renderCheckGroup('B', 'Exhaust System', VALIDATION_GROUP_B, validationChecks)}
                {renderCheckGroup('C', 'Lub Oil System', VALIDATION_GROUP_C, validationChecks)}
                {renderCheckGroup('D', 'Cooling System', VALIDATION_GROUP_D, validationChecks)}
                {renderCheckGroup('E', 'Fuel System', VALIDATION_GROUP_E, validationChecks)}
                {renderCheckGroup('F', 'Electrical Wiring', VALIDATION_GROUP_F, validationChecks)}
                {renderCheckGroup('G', 'General', VALIDATION_GROUP_G, validationChecks)}
              </>
            ) : (
              <>
                {renderCheckGroup('A', 'Pre-Installation Checks', COMMISSIONING_GROUP_A, commissioningChecks)}
                <View style={{ marginBottom: 18 }}>
                  <Text style={styles.subGroupTitle}>EB (Mains)</Text>
                  <InfoRow label="Voltage R-Y Phase" value={commissioningChecks.A14} />
                  <InfoRow label="Voltage Y-B Phase" value={commissioningChecks.A15} />
                  <InfoRow label="Voltage B-R Phase" value={commissioningChecks.A16} />
                  <InfoRow label="Voltage R-N Phase" value={commissioningChecks.A17} />
                  <InfoRow label="Voltage Y-N Phase" value={commissioningChecks.A18} />
                  <InfoRow label="Voltage B-N Phase" value={commissioningChecks.A19} />
                  <InfoRow label="Load R Phase" value={commissioningChecks.A11} />
                  <InfoRow label="Load Y Phase" value={commissioningChecks.A12} />
                  <InfoRow label="Load B Phase" value={commissioningChecks.A13} />
                </View>

                {/* Commissioning Instructions (B) / CPCB IV+ ATS System
                    Check Points (C) / Performance Trial (D) all skip
                    Pre-Commissioning — matches taskForm.tsx's own gating on
                    the same flag, since a pre-commissioning task never
                    actually collects any of this. */}
                {!isPreCommissioning && (
                <>
                {renderCheckGroup('B', 'Commissioning Instructions', COMMISSIONING_GROUP_B, commissioningChecks)}
                <View style={{ marginBottom: 18 }}>
                  <Text style={styles.subGroupTitle}>Phase Difference (A)</Text>
                  <InfoRow label="R Phase" value={commissioningChecks.B5R} />
                  <InfoRow label="Y Phase" value={commissioningChecks.B5Y} />
                  <InfoRow label="B Phase" value={commissioningChecks.B5B} />
                </View>

                {renderCheckGroup('C', 'CPCB IV+ ATS System Check Points', COMMISSIONING_GROUP_C, commissioningChecks)}
                <View style={{ marginBottom: 18 }}>
                  <Text style={styles.subGroupTitle}>Exhaust Temp. on Load DOC (°C)</Text>
                  <InfoRow label="IN" value={commissioningChecks.C12} />
                  <InfoRow label="OUT" value={commissioningChecks.C13} />
                  <InfoRow label="DEF Make" value={commissioningChecks.C18} />
                </View>

                <View style={{ marginBottom: 18 }}>
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupLetterCircle}>
                      <Text style={styles.groupLetterText}>D</Text>
                    </View>
                    <Text style={styles.groupHeaderTitle}>Performance Trial</Text>
                  </View>
                  {LOAD_STAGES.map(stage => (
                    <View key={stage.prefix} style={styles.loadStageReportCard}>
                      <Text style={styles.loadStageReportLabel}>{stage.label}</Text>
                      {/* 0% Load never collects this in the form (see
                          taskForm.tsx's own `stage.prefix !== "D0"` gate on
                          the Load (AMPS) fields) — showing it here anyway
                          just displayed three dashes with nothing behind
                          them, so it's skipped for that one stage only. */}
                      {stage.prefix !== 'D0' && (
                        <InfoRow label="Load R/Y/B (A)" value={`${val(commissioningChecks[`${stage.prefix}LR`])} / ${val(commissioningChecks[`${stage.prefix}LY`])} / ${val(commissioningChecks[`${stage.prefix}LB`])}`} />
                      )}
                      <InfoRow label="Voltage R/Y/B (V)" value={`${val(commissioningChecks[`${stage.prefix}VR`])} / ${val(commissioningChecks[`${stage.prefix}VY`])} / ${val(commissioningChecks[`${stage.prefix}VB`])}`} />
                      <InfoRow label="Freq (Hz)" value={commissioningChecks[`${stage.prefix}F`]} />
                      <InfoRow label="Battery V" value={commissioningChecks[`${stage.prefix}BV`]} />
                      <InfoRow label="Remarks" value={commissioningChecks[`${stage.prefix}REM`]} />
                    </View>
                  ))}
                </View>
                </>
                )}

              </>
            )}
          </ReportSectionCard>

        {/* Running Hours — its own standalone section rather than buried
            inside Commissioning/Validation Checks above, same
            commissioningChecks.runningHours key regardless of task type (see
            taskForm.tsx's runningHoursCard: Step 2 for pre-commissioning/
            commissioning/re-commissioning, Step 5 for revalidation). Now
            also shows the photo taken during that same step — it's
            recoverable here because the form always confirms it pre-tagged
            'Running Hours' (see useTaskFormPhotos.ts's runningHoursQueue),
            so taskReportController.ts can pull it out of the general
            media[] array by that tag instead of it landing in the plain
            Photos section below alongside everything else. */}
        <ReportSectionCard
          title="Running Hours"
          expanded={runningHoursExpanded}
          onToggle={() => setRunningHoursExpanded(!runningHoursExpanded)}
        >
          <InfoRow label="Running Hours" value={commissioningChecks.runningHours} />
          {!!runningHoursPhotoUrl && (
            <Image
              source={{ uri: signedPhotoUrls[runningHoursPhotoUrl] || runningHoursPhotoUrl }}
              style={[styles.reportPhotoThumb, { marginTop: 12 }]}
            />
          )}
        </ReportSectionCard>

        {/* Revalidation and Pre-Commissioning both skip this — matches
            taskForm.tsx's own gating on the same two flags. */}
        {!isRevalidation && !isPreCommissioning && (
          <ReportSectionCard
            title="Customer Handover"
            expanded={customerHandoverExpanded}
            onToggle={() => setCustomerHandoverExpanded(!customerHandoverExpanded)}
          >
            {renderCheckGroup('E', 'Customer Handover', COMMISSIONING_GROUP_F, commissioningChecks, 'c')}
          </ReportSectionCard>
        )}

        <ReportSectionCard
          title={`Complaint Codes (${faultCodes.length})`}
          expanded={complaintExpanded}
          onToggle={() => setComplaintExpanded(!complaintExpanded)}
        >
          {faultCodes.length === 0 ? (
            <Text style={styles.emptyText}>No complaint codes recorded.</Text>
          ) : (
            faultCodes.map((fc: any, i: number) => {
              const codeInfo = fc.codeId || {};
              return (
                <View key={fc._id || i} style={styles.complaintReportCard}>
                  <View style={styles.complaintCodeBadge}>
                    <Text style={styles.complaintCodeText}>{val(codeInfo.code)}</Text>
                  </View>
                  <Text style={styles.complaintReportTitle}>{val(codeInfo.description)}</Text>
                  <Text style={styles.complaintReportSub}>
                    {val(codeInfo.category)} {codeInfo.subCategory ? `› ${codeInfo.subCategory}` : ''}
                  </Text>
                  {!!codeInfo.priority && (
                    <View style={[styles.priorityBadgeReport, { backgroundColor: getPriorityColor(codeInfo.priority).backgroundColor }]}>
                      <Text style={[styles.priorityBadgeText, { color: getPriorityTextColor(codeInfo.priority) }]}>
                        {codeInfo.priority}
                      </Text>
                    </View>
                  )}
                  {!!fc.observation && (
                    <View style={[styles.complaintInfoBlock, { backgroundColor: '#FFFAD9' }]}>
                      <Text style={styles.complaintInfoBlockTitle}>Observation</Text>
                      <Text style={styles.complaintInfoBlockValue}>{fc.observation}</Text>
                    </View>
                  )}
                  {!!fc.rootCause && (
                    <View style={[styles.complaintInfoBlock, { backgroundColor: '#FFD9D9' }]}>
                      <Text style={styles.complaintInfoBlockTitle}>Root Cause</Text>
                      <Text style={styles.complaintInfoBlockValue}>{fc.rootCause}</Text>
                    </View>
                  )}
                  {!!fc.correctiveAction && (
                    <View style={[styles.complaintInfoBlock, { backgroundColor: '#DBF9E2' }]}>
                      <Text style={styles.complaintInfoBlockTitle}>Corrective Action</Text>
                      <Text style={styles.complaintInfoBlockValue}>{fc.correctiveAction}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ReportSectionCard>

        <ReportSectionCard title="Parts Used" expanded={partsExpanded} onToggle={() => setPartsExpanded(!partsExpanded)}>
          {partsUsed.length === 0 ? (
            <Text style={styles.emptyText}>No parts recorded.</Text>
          ) : (
            partsUsed.map((p: any, i: number) => {
              // partId populates as null (not an error) if the part it
              // references was since deleted — `|| {}` keeps every field
              // read below safe (shows "--" via val()) instead of crashing,
              // per the Parts API reference doc's null-partId warning.
              const partInfo = p.partId || {};
              // category/subCategory/unit were removed in the 2026-08-29
              // Part schema change — cpcbNorm/engineFamily are their closest
              // replacement for "extra info about this part", shown only
              // when actually set.
              const partSubtitle = [partInfo.cpcbNorm, partInfo.engineFamily?.join(', ')].filter(Boolean).join(' · ');
              return (
                <View key={p._id || i} style={styles.partReportCard}>
                  <View style={styles.partReportTop}>
                    <View style={styles.partCodeBadgeReport}>
                      <Text style={styles.partCodeTextReport}>{val(partInfo.componentNumber)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partNameReport}>{val(partInfo.description)}</Text>
                      {!!partSubtitle && <Text style={styles.partCategoryReport}>{partSubtitle}</Text>}
                    </View>
                  </View>
                  <View style={styles.partReportBottom}>
                    <Text style={styles.partQtyReport}>Qty: {val(p.quantity)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ReportSectionCard>

        <ReportSectionCard title="Genset Readings" expanded={readingsExpanded} onToggle={() => setReadingsExpanded(!readingsExpanded)}>
          {!gensetReadings ? (
            <Text style={styles.emptyText}>No readings recorded.</Text>
          ) : (
            <>
              <InfoRow label="AC Volt R-Y" value={gensetReadings.acVoltageRY} />
              <InfoRow label="AC Volt Y-B" value={gensetReadings.acVoltageYB} />
              <InfoRow label="AC Volt B-R" value={gensetReadings.acVoltageBR} />
              <InfoRow label="AC Amp R" value={gensetReadings.acAmpR} />
              <InfoRow label="AC Amp Y" value={gensetReadings.acAmpY} />
              <InfoRow label="AC Amp B" value={gensetReadings.acAmpB} />
              <InfoRow label="Load kW R" value={gensetReadings.loadKwR} />
              <InfoRow label="Load kW Y" value={gensetReadings.loadKwY} />
              <InfoRow label="Load kW B" value={gensetReadings.loadKwB} />
              <InfoRow label="Total Load KW" value={gensetReadings.totalKwLoad} />
              <InfoRow label="Load %" value={gensetReadings.loadPercentage} />
              <InfoRow label="RPM" value={gensetReadings.rpm} />
              <InfoRow label="Frequency (Hz)" value={gensetReadings.frequency} />
              <InfoRow label="DC Voltage (V)" value={gensetReadings.dcVoltage} />
              <InfoRow label="Oil Pressure" value={gensetReadings.oilPressure} />
              <InfoRow label="Coolant Temp (°C)" value={gensetReadings.coolantTemperature} />
              <InfoRow label="DEF Level (%)" value={gensetReadings.defLevelPercentage} />
              <CheckRow label="Oil Level" value={gensetReadings.oilLevel} comment={gensetReadings.oilLevelComment} />
              <CheckRow label="Coolant Level" value={gensetReadings.coolantLevel} comment={gensetReadings.coolantLevelComment} />
              {gensetReadings.savedBy && (
                <Text style={styles.savedByText}>
                  Saved by {gensetReadings.savedBy.name} · {formatDate(gensetReadings.savedAt)}
                </Text>
              )}
            </>
          )}
        </ReportSectionCard>

        <ReportSectionCard title={`Photos (${photos.length})`} expanded={photosExpanded} onToggle={() => setPhotosExpanded(!photosExpanded)}>
          {photos.length === 0 ? (
            <Text style={styles.emptyText}>No photos uploaded.</Text>
          ) : photosSigning ? (
            <ActivityIndicator color="#1E1951" style={styles.photosLoadingSpinner} />
          ) : (
            <View style={styles.reportPhotoGrid}>
              {photos.map((url: string, i: number) => (
                <TouchableOpacity key={i} onPress={() => { setLightboxIndex(i); setLightboxVisible(true); }}>
                  <Image source={{ uri: signedPhotoUrls[url] || url }} style={styles.reportPhotoThumb} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ReportSectionCard>

        <ReportSectionCard title={`Videos (${videos.length})`} expanded={videosExpanded} onToggle={() => setVideosExpanded(!videosExpanded)}>
          {videos.length === 0 ? (
            <Text style={styles.emptyText}>No videos uploaded.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {videos.map((url: string, i: number) => (
                <TouchableOpacity key={i} style={styles.videoReportRow} onPress={() => handlePlayVideo(url)}>
                  <View style={styles.videoReportPlayChip}>
                    <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.videoReportFileName} numberOfLines={1}>{videoFileName(url)}</Text>
                    <Text style={styles.videoReportTapToPlay}>Tap to play</Text>
                  </View>
                  <VideoIcon size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ReportSectionCard>

        {/* PDFs ride the same unified media[] array as photos/videos for
            commissioning, filtered by type: 'pdf' (see
            taskReportController.ts) — no in-app PDF viewer, tapping one
            signs the URL and hands it to the device's own PDF viewer via
            Linking. */}
        <ReportSectionCard title={`Documents (${documents.length})`} expanded={documentsExpanded} onToggle={() => setDocumentsExpanded(!documentsExpanded)}>
          {documents.length === 0 ? (
            <Text style={styles.emptyText}>No documents uploaded.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {documents.map((url: string, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={styles.videoReportRow}
                  onPress={() => handleViewDocument(url)}
                  disabled={documentOpeningUrl === url}
                >
                  <View style={styles.videoReportPlayChip}>
                    {documentOpeningUrl === url
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : <FileText size={18} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.videoReportFileName} numberOfLines={1}>{videoFileName(url)}</Text>
                    <Text style={styles.videoReportTapToPlay}>Tap to view</Text>
                  </View>
                  <FileText size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
              {!!documentError && <Text style={styles.closeServiceErrorText}>{documentError}</Text>}
            </View>
          )}
        </ReportSectionCard>

        {/* Notes, Suggestion Comment, OTP Pending, and Customer Remark all
            share one plain card instead of separate collapsible/standalone
            ones — whichever of the later three actually apply for this
            task's current state render right below Notes, in that order. */}
        <View style={styles.notesSuggestionCard}>
          <Text style={styles.notesSuggestionLabel}>Notes</Text>
          {!notes ? (
            <Text style={styles.emptyText}>No notes recorded.</Text>
          ) : (
            <NotesBulletList notes={notes} />
          )}

          {!!task.suggestionComment && (
            <>
              <Text style={[styles.notesSuggestionLabel, { marginTop: 20 }]}>Suggestion Comment</Text>
              <NotesBulletList notes={task.suggestionComment} />
            </>
          )}

          {/* Same isOtpPending condition the floating footer's button below
              reacts to — states the fact inline, right in this card, instead
              of as its own separate card; the button (which actually opens
              the sheet) stays in the floating footer so it's always
              reachable without scrolling. */}
          {isOtpPending && (
            <View style={[styles.otpPendingCard, { marginTop: 20 }]}>
              <View style={styles.otpPendingCardIconCircle}>
                <Text style={styles.otpPendingCardIconText}>!</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.otpPendingCardTitle}>OTP Pending</Text>
                <Text style={styles.otpPendingCardSubtitle}>Client OTP not yet verified</Text>
              </View>
              <View style={styles.otpPendingCardPill}>
                <Text style={styles.otpPendingCardPillText}>PENDING</Text>
              </View>
            </View>
          )}

          {/* Saved via the OTP sheet's own Step 3, once the customer's OTP
              is verified — the closed-task counterpart to the OTP Pending
              box above (mutually exclusive: isOtpPending is false by the
              time feedbackComment exists). */}
          {!!feedbackComment && (
            <>
              <Text style={[styles.notesSuggestionLabel, { marginTop: 20 }]}>Customer Remark</Text>
              <NotesBulletList notes={feedbackComment} />
            </>
          )}
        </View>

        <View style={styles.footerCard}>
          <View style={styles.footerStackRow}>
            <Text style={styles.footerLabel}>CREATED BY</Text>
            <Text style={styles.footerValue}>{val(task.createdBy?.name)}</Text>
            <Text style={styles.footerSubvalue}>{formatDate(task.date)}</Text>
          </View>

          <View style={[styles.footerStackRow, { marginTop: 16 }]}>
            <Text style={styles.footerLabel}>COMPLETED BY</Text>
            <Text style={styles.footerValue}>{val(task.assignedTo?.name)}</Text>
            <Text style={styles.footerSubvalue}>{formatDate(task.completedAt || completionOtp?.verifiedAt || task.updatedAt)}</Text>
          </View>

          <Text style={[styles.footerLabel, { marginTop: 16, marginBottom: 10 }]}>WORK COMPLETION</Text>
          {completionOtp?.verified ? (
            <View style={styles.workCompletionBox}>
              <View style={styles.workCompletionCheckCircle}>
                <Text style={styles.workCompletionCheckIcon}>✓</Text>
              </View>
              <View>
                <Text style={styles.workCompletionTitle}>Customer OTP Verified</Text>
                <Text style={styles.workCompletionDate}>{formatDate(completionOtp.verifiedAt || task.updatedAt)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.workCompletionPendingBox}>
              <View style={styles.workCompletionPendingCircle}>
                <Text style={styles.workCompletionPendingIcon}>!</Text>
              </View>
              <Text style={styles.workCompletionPendingText}>OTP Not Verified</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Floats over the content instead of pushing the ScrollView up in
          normal flow — same pattern as Dashboard/srDetail.tsx's own
          floatingFooter. pointerEvents="box-none" lets touches pass
          through the transparent space around the button/bar to whatever
          scrolled content sits underneath. The ScrollView's own
          contentContainerStyle paddingBottom above is sized to clear this
          footer's actual height (taller when an action button is also
          showing) so the last card never ends up hidden behind it. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        {/* Close (APPROVED → CLOSED) — the one lifecycle-ending action this
            report screen exposes, gated by role and the task's current
            status. */}
        {canClose && (
          <View style={[styles.closeServiceBar, { paddingHorizontal: hPad }]}>
            <TouchableOpacity
              style={[styles.closeServiceButton, closingTicket && styles.buttonDisabled]}
              onPress={handleCloseTicket}
              disabled={closingTicket}
            >
              {closingTicket ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <CheckCheck size={18} color="#FFFFFF" />
                  <Text style={styles.closeServiceButtonText}>Close Ticket</Text>
                </>
              )}
            </TouchableOpacity>
            {!!closeTicketError && <Text style={styles.closeServiceErrorText}>{closeTicketError}</Text>}
          </View>
        )}

        {/* COMPLETED but the customer's OTP isn't verified yet — same
            condition TaskPreviewCard's own "OTP Pending" banner uses.
            Mutually exclusive with canClose (COMPLETED vs APPROVED), so
            never shows alongside it. */}
        {isOtpPending && (
          <View style={[styles.otpPendingBar, { marginHorizontal: hPad, marginBottom: 16, paddingHorizontal: hPad }]}>
            {/* Styled disabled while offline (not the RN `disabled` prop —
                that would swallow the tap entirely) so a tap still lands
                and can show why it's blocked, instead of just doing
                nothing. OTP generate/verify are inherently live-only (see
                commisionAPi.ts) and can't queue for later like every other
                save in this app now can. */}
            <TouchableOpacity
              style={[styles.otpPendingButton, isOffline && styles.otpPendingButtonDisabled]}
              onPress={() => {
                if (isOffline) {
                  Alert.alert('You\'re offline', 'Verifying the customer OTP needs an internet connection. Please try again once you\'re back online.');
                  return;
                }
                openOtpSheet();
              }}
            >
              <Text style={styles.otpPendingButtonText}>Verify Client OTP</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <PhotoLightboxModal
        visible={lightboxVisible}
        photos={photos.map((url: string) => signedPhotoUrls[url] || url)}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />

      <VideoPlayerModal
        visible={videoModalVisible}
        uri={videoUri}
        error={videoError}
        onClose={closeVideoModal}
      />

      {/* Client OTP bottom sheet — 3 steps: Generate OTP, Customer Enters
          OTP, then an optional Customer Remark (saved via the no-status-
          restriction feedback endpoint) before the sheet closes. */}
      <Modal visible={otpSheetOpen} transparent animationType="slide" onRequestClose={otpStep === 3 ? () => {} : closeOtpSheet}>
        {/* Dismissible by tap-outside/X/back on steps 1-2 only — once OTP is
            verified (step 3), the task is already CLOSED server-side, and
            the only way out is explicitly saving (or leaving blank) the
            customer remark via Save & Close below. */}
        <Pressable style={styles.otpModalOverlay} onPress={otpStep === 3 ? undefined : closeOtpSheet}>
          <Pressable style={styles.otpSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.otpSheetHandle} />
            <View style={styles.otpSheetHeaderRow}>
              <View>
                <Text style={styles.otpSheetTitle}>Client OTP Verification</Text>
                {!!a?.primaryContactNumber && (
                  <Text style={styles.otpSheetContactNumber}>{a.primaryContactNumber}</Text>
                )}
              </View>
              {otpStep !== 3 && (
                <TouchableOpacity style={styles.otpCloseButton} onPress={closeOtpSheet}>
                  <X size={18} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <OtpStepper step={otpStep} />

            {/* keyboardShouldPersistTaps="handled" — without it, the first
                tap on Verify OTP (or Generate/Regenerate) while the OTP
                digit input still has focus only dismisses the keyboard
                instead of registering as a press; a second tap was needed
                to actually fire the button. */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              {otpStep === 1 && (
                <View style={styles.otpStepCard}>
                  <Text style={styles.otpStepLabel}>STEP 1 — GENERATE OTP</Text>
                  <View style={styles.otpStepIntroRow}>
                    <View style={styles.otpKeyIconCircle}>
                      <Key size={18} color="#F26722" />
                    </View>
                    <Text style={styles.otpStepIntroText}>
                      Generate a 4-digit OTP and share it with the customer to confirm work completion.
                    </Text>
                  </View>
                  {!!otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}
                  <TouchableOpacity
                    style={[styles.otpGenerateButton, otpLoading && styles.buttonDisabled]}
                    onPress={handleGenerateOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                      <>
                        <Key size={18} color="#FFFFFF" />
                        <Text style={styles.otpGenerateButtonText}>Generate OTP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {otpStep === 2 && (
                <>
                  <View style={styles.otpCodeCard}>
                    <Text style={styles.otpCodeCardLabel}>SHARE THIS CODE WITH CUSTOMER</Text>
                    <View style={[styles.otpBoxRow, { justifyContent: 'center', marginTop: 12 }]}>
                      {generatedOtp.map((digit, index) => (
                        <View key={index} style={styles.otpBoxGenerated}>
                          <Text style={styles.otpBoxGeneratedText}>{digit}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }} onPress={handleRegenerateOtp} disabled={otpLoading}>
                      <Text style={styles.otpResendLink}>Regenerate</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.otpStepCard, { marginTop: 16 }]}>
                    <Text style={styles.otpStepLabel}>STEP 2 — CUSTOMER ENTERS OTP</Text>
                    <View style={[styles.otpBoxRow, { justifyContent: 'center', marginTop: 16 }]}>
                      {customerOtp.map((digit, index) => (
                        <TextInput
                          key={index}
                          ref={(ref) => { otpInputRefs.current[index] = ref; }}
                          style={styles.otpBox}
                          value={digit}
                          onChangeText={(text) => handleChangeCustomerOtpDigit(index, text)}
                          keyboardType="numeric"
                          maxLength={1}
                          textAlign="center"
                        />
                      ))}
                    </View>

                    {!!otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}

                    <TouchableOpacity
                      style={[styles.otpVerifyButton, (customerOtp.join('').length < 4 || otpLoading) && styles.buttonDisabled]}
                      onPress={handleVerifyOtp}
                      disabled={customerOtp.join('').length < 4 || otpLoading}
                    >
                      {otpLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpVerifyButtonText}>Verify OTP</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {otpStep === 3 && (
                <>
                  <View style={styles.otpVerifiedBox}>
                    <View style={styles.otpVerifiedIconCircle}>
                      <Check size={18} color="#16A34A" strokeWidth={3} />
                    </View>
                    <View>
                      <Text style={styles.otpVerifiedTitle}>OTP Verified</Text>
                      <Text style={styles.otpVerifiedSubtitle}>Customer confirmed work completion</Text>
                    </View>
                  </View>

                  <View style={[styles.otpStepCard, { marginTop: 16 }]}>
                    <Text style={styles.otpStepLabel}>STEP 3 — CUSTOMER REMARK</Text>
                    <TextInput
                      style={[styles.otpRemarkInput, { marginTop: 14 }]}
                      placeholder="Enter customer feedback or remarks (optional)..."
                      placeholderTextColor="#9CA3AF"
                      value={remark}
                      onChangeText={setRemark}
                      multiline
                      numberOfLines={4}
                    />
                    {!!remarkError && <Text style={styles.otpErrorText}>{remarkError}</Text>}
                    <TouchableOpacity
                      style={[styles.otpVerifyButton, remarkSaving && styles.buttonDisabled]}
                      onPress={handleSaveRemark}
                      disabled={remarkSaving}
                    >
                      {remarkSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpVerifyButtonText}>Save & Close</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// 1-2-3 progress row atop the OTP sheet — a completed step shows a green
// check, the active step is filled orange, everything after is a plain
// grey outline. The connecting line between two steps is only green once
// both its endpoints are done.
function OtpStepper({ step }: { step: 1 | 2 | 3 }) {
  const circle = (n: 1 | 2 | 3) => {
    const done = step > n;
    const active = step === n;
    return (
      <View style={[styles.stepCircle, done && styles.stepCircleDone, active && styles.stepCircleActive]}>
        {done ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : (
          <Text style={[styles.stepCircleText, active && styles.stepCircleTextActive]}>{n}</Text>
        )}
      </View>
    );
  };
  const line = (afterStep: 1 | 2) => <View style={[styles.stepLine, step > afterStep && styles.stepLineDone]} />;

  return (
    <View style={styles.stepperRow}>
      {circle(1)}
      {line(1)}
      {circle(2)}
      {line(2)}
      {circle(3)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },
  errorText: { textAlign: 'center', marginTop: 40, color: '#9CA3AF' },
  detailErrorBanner: {
    backgroundColor: '#FEE2E2', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  detailErrorBannerText: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  buttonDisabled: { opacity: 0.6 },
  // Same floating (not in-flow) bottom footer pattern as Dashboard/
  // srDetail.tsx — see the comment above where this is used.
  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  closeServiceBar: { paddingVertical: 14 },
  closeServiceButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: '#1E1951',
    borderRadius: 100,
    height: 56,
  },
  closeServiceButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeServiceErrorText: { color: '#DC2626', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  // Same shape as closeServiceButton, green instead of navy — a distinct
  // review-step action rather than the lifecycle-ending Close.

  // "Verify Client OTP" bar — a COMPLETED task with an unverified customer
  // OTP. No BottomNavBar on this screen, so this sits directly on the
  // bottom edge — rounded on all corners like a floating card, not just
  // the top. The informational text moved into otpPendingCard (in the
  // scroll content) — this bar is just the button now.
  otpPendingBar: {
    backgroundColor: '#11101C',
    borderRadius: 28,
    paddingTop: 16, paddingBottom: 20,
  },
  otpPendingButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: '#F26722',
    borderRadius: 100,
    height: 56,
  },
  otpPendingButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  otpPendingButtonDisabled: { backgroundColor: '#FBC7A4' },

  // "OTP Pending" card — sits in the scroll content, states the fact;
  // the actual "Verify Client OTP" button lives in the floating footer.
  otpPendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF9E7',
    borderWidth: 1, borderColor: '#FBE8A6',
    borderRadius: 24,
    padding: 16,
    marginTop: 14,
  },
  otpPendingCardIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center',
  },
  otpPendingCardIconText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  otpPendingCardTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  otpPendingCardSubtitle: { fontSize: 13, fontWeight: '500', color: '#B45309', marginTop: 2 },
  otpPendingCardPill: {
    backgroundColor: '#F59E0B',
    borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  otpPendingCardPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Verify OTP bottom sheet — 3-step (Generate / Customer Enters OTP /
  // Customer Remark), matching the reference "Client OTP Verification"
  // sheet design.
  otpModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  otpSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 20, paddingBottom: 32,
  },
  otpSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  otpSheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  otpSheetTitle: { fontSize: 18, fontWeight: '700', color: '#1E1951' },
  otpSheetContactNumber: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  otpCloseButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },

  // 1-2-3 progress row.
  stepperRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: '#F26722', borderColor: '#F26722' },
  stepCircleDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  stepCircleText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  stepCircleTextActive: { color: '#FFFFFF' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB' },
  stepLineDone: { backgroundColor: '#16A34A' },

  otpStepCard: { backgroundColor: '#F3F4F6', borderRadius: 20, padding: 16 },
  otpStepLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.4 },
  otpStepIntroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  otpKeyIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FDECE1',
    justifyContent: 'center', alignItems: 'center',
  },
  otpStepIntroText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },
  otpGenerateButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    width: '100%', height: 56, borderRadius: 100,
    backgroundColor: '#F26722',
    marginTop: 20,
  },
  otpGenerateButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  otpCodeCard: { backgroundColor: '#1E1951', borderRadius: 20, padding: 16 },
  otpCodeCardLabel: { fontSize: 11, fontWeight: '700', color: '#B8B3D9', letterSpacing: 0.4, textAlign: 'center' },
  otpBoxRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  otpBoxGenerated: {
    width: 60, height: 60, borderRadius: 12,
    backgroundColor: '#332C6B',
    justifyContent: 'center', alignItems: 'center',
  },
  otpBoxGeneratedText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  otpBox: {
    width: 60, height: 60, borderRadius: 12,
    borderWidth: 1, borderColor: '#DBDBDB',
    backgroundColor: '#F8F8F8',
    fontSize: 20, fontWeight: '700', color: '#000000',
  },
  otpResendLink: { fontSize: 14, fontWeight: '600', color: '#F8BA3B', textAlign: 'center', textDecorationLine: 'underline' },
  otpErrorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginTop: 8 },
  otpVerifyButton: {
    width: '100%', height: 56, borderRadius: 100,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  otpVerifyButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  otpRemarkInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12, fontSize: 14, color: '#1F2937',
    minHeight: 100, textAlignVertical: 'top',
  },

  // Confirmation shown once the OTP is actually verified — step 3's own
  // remark form comes right after it.
  otpVerifiedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
  },
  otpVerifiedIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center', alignItems: 'center',
  },
  otpVerifiedTitle: { fontSize: 15, fontWeight: '700', color: '#15803D' },
  otpVerifiedSubtitle: { fontSize: 13, color: '#16A34A', marginTop: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
  },
  headerButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000000', textTransform: 'uppercase'  },
  headerDownloadButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },

  // Identity card — AssetIdentityHeader (SR ribbon + genset/engine pill +
  // avatars, same component TaskPreviewCard/the task form's own header
  // use) plus this screen's own type/status pill row underneath.
  identityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  identityPillRow: { flexDirection: 'row', gap: 8 },
  identityPill: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  identityPillText: { fontSize: 13, fontWeight: '700' },


  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.3 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },

  emptyText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },

  notesSuggestionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginTop: 14,
  },
  notesSuggestionLabel: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.6, marginBottom: 10,
  },

  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  groupLetterCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F26722', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  groupLetterText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  groupHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  subGroupTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },

  loadStageReportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  loadStageReportLabel: { fontWeight: '700', color: '#1F2937', marginBottom: 8 },

  complaintReportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  complaintCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F7A057',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
  },
  complaintCodeText: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  complaintReportTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  complaintReportSub: { fontSize: 13, color: '#9CA3AF' },
  priorityBadgeReport: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 10,
  },
  priorityBadgeText: { fontSize: 11, fontWeight: '700' },
  complaintInfoBlock: { borderRadius: 12, padding: 12, marginTop: 12, gap: 4 },
  complaintInfoBlockTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', textTransform: 'uppercase', letterSpacing: 0.3 },
  complaintInfoBlockValue: { fontSize: 14, color: '#374151' },

  partReportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F26722',
  },
  partReportTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  partCodeBadgeReport: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
  },
  partCodeTextReport: { fontSize: 12, fontWeight: '700', color: '#374151' },
  partNameReport: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  partCategoryReport: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  // unit was removed in the 2026-08-29 Part schema change — no replacement,
  // so this row now only ever holds Qty, right-aligned.
  partReportBottom: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  partQtyReport: { fontSize: 13, fontWeight: '700', color: '#1F2937' },

  reportPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportPhotoThumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#F3F4F6' },
  photosLoadingSpinner: { paddingVertical: 20 },

  videoReportRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F3F1FD',
    borderRadius: 16,
    padding: 12,
  },
  videoReportPlayChip: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },
  videoReportFileName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  videoReportTapToPlay: { fontSize: 12, fontWeight: '600', color: '#4F46E5', marginTop: 2 },

  savedByText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 14,
  },
  // Created By / Completed By — stacked vertically (label, name, date),
  // one block below the other, instead of the old side-by-side row.
  footerStackRow: { gap: 2 },
  footerLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 4 },
  footerValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  footerSubvalue: { fontSize: 12, color: '#9CA3AF' },

  workCompletionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    padding: 14,
  },
  workCompletionCheckCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  workCompletionCheckIcon: { color: '#fff', fontWeight: '700', fontSize: 16 },
  workCompletionTitle: { color: '#065F46', fontWeight: '700', fontSize: 14 },
  workCompletionDate: { color: '#059669', fontSize: 12, marginTop: 2 },

  workCompletionPendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
  },
  workCompletionPendingCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  workCompletionPendingIcon: { color: '#fff', fontWeight: '700', fontSize: 16 },
  workCompletionPendingText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
});
