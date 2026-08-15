import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Bell, CheckCheck, FileText, Play, Video as VideoIcon } from 'lucide-react-native';
import { CheckRow, InfoRow } from '../../_components/ReportRows';
import { ReportSectionCard } from '../../_components/shared/ReportSectionCard';
import { ActivityHistoryCard } from '../../_components/shared/ActivityHistoryCard';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';
import { PhotoLightboxModal } from '../../_components/shared/PhotoLightboxModal';
import { VideoPlayerModal } from '../../_components/shared/VideoPlayerModal';
import { SrNumberText } from '../../_components/shared/SrNumberText';
import { useTaskReportController } from '../../controllers/taskReportController';
import {
  val, formatDate, formatAddress, getPriorityColor, getPriorityTextColor, TASK_TYPE_BADGE, DEFAULT_TASK_TYPE_BADGE, videoFileName,
} from '../../utils/reportFormatters';
import { safeJsonParse } from '../../utils/safeJsonParse';

const REF_WIDTH = 420;

const formatTaskType = (type: string) => {
  if (!type) return '';
  const map: Record<string, string> = {
    RE_COMMISSIONING: 'ReC',
    REVALIDATION: 'Revalidation',
    COMMISSIONING: 'Commissioning',
    PRE_COMM: 'Pre-Comm',
  };
  return map[type] || type.replace(/_/g, ' ');
};

// Same {label,color} convention TaskPreviewCard's statusPill uses — green
// once done, orange for everything still moving.
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: '#DCFCE7', text: '#15803D' },
  CLOSED: { bg: '#DCFCE7', text: '#15803D' },
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
  ['A6', 'Earthing (2 pits genset/panel body, 1 neutral, 1 alternator)'],
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

