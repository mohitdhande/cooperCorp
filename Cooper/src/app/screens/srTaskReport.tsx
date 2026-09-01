// NEW
import React from 'react';
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
import { useRouter } from 'expo-router';
import { SERVICE_CATEGORIES } from '../../_components/srTaskForm/srDropdownOptions';
import { useSrTaskReportScreenController } from '@/controllers/srTaskReportController';
import { formatAddress, formatDate, val } from '@/utils/reportFormatters';
import { getPriorityColor, getPriorityTextColor } from '@/utils/statusStyles';
import { CheckRow } from '@/_components/shared/CheckRow';
import { InfoRow } from '@/_components/shared/InfoRow';

const { width: SCREEN_WIDTH } = require('react-native').Dimensions.get('window');

export default function ServiceTaskReportScreen() {
  const router = useRouter();

  const {
    initialTask, detail, asset, isLoading, loadError, userName, userProfilePic,
    gensetExpanded, setGensetExpanded,
    alternatorExpanded, setAlternatorExpanded,
    serviceExpanded, setServiceExpanded,
    readingsExpanded, setReadingsExpanded,
    engineParamsExpanded, setEngineParamsExpanded,
    complaintExpanded, setComplaintExpanded,
    partsExpanded, setPartsExpanded,
    photosExpanded, setPhotosExpanded,
    notesExpanded, setNotesExpanded,
    approvalExpanded, setApprovalExpanded,
  } = useSrTaskReportScreenController();

  if (!initialTask) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No task data found.</Text>
      </SafeAreaView>
    );
  }

  const task = detail ? { ...initialTask, ...detail } : initialTask;
  const a = asset || {};

  const faultCodes = task.faultCodes || [];
  const partsUsed = task.partsUsed || [];
  const photos = task.photos || [];
  const notes = task.notes || '';
  const category = task.category || '';
  const subCategory = task.subCategory || '';
  const workApproval = task.workApproval || null;
  const completionOtp = task.completionOtp || null;

  const categoryColor =
    SERVICE_CATEGORIES.find((c) => c.letter === category) ||
    { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' };

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
    
      {/* ── AppBar (standard, matches rest of app) ── */}
      <View style={styles.appBar}>
        <View style={styles.brandRow}>
          <Image source={require('@/assets/logo_circular.png')} style={styles.logoImage} />
          <View>
            <Text style={styles.brandTitle}>Cooper Corp</Text>
            <Text style={styles.brandSubtitle}>Gentset E-FSR</Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity onPress={() => router.push('/screens/profile' as any)}>
            {userProfilePic ? (
              <Image source={{ uri: userProfilePic }} style={styles.appBarAvatar} />
            ) : (
              <View style={styles.appBarAvatarFallback}>
                <Text style={styles.appBarAvatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Sub-header: back link + badges ── */}
      <View style={styles.subHeaderRow}>
        <TouchableOpacity style={styles.backLinkRow} onPress={() => router.back()}>
          <Text style={styles.backLinkArrow}>{'‹'}</Text>
          <Text style={styles.backLinkText}>SR Tasks</Text>
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>● SR Job</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{task.status}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>

        {/* ── Title + category badge ── */}
        <View style={styles.titleRow}>
          <Text style={styles.gensetNumberTitle}>{val(task.title || a.gensetNumber)}</Text>
          {category ? (
            <View style={[styles.categoryBadgeReport, { backgroundColor: categoryColor.bg, borderColor: categoryColor.border }]}>
              <Text style={[styles.categoryBadgeReportText, { color: categoryColor.text }]}>
                {category} — {subCategory}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.gensetModelSubtitle}>{val(a.gensetNumber)} · {val(a.engineNumber)}</Text>

        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#241D67" />
            <Text style={styles.loadingText}>Loading full report...</Text>
          </View>
        )}
        {!isLoading && loadError ? (
          <Text style={[styles.errorText, { marginTop: 8 }]}>{loadError}</Text>
        ) : null}

        {/* ── STEP 1a — Genset Identification ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setGensetExpanded(!gensetExpanded)}>
          <Text style={styles.sectionHeaderText}>GENSET IDENTIFICATION</Text>
          <Text style={styles.sectionToggle}>{gensetExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {gensetExpanded && (
          <View style={styles.sectionBody}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>GENSET MODEL</Text>
                <Text style={styles.fieldValue}>{val(a.gensetModel)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>GENSET SR NUMBER</Text>
                <Text style={styles.fieldValue}>{val(a.gensetNumber)}</Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>ENGINE MODEL</Text>
                <Text style={styles.fieldValue}>{val(a.engineModel)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>ENGINE NUMBER</Text>
                <Text style={styles.fieldValue}>{val(a.engineNumber)}</Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>ENGINE KW</Text>
                <Text style={styles.fieldValue}>{val(a.kw)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>ENGINE TYPE</Text>
                <Text style={styles.fieldValue}>{val(a.engineType)}</Text>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>ENGINE FAMILY</Text>
                <Text style={styles.fieldValue}>{val(a.engineFamily)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>FUEL TYPE</Text>
                <Text style={styles.fieldValue}>{val(a.fuelType)}</Text>
              </View>
            </View>

            <View style={styles.fieldFull}>
              <Text style={styles.fieldLabel}>APPLICATION</Text>
              <Text style={styles.fieldValue}>{val(a.applicationMaterial)}</Text>
            </View>

            <View style={styles.fieldFull}>
              <Text style={styles.fieldLabel}>CLIENT</Text>
              <Text style={styles.fieldValue}>{val(a.clientName)}</Text>
            </View>

            <View style={styles.fieldFull}>
              <Text style={styles.fieldLabel}>ADDRESS</Text>
              <Text style={styles.fieldValue}>{formatAddress(a.address)}</Text>
            </View>
          </View>
        )}

        {/* ── STEP 1b — Alternator & Panel ── */}
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
                <Text style={styles.fieldLabel}>KVA</Text>
                <Text style={styles.fieldValue}>{val(a.kva)}</Text>
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>PHASE</Text>
                <Text style={styles.fieldValue}>{val(a.phase)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>PANEL TYPE</Text>
                <Text style={styles.fieldValue}>{val(a.panelType)}</Text>
              </View>
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>PANEL S/N</Text>
                <Text style={styles.fieldValue}>{val(a.controlPanelSerialNumber)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>CPCB NORM</Text>
                <Text style={styles.fieldValue}>{val(a.cpcb)}</Text>
              </View>
            </View>
            <View style={styles.fieldFull}>
              <Text style={styles.fieldLabel}>LOAD UNBALANCE</Text>
              <Text style={styles.fieldValue}>{a.loadUnbalance === true ? 'Yes' : a.loadUnbalance === false ? 'No' : '--'}</Text>
            </View>
            {a.loadUnbalance ? (
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>UNBALANCE %</Text>
                <Text style={styles.fieldValue}>{val(a.loadUnbalancePercentage)}</Text>
              </View>
            ) : a.loadUnbalanceComment ? (
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>COMMENT</Text>
                <Text style={styles.fieldValue}>{val(a.loadUnbalanceComment)}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── STEP 1c — Service ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setServiceExpanded(!serviceExpanded)}>
          <Text style={styles.sectionHeaderText}>SERVICE</Text>
          <Text style={styles.sectionToggle}>{serviceExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {serviceExpanded && (
          <View style={styles.sectionBody}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>TYPE OF SERVICE</Text>
                <Text style={styles.fieldValue}>{val(a.serviceType)}</Text>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.fieldLabel}>WARRANTY STATUS</Text>
                <Text style={styles.fieldValue}>{val(a.warrantyStatus)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── STEP 1d — Electrical Readings ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setReadingsExpanded(!readingsExpanded)}>
          <Text style={styles.sectionHeaderText}>ELECTRICAL READINGS</Text>
          <Text style={styles.sectionToggle}>{readingsExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {readingsExpanded && (
          <View style={styles.sectionBody}>
            <InfoRow label="AC Volt R-Y (V)" value={a.acVoltageRY} />
            <InfoRow label="AC Volt Y-B (V)" value={a.acVoltageYB} />
            <InfoRow label="AC Volt B-R (V)" value={a.acVoltageBR} />
            <InfoRow label="AC Amp R (A)" value={a.acAmpR} />
            <InfoRow label="AC Amp Y (A)" value={a.acAmpY} />
            <InfoRow label="AC Amp B (A)" value={a.acAmpB} />
            <InfoRow label="Load kW R" value={a.loadKwR} />
            <InfoRow label="Load kW Y" value={a.loadKwY} />
            <InfoRow label="Load kW B" value={a.loadKwB} />
            <InfoRow label="Total kW" value={a.totalKwLoad} />
            <InfoRow label="Load %" value={a.loadPercentage} />
          </View>
        )}

        {/* ── STEP 1e — Engine Parameters ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setEngineParamsExpanded(!engineParamsExpanded)}>
          <Text style={styles.sectionHeaderText}>ENGINE PARAMETERS</Text>
          <Text style={styles.sectionToggle}>{engineParamsExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {engineParamsExpanded && (
          <View style={styles.sectionBody}>
            <InfoRow label="RPM" value={a.rpm} />
            <InfoRow label="Frequency (Hz)" value={a.frequency} />
            <InfoRow label="DC Voltage (V)" value={a.dcVoltage} />
            <InfoRow label="Oil Pressure" value={a.oilPressure} />
            <InfoRow label="Coolant Temp (°C)" value={a.coolantTemperature} />
            <InfoRow label="DEF Level (%)" value={a.defLevelPercentage} />
            <CheckRow label="Oil Level" value={a.oilLevel} />
            <CheckRow label="Coolant Level" value={a.coolantLevel} />
          </View>
        )}

        {/* ── STEP 2 — Complaint Codes ── */}
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
                        <View style={[styles.priorityBadgeReport, { backgroundColor: getPriorityColor(codeInfo.priority) }]}>
                          <Text style={[styles.priorityBadgeText, { color: getPriorityTextColor(codeInfo.priority) }]}>
                            {codeInfo.priority}
                          </Text>
                        </View>
                      )}
                    </View>
                    {fc.observation && <InfoRow label="Observation" value={fc.observation} />}
                    {fc.rootCause && <InfoRow label="Root Cause" value={fc.rootCause} />}
                    {fc.correctiveAction && <InfoRow label="Corrective Action" value={fc.correctiveAction} />}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── STEP 3 — Parts Used ── */}
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

        {/* ── STEP 4 — Photos ── */}
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

        {/* ── STEP 5 — Notes ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setNotesExpanded(!notesExpanded)}>
          <Text style={styles.sectionHeaderText}>WORK SUMMARY / NOTES</Text>
          <Text style={styles.sectionToggle}>{notesExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {notesExpanded && (
          <View style={styles.sectionBody}>
            {!notes ? (
              <Text style={styles.emptyText}>No notes recorded.</Text>
            ) : (
              <Text style={styles.notesText}>{notes}</Text>
            )}
          </View>
        )}

        {/* ── STEP 6 — Category & Approval ── */}
        <TouchableOpacity style={styles.sectionHeader} onPress={() => setApprovalExpanded(!approvalExpanded)}>
          <Text style={styles.sectionHeaderText}>CATEGORY & APPROVAL</Text>
          <Text style={styles.sectionToggle}>{approvalExpanded ? 'Less ▲' : 'More ▼'}</Text>
        </TouchableOpacity>

        {approvalExpanded && (
          <View style={styles.sectionBody}>
            {category ? (
              <View style={[styles.categoryBadgeReport, { backgroundColor: categoryColor.bg, borderColor: categoryColor.border, marginBottom: 14 }]}>
                <Text style={[styles.categoryBadgeReportText, { color: categoryColor.text }]}>
                  {category} — {subCategory}
                </Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>No category selected.</Text>
            )}

            {workApproval ? (
              <>
                <InfoRow label="Status" value={workApproval.status} />
                {workApproval.requestedAt && (
                  <InfoRow label="Requested" value={`${formatDate(workApproval.requestedAt)} by ${val(workApproval.requestedBy?.name)}`} />
                )}
                {workApproval.amDecidedAt && (
                  <InfoRow label="AM Approved" value={`${formatDate(workApproval.amDecidedAt)} by ${val(workApproval.amDecidedBy?.name)}`} />
                )}
                {workApproval.rsmDecidedAt && (
                  <InfoRow label="RSM Confirmed" value={`${formatDate(workApproval.rsmDecidedAt)} by ${val(workApproval.rsmDecidedBy?.name)}`} />
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>No approval requested yet.</Text>
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

        {/* ── Work Completion ── */}
        <Text style={[styles.footerLabel, { marginTop: 20, marginBottom: 10 }]}>WORK COMPLETION</Text>
        {completionOtp?.verified === true ? (
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

  // ── Standard AppBar (matches every other screen — fixed 70px height) ──
  appBar: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241D67',
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logoImage: { width: 36, height: 36, marginRight: 10 },
  brandTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  brandSubtitle: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  rightSection: { flexDirection: 'row', alignItems: 'center' },
  appBarAvatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: '#fff',
  },
  appBarAvatarFallback: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
  },
  appBarAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Sub-header row (back link + badges) ──
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  backLinkRow: { flexDirection: 'row', alignItems: 'center' },
  backLinkArrow: { fontSize: 20, color: '#241D67', marginRight: 4 },
  backLinkText: { fontSize: 15, fontWeight: '600', color: '#241D67' },

  headerLeft: { flexDirection: 'row', alignItems: 'center' },
 
  typeBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
  },
  typeBadgeText: { color: '#1D4ED8', fontWeight: '600', fontSize: 12 },
  statusBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: { color: '#C2410C', fontWeight: '700', fontSize: 12 },
  closeIcon: { fontSize: 20, color: '#6B7280' },

 // NEW
  scrollArea: { flex: 1, paddingHorizontal: 16, backgroundColor: '#fff' },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  gensetNumberTitle: { fontSize: 22, fontWeight: '700', color: '#1F2937', flex: 1 },
  categoryBadgeReport: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  categoryBadgeReportText: { fontSize: 12, fontWeight: '700' },
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
  notesText: { color: '#1F2937', fontSize: 14, lineHeight: 21 },

  // Check rows and info rows now live in the shared CheckRow/InfoRow components.

  complaintReportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
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
});