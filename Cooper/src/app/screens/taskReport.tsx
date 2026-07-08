import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCommissioningTaskDetail, getAssetById } from '@/viewModel/commisionAPi';

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

const formatAddress = (address: any) => {
  if (!address) return '--';
  const parts = [address.line1, address.line2, address.locality, address.city, address.taluk, address.district, address.state, address.pinCode, address.country]
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '--';
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '--';
  }
};

const val = (v: any) => (v === undefined || v === null || v === '' ? '--' : String(v));

// ── Badge color logic for check values (OK / Not OK / custom values) ──
const getBadgeStyle = (value: string) => {
  if (!value) return { badge: styles.badgeNeutral, text: styles.badgeTextNeutral };
  const v = value.trim().toLowerCase();
  if (v === 'ok') return { badge: styles.badgeOk, text: styles.badgeTextOk };
  if (v === 'not ok') return { badge: styles.badgeBad, text: styles.badgeTextBad };
  return { badge: styles.badgeNeutral, text: styles.badgeTextNeutral };
};

// ── Generic row for a single check item (label + value pill + optional comment) ──
const CheckRow = ({ label, value, comment }: { label: string; value?: string; comment?: string }) => {
  const { badge, text } = getBadgeStyle(value || '');
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkRowTop}>
        <Text style={styles.checkRowLabel}>{label}</Text>
        <View style={[styles.badge, badge]}>
          <Text style={[styles.badgeText, text]}>{val(value)}</Text>
        </View>
      </View>
      {comment ? (
        <View style={styles.commentBox}>
          <Text style={styles.commentText}>{comment}</Text>
        </View>
      ) : null}
    </View>
  );
};

// ── Generic row for a plain label:value pair (numeric fields) ──
const InfoRow = ({ label, value }: { label: string; value?: any }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoRowLabel}>{label}</Text>
    <Text style={styles.infoRowValue}>{val(value)}</Text>
  </View>
);

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
      <CheckRow
        key={key}
        label={label}
        value={checks[key]}
        comment={checks[`${key}_comment`]}
      />
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
const getPriorityColor = (priority: string) => {
  const colors: Record<string, { backgroundColor: string }> = {
    P1: { backgroundColor: '#FEE2E2' },    // Red
    P2: { backgroundColor: '#FFEDD5' },    // Orange
    P3: { backgroundColor: '#DBEAFE' },    // Blue
    P4: { backgroundColor: '#F3F4F6' },    // Gray
  };
  return colors[priority] || colors['P4'];
};

const getPriorityTextColor = (priority: string) => {
  const colors: Record<string, string> = {
    P1: '#DC2626',    // Red
    P2: '#C2410C',    // Orange
    P3: '#1D4ED8',    // Blue
    P4: '#6B7280',    // Gray
  };
  return colors[priority] || colors['P4'];
};

