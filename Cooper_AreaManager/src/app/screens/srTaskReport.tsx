import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, RefreshControl, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Bell, CheckCheck, CheckCircle2, FileText, Play, Video as VideoIcon } from 'lucide-react-native';
import { CheckRow, InfoRow } from '../../_components/ReportRows';
import { ReportSectionCard } from '../../_components/shared/ReportSectionCard';
import { ActivityHistoryCard } from '../../_components/shared/ActivityHistoryCard';
import { AssetIdentityHeader } from '../../_components/shared/AssetIdentityHeader';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';
import { VideoPlayerModal } from '../../_components/shared/VideoPlayerModal';
import { PhotoLightboxModal } from '../../_components/shared/PhotoLightboxModal';
import { useSrTaskReportController } from '../../controllers/srTaskReportController';
import {
  val, formatDate, formatAddress, getPriorityColor, getPriorityTextColor, formatTimeAgoLabel, getTaskPeople, videoFileName,
} from '../../utils/reportFormatters';
import { SERVICE_CATEGORIES } from '../../_components/srTaskForm/srDropdownOptions';
import { safeJsonParse } from '../../utils/safeJsonParse';

const REF_WIDTH = 420;

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  // COMPLETED (OTP still pending) reads as still-active/amber, not done —
  // only CLIENT_APPROVED (OTP verified) and CLOSED are the real "done"
  // greens, matching the same distinction used everywhere else in the app.
  COMPLETED: { bg: '#FFE3D4', text: '#FB7C42' },
  CLIENT_APPROVED: { bg: '#DCFCE7', text: '#15803D' },
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
          <RadialGradient id="srTaskReportBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#srTaskReportBg)" />
      </Svg>
    </View>
  );
}

