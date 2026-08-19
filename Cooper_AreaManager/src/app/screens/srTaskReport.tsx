import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, RefreshControl, useWindowDimensions, Modal, Pressable } from 'react-native';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Bell, Check, CheckCheck, CheckCircle2, Clock, FileText, Play, Video as VideoIcon, X, Key, Star } from 'lucide-react-native';
import { CheckRow, InfoRow } from '../../_components/ReportRows';
import { ReportSectionCard } from '../../_components/shared/ReportSectionCard';
import { NotesBulletList } from '../../_components/shared/NotesBulletList';
import { ActivityHistoryCard } from '../../_components/shared/ActivityHistoryCard';
import { AssetIdentityHeader } from '../../_components/shared/AssetIdentityHeader';
import { VideoPlayerModal } from '../../_components/shared/VideoPlayerModal';
import { PhotoLightboxModal } from '../../_components/shared/PhotoLightboxModal';
import { useSrTaskReportController } from '../../controllers/srTaskReportController';
import {
  val, formatDate, formatAddress, getPriorityColor, getPriorityTextColor, getTaskPeople, videoFileName,
} from '../../utils/reportFormatters';
import { SERVICE_CATEGORIES } from '../../_components/srTaskForm/srDropdownOptions';
import { safeJsonParse } from '../../utils/safeJsonParse';

const REF_WIDTH = 420;

// Voice of Customer's 1-5 star rating, labeled the same way srTaskForm.tsx's
// own (editable) star input does.
const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

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

// 1-2-3 progress row atop the OTP sheet — same visual language and same
// 3-step shape as commissioning's own OtpStepper (taskReport.tsx).
function OtpStepper({ step }: { step: 1 | 2 | 3 }) {
  const circle = (n: 1 | 2 | 3) => {
    const done = step > n;
    const active = step === n;
    return (
      <View style={[styles.stepCircle, done && styles.stepCircleDone, active && styles.stepCircleActive]}>
        {done ? <CheckCircle2 size={16} color="#FFFFFF" /> : <Text style={[styles.stepCircleText, active && styles.stepCircleTextActive]}>{n}</Text>}
      </View>
    );
  };
  return (
    <View style={styles.stepperRow}>
      {circle(1)}
      <View style={[styles.stepLine, step > 1 && styles.stepLineDone]} />
      {circle(2)}
      <View style={[styles.stepLine, step > 2 && styles.stepLineDone]} />
      {circle(3)}
    </View>
  );
}