const renderCheckGroup = (letter: string, title: string, items: string[][], checks: Record<string, any>) => (
  <View key={letter} style={{ marginBottom: 18 }}>
    <View style={styles.groupHeaderRow}>
      <View style={styles.groupLetterCircle}>
        <Text style={styles.groupLetterText}>{letter}</Text>
      </View>
      <Text style={styles.groupHeaderTitle}>{title}</Text>
    </View>
    {items.map(([key, label]) => (
      <CheckRow key={key} label={label} value={checks[key]} comment={checks[`${key}_comment`]} />
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
    task, asset: a, isLoading, refreshing, onRefresh, detailError,
    photos, signedPhotoUrls, photosSigning,
    videos, videoModalVisible, videoUri, videoError, handlePlayVideo, closeVideoModal,
    documents, documentOpeningUrl, documentError, handleViewDocument,
    canClose, closingTicket, closeTicketError, handleCloseTicket,
  } = useTaskReportController(initialTask);

  const [gensetExpanded, setGensetExpanded] = useState(true);
  const [engineExpanded, setEngineExpanded] = useState(false);
  const [alternatorExpanded, setAlternatorExpanded] = useState(false);
  const [checksExpanded, setChecksExpanded] = useState(false);
  const [complaintExpanded, setComplaintExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [videosExpanded, setVideosExpanded] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

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
  const completionOtp = task.completionOtp || null;

  const typeBadge = TASK_TYPE_BADGE[task.type] || DEFAULT_TASK_TYPE_BADGE;
  const statusColor = STATUS_COLOR[task.status] || STATUS_COLOR.ASSIGNED;
  const typeLabel = formatTaskType(task.type);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <View style={styles.headerPillsRow}>
          <View style={[styles.typeInitialPill, { backgroundColor: typeBadge.bg }]}>
            <View style={[styles.typeInitialDot, { backgroundColor: statusColor.text }]} />
            <Text style={[styles.typeInitialText, { color: typeBadge.text }]}>{typeLabel.charAt(0)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusPillText, { color: statusColor.text }]}>{val(task.status).charAt(0) + val(task.status).slice(1).toLowerCase()}</Text>
          </View>
          <Text style={styles.typeLabelText} numberOfLines={1}>{typeLabel}</Text>
        </View>
        <View style={styles.headerButton}>
          <Bell size={20} color="#979797" />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: canClose ? 210 : 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        {/* Surfaces a failed detail fetch instead of silently leaving the
            screen on stale nav-param data — pull down to retry. */}
        {!!detailError && (
          <View style={[styles.detailErrorBanner, { marginBottom: 16 }]}>
            <Text style={styles.detailErrorBannerText}>{detailError} Pull down to retry.</Text>
          </View>
        )}

        {!!task.srNumber && (
          <View style={styles.srNumberPill}>
            <SrNumberText srNumber={task.srNumber} style={styles.srNumberPillText} />
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={styles.gensetNumberTitle}>{val(a.gensetNumber)}</Text>
          <View style={styles.warrantyBadge}>
            <Text style={styles.warrantyBadgeText}>{a.warrantyStatus || 'No warranty info'}</Text>
          </View>
        </View>
        <Text style={styles.gensetModelSubtitle}>{val(a.engineNumber)}</Text>

        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#1E1951" />
            <Text style={styles.loadingText}>Loading full report...</Text>
          </View>
        )}

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

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>SERVICE TYPE</Text>
              <Text style={styles.fieldValue}>{val(a.serviceType)}</Text>
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>WARRANTY STATUS</Text>
              <Text style={styles.fieldValue}>{val(a.warrantyStatus)}</Text>
            </View>
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
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>BATTERY S/N</Text>
              <Text style={styles.fieldValue}>{val(a.batterySerialNumber)}</Text>
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

        {!isPreCommissioning && (
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
                  <InfoRow label="Before" value={commissioningChecks.C12} />
                  <InfoRow label="After" value={commissioningChecks.C13} />
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
                      <InfoRow label="Load R/Y/B (A)" value={`${val(commissioningChecks[`${stage.prefix}LR`])} / ${val(commissioningChecks[`${stage.prefix}LY`])} / ${val(commissioningChecks[`${stage.prefix}LB`])}`} />
                      <InfoRow label="Voltage R/Y/B (V)" value={`${val(commissioningChecks[`${stage.prefix}VR`])} / ${val(commissioningChecks[`${stage.prefix}VY`])} / ${val(commissioningChecks[`${stage.prefix}VB`])}`} />
                      <InfoRow label="Freq (Hz)" value={commissioningChecks[`${stage.prefix}F`]} />
                      <InfoRow label="Battery V" value={commissioningChecks[`${stage.prefix}BV`]} />
                      <InfoRow label="Remarks" value={commissioningChecks[`${stage.prefix}REM`]} />
                    </View>
                  ))}
                </View>

                <View style={{ marginBottom: 4 }}>
                  <View style={styles.groupHeaderRow}>
                    <View style={styles.groupLetterCircle}>
                      <Text style={styles.groupLetterText}>E</Text>
                    </View>
                    <Text style={styles.groupHeaderTitle}>Running Hours</Text>
                  </View>
                  <InfoRow label="Running Hours" value={commissioningChecks.E_runHrs} />
                </View>
              </>
            )}
          </ReportSectionCard>
        )}

        <ReportSectionCard title="Complaint Codes" expanded={complaintExpanded} onToggle={() => setComplaintExpanded(!complaintExpanded)}>
          {faultCodes.length === 0 ? (
            <Text style={styles.emptyText}>No complaint codes recorded.</Text>
          ) : (
            faultCodes.map((fc: any, i: number) => {
              const codeInfo = fc.codeId || {};
              return (
                <View key={fc._id || i} style={styles.complaintReportCard}>
                  <View style={styles.complaintReportHeader}>
                    <View style={styles.complaintCodeBadge}>
                      <Text style={styles.complaintCodeText}>{val(codeInfo.code)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.complaintReportTitle}>{val(codeInfo.description)}</Text>
                      <Text style={styles.complaintReportSub}>
                        {val(codeInfo.category)} {codeInfo.subCategory ? `› ${codeInfo.subCategory}` : ''}
                      </Text>
                    </View>
                    {codeInfo.priority && (
                      <View style={[styles.priorityBadgeReport, { backgroundColor: getPriorityColor(codeInfo.priority).backgroundColor }]}>
                        <Text style={[styles.priorityBadgeText, { color: getPriorityTextColor(codeInfo.priority) }]}>
                          {codeInfo.priority}
                        </Text>
                      </View>
                    )}
                  </View>
                  {fc.observation && <InfoRow label="Observation" value={fc.observation} />}
                  {fc.rootCause && <InfoRow label="Root Cause" value={fc.rootCause} />}
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
              const partInfo = p.partId || {};
              return (
                <View key={p._id || i} style={styles.partReportCard}>
                  <View style={styles.partReportTop}>
                    <View style={styles.partCodeBadgeReport}>
                      <Text style={styles.partCodeTextReport}>{val(partInfo.code)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partNameReport}>{val(partInfo.name)}</Text>
                      <Text style={styles.partCategoryReport}>
                        {val(partInfo.category)} {partInfo.subCategory ? `› ${partInfo.subCategory}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.partReportBottom}>
                    <Text style={styles.partUnitReport}>{val(partInfo.unit)}</Text>
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
              <InfoRow label="AC Volt R-Y (V)" value={gensetReadings.acVoltageRY} />
              <InfoRow label="AC Volt Y-B (V)" value={gensetReadings.acVoltageYB} />
              <InfoRow label="AC Volt B-R (V)" value={gensetReadings.acVoltageBR} />
              <InfoRow label="AC Amp R (A)" value={gensetReadings.acAmpR} />
              <InfoRow label="AC Amp Y (A)" value={gensetReadings.acAmpY} />
              <InfoRow label="AC Amp B (A)" value={gensetReadings.acAmpB} />
              <InfoRow label="Load kW R" value={gensetReadings.loadKwR} />
              <InfoRow label="Load kW Y" value={gensetReadings.loadKwY} />
              <InfoRow label="Load kW B" value={gensetReadings.loadKwB} />
              <InfoRow label="Total kW" value={gensetReadings.totalKwLoad} />
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

        {/* PDFs ride the same GCS array as photos/videos for commissioning
            (see splitMediaByExtension/taskReportController.ts) — no in-app
            PDF viewer, tapping one signs the URL and hands it to the
            device's own PDF viewer via Linking. */}
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

        <ReportSectionCard title="Notes" expanded={notesExpanded} onToggle={() => setNotesExpanded(!notesExpanded)}>
          {!notes ? (
            <Text style={styles.emptyText}>No notes recorded.</Text>
          ) : (
            <Text style={styles.notesText}>{notes}</Text>
          )}
        </ReportSectionCard>

        <View style={styles.footerCard}>
          <View style={styles.footerRow}>
            <View style={{ flexShrink: 0 }}>
              <Text style={styles.footerLabel}>DATE</Text>
              <Text style={styles.footerValue}>{formatDate(task.date)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12, alignItems: 'flex-end' }}>
              <Text style={styles.footerLabel}>CREATED BY</Text>
              <Text style={styles.footerValue} numberOfLines={1}>{val(task.createdBy?.name)}</Text>
              <Text style={styles.footerSubvalue} numberOfLines={1}>{val(task.createdBy?.dealerName)}</Text>
            </View>
          </View>
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerLabel}>ASSIGNED TO</Text>
              <Text style={styles.footerValue}>{val(task.assignedTo?.name)}</Text>
              <Text style={styles.footerSubvalue}>{val(task.assignedTo?.dealerName)}</Text>
            </View>
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

        <BottomNavBar active="commissioning" />
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
    </SafeAreaView>
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
  headerPillsRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeInitialPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  typeInitialDot: { width: 7, height: 7, borderRadius: 3.5 },
  typeInitialText: { fontSize: 12, fontWeight: '700' },
  statusPill: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { fontSize: 13, fontWeight: '700' },
  typeLabelText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', flexShrink: 1 },

  srNumberPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1951',
    borderRadius: 40,
    paddingVertical: 8, paddingHorizontal: 14,
    marginBottom: 12,
  },
  srNumberPillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', fontFamily: 'monospace', letterSpacing: 0.5 },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gensetNumberTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', flex: 1 },
  warrantyBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  warrantyBadgeText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  gensetModelSubtitle: { color: '#9CA3AF', fontSize: 14, marginTop: 2 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.3 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },

  emptyText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },

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
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  complaintReportHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  complaintCodeBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  complaintCodeText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  complaintReportTitle: { fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  complaintReportSub: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  priorityBadgeReport: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  priorityBadgeText: { fontSize: 11, fontWeight: '700' },

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
  partReportBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partUnitReport: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F26722',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
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
  notesText: { color: '#1F2937', fontSize: 14, lineHeight: 21 },

  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 14,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
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