export default function TaskReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ task: string }>();

  const initialTask = params.task ? JSON.parse(params.task) : null;

  const [detail, setDetail] = useState<any>(null);
  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [gensetExpanded, setGensetExpanded] = useState(true);
  const [engineExpanded, setEngineExpanded] = useState(false);
  const [alternatorExpanded, setAlternatorExpanded] = useState(false);
  const [checksExpanded, setChecksExpanded] = useState(false);
  const [complaintExpanded, setComplaintExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);

  useEffect(() => {
    loadDetail();
  }, []);

  const loadDetail = async () => {
    console.log('[REPORT] Loading report for task:', initialTask?._id);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !initialTask?._id) {
        console.log('[REPORT] Missing token or task id, aborting');
        return;
      }

      const data = await getCommissioningTaskDetail(token, initialTask._id);
      console.log('[REPORT] Commissioning detail response:', JSON.stringify(data));
      setDetail(data);

      const assetIdToFetch = data.assetId || initialTask.assetId;
      if (assetIdToFetch) {
        console.log('[REPORT] Loading asset:', assetIdToFetch);
        try {
          const assetData = await getAssetById(token, assetIdToFetch);
          console.log('[REPORT] Asset response:', JSON.stringify(assetData));
          setAsset(assetData);
        } catch (assetErr) {
          console.log('[REPORT] Failed to load asset:', assetErr);
        }
      } else {
        console.log('[REPORT] No assetId found on task, skipping asset fetch');
      }
    } catch (error) {
      console.log('[REPORT] Failed to load task detail:', error);
    } finally {
      setIsLoading(false);
      console.log('[REPORT] Load complete');
    }
  };

  if (!initialTask) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No task data found.</Text>
      </SafeAreaView>
    );
  }

  const task = detail ? { ...initialTask, ...detail } : initialTask;
  const a = asset || {};

  const rawType = (task.type || '').toUpperCase();
  const isRevalidation = rawType === 'REVALIDATION';
  const isPreCommissioning = rawType.includes('PRE');

  const commissioningChecks = task.commissioningChecks || {};
  const validationChecks = task.validationChecks || {};
  const faultCodes = task.faultCodes || [];
  const partsUsed = task.partsUsed || [];
  const gensetReadings = task.gensetReadings || null;
  const photos = task.photos || [];
  const customerFeedback = task.customerFeedback || null;
  const completionOtp = task.completionOtp || null;

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>● {formatTaskType(task.type)}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{task.status}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>

        {/* ── Genset number + warranty (from asset) ── */}
        <View style={styles.titleRow}>
          <Text style={styles.gensetNumberTitle}>{val(a.gensetNumber)}</Text>
          <View style={styles.warrantyBadge}>
            <Text style={styles.warrantyBadgeText}>
              {a.warrantyStatus || 'No warranty info'}
            </Text>
          </View>
        </View>
        <Text style={styles.gensetModelSubtitle}>{val(a.engineNumber)}</Text>

        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#241D67" />
            <Text style={styles.loadingText}>Loading full report...</Text>
          </View>
        )}

        {/* ── Genset Identification ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setGensetExpanded(!gensetExpanded)}>
          <Text style={styles.sectionHeaderText}>GENSET IDENTIFICATION</Text>
          <Text style={styles.sectionToggle}>{gensetExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {gensetExpanded && (
          <View style={styles.sectionBody}>
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
          </View>
        )}

        {/* ── Engine Parameters ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setEngineExpanded(!engineExpanded)}>
          <Text style={styles.sectionHeaderText}>ENGINE PARAMETERS</Text>
          <Text style={styles.sectionToggle}>{engineExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {engineExpanded && (
          <View style={styles.sectionBody}>
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
          </View>
        )}

        {/* ── Alternator & Panel ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setAlternatorExpanded(!alternatorExpanded)}>
          <Text style={styles.sectionHeaderText}>ALTERNATOR & PANEL</Text>
          <Text style={styles.sectionToggle}>{alternatorExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {alternatorExpanded && (
          <View style={styles.sectionBody}>
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
          </View>
        )}

        {/* ── STEP 2 — Commissioning Checks OR Validation Checks (skipped for Pre-Comm) ── */}
        {!isPreCommissioning && (
          <>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => setChecksExpanded(!checksExpanded)}>
              <Text style={styles.sectionHeaderText}>
                {isRevalidation ? 'VALIDATION CHECKS' : 'COMMISSIONING CHECKS'}
              </Text>
              <Text style={styles.sectionToggle}>{checksExpanded ? 'Less ▲' : 'More ▼'}</Text>
            </TouchableOpacity>

            {checksExpanded && (
              <View style={styles.sectionBody}>
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
              </View>
            )}
          </>
        )}

        {/* ── STEP 3 — Complaint Codes ── */}
{/* ── STEP 3 — Complaint Codes ── */}
<TouchableOpacity style={styles.sectionHeader} onPress={() => setComplaintExpanded(!complaintExpanded)}>
  <Text style={styles.sectionHeaderText}>COMPLAINT CODES</Text>
  <Text style={styles.sectionToggle}>{complaintExpanded ? 'Less ▲' : 'More ▼'}</Text>
</TouchableOpacity>

{complaintExpanded && (
  <View style={styles.sectionBody}>
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
  </View>
)}

{/* ── STEP 4 — Parts Used ── */}
<TouchableOpacity style={styles.sectionHeader} onPress={() => setPartsExpanded(!partsExpanded)}>
  <Text style={styles.sectionHeaderText}>PARTS USED</Text>
  <Text style={styles.sectionToggle}>{partsExpanded ? 'Less ▲' : 'More ▼'}</Text>
</TouchableOpacity>