// Client OTP verification sheet — moved here from srTaskForm.tsx's Step 5
// Customer Sign-off card, same as commissioning's own OTP step living on
// its report screen instead of the task form. Same 3-step shape as
// commissioning: Generate OTP -> Customer Enters OTP -> Customer Remark.
function VerifyOtpSheet({
  visible, step, contactNumber, otpGenerated, generatedOtp, customerOtp, otpInputRefs, otpLoading, otpError,
  remark, remarkSaving, remarkError,
  onClose, onGenerate, onRegenerate, onChangeDigit, onVerify, onChangeRemark, onSaveRemark,
}: {
  visible: boolean;
  step: 1 | 2 | 3;
  contactNumber?: string;
  otpGenerated: boolean;
  generatedOtp: string[];
  customerOtp: string[];
  otpInputRefs: React.MutableRefObject<Array<any>>;
  otpLoading: boolean;
  otpError: string;
  remark: string;
  remarkSaving: boolean;
  remarkError: string;
  onClose: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onChangeDigit: (index: number, value: string) => void;
  onVerify: () => void;
  onChangeRemark: (text: string) => void;
  onSaveRemark: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={step === 3 ? () => {} : onClose}>
      {/* Dismissible by tap-outside/X/back on steps 1-2 only — once OTP is
          verified (step 3), the only way out is explicitly saving (or
          leaving blank) the customer remark via Save & Close below. */}
      <Pressable style={styles.otpModalOverlay} onPress={step === 3 ? undefined : onClose}>
        <Pressable style={styles.otpSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.otpSheetHandle} />
          <View style={styles.otpSheetHeaderRow}>
            <View>
              <Text style={styles.otpSheetTitle}>Client OTP Verification</Text>
              {!!contactNumber && <Text style={styles.otpSheetContactNumber}>{contactNumber}</Text>}
            </View>
            {step !== 3 && (
              <TouchableOpacity style={styles.otpCloseButton} onPress={onClose}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          <OtpStepper step={step} />

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {step === 1 && (
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
                  onPress={onGenerate}
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

            {step === 2 && (
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
                  <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }} onPress={onRegenerate} disabled={otpLoading}>
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
                        onChangeText={(text) => onChangeDigit(index, text)}
                        keyboardType="numeric"
                        maxLength={1}
                        textAlign="center"
                      />
                    ))}
                  </View>

                  {!!otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}

                  <TouchableOpacity
                    style={[styles.otpVerifyButton, (customerOtp.join('').length < 4 || otpLoading) && styles.buttonDisabled]}
                    onPress={onVerify}
                    disabled={customerOtp.join('').length < 4 || otpLoading}
                  >
                    {otpLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpVerifyButtonText}>Verify OTP</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 3 && (
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
                    onChangeText={onChangeRemark}
                    multiline
                    numberOfLines={4}
                  />
                  {!!remarkError && <Text style={styles.otpErrorText}>{remarkError}</Text>}
                  <TouchableOpacity
                    style={[styles.otpVerifyButton, remarkSaving && styles.buttonDisabled]}
                    onPress={onSaveRemark}
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
    isOtpPending,
    otpSheetOpen, openOtpSheet, closeOtpSheet, otpStep,
    otpGenerated, generatedOtp, customerOtp, otpInputRefs, otpLoading, otpError,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleVerifyOtp,
    remark, setRemark, remarkSaving, remarkError, handleSaveRemark,
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
  const partApproval = task.partApproval || null;
  const completionOtp = task.completionOtp || null;
  const customerFeedback = task.customerFeedback || null;

  const categoryColor =
    SERVICE_CATEGORIES.find((c) => c.letter === category) ||
    { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151', name: 'Service' };
  const statusColor = STATUS_COLOR[task.status] || STATUS_COLOR.ASSIGNED;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />

      {/* App bar is the ScrollView's own first child (not a fixed sibling
          above it) — the whole screen, header included, scrolls as one
          unit, same fix already applied to newJob.tsx/newServiceJob.tsx/
          srTaskForm.tsx. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: (canCloseTicket || isOtpPending) ? 210 : 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
      >
        {/* headerPad (30/420) is wider than this ScrollView's own hPad
            (20/420) content padding — negative margin cancels that out so
            the header still sits at its original, wider inset instead of
            the narrower one every other card uses. */}
        <View style={[styles.header, { marginHorizontal: -hPad, paddingHorizontal: headerPad }]}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <ChevronLeft size={22} color="#979797" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Report</Text>
          <View style={styles.headerButton}>
            <Bell size={20} color="#979797" />
          </View>
        </View>

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

        {/* Same "Pending Customer Sign-off" banner srTaskForm.tsx's Step 5
            used to show — moved here since OTP verification itself now
            lives on this screen. */}
        {isOtpPending && (
          <View style={styles.pendingSignOffBanner}>
            <View style={styles.pendingSignOffIconChip}>
              <Clock size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingSignOffTitle}>Pending Customer Sign-off</Text>
              <Text style={styles.pendingSignOffSubtitle}>Collect OTP from the customer to proceed.</Text>
            </View>
          </View>
        )}

        {/* Same dedicated "Approval Status" card srTaskForm.tsx's Step 5
            used to show (category badge + Work/Parts Approval banners) —
            moved here as its own card rather than folded into Approval
            Timeline below, which stays scoped to the Work Approval trail. */}
        {!!category && (workApproval || partApproval) && (
          <View style={styles.approvalStatusCard}>
            <Text style={styles.approvalStatusLabel}>APPROVAL STATUS</Text>
            <View style={styles.approvalStatusCatRow}>
              <View style={[styles.approvalStatusCatBadge, { backgroundColor: categoryColor.bg }]}>
                <Text style={[styles.approvalStatusCatBadgeText, { color: categoryColor.text }]}>{category}</Text>
              </View>
              <Text style={styles.approvalStatusCatName}>{(categoryColor as any).name || subCategory}</Text>
            </View>

            {!!workApproval && (workApproval.status === 'PENDING_AM' || workApproval.status === 'PENDING_RSM') && (
              <View style={styles.partsApprovalBanner}>
                <View style={styles.partsApprovalIconChip}>
                  <Clock size={16} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partsApprovalTitle}>Work Approval</Text>
                  <Text style={styles.partsApprovalSubtitle}>
                    {workApproval.status === 'PENDING_AM' ? 'Awaiting Area Manager review' : 'AM approved — awaiting RSM confirmation'}
                  </Text>
                </View>
                <View style={styles.pendingTag}>
                  <Text style={styles.pendingTagText}>{workApproval.status === 'PENDING_AM' ? 'PENDING AM' : 'PENDING RSM'}</Text>
                </View>
              </View>
            )}
            {workApproval?.status === 'CONFIRMED' && (
              <View style={styles.partsApprovalBannerDone}>
                <View style={styles.partsApprovalIconChipDone}>
                  <CheckCircle2 size={16} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partsApprovalTitleDone}>Work Approval</Text>
                  <Text style={styles.partsApprovalSubtitleDone}>RSM confirmed</Text>
                </View>
                <View style={styles.doneTag}><Text style={styles.doneTagText}>DONE</Text></View>
              </View>
            )}

            {partApproval?.status === 'PENDING' && (
              <View style={styles.partsApprovalBanner}>
                <View style={styles.partsApprovalIconChip}>
                  <Clock size={16} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partsApprovalTitle}>Parts Approval</Text>
                  <Text style={styles.partsApprovalSubtitle}>Pending AM review</Text>
                </View>
                <View style={styles.pendingTag}>
                  <Text style={styles.pendingTagText}>PENDING</Text>
                </View>
              </View>
            )}
            {!!partApproval && partApproval.status !== 'PENDING' && (
              <View style={styles.partsApprovalBannerDone}>
                <View style={styles.partsApprovalIconChipDone}>
                  <CheckCircle2 size={16} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partsApprovalTitleDone}>Parts Approval</Text>
                  <Text style={styles.partsApprovalSubtitleDone}>Reviewed</Text>
                </View>
                <View style={styles.doneTag}><Text style={styles.doneTagText}>DONE</Text></View>
              </View>
            )}
          </View>
        )}

        {/* Notes / Suggestion Comments / Voice of Customer / Customer
            Remark / OTP Pending all share one plain card — same merged
            pattern as commissioning's own taskReport.tsx. Voice of Customer
            and Customer Remark are service-only (task.customerFeedback:
            { customerName, rating, comment, submittedAt }); Notes and
            Suggestion Comments read task.notes/task.suggestionComment. */}
        <View style={styles.notesSuggestionCard}>
          <Text style={styles.approvalStatusLabel}>NOTES</Text>
          {!notes ? (
            <Text style={styles.emptyText}>No notes recorded.</Text>
          ) : (
            <NotesBulletList notes={notes} />
          )}

          {!!task.suggestionComment && (
            <>
              <View style={styles.notesSuggestionDivider} />
              <Text style={styles.approvalStatusLabel}>SUGGESTION COMMENTS</Text>
              <NotesBulletList notes={task.suggestionComment} />
            </>
          )}

          {!!customerFeedback && (
            <>
              <View style={styles.notesSuggestionDivider} />
              <Text style={styles.approvalStatusLabel}>VOICE OF CUSTOMER</Text>
              {!!customerFeedback.customerName && (
                <Text style={styles.voiceOfCustomerName}>{customerFeedback.customerName}</Text>
              )}
              {!!customerFeedback.rating && (
                <View style={styles.voiceOfCustomerStarRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={20}
                      color={n <= customerFeedback.rating ? '#F26722' : '#D1D5DB'}
                      fill={n <= customerFeedback.rating ? '#F26722' : 'none'}
                    />
                  ))}
                  <Text style={styles.voiceOfCustomerRatingLabel}>{RATING_LABELS[customerFeedback.rating]}</Text>
                </View>
              )}
              {!!customerFeedback.comment && (
                <>
                  <Text style={[styles.approvalStatusLabel, { marginTop: 14, marginBottom: 6 }]}>CUSTOMER REMARK</Text>
                  <NotesBulletList notes={customerFeedback.comment} />
                </>
              )}
            </>
          )}

          {/* Same isOtpPending condition the floating footer's button and
              the top "Pending Customer Sign-off" banner react to — states
              the fact inline in this card too, matching commissioning's
              own merged-card pattern. */}
          {isOtpPending && (
            <View style={[styles.otpPendingCard, { marginTop: 16 }]}>
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
        </View>

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

      <VerifyOtpSheet
        visible={otpSheetOpen}
        step={otpStep}
        contactNumber={a?.primaryContactNumber}
        otpGenerated={otpGenerated}
        generatedOtp={generatedOtp}
        customerOtp={customerOtp}
        otpInputRefs={otpInputRefs}
        otpLoading={otpLoading}
        otpError={otpError}
        remark={remark}
        remarkSaving={remarkSaving}
        remarkError={remarkError}
        onClose={closeOtpSheet}
        onGenerate={handleGenerateOtp}
        onRegenerate={handleRegenerateOtp}
        onChangeDigit={handleChangeCustomerOtpDigit}
        onVerify={handleVerifyOtp}
        onChangeRemark={setRemark}
        onSaveRemark={handleSaveRemark}
      />

      {/* Floats over the content instead of pushing the ScrollView up in
          normal flow — same pattern as commissioning's taskReport.tsx.
          No BottomNavBar on this screen (removed) — Verify Client OTP/
          Close Service are the only actions it offers, so they sit alone
          at the bottom edge instead of alongside nav icons.
          pointerEvents="box-none" lets touches pass through the
          transparent space around the button/bar to whatever scrolled
          content sits underneath. The ScrollView's own contentContainerStyle
          paddingBottom above is sized to clear this footer's actual height
          so the last card never ends up hidden behind it. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        {/* COMPLETED but the customer's OTP isn't verified yet — mutually
            exclusive with canCloseTicket (that one requires OTP already
            verified), so never shows alongside it. */}
        {isOtpPending && (
          <View style={[styles.closeServiceBar, { paddingHorizontal: hPad }]}>
            <TouchableOpacity style={styles.closeServiceButton} onPress={openOtpSheet}>
              <Text style={styles.closeServiceButtonText}>Verify Client OTP</Text>
            </TouchableOpacity>
          </View>
        )}

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

  // "Pending Customer Sign-off" banner — same shape/copy as srTaskForm.tsx's
  // old Step 5 banner, now shown here above Activity History instead.
  pendingSignOffBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E76124',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
  },
  pendingSignOffIconChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingSignOffTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  pendingSignOffSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  reportTaskTitle: { fontSize: 16, fontWeight: '700', color: '#000000' },
  reportCatStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportCatBadgeCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },
  reportCatBadgeLetter: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 4, letterSpacing: 0.3 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },

  emptyText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },

  // ─── Approval Status card — same design as srTaskForm.tsx's old Step 5
  // card (category badge + Work/Parts Approval banners). ───
  approvalStatusCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 20, marginTop: 16 },
  approvalStatusLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 14 },
  approvalStatusCatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  approvalStatusCatBadge: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  approvalStatusCatBadgeText: { fontSize: 14, fontWeight: '700' },
  approvalStatusCatName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },

  // ─── Notes / Suggestion Comments / Voice of Customer / Customer Remark /
  // OTP Pending — one merged card, same pattern as commissioning's own
  // taskReport.tsx. ───
  notesSuggestionCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 20, marginTop: 16 },
  notesSuggestionDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  voiceOfCustomerName: { fontSize: 15, fontWeight: '700', color: '#1E1951', marginBottom: 10 },
  voiceOfCustomerStarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voiceOfCustomerRatingLabel: { fontSize: 14, fontWeight: '600', color: '#4338CA', marginLeft: 6 },

  otpPendingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF9E7',
    borderWidth: 1, borderColor: '#FBE8A6',
    borderRadius: 24,
    padding: 16,
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

  partsApprovalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 14, padding: 12,
    marginTop: 16,
  },
  partsApprovalIconChip: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FDE68A',
    justifyContent: 'center', alignItems: 'center',
  },
  partsApprovalTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  partsApprovalSubtitle: { fontSize: 12, color: '#B45309', marginTop: 1 },
  pendingTag: {
    backgroundColor: '#FDE68A', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pendingTagText: { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 0.4 },

  // Same banner shape as partsApprovalBanner/pendingTag, green once
  // confirmed instead of amber while pending.
  partsApprovalBannerDone: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: 14, padding: 12,
    marginTop: 16,
  },
  partsApprovalIconChipDone: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#BBF7D0',
    justifyContent: 'center', alignItems: 'center',
  },
  partsApprovalTitleDone: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  partsApprovalSubtitleDone: { fontSize: 12, color: '#16A34A', marginTop: 1 },
  doneTag: {
    backgroundColor: '#BBF7D0', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  doneTagText: { fontSize: 11, fontWeight: '700', color: '#15803D', letterSpacing: 0.4 },

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

  // ─── Client OTP Verification sheet — same design as commissioning's own
  // (taskReport.tsx), just a 1-2 stepper instead of 1-2-3. ───
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
});