// Full SR (service) task report — genset/engine/alternator identification,
// electrical readings, complaint codes, parts, photos, notes, category &
// approval trail, and work-completion status.
export default function ServiceTaskReportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);
  const params = useLocalSearchParams<{ task: string }>();
  const initialTask = safeJsonParse<any>(params.task) ?? null;

  const {
    task, asset: a, isLoading, refreshing, onRefresh, detailError,
    videos, videoModalVisible, videoUri, videoError, handlePlayVideo, closeVideoModal,
    documents, documentOpeningUrl, documentError, handleViewDocument,
    signedPhotoUrls, photosSigning,
    canCloseTicket, closingTicket, closeTicketError, handleCloseTicket,
  } = useSrTaskReportController(initialTask);

  const [gensetExpanded, setGensetExpanded] = useState(true);
  const [alternatorExpanded, setAlternatorExpanded] = useState(false);
  const [serviceExpanded, setServiceExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [engineParamsExpanded, setEngineParamsExpanded] = useState(false);
  const [complaintExpanded, setComplaintExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [videosExpanded, setVideosExpanded] = useState(false);
  const [documentsExpanded, setDocumentsExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [approvalExpanded, setApprovalExpanded] = useState(true);

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!initialTask) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No task data found.</Text>
      </SafeAreaView>
    );
  }

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
    { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', name: 'Service' };
  const statusColor = STATUS_COLOR[task.status] || STATUS_COLOR.ASSIGNED;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Report</Text>
        <View style={styles.headerButton}>
          <Bell size={20} color="#979797" />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: canCloseTicket ? 210 : 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        {/* Surfaces a failed detail fetch instead of silently leaving the
            screen on stale nav-param data — pull down to retry. */}
        {!!detailError && (
          <View style={[styles.detailErrorBanner, { marginBottom: 16 }]}>
            <Text style={styles.detailErrorBannerText}>{detailError} Pull down to retry.</Text>
          </View>
        )}

        {/* Same identity ribbon+pill TaskPreviewCard/srDetail already use —
            was a separate hand-rolled srNumberPill/title block here before,
            with a raw unformatted srNumber and no assignee identity at all. */}
        <View style={styles.identityCard}>
          <AssetIdentityHeader
            task={task}
            isService
            taskPeople={getTaskPeople(task)}
            gensetNumberOverride={a.gensetNumber}
            engineNumberOverride={a.engineNumber}
          />

          {!!task.title && <Text style={styles.reportTaskTitle}>{task.title}</Text>}

          {!!category && (
            <View style={styles.reportCatStatusRow}>
              <View style={styles.reportCatBadgeCircle}>
                <Text style={styles.reportCatBadgeLetter}>{category}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusPillText, { color: statusColor.text }]}>
                  {val(task.status).split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}
                </Text>
              </View>
            </View>
          )}
        </View>

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
        </ReportSectionCard>

        <ReportSectionCard title="Service" expanded={serviceExpanded} onToggle={() => setServiceExpanded(!serviceExpanded)}>
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
        </ReportSectionCard>

        <ReportSectionCard title="Electrical Readings" expanded={readingsExpanded} onToggle={() => setReadingsExpanded(!readingsExpanded)}>
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
        </ReportSectionCard>

        <ReportSectionCard title="Engine Parameters" expanded={engineParamsExpanded} onToggle={() => setEngineParamsExpanded(!engineParamsExpanded)}>
          <InfoRow label="RPM" value={a.rpm} />
          <InfoRow label="Frequency (Hz)" value={a.frequency} />
          <InfoRow label="DC Voltage (V)" value={a.dcVoltage} />
          <InfoRow label="Oil Pressure" value={a.oilPressure} />
          <InfoRow label="Coolant Temp (°C)" value={a.coolantTemperature} />
          <InfoRow label="DEF Level (%)" value={a.defLevelPercentage} />
          <CheckRow label="Oil Level" value={a.oilLevel} />
          <CheckRow label="Coolant Level" value={a.coolantLevel} />
        </ReportSectionCard>

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
                  {fc.correctiveAction && <InfoRow label="Corrective Action" value={fc.correctiveAction} />}
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

        <ReportSectionCard title={`Photos (${photos.length})`} expanded={photosExpanded} onToggle={() => setPhotosExpanded(!photosExpanded)}>
          {photos.length === 0 ? (
            <Text style={styles.emptyText}>No photos uploaded.</Text>
          ) : photosSigning ? (
            <ActivityIndicator color="#F26722" style={styles.photosLoadingSpinner} />
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

        {/* PDFs ride the same GCS array as videos (see
            srTaskReportController.ts) but need their own section — tapping
            one signs the URL and hands it to the device's own PDF viewer
            (Linking.openURL), there's no in-app PDF renderer. */}
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

        <ReportSectionCard title="Work Summary / Notes" expanded={notesExpanded} onToggle={() => setNotesExpanded(!notesExpanded)}>
          {!notes ? (
            <Text style={styles.emptyText}>No notes recorded.</Text>
          ) : (
            <Text style={styles.notesText}>{notes}</Text>
          )}
        </ReportSectionCard>

        <ReportSectionCard title="Approval Timeline" expanded={approvalExpanded} onToggle={() => setApprovalExpanded(!approvalExpanded)}>
          {category ? (
            <View style={[styles.categoryBadgeReport, { backgroundColor: categoryColor.bg, borderColor: categoryColor.border, marginBottom: 14 }]}>
              <Text style={[styles.categoryBadgeReportText, { color: categoryColor.text }]}>
                {category} — {subCategory}
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No category selected.</Text>
          )}

          {!workApproval ? (
            <Text style={styles.emptyText}>No approval requested yet.</Text>
          ) : (
            <>
              {!!workApproval.requestedAt && (
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#3B82F6' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>Submitted for Approval</Text>
                    {!!workApproval.requestedBy?.name && (
                      <Text style={styles.timelineSubtitle}>{workApproval.requestedBy.name}</Text>
                    )}
                    <Text style={styles.timelineTime}>
                      {formatTimeAgoLabel(workApproval.requestedAt)}
                    </Text>
                  </View>
                </View>
              )}

              {!!workApproval.amDecidedAt && (
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#16A34A' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>AM Approved</Text>
                    {!!workApproval.amDecidedBy?.name && (
                      <Text style={styles.timelineSubtitle}>{workApproval.amDecidedBy.name}</Text>
                    )}
                    <Text style={styles.timelineTime}>
                      {formatTimeAgoLabel(workApproval.amDecidedAt)}
                    </Text>
                  </View>
                </View>
              )}

              {!!workApproval.rsmDecidedAt && (
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#16A34A' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>RSM Confirmed</Text>
                    {!!workApproval.rsmDecidedBy?.name && (
                      <Text style={styles.timelineSubtitle}>{workApproval.rsmDecidedBy.name}</Text>
                    )}
                    <Text style={styles.timelineTime}>
                      {formatTimeAgoLabel(workApproval.rsmDecidedAt)}
                    </Text>
                  </View>
                </View>
              )}

              {workApproval.status === 'CONFIRMED' ? (
                <View style={styles.timelineFinalRow}>
                  <CheckCircle2 size={18} color="#16A34A" />
                  <Text style={styles.timelineFinalTextApproved}>Fully Approved</Text>
                </View>
              ) : workApproval.status === 'REJECTED' ? (
                <View style={styles.timelineFinalRow}>
                  <Text style={styles.timelineFinalTextRejected}>
                    Rejected{workApproval.rejectedBy ? ` by ${workApproval.rejectedBy}` : ''}
                    {workApproval.rejectionNote ? ` — ${workApproval.rejectionNote}` : ''}
                  </Text>
                </View>
              ) : null}
            </>
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
        </View>
      </ScrollView>

      {/* Floats over the content instead of pushing the ScrollView up in
          normal flow — same pattern as Dashboard/srDetail's own
          floatingFooter. pointerEvents="box-none" lets touches pass
          through the transparent space around the button/bar to whatever
          scrolled content sits underneath. The ScrollView's own
          contentContainerStyle paddingBottom above is sized to clear
          this footer's actual height (taller when the Close Service
          button is also showing) so the last card never ends up hidden
          behind it. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        {/* Same 3-gate close rule as srDetail.tsx/srTaskForm.tsx — the
            report screen is otherwise read-only, so this is the one
            action it offers once the ticket is actually eligible to
            close. */}
        {canCloseTicket && (
          <View style={[styles.closeServiceBar, { paddingHorizontal: hPad }]}>
            <TouchableOpacity
              style={[styles.closeServiceButton, closingTicket && styles.buttonDisabled]}
              onPress={handleCloseTicket}
              disabled={closingTicket}
            >
              {closingTicket ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <CheckCheck size={18} color="#FFFFFF" />
                  <Text style={styles.closeServiceButtonText}>Close Service</Text>
                </>
              )}
            </TouchableOpacity>
            {!!closeTicketError && <Text style={styles.closeServiceErrorText}>{closeTicketError}</Text>}
          </View>
        )}

        <BottomNavBar active="services" />
      </View>

      <VideoPlayerModal
        visible={videoModalVisible}
        uri={videoUri}
        error={videoError}
        onClose={closeVideoModal}
      />

      <PhotoLightboxModal
        visible={lightboxVisible}
        photos={photos.map((url: string) => signedPhotoUrls[url] || url)}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },
  errorText: { textAlign: 'center', marginTop: 40, color: '#9CA3AF' },
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
  detailErrorBanner: {
    backgroundColor: '#FEE2E2', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  detailErrorBannerText: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },

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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '400', color: '#6B7280' },
  statusPill: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { fontSize: 13, fontWeight: '700' },

  // The identity ribbon+pill card (AssetIdentityHeader) plus this report's
  // own title/category/status row underneath it — sits right above
  // ActivityHistoryCard, same white-card treatment, small gap between the
  // two rather than one merged card (ActivityHistoryCard is self-contained
  // and used elsewhere on its own).
  identityCard: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 20, gap: 14, marginBottom: 4 },
  reportTaskTitle: { fontSize: 16, fontWeight: '700', color: '#000000' },
  reportCatStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportCatBadgeCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },
  reportCatBadgeLetter: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  categoryBadgeReport: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  categoryBadgeReportText: { fontSize: 12, fontWeight: '700' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.3 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },

  emptyText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },
  notesText: { color: '#1F2937', fontSize: 14, lineHeight: 21 },

  // ─── Approval Timeline ───
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  timelineSubtitle: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 2 },
  timelineTime: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  timelineFinalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 22 },
  timelineFinalTextApproved: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  timelineFinalTextRejected: { fontSize: 14, fontWeight: '600', color: '#DC2626' },

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
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 14,
  },
  workCompletionPendingText: { color: '#6B7280', fontSize: 13 },
});