{partsExpanded && (
  <View style={styles.sectionBody}>
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
  </View>
)}

        {/* ── STEP 5 — Genset Readings ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setReadingsExpanded(!readingsExpanded)}>
          <Text style={styles.sectionHeaderText}>GENSET READINGS</Text>
          <Text style={styles.sectionToggle}>{readingsExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {readingsExpanded && (
          <View style={styles.sectionBody}>
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
          </View>
        )}

        {/* ── STEP 6 — Photos ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setPhotosExpanded(!photosExpanded)}>
          <Text style={styles.sectionHeaderText}>PHOTOS ({photos.length})</Text>
          <Text style={styles.sectionToggle}>{photosExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {photosExpanded && (
          <View style={styles.sectionBody}>
            {photos.length === 0 ? (
              <Text style={styles.emptyText}>No photos uploaded.</Text>
            ) : (
              <View style={styles.reportPhotoGrid}>
                {photos.map((url: string, i: number) => (
                  <Image key={i} source={{ uri: url }} style={styles.reportPhotoThumb} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── STEP 7 — Customer Feedback ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setFeedbackExpanded(!feedbackExpanded)}>
          <Text style={styles.sectionHeaderText}>CUSTOMER FEEDBACK</Text>
          <Text style={styles.sectionToggle}>{feedbackExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {feedbackExpanded && (
          <View style={styles.sectionBody}>
            {!customerFeedback ? (
              <Text style={styles.emptyText}>No feedback recorded.</Text>
            ) : (
              <>
                <InfoRow label="Customer Name" value={customerFeedback.customerName} />
                <InfoRow label="Rating" value={customerFeedback.rating} />
                <InfoRow label="Comment" value={customerFeedback.comment} />
              </>
            )}
          </View>
        )}

        {/* ── Footer info ── */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.footerLabel}>DATE</Text>
            <Text style={styles.footerValue}>{formatDate(task.date)}</Text>
          </View>
          <View>
            <Text style={styles.footerLabel}>CREATED BY</Text>
            <Text style={styles.footerValue}>{val(task.createdBy?.name)}</Text>
            <Text style={styles.footerSubvalue}>{val(task.createdBy?.dealerName)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View>
            <Text style={styles.footerLabel}>ASSIGNED TO</Text>
            <Text style={styles.footerValue}>{val(task.assignedTo?.name)}</Text>
            <Text style={styles.footerSubvalue}>{val(task.assignedTo?.dealerName)}</Text>
          </View>
        </View>

        {/* ── STEP 8 — Work Completion ── */}
        <Text style={[styles.footerLabel, { marginTop: 20, marginBottom: 10 }]}>WORK COMPLETION</Text>
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
            <Text style={styles.workCompletionPendingText}>Work completion not yet verified.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  errorText: { textAlign: 'center', marginTop: 40, color: '#9CA3AF' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  typeBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
  },
  typeBadgeText: { color: '#7E22CE', fontWeight: '600', fontSize: 12 },
  statusBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: { color: '#C2410C', fontWeight: '700', fontSize: 12 },
  closeIcon: { fontSize: 20, color: '#6B7280' },

  scrollArea: { flex: 1, paddingHorizontal: 16 },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  gensetNumberTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937' },
  warrantyBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  warrantyBadgeText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  gensetModelSubtitle: { color: '#9CA3AF', fontSize: 14, marginTop: 2, marginBottom: 16 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  sectionHeader: {
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    borderRadius: 8,
  },
  sectionHeaderText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  sectionToggle: { color: '#D1D5DB', fontSize: 12, fontWeight: '600' },

  sectionBody: {
    paddingHorizontal: 4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.3 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },

  emptyText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },

  // Check group headers
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  groupLetterCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F26722', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  groupLetterText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  groupHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  subGroupTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },

  // Check rows
  checkRow: { marginBottom: 12 },
  checkRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkRowLabel: { flex: 1, fontSize: 13, color: '#374151', marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeOk: { backgroundColor: '#D1FAE5' },
  badgeTextOk: { color: '#059669' },
  badgeBad: { backgroundColor: '#FEE2E2' },
  badgeTextBad: { color: '#DC2626' },
  badgeNeutral: { backgroundColor: '#F3F4F6' },
  badgeTextNeutral: { color: '#4B5563' },

  commentBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  commentText: { color: '#B91C1C', fontStyle: 'italic', fontSize: 12 },

  // Info rows (plain label:value)
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoRowLabel: { fontSize: 13, color: '#6B7280' },
  infoRowValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flexShrink: 1, textAlign: 'right' },

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
  complaintReportTitle: { fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  complaintReportSub: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },

  reportPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportPhotoThumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#F3F4F6' },

  savedByText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
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
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
  },
  workCompletionPendingText: { color: '#6B7280', fontSize: 13 },
  // ── Complaint Codes Report Styles ──
complaintReportHeader: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 12,
},
complaintCodeBadge: {
  backgroundColor: '#F3F4F6',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  marginRight: 12,
  minWidth: 60,
  alignItems: 'center',
},
complaintCodeText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#374151',
},
priorityBadgeReport: {
  alignSelf: 'flex-start',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 10,
  marginBottom: 10,
},
priorityBadgeText: {
  fontSize: 11,
  fontWeight: '700',
},

// ── Parts Used Report Styles ──
partReportCard: {
  backgroundColor: '#F9FAFB',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  borderLeftWidth: 4,
  borderLeftColor: '#F26722',
},
partReportTop: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 10,
},
partCodeBadgeReport: {
  backgroundColor: '#F3F4F6',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  marginRight: 12,
},
partCodeTextReport: {
  fontSize: 12,
  fontWeight: '700',
  color: '#374151',
},
partNameReport: {
  fontSize: 14,
  fontWeight: '700',
  color: '#1F2937',
},
partCategoryReport: {
  fontSize: 12,
  color: '#9CA3AF',
  marginTop: 2,
},
partReportBottom: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
partUnitReport: {
  fontSize: 12,
  fontWeight: '600',
  color: '#F26722',
  backgroundColor: '#FFEDD5',
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 8,
},
partQtyReport: {
  fontSize: 13,
  fontWeight: '700',
  color: '#1F2937',
},
});

