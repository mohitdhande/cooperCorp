import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
// expo-image (not RN's own Image) for these photo thumbnails — disk-caches
// by URL, so reopening this screen or scrolling back doesn't re-download
// the same signed GCS URL again.
import { Image } from 'expo-image';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wrench, Clock, Check, X, CheckCircle2, XCircle,
  RefreshCw, FileText, Package, Minus, Plus, BookmarkCheck, FileDown,
} from 'lucide-react-native';
import { useSrDetailController } from '../../controllers/srDetailController';
import { ActivityHistoryCard } from '../../_components/shared/ActivityHistoryCard';
import { ReportSectionCard } from '../../_components/shared/ReportSectionCard';
import { NotesBulletList } from '../../_components/shared/NotesBulletList';
import { InfoRow } from '../../_components/ReportRows';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';
import { PhotoLightboxModal } from '../../_components/shared/PhotoLightboxModal';
import { UserAvatar } from '../../_components/shared/UserAvatar';
import { AssetLocationContact } from '../../_components/shared/AssetLocationContact';
import { AssetIdentityHeader } from '../../_components/shared/AssetIdentityHeader';
import {
  val, formatTimeAgoLabel, getPriorityColor, getPriorityTextColor, formatDate, getTaskPeople,
} from '../../utils/reportFormatters';
import { safeJsonParse } from '../../utils/safeJsonParse';
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_META } from '../../_components/srTaskForm/srDropdownOptions';

const REF_WIDTH = 420;

const PART_DECISION_PILL: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#F3F4F6', text: '#6B7280' },
  APPROVED: { bg: '#DCFCE7', text: '#15803D' },
  REJECTED: { bg: '#FEE2E2', text: '#DC2626' },
};

// The task's own lifecycle (not the separate work-approval gate) — shown as
// a 5-step tracker on the Active-tab detail view only, so an engineer can
// see where their task actually stands (Assigned/Accepted/Active are all
// "before RSM/Photos even come into it").
const LIFECYCLE_STEPS: { key: string; label: string }[] = [
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'IN_PROGRESS', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CLOSED', label: 'Closed' },
];

// Same peach->light radial gradient backdrop as the other screens
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
          <RadialGradient id="srDetailBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#srDetailBg)" />
      </Svg>
    </View>
  );
}

// Compact read-only status screen for a service task — reached by tapping
// an Active-tab card still awaiting RSM confirmation, or a Closed-tab card.
// Deliberately NOT the full report (no asset identification/readings/parts/
// photos/customer-feedback — that's srTaskReport.tsx) — just enough to
// answer "what is this task and where does its approval stand": identity +
// Activity History, then Complaint Codes / Notes / Approval Timeline.
export default function SrDetailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);
  const params = useLocalSearchParams<{ task: string }>();
  const initialTask = safeJsonParse<any>(params.task) ?? null;

  const {
    task, asset, role, isMyOwnTask,
    detailError, retryFetchDetail,
    editModalVisible, openEditModal, closeEditModal,
    editFaultCodes, editParts, updateFaultCodeField, changePartQuantity,
    resubmitting, resubmitError, handleResubmit,
    acknowledging, acknowledgeError, handleAcknowledge,
    startingWork, startWorkError, handleStartWork,
    amReviewSaving, amReviewError, handleAmReview,
    workApprovalSaving, workApprovalError, handleAmWorkDecision, handleRsmWorkDecision,
    closingTicket, closeTicketError, handleCloseTicket,
    signedPhotoUrls, photosSigning,
    downloadingReport, downloadReportError, handleDownloadReport,
  } = useSrDetailController(initialTask);

  const [photosExpanded, setPhotosExpanded] = useState(true);
  const [complaintExpanded, setComplaintExpanded] = useState(true);
  const [partsExpanded, setPartsExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [approvalExpanded, setApprovalExpanded] = useState(true);
  const [categoryExpanded, setCategoryExpanded] = useState(false);

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Rejecting a part needs a reason first — tapping X opens an inline
  // input (Cancel/Save) instead of calling the API right away, unlike
  // Approve which still fires immediately. Only one part's reason form is
  // open at a time.
  const [rejectingPartId, setRejectingPartId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const openRejectForm = (partId: string) => { setRejectingPartId(partId); setRejectReason(''); };
  const cancelRejectForm = () => { setRejectingPartId(null); setRejectReason(''); };

  // Rejecting the work-approval request (Approval Request card) opens a
  // full bottom sheet for the note instead of an inline form — a separate
  // gate from the per-part rejection above, same "ask for a reason before
  // calling the API" idea though.
  const [workRejectVisible, setWorkRejectVisible] = useState(false);
  const [workRejectNote, setWorkRejectNote] = useState('');
  const closeWorkRejectSheet = () => { setWorkRejectVisible(false); setWorkRejectNote(''); };

  // IN_PROGRESS's "Complete Service" card — same navigation target
  // serviceTasksController.ts's goToTaskForm uses for an Active-tab card.
  const goToTaskForm = () => {
    router.push({
      pathname: '/screens/srTaskForm',
      params: {
        taskId: task._id,
        assetId: task.asset?._id || '',
        gensetNumber: task.asset?.gensetNumber || '',
        engineNumber: task.asset?.engineNumber || '',
      },
    } as any);
  };

  if (!initialTask) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No task data found.</Text>
      </SafeAreaView>
    );
  }

  const workApproval = task.workApproval || null;
  const faultCodes = task.faultCodes || [];
  const partsUsed = task.partsUsed || [];
  const notes = task.notes || '';
  // task.media replaces the old flat task.photos field (unified media[]
  // model, Sep 2026 backend migration).
  const photos: string[] = (task.media || []).filter((m: any) => m.type === 'photo' || m.type === 'image').map((m: any) => m.gcsUrl);
  const taskPeople = getTaskPeople(task);

  const partRowId = (p: any, i: number) => p._id || p.partId?._id || String(i);
  const pendingPartsCount = partsUsed.filter((p: any) => p.decision === 'PENDING').length;
  const hasReviewedParts = partsUsed.length > 0 && pendingPartsCount === 0;
  // PUT /service/:id/parts/review is admin | area_manager only per the
  // backend dev guide — dealer and engineer could reach this screen (e.g.
  // an engineer viewing their own task, or a dealer reviewing a subordinate
  // engineer's) but were never allowed to actually decide a part, so the
  // Approve/Reject buttons shouldn't render for them at all.
  const canReviewParts = role === 'areaManager' || role === 'admin';

  // Task-level category/sub-category (distinct from each fault code/part's
  // own category/subCategory fields) — task.category is the letter (A-G);
  // title comes from SERVICE_CATEGORIES, description from the New Service
  // Job screen's own SERVICE_CATEGORY_META (this screen doesn't otherwise
  // need a live category-config fetch just for this one label).
  const categoryTitle = SERVICE_CATEGORIES.find((c) => c.letter === task.category)?.name || task.category;
  // Campaign's generic description doesn't fit its Genset sub-type — that
  // one gets its own more specific line instead of the category-wide text.
  const categoryDescription = (task.category === 'F' && task.subCategory === 'Genset')
    ? 'Factory-issued service campaigns and product improvement programs.'
    : SERVICE_CATEGORY_META[task.category]?.description || '';

  // Closed and Completed share the richest layout (Activity History, then
  // Photos/Complaint Codes/Parts Used/Notes under an "SR DETAILS" heading,
  // then the full Approval Timeline) — just Photos/Complaint Codes/Parts
  // Used/Notes, deliberately not the rest of srTaskReport.tsx's full report
  // (asset identification/readings/customer feedback). Active-tab
  // pending-RSM keeps the original simple view — notes inline, single-step
  // timeline.
  const isClosedView = task.status === 'CLOSED';
  // COMPLETED (work done, customer OTP still pending) and CLIENT_APPROVED
  // (OTP verified) are both "past active, not yet closed" for this screen's
  // purposes — the whole SR-details view (Parts Awaiting Review, Approval
  // Request, Fault Codes/Parts/Photos/Notes) was previously gated on
  // COMPLETED only, so a task that had already been OTP-verified (the real,
  // final CLIENT_APPROVED state) fell through every check here and the
  // screen quietly showed none of it — not because it was missing, but
  // because CLIENT_APPROVED was never an equality match for anything.
  const isCompletedView = task.status === 'COMPLETED' || task.status === 'CLIENT_APPROVED';
  const isOtpVerified = task.status === 'CLIENT_APPROVED' || task.completionOtp?.verified === true;
  const showSrDetails = isClosedView || isCompletedView;

  // "Path b" from the API doc: this category never seeded a workApproval
  // gate at all (no object present), so once parts are reviewed the only
  // gate left is the customer's OTP — close directly right here instead of
  // sending the user into srTaskForm.tsx just to see an empty Approval
  // Status card. Per the backend's own 3-gate close rule there is NO
  // per-category exception to needing OTP verified — status === 'COMPLETED'
  // means OTP is still pending (not verified yet), so this must require
  // CLIENT_APPROVED specifically, not just "no work approval + parts done".
  const readyToCloseDirectly = task.status === 'CLIENT_APPROVED' && !workApproval && pendingPartsCount === 0;
  // Math.max(0, -1) previously made an unrecognized/missing task.status
  // silently render as "Assigned" — indistinguishable from a real ASSIGNED
  // task, which made every other status-gated card on this screen (all
  // exact string checks against task.status) go quietly missing too, with
  // nothing on screen to explain why. Track the raw index separately so an
  // unrecognized status shows honestly instead of masquerading as Assigned.
  //
  // CLIENT_APPROVED has no dot of its own in this 5-step tracker — it maps
  // onto the same "Completed" dot COMPLETED does, since both mean "past
  // active work, not yet closed" as far as this tracker is concerned; the
  // OTP-verified distinction is called out separately (isOtpVerified) where
  // it actually changes what the screen shows, not in the tracker itself.
  const rawLifecycleIndex = LIFECYCLE_STEPS.findIndex((s) => s.key === (task.status === 'CLIENT_APPROVED' ? 'COMPLETED' : task.status));
  const lifecycleStatusUnrecognized = rawLifecycleIndex === -1;
  const lifecycleIndex = Math.max(0, rawLifecycleIndex);

  // The "Approval Request" card — shown read-only for the full lifetime of
  // workApproval (PENDING_AM through REJECTED/CONFIRMED), not just while
  // someone can act on it. areaManager acts at PENDING_AM, admin stands in
  // for the RSM step at PENDING_RSM (no dedicated rsm role in this app).
  // Independent of, and can show alongside, the Parts card above (a task
  // can have both partApproval and workApproval pending at once).
  const hasWorkApproval = isCompletedView && !!workApproval;
  const canReviewWorkApproval = hasWorkApproval && (
    (workApproval.status === 'PENDING_AM' && role === 'areaManager') ||
    (workApproval.status === 'PENDING_RSM' && role === 'admin')
  );
  const workApprovalIsAmStage = workApproval?.status === 'PENDING_AM';
  // Whether the floating footer (below) renders a status pill above
  // BottomNavBar — drives how much extra scroll padding the content needs
  // so the last card never ends up hidden behind the footer.
  const hasBottomPill = workApproval?.status === 'PENDING_RSM' || workApproval?.status === 'REJECTED';
  const workApprovalRequester = workApproval?.requestedBy;
  const workApprovalRelTime = workApproval?.requestedAt
    ? formatTimeAgoLabel(workApproval.requestedAt)
    : '';

  // Per-step (AM/RSM) chain state — pending / approved / rejected, each
  // with its own decider + timestamp, not just a single "which stage are
  // we on" flag (that only covers the still-pending case).
  const amRejected = workApproval?.status === 'REJECTED' && workApproval?.rejectedBy === 'AM';
  const amDone = !!workApproval && workApproval.status !== 'PENDING_AM';
  const amApproved = amDone && !amRejected;
  const amTime = workApproval?.amDecidedAt ? formatTimeAgoLabel(workApproval.amDecidedAt) : '';

  const rsmRejected = workApproval?.status === 'REJECTED' && workApproval?.rejectedBy === 'RSM';
  const rsmConfirmed = workApproval?.status === 'CONFIRMED';
  const rsmTime = workApproval?.rsmDecidedAt ? formatTimeAgoLabel(workApproval.rsmDecidedAt) : '';

  const workApprovalStatusPillColor = workApproval?.status === 'REJECTED'
    ? { bg: '#FEE2E2', text: '#DC2626' }
    : workApproval?.status === 'CONFIRMED'
    ? { bg: '#DCFCE7', text: '#15803D' }
    : { bg: '#FEF9C3', text: '#B45309' };

  // Whichever of AM/RSM actually rejected — shown with their photo next to
  // the rejection note so it's clear who wrote it, not just what it says.
  const workApprovalRejector = workApproval?.rejectedBy === 'AM'
    ? workApproval?.amDecidedBy
    : workApproval?.rejectedBy === 'RSM'
    ? workApproval?.rsmDecidedBy
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SERVICE DETAILS</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleDownloadReport} disabled={downloadingReport}>
          {downloadingReport ? <ActivityIndicator size="small" color="#1E1951" /> : <FileDown size={20} color="#1E1951" />}
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
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: hasBottomPill ? 210 : 130 }}
      >
        {/* Surfaces a failed detail refetch instead of silently leaving the
            screen on stale nav-param data with no indication anything's
            wrong — tap to retry the same fetch. */}
        {!!detailError && (
          <TouchableOpacity style={[styles.detailErrorBanner, { marginBottom: 16 }]} onPress={retryFetchDetail}>
            <Text style={styles.detailErrorBannerText}>{detailError} Tap to retry.</Text>
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          {/* The exact same component TaskPreviewCard/Dashboard's Active
              Task card use — was a separate hand-rolled copy here before
              (raw unformatted srNumber, no gensetModel branch, smaller
              non-tappable avatars, no tooltip). `asset` (the dedicated
              GET /assets/:id fetch above) is the authoritative full record;
              task.asset/task.assetId are just the list/detail endpoints'
              own partial embeds, kept as a fallback while that fetch is
              still in flight. */}
          <AssetIdentityHeader
            task={task}
            isService
            taskPeople={taskPeople}
            assetOverride={{
              gensetNumber: asset?.gensetNumber || task.asset?.gensetNumber || task.assetId?.gensetNumber,
              engineNumber: asset?.engineNumber || task.asset?.engineNumber || task.assetId?.engineNumber,
              gensetModel: asset?.gensetModel,
              dispatchDate: asset?.dispatchDate,
            }}
          />

          {/* Location + site contact — same card as the SR pill/identity
              row above it, not a separate one (matches TaskPreviewCard's
              own AssetIdentityHeader + AssetLocationContact pairing). Was
              missing here entirely before. The card's own gap:12 handles
              spacing above this, same as every other direct child here. */}
          <AssetLocationContact asset={asset || task.asset || task.assetId} hideContact noBorder />
        </View>

        {/* The task's own lifecycle position (separate from the work-
            approval gate below) — shown for Active AND Completed (only
            Closed hides it, since by then the fuller Activity History card
            above already covers the same ground). */}
        {!isClosedView && (
          <View style={[styles.card, { marginTop: 20 }]}>
            <View style={styles.lifecycleHeaderRow}>
              <View>
                <Text style={styles.lifecycleLabel}>ASSIGNED</Text>
                <Text style={styles.lifecycleValue}>{formatDate(task.assignedAt || task.date)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.lifecycleLabel}>STATUS</Text>
                <Text style={[styles.lifecycleStatusValue, lifecycleStatusUnrecognized && styles.lifecycleStatusValueUnknown]}>
                  {lifecycleStatusUnrecognized ? (task.status || 'Unknown') : LIFECYCLE_STEPS[lifecycleIndex]?.label}
                </Text>
              </View>
            </View>

            {lifecycleStatusUnrecognized && (
              <Text style={styles.lifecycleUnknownNote}>
                "{task.status ?? 'null'}" isn't a recognized status — showing it as-is instead of guessing.
              </Text>
            )}

            <View style={styles.lifecycleStepsRow}>
              {LIFECYCLE_STEPS.map((step, idx) => {
                const isDone = idx < lifecycleIndex;
                const isCurrent = idx === lifecycleIndex;
                return (
                  <React.Fragment key={step.key}>
                    {idx > 0 && (
                      <View style={[styles.lifecycleLine, idx <= lifecycleIndex && styles.lifecycleLineDone]} />
                    )}
                    <View style={styles.lifecycleStepCol}>
                      {isCurrent ? (
                        <View style={styles.lifecycleStepCurrent}>
                          <View style={styles.lifecycleStepCurrentDot} />
                        </View>
                      ) : isDone ? (
                        <View style={styles.lifecycleStepDone}>
                          <Check size={14} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      ) : (
                        <View style={styles.lifecycleStepDot} />
                      )}
                      <Text style={[styles.lifecycleStepLabel, isCurrent && styles.lifecycleStepLabelActive]}>
                        {step.label}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Active-tab detail view only — the acknowledge/start-work/
            complete-service actions, while the task is still sitting at
            ASSIGNED/ACCEPTED/IN_PROGRESS. Gated to the actual assignee —
            this screen is also how an areaManager reaches a subordinate's
            task (to review/approve parts or work), and without isMyOwnTask
            they'd see the exact same Acknowledge/Start Work/Continue
            buttons the assignee sees, even though acting on the task is
            that assignee's job, not theirs. */}
        {!isClosedView && !isCompletedView && isMyOwnTask && (
          <>
            {/* Acknowledge (ASSIGNED) and Start Work (ACCEPTED) share the
                same card shape — whichever action moves the task to its
                next lifecycle step. */}
            {(task.status === 'ASSIGNED' || task.status === 'ACCEPTED') && (
              <View style={[styles.card, styles.acknowledgeCard, { marginTop: 20 }]}>
                <View style={[styles.acknowledgeIconChip, task.status === 'ACCEPTED' && styles.startWorkIconChip]}>
                  {task.status === 'ASSIGNED' ? (
                    <BookmarkCheck size={20} color="#F26722" />
                  ) : (
                    <Wrench size={20} color="#1E1951" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acknowledgeTitle}>{task.status === 'ASSIGNED' ? 'Acknowledge Task' : 'Ready to Start?'}</Text>
                  <Text style={styles.acknowledgeSubtitle}>
                    {task.status === 'ASSIGNED'
                      ? 'Confirm receipt and take ownership of this service request'
                      : 'Mark this service as In Progress when work begins on site'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    task.status === 'ASSIGNED' ? styles.acknowledgeButton : styles.startWorkButton,
                    (acknowledging || startingWork) && styles.buttonDisabled,
                  ]}
                  onPress={task.status === 'ASSIGNED' ? handleAcknowledge : handleStartWork}
                  disabled={acknowledging || startingWork}
                >
                  {(acknowledging || startingWork) ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.acknowledgeButtonText}>{task.status === 'ASSIGNED' ? 'Acknowledge' : 'Start Work'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {(!!acknowledgeError || !!startWorkError) && (
              <Text style={styles.acknowledgeErrorText}>{acknowledgeError || startWorkError}</Text>
            )}

            {/* IN_PROGRESS — the task itself is ready to be worked; this
                just opens the real task form (srTaskForm.tsx) rather than
                calling an API directly like Acknowledge/Start Work do. */}
            {task.status === 'IN_PROGRESS' && (
              <View style={[styles.card, styles.acknowledgeCard, { marginTop: 20 }]}>
                <View style={[styles.acknowledgeIconChip, styles.completeServiceIconChip]}>
                  <ChevronRight size={20} color="#16A34A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acknowledgeTitle}>Complete Service</Text>
                  <Text style={styles.acknowledgeSubtitle}>Fill in fault codes, parts used and submit your report</Text>
                </View>
                <TouchableOpacity style={styles.completeServiceButton} onPress={goToTaskForm}>
                  <Text style={styles.acknowledgeButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Completed, still has parts sitting at PENDING — the AM's own
            "something to do" card, mirroring Acknowledge/Start Work's shape
            above but for the reviewer's side of the workflow. "Review
            Parts" just expands the Parts section below rather than
            navigating anywhere else. Gated to canReviewParts — its own copy
            says "need your approval decision", which would be wrong for a
            dealer/engineer who can only ever view this screen, never act on
            a part (see the Approve/Reject buttons below, same gate). */}
        {canReviewParts && isCompletedView && pendingPartsCount > 0 && (
          <TouchableOpacity
            style={[styles.card, styles.acknowledgeCard, { marginTop: 20 }]}
            activeOpacity={0.8}
            onPress={() => setPartsExpanded(true)}
          >
            <View style={[styles.acknowledgeIconChip, styles.partsReviewIconChip]}>
              <RefreshCw size={20} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.acknowledgeTitle}>Parts Awaiting Review</Text>
              <Text style={styles.acknowledgeSubtitle}>{pendingPartsCount} part(s) need your approval decision</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Service title + notes — shown for every status (not just
            Active). Moved below Parts Awaiting Review (was above the
            lifecycle tracker) so the "something to do" card stays the
            first thing seen when there's pending review work. */}
        {(!!task.title || !!notes) && (
          <View style={[styles.card, styles.serviceTitleCard, { marginTop: 20 }]}>
            <Text style={styles.serviceTitleLabel}>SERVICE TITLE</Text>
            {!!task.title && <Text style={styles.serviceTitleValue}>{task.title}</Text>}
            {!!notes && <Text style={styles.serviceTitleNotes}>{notes}</Text>}
          </View>
        )}

        {(isClosedView || isCompletedView) && (
          <View style={{ marginTop: 20 }}>
            <ActivityHistoryCard task={task} />
          </View>
        )}

        {/* Task-level category/sub-category — collapsible, matching the
            same dark full-width pill + RefreshCw pattern used elsewhere
            (e.g. TaskPreviewCard's service tag) for this exact field. */}
        {isCompletedView && !!task.category && (
          <>
            <TouchableOpacity
              style={[styles.categoryPillRow, { marginTop: 20 }]}
              onPress={() => setCategoryExpanded(!categoryExpanded)}
            >
              <RefreshCw size={16} color="#FFFFFF" />
              <Text style={styles.categoryPillText}>{categoryTitle}</Text>
              {categoryExpanded ? <ChevronUp size={18} color="#FFFFFF" /> : <ChevronDown size={18} color="#FFFFFF" />}
            </TouchableOpacity>
            {!!task.subCategory && (
              <View style={[styles.categoryPillRow, styles.categorySubPillRow]}>
                <RefreshCw size={16} color="#FFFFFF" />
                <Text style={styles.categoryPillText}>{task.subCategory}</Text>
              </View>
            )}
            {categoryExpanded && !!categoryDescription && (
              <View style={styles.categoryDescCard}>
                <Text style={styles.categoryDescText}>{categoryDescription}</Text>
              </View>
            )}
          </>
        )}

        {/* Work approval — the separate AM-review/RSM-confirm gate (only
            seeded for D/E always, or B/C+Goodwill), distinct from the Parts
            card above and independent of it — a task can have both pending
            at once. areaManager decides PENDING_AM; admin stands in for the
            RSM step at PENDING_RSM (this app has no dedicated rsm role). */}
        {hasWorkApproval && (
          <View style={[styles.card, { marginTop: 20 }]}>
            <View style={styles.approvalReqHeaderRow}>
              <UserAvatar userId={workApprovalRequester?.userId} name={workApprovalRequester?.name || ''} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.approvalReqTitle}>Approval Request</Text>
                {!!workApprovalRelTime && <Text style={styles.approvalReqTime}>{workApprovalRelTime}</Text>}
              </View>
              <View style={[styles.approvalReqStatusPill, { backgroundColor: workApprovalStatusPillColor.bg }]}>
                <Text style={[styles.approvalReqStatusPillText, { color: workApprovalStatusPillColor.text }]}>
                  {workApproval?.status.replace('_', ' ')}
                </Text>
              </View>
            </View>

            <View style={styles.approvalChainRow}>
              <View style={styles.approvalChainStep}>
                <View style={[
                  styles.approvalChainAvatar,
                  amApproved && styles.approvalChainAvatarDone,
                  amRejected && styles.approvalChainAvatarRejected,
                ]}>
                  {amRejected ? (
                    <X size={18} color="#FFFFFF" />
                  ) : amApproved ? (
                    workApproval?.amDecidedBy?.userId ? (
                      <UserAvatar userId={workApproval.amDecidedBy.userId} name={workApproval.amDecidedBy.name || ''} size={40} bg="#16A34A" />
                    ) : (
                      <Check size={18} color="#FFFFFF" />
                    )
                  ) : (
                    <Text style={styles.approvalChainAvatarQ}>?</Text>
                  )}
                </View>
                <Text style={styles.approvalChainLabel}>AM</Text>
                <View style={styles.approvalChainStatusRow}>
                  <Clock size={10} color={amRejected ? '#DC2626' : amApproved ? '#16A34A' : '#B45309'} />
                  <Text style={[
                    styles.approvalChainStatus,
                    amApproved && styles.approvalChainStatusDone,
                    amRejected && styles.approvalChainStatusRejected,
                  ]}>
                    {amRejected ? 'Rejected' : amApproved ? (amTime || 'Approved') : 'Pending'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
              <View style={styles.approvalChainStep}>
                <View style={[
                  styles.approvalChainAvatar,
                  rsmConfirmed && styles.approvalChainAvatarDone,
                  rsmRejected && styles.approvalChainAvatarRejected,
                ]}>
                  {rsmRejected ? (
                    <X size={18} color="#FFFFFF" />
                  ) : rsmConfirmed ? (
                    workApproval?.rsmDecidedBy?.userId ? (
                      <UserAvatar userId={workApproval.rsmDecidedBy.userId} name={workApproval.rsmDecidedBy.name || ''} size={40} bg="#16A34A" />
                    ) : (
                      <Check size={18} color="#FFFFFF" />
                    )
                  ) : (
                    <Text style={styles.approvalChainAvatarQ}>?</Text>
                  )}
                </View>
                <Text style={styles.approvalChainLabel}>RSM</Text>
                <View style={styles.approvalChainStatusRow}>
                  <Clock size={10} color={rsmRejected ? '#DC2626' : rsmConfirmed ? '#16A34A' : '#9CA3AF'} />
                  <Text style={[
                    styles.approvalChainStatus,
                    rsmConfirmed && styles.approvalChainStatusDone,
                    rsmRejected && styles.approvalChainStatusRejected,
                  ]}>
                    {rsmRejected ? 'Rejected' : rsmConfirmed ? (rsmTime || 'Confirmed') : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>

            {workApproval?.status === 'REJECTED' && !!workApproval?.rejectionNote && (
              <View style={styles.approvalReqRejectionNoteBox}>
                <View style={styles.rejectionNoteHeaderRow}>
                  <UserAvatar userId={workApprovalRejector?.userId} name={workApprovalRejector?.name || ''} size={28} bg="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rejectionNoteLabel}>REJECTION NOTE</Text>
                    {!!workApprovalRejector?.name && <Text style={styles.rejectionNoteByText}>{workApprovalRejector.name}</Text>}
                  </View>
                </View>
                <Text style={styles.rejectionNoteText}>&ldquo;{workApproval.rejectionNote}&rdquo;</Text>
              </View>
            )}

            {canReviewWorkApproval && (
              <View style={styles.approvalReqButtonsRow}>
                <TouchableOpacity
                  style={[styles.approvalReqRejectButton, workApprovalSaving && styles.buttonDisabled]}
                  onPress={() => setWorkRejectVisible(true)}
                  disabled={workApprovalSaving}
                >
                  <X size={16} color="#DC2626" />
                  <Text style={styles.approvalReqRejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approvalReqApproveButton, workApprovalSaving && styles.buttonDisabled]}
                  onPress={() => (workApprovalIsAmStage ? handleAmWorkDecision('APPROVED') : handleRsmWorkDecision('CONFIRMED'))}
                  disabled={workApprovalSaving}
                >
                  {workApprovalSaving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Check size={16} color="#FFFFFF" />
                      <Text style={styles.approvalReqApproveText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {!!workApprovalError && <Text style={[styles.acknowledgeErrorText, { marginTop: 8 }]}>{workApprovalError}</Text>}
          </View>
        )}

        {/* Fully confirmed, not yet closed — the one moment where closing
            the ticket is actually the next real action. The actual
            OTP-generate/verify + Close Ticket UI lives in srTaskForm.tsx
            (Step 5's Customer Sign-off card), not here — this banner just
            needed a real way to get there instead of only telling the
            viewer to go do it somewhere unspecified. */}
        {isCompletedView && workApproval?.status === 'CONFIRMED' && (
          <View style={[styles.fullyApprovedBanner, { marginTop: 20 }]}>
            <CheckCircle2 size={22} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.fullyApprovedTitle}>Fully Approved</Text>
              <Text style={styles.fullyApprovedSubtitle}>
                {isOtpVerified ? 'RSM confirmed and OTP verified. Ready to close the ticket.' : 'RSM confirmed. Generate OTP to close the ticket.'}
              </Text>
            </View>
          </View>
        )}
        {isCompletedView && workApproval?.status === 'CONFIRMED' && (
          <TouchableOpacity style={[styles.completeServiceButton, { marginTop: 12 }]} onPress={goToTaskForm}>
            <Text style={styles.acknowledgeButtonText}>Close Ticket →</Text>
          </TouchableOpacity>
        )}

        {/* This category never needed work approval and every part now has
            a decision — nothing left to review, so the ticket can close
            directly (no OTP step, unlike the "Fully Approved" banner above). */}
        {readyToCloseDirectly && (
          <View style={[styles.fullyApprovedBanner, { marginTop: 20 }]}>
            <CheckCircle2 size={22} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.fullyApprovedTitle}>Ready to Close</Text>
              <Text style={styles.fullyApprovedSubtitle}>All parts reviewed. No further approval needed.</Text>
            </View>
          </View>
        )}

        {readyToCloseDirectly && (
          <TouchableOpacity
            style={[styles.completeServiceButton, styles.closeTicketButton, closingTicket && styles.buttonDisabled]}
            onPress={handleCloseTicket}
            disabled={closingTicket}
          >
            {closingTicket ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.acknowledgeButtonText}>Close Ticket</Text>
            )}
          </TouchableOpacity>
        )}
        {!!closeTicketError && <Text style={styles.acknowledgeErrorText}>{closeTicketError}</Text>}

        {showSrDetails && (
          <>
            <Text style={styles.srDetailsHeading}>SR DETAILS</Text>

            <ReportSectionCard title="Photos" count={photos.length} expanded={photosExpanded} onToggle={() => setPhotosExpanded(!photosExpanded)}>
              {photos.length === 0 ? (
                <Text style={styles.emptyText}>No photos uploaded.</Text>
              ) : photosSigning ? (
                <ActivityIndicator color="#F26722" style={styles.photosLoadingSpinner} />
              ) : (
                <View style={styles.photoGrid}>
                  {photos.map((url: string, i: number) => (
                    <TouchableOpacity key={i} onPress={() => { setLightboxIndex(i); setLightboxVisible(true); }}>
                      <Image source={{ uri: signedPhotoUrls[url] || url }} style={styles.photoThumb} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ReportSectionCard>

            <ReportSectionCard title="Complaint Codes" count={faultCodes.length} expanded={complaintExpanded} onToggle={() => setComplaintExpanded(!complaintExpanded)}>
              {faultCodes.length === 0 ? (
                <Text style={styles.emptyText}>No complaint codes recorded.</Text>
              ) : (
                faultCodes.map((fc: any, i: number) => {
                  const codeInfo = fc.codeId || {};
                  return (
                    <View key={fc._id || i} style={styles.complaintCard}>
                      <View style={styles.complaintHeader}>
                        <View style={styles.complaintCodeBadge}>
                          <Text style={styles.complaintCodeText}>{val(codeInfo.code)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.complaintTitle}>{val(codeInfo.description)}</Text>
                          <Text style={styles.complaintSub}>
                            {val(codeInfo.category)} {codeInfo.subCategory ? `› ${codeInfo.subCategory}` : ''}
                          </Text>
                        </View>
                        {!!codeInfo.priority && (
                          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(codeInfo.priority).backgroundColor }]}>
                            <Text style={[styles.priorityBadgeText, { color: getPriorityTextColor(codeInfo.priority) }]}>
                              {codeInfo.priority}
                            </Text>
                          </View>
                        )}
                      </View>
                      {!!fc.observation && <InfoRow label="Observation" value={fc.observation} />}
                      {!!fc.rootCause && <InfoRow label="Root Cause" value={fc.rootCause} />}
                      {!!fc.correctiveAction && <InfoRow label="Corrective Action" value={fc.correctiveAction} />}
                    </View>
                  );
                })
              )}
            </ReportSectionCard>

            <ReportSectionCard
              title="Parts"
              count={partsUsed.length}
              expanded={partsExpanded}
              onToggle={() => setPartsExpanded(!partsExpanded)}
              badge={
                pendingPartsCount > 0
                  ? { label: 'AM Review Needed', bg: '#FEF3C7', text: '#B45309' }
                  : hasReviewedParts
                  ? { label: 'Reviewed', bg: '#DCFCE7', text: '#15803D' }
                  : undefined
              }
            >
              {partsUsed.length === 0 ? (
                <Text style={styles.emptyText}>No parts recorded.</Text>
              ) : (
                partsUsed.map((p: any, i: number) => {
                  // partId populates as null (not an error) if the part it
                  // references was since deleted — `|| {}` keeps every
                  // field read below safe (shows "--" via val()) instead of
                  // crashing, per the Parts API reference doc's null-partId
                  // warning.
                  const partInfo = p.partId || {};
                  const decision = p.decision;
                  const decisionStyle = PART_DECISION_PILL[decision] || PART_DECISION_PILL.PENDING;
                  const rowId = partRowId(p, i);
                  // category/subCategory/unit were removed in the
                  // 2026-08-29 Part schema change — cpcbNorm/engineFamily
                  // are their closest replacement, shown only when set.
                  const partSubtitle = [partInfo.cpcbNorm, partInfo.engineFamily?.join(', ')].filter(Boolean).join(' · ');
                  return (
                    <View key={rowId} style={styles.partCard}>
                      <View style={styles.partTop}>
                        <View style={styles.partCodeBadge}>
                          <Text style={styles.partCodeText}>{val(partInfo.componentNumber)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partName}>{val(partInfo.description)}</Text>
                          {!!partSubtitle && <Text style={styles.partCategory}>{partSubtitle}</Text>}
                        </View>
                      </View>
                      <View style={styles.partBottom}>
                        <Text style={styles.partQty}>Qty: {val(p.quantity)}</Text>
                      </View>
                      {canReviewParts && isCompletedView && decision === 'PENDING' && !!partInfo._id && rejectingPartId === partInfo._id ? (
                        <View style={styles.rejectForm}>
                          <TextInput
                            style={styles.rejectReasonInput}
                            placeholder="Reason for rejection..."
                            placeholderTextColor="#FCA5A5"
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                          />
                          <View style={styles.rejectFormActions}>
                            <TouchableOpacity style={styles.rejectCancelButton} onPress={cancelRejectForm} disabled={amReviewSaving}>
                              <Text style={styles.rejectCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.rejectSaveButton, amReviewSaving && styles.buttonDisabled]}
                              onPress={async () => { await handleAmReview(partInfo._id, 'REJECTED', rejectReason); cancelRejectForm(); }}
                              disabled={amReviewSaving}
                            >
                              {amReviewSaving ? <ActivityIndicator color="#fff" size="small" /> : (
                                <>
                                  <Check size={16} color="#FFFFFF" />
                                  <Text style={styles.rejectSaveButtonText}>Save</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.partDecisionRow}>
                          {!!decision && (
                            <View style={[styles.partDecisionPill, { backgroundColor: decisionStyle.bg }]}>
                              <Text style={[styles.partDecisionText, { color: decisionStyle.text }]}>{decision}</Text>
                            </View>
                          )}
                          {canReviewParts && isCompletedView && decision === 'PENDING' && !!partInfo._id && (
                            <View style={styles.partDecisionActions}>
                              <TouchableOpacity
                                style={[styles.partRejectButton, amReviewSaving && styles.buttonDisabled]}
                                onPress={() => openRejectForm(partInfo._id)}
                                disabled={amReviewSaving}
                              >
                                <X size={16} color="#9CA3AF" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.partApproveButton, amReviewSaving && styles.buttonDisabled]}
                                onPress={() => handleAmReview(partInfo._id, 'APPROVED')}
                                disabled={amReviewSaving}
                              >
                                <Check size={16} color="#16A34A" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                      {/* decisionReason — confirmed field name per the API
                          reference doc's partsUsed[] shape. */}
                      {decision === 'REJECTED' && !!p.decisionReason && (
                        <View style={styles.partRejectionNoteBox}>
                          <Text style={styles.partRejectionNoteText}>{p.decisionReason}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
              {!!amReviewError && <Text style={[styles.acknowledgeErrorText, { marginTop: 8 }]}>{amReviewError}</Text>}
            </ReportSectionCard>

            <ReportSectionCard title="Notes" expanded={notesExpanded} onToggle={() => setNotesExpanded(!notesExpanded)}>
              {!notes ? (
                <Text style={styles.emptyText}>No notes recorded.</Text>
              ) : (
                <NotesBulletList notes={notes} />
              )}
            </ReportSectionCard>
          </>
        )}

        {/* Full multi-step timeline — Closed and Completed both get this,
            Closed additionally wrapped by the SR DETAILS section group
            above. */}
        {(isClosedView || isCompletedView) && (
            <ReportSectionCard title="Approval Timeline" expanded={approvalExpanded} onToggle={() => setApprovalExpanded(!approvalExpanded)}>
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
        )}

        {/* Rejected Active-tab tasks only — the engineer needs to see what's
            actually being sent back for revision before tapping Edit &
            Resubmit, not just that it was rejected. Plain icon+label section
            cards (not the collapsible ReportSectionCard pill style used on
            the Closed view) — this is a smaller, focused set of info, not a
            full report. */}
        {!isClosedView && !isCompletedView && workApproval?.status === 'REJECTED' && (
          <>
            {faultCodes.length > 0 && (
              <View style={[styles.card, { marginTop: 20 }]}>
                <View style={styles.plainSectionHeader}>
                  <FileText size={16} color="#9CA3AF" />
                  <Text style={styles.plainSectionLabel}>FAULT CODES</Text>
                </View>
                {faultCodes.map((fc: any, i: number) => {
                  const codeInfo = fc.codeId || {};
                  return (
                    <View key={fc._id || i} style={styles.plainFaultBox}>
                      <Text style={styles.plainFaultTitle}>{val(codeInfo.code)} — {val(codeInfo.description)}</Text>
                      {!!fc.observation && <Text style={styles.plainFaultLine}>Observation: {fc.observation}</Text>}
                      {!!fc.rootCause && <Text style={styles.plainFaultLine}>Root cause: {fc.rootCause}</Text>}
                      {!!fc.correctiveAction && <Text style={styles.plainFaultLine}>Action: {fc.correctiveAction}</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            {partsUsed.length > 0 && (
              <View style={[styles.card, { marginTop: 20 }]}>
                <View style={styles.plainSectionHeader}>
                  <Package size={16} color="#9CA3AF" />
                  <Text style={styles.plainSectionLabel}>PARTS USED</Text>
                </View>
                {partsUsed.map((p: any, i: number) => {
                  // partId populates as null (not an error) if the part it
                  // references was since deleted — `|| {}` keeps every
                  // field read below safe instead of crashing.
                  const partInfo = p.partId || {};
                  return (
                    <View key={p._id || i} style={styles.plainPartRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.plainPartName}>{val(partInfo.description)}</Text>
                        {/* unit was removed in the 2026-08-29 Part schema
                        change — componentNumber/cpcbNorm are what's left to
                        show here. */}
                        <Text style={styles.plainPartSub}>
                          {val(partInfo.componentNumber)}{partInfo.cpcbNorm ? ` · ${partInfo.cpcbNorm}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.plainPartQty}>×{val(p.quantity)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {!!notes && (
              <View style={[styles.card, { marginTop: 20 }]}>
                <View style={styles.plainSectionHeader}>
                  <FileText size={16} color="#9CA3AF" />
                  <Text style={styles.plainSectionLabel}>NOTES</Text>
                </View>
                <NotesBulletList notes={notes} />
              </View>
            )}
          </>
        )}

        {/* Non-closed (Active/pending-RSM) view only — the original simple,
            single-step timeline card, not the collapsible multi-step one
            above. */}
        {!isClosedView && !isCompletedView && (
          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={styles.sectionLabel}>APPROVAL TIMELINE</Text>

            {!!workApproval?.requestedAt && (
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

            {workApproval?.status === 'PENDING_RSM' && (
              <View style={styles.timelineFinalRow}>
                <Clock size={18} color="#4338CA" />
                <Text style={styles.timelineFinalTextPending}>Awaiting RSM Confirmation</Text>
              </View>
            )}

            {workApproval?.status === 'REJECTED' && (
              <>
                <View style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: '#EF4444' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitleRejected}>
                      {workApproval.rejectedBy ? `${workApproval.rejectedBy} Rejected` : 'Rejected'}
                    </Text>
                    {!!workApproval.rsmDecidedBy?.name && (
                      <Text style={styles.timelineSubtitle}>{workApproval.rsmDecidedBy.name}</Text>
                    )}
                    {!!workApproval.rsmDecidedAt && (
                      <Text style={styles.timelineTime}>
                        {formatTimeAgoLabel(workApproval.rsmDecidedAt)}
                      </Text>
                    )}
                  </View>
                </View>
                {!!workApproval.rejectionNote && (
                  <View style={styles.rejectionNoteBox}>
                    <Text style={styles.rejectionNoteText}>&ldquo;{workApproval.rejectionNote}&rdquo;</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floats over the ScrollView (instead of sitting below it as a
          normal flex sibling) so the last card keeps visibly scrolling
          behind this bar, matching the reference design — the ScrollView's
          own bottom padding above is sized to clear this footer's height. */}
      <View style={[styles.floatingFooter, { paddingHorizontal: hPad }]} pointerEvents="box-none">
        {workApproval?.status === 'PENDING_RSM' && (
          <View style={styles.bottomBar}>
            <Clock size={18} color="#F59E0B" />
            <Text style={styles.bottomBarText}>Awaiting RSM Confirmation</Text>
          </View>
        )}

        {/* Edit & Resubmit is the engineer's own action (they're the one who
            can actually change the fault codes/parts and re-send for
            approval) — every other role just sees a read-only status banner
            instead, same spot, above the bottom bar. */}
        {workApproval?.status === 'REJECTED' && (
          role === 'engineer' ? (
            <TouchableOpacity style={styles.resubmitButton} onPress={openEditModal}>
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={styles.resubmitButtonText}>Edit & Resubmit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bottomBar}>
              <XCircle size={18} color="#DC2626" />
              <Text style={styles.rejectedBannerText}>Rejected — Needs Revision</Text>
            </View>
          )
        )}

        <BottomNavBar active="services" />
      </View>

      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Edit & Resubmit</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              {!!workApproval?.rejectionNote && (
                <View style={styles.modalRejectionBox}>
                  <Text style={styles.modalRejectionLabel}>REJECTION NOTE</Text>
                  <Text style={styles.modalRejectionText}>&ldquo;{workApproval.rejectionNote}&rdquo;</Text>
                </View>
              )}

              {editFaultCodes.length > 0 && (
                <>
                  <Text style={styles.modalSectionLabel}>FAULT CODES</Text>
                  {editFaultCodes.map((fc, index) => (
                    <View key={fc.codeId || index} style={styles.modalFaultCard}>
                      <Text style={styles.modalFaultTitle}>{fc.code} — {fc.description}</Text>

                      <Text style={styles.modalFieldLabel}>OBSERVATION</Text>
                      <TextInput
                        style={styles.modalFieldInput}
                        value={fc.observation}
                        onChangeText={(v) => updateFaultCodeField(index, 'observation', v)}
                        placeholder="Observation"
                        placeholderTextColor="#9CA3AF"
                      />

                      <Text style={styles.modalFieldLabel}>ROOT CAUSE</Text>
                      <TextInput
                        style={styles.modalFieldInput}
                        value={fc.rootCause}
                        onChangeText={(v) => updateFaultCodeField(index, 'rootCause', v)}
                        placeholder="Root cause"
                        placeholderTextColor="#9CA3AF"
                      />

                      <Text style={styles.modalFieldLabel}>CORRECTIVE ACTION</Text>
                      <TextInput
                        style={styles.modalFieldInput}
                        value={fc.correctiveAction}
                        onChangeText={(v) => updateFaultCodeField(index, 'correctiveAction', v)}
                        placeholder="Corrective action"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  ))}
                </>
              )}

              {editParts.length > 0 && (
                <>
                  <Text style={styles.modalSectionLabel}>PARTS USED</Text>
                  {editParts.map((p, index) => (
                    <View key={p.partId || index} style={styles.modalPartRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.plainPartName}>{p.name}</Text>
                        <Text style={styles.plainPartSub}>{p.code} · {p.unit}</Text>
                      </View>
                      <View style={styles.modalQtyStepper}>
                        <TouchableOpacity style={styles.modalQtyButton} onPress={() => changePartQuantity(index, -1)}>
                          <Minus size={16} color="#1F2937" />
                        </TouchableOpacity>
                        <Text style={styles.modalQtyValue}>{p.quantity}</Text>
                        <TouchableOpacity style={styles.modalQtyButton} onPress={() => changePartQuantity(index, 1)}>
                          <Plus size={16} color="#1F2937" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {!!resubmitError && (
                <View style={styles.errorBoxModal}>
                  <Text style={styles.errorTextModal}>{resubmitError}</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalResubmitButton} onPress={handleResubmit} disabled={resubmitting}>
              {resubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalResubmitButtonText}>Resubmit for Approval</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rejecting the work-approval request (Approval Request card) — a
          full sheet for the note, same "Confirm Reject" call as Approve
          uses (submitAmWorkApproval/submitRsmWorkApproval), just with
          REJECTED + this typed note instead of the default fallback text. */}
      <Modal visible={workRejectVisible} transparent animationType="slide" onRequestClose={closeWorkRejectSheet}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>Rejection Note</Text>

            <TextInput
              style={styles.workRejectInput}
              placeholder="Explain what needs to be corrected..."
              placeholderTextColor="#9CA3AF"
              value={workRejectNote}
              onChangeText={setWorkRejectNote}
              multiline
            />

            {!!workApprovalError && (
              <View style={styles.errorBoxModal}>
                <Text style={styles.errorTextModal}>{workApprovalError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.workRejectConfirmButton, (!workRejectNote.trim() || workApprovalSaving) && styles.workRejectConfirmButtonDisabled]}
              onPress={async () => {
                await (workApprovalIsAmStage ? handleAmWorkDecision : handleRsmWorkDecision)('REJECTED', workRejectNote);
                closeWorkRejectSheet();
              }}
              disabled={!workRejectNote.trim() || workApprovalSaving}
            >
              {workApprovalSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.workRejectConfirmButtonText}>Confirm Reject</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  errorText: { textAlign: 'center', marginTop: 40, color: '#9CA3AF', fontSize: 15 },
  detailErrorBanner: {
    backgroundColor: '#FEE2E2', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  detailErrorBannerText: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000000', textTransform: 'uppercase' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  serviceTitleCard: { backgroundColor: '#FFFAD9' },
  serviceTitleLabel: { fontSize: 11, fontWeight: '700', color: '#C2410C', letterSpacing: 0.5, marginBottom: 6 },
  serviceTitleValue: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  serviceTitleNotes: { fontSize: 14, fontWeight: '500', color: '#686868', lineHeight: 20, marginTop: 4 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: 4 },

  // Plain caps label grouping Complaint Codes/Notes/Approval Timeline below
  // it, separate from the Activity History card above — not its own card,
  // just a section break.
  srDetailsHeading: {
    fontSize: 13, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8,
    marginTop: 24, marginBottom: 4, marginLeft: 4,
  },

  emptyText: { color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' },

  complaintCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  complaintHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  complaintCodeBadge: {
    backgroundColor: '#FFEDD5',
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  complaintCodeText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },
  complaintTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  complaintSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  priorityBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  priorityBadgeText: { fontSize: 11, fontWeight: '700' },

  partCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F26722',
  },
  partTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  partCodeBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 12,
  },
  partCodeText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  partName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  partCategory: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  // unit was removed in the 2026-08-29 Part schema change — no replacement,
  // so this row now only ever holds Qty, right-aligned.
  partBottom: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  partQty: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  partDecisionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  partDecisionPill: {
    alignSelf: 'flex-start',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  partDecisionText: { fontSize: 11, fontWeight: '700' },
  partRejectionNoteBox: {
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  partRejectionNoteText: { fontSize: 13, color: '#DC2626' },
  // AM's approve/reject buttons for a PENDING part — no backend endpoint
  // yet (see handleDecidePart), purely a local, non-persisted UI stub.
  // Square (rounded) decision buttons, not circular — same joined-pill
  // language as ComplaintCodeCard's own X/edit pill elsewhere in the app.
  partDecisionActions: {
    flexDirection: 'row', gap: 4, marginLeft: 'auto',
    backgroundColor: '#F8F8F8', borderRadius: 12,
    borderWidth: 1, borderColor: '#DBDBDB', padding: 4,
  },
  partRejectButton: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: '#DEDEDE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  partApproveButton: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: '#DEDEDE',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  // Inline reject-reason form — replaces the pill+X/check row for the one
  // part currently being rejected, instead of calling the API right away.
  rejectForm: { marginTop: 10, gap: 10 },
  rejectReasonInput: {
    borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1F2937',
    backgroundColor: '#fff', minHeight: 44, textAlignVertical: 'top',
  },
  rejectFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  rejectCancelButton: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 100,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  rejectCancelButtonText: { fontSize: 14, fontWeight: '700', color: '#4B5563' },
  rejectSaveButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#DC2626', borderRadius: 100,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  rejectSaveButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#F3F4F6' },
  photosLoadingSpinner: { paddingVertical: 20 },

  plainSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  plainSectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6 },

  plainFaultBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
  },
  plainFaultTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 6 },
  plainFaultLine: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  plainPartRow: { flexDirection: 'row', alignItems: 'center' },
  plainPartName: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  plainPartSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  plainPartQty: { fontSize: 15, fontWeight: '700', color: '#1F2937' },

  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  timelineSubtitle: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 2 },
  timelineTime: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  timelineFinalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 22 },
  timelineFinalTextPending: { fontSize: 14, fontWeight: '700', color: '#4338CA' },
  timelineFinalTextApproved: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  timelineFinalTextRejected: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  timelineTitleRejected: { fontSize: 15, fontWeight: '700', color: '#DC2626' },

  rejectionNoteBox: {
    backgroundColor: '#FDF2F2',
    borderRadius: 12,
    padding: 12,
    marginLeft: 22,
    marginTop: -4,
    marginBottom: 4,
  },
  rejectionNoteText: { fontSize: 13, fontWeight: '500', fontStyle: 'italic', color: '#DC2626' },
  rejectionNoteLabel: { fontSize: 11, fontWeight: '700', color: '#DC2626', letterSpacing: 0.5 },
  // Same pink box as rejectionNoteBox but without that one's timeline-row
  // indent — this one sits directly under the Approval Request chain.
  approvalReqRejectionNoteBox: {
    backgroundColor: '#FDF2F2',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  // Rejector's own photo + name above the quoted note, so it's clear who
  // wrote it at a glance, not just what it says.
  rejectionNoteHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rejectionNoteByText: { fontSize: 12, fontWeight: '600', color: '#7F1D1D', marginTop: 1 },

  // Pinned over the ScrollView, not a normal flex sibling below it — see
  // the comment at its call site for why.
  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#11101C',
    borderRadius: 100,
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  bottomBarText: { fontSize: 15, fontWeight: '700', color: '#F59E0B' },
  // Read-only counterpart to resubmitButton below, for every role except
  // the engineer — reuses bottomBar's same dark pill, just red instead of amber.
  rejectedBannerText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },

  // Actionable (unlike bottomBar, which is purely informational) — the
  // rejected case genuinely has something for the user to do next.
  resubmitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#F26722',
    borderRadius: 100,
    paddingVertical: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  resubmitButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // ─── Edit & Resubmit modal ───
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24,
    maxHeight: '88%',
  },
  modalDragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 16 },

  modalRejectionBox: {
    backgroundColor: '#FDF2F2',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  modalRejectionLabel: { fontSize: 12, fontWeight: '700', color: '#DC2626', letterSpacing: 0.5, marginBottom: 4 },
  modalRejectionText: { fontSize: 14, fontWeight: '500', fontStyle: 'italic', color: '#DC2626' },

  modalSectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },

  modalFaultCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  modalFaultTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  modalFieldLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.4, marginBottom: 6, marginTop: 10 },
  modalFieldInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1F2937',
  },

  modalPartRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  modalQtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalQtyButton: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  modalQtyValue: { fontSize: 16, fontWeight: '700', color: '#1F2937', minWidth: 20, textAlign: 'center' },

  errorBoxModal: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, marginTop: 4 },
  errorTextModal: { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  modalResubmitButton: {
    backgroundColor: '#F26722',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalResubmitButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Rejection Note sheet — work-approval reject.
  workRejectInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1F2937',
    backgroundColor: '#fff', minHeight: 110, textAlignVertical: 'top',
    marginBottom: 20,
  },
  workRejectConfirmButton: {
    backgroundColor: '#DC2626',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  // Faded/pink while there's no note yet, matching the reference design's
  // disabled look rather than the app's usual flat opacity dimming.
  workRejectConfirmButtonDisabled: { backgroundColor: '#F3A6A6' },
  workRejectConfirmButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Active-tab lifecycle tracker + Acknowledge action.
  lifecycleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lifecycleLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  lifecycleValue: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  lifecycleStatusValue: { fontSize: 15, fontWeight: '700', color: '#F26722', marginTop: 2 },
  lifecycleStatusValueUnknown: { color: '#DC2626' },
  lifecycleUnknownNote: { fontSize: 11, color: '#DC2626', marginTop: 10 },
  lifecycleStepsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20 },
  lifecycleStepCol: { alignItems: 'center', width: 56 },
  // Plain connector between step circles — centered on their vertical
  // middle (dots sit flush at the row's top, center 6px down).
  lifecycleLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginTop: 5 },
  lifecycleLineDone: { backgroundColor: '#F26722' },
  lifecycleStepDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#D1D5DB',
  },
  // Current and done steps are both the taller 32px circle — same
  // marginTop trick centers either one on the plain 12px dots' vertical
  // middle (dots sit flush at the top of the row, center 6px down; 32/2=16,
  // 16-10=6 matches that same center once shifted up by this margin).
  lifecycleStepCurrent: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 3, borderColor: '#F26722',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -10,
  },
  lifecycleStepCurrentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F26722' },
  lifecycleStepDone: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -10,
  },
  lifecycleStepLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  lifecycleStepLabelActive: { color: '#F26722', fontWeight: '700' },

  acknowledgeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  acknowledgeIconChip: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center', alignItems: 'center',
  },
  // Start Work's icon chip — same shape, plain grey instead of the
  // Acknowledge card's orange tint (this action isn't the urgent one).
  startWorkIconChip: { backgroundColor: '#F3F4F6' },
  // Complete Service's icon chip — light green, matching the button below.
  completeServiceIconChip: { backgroundColor: '#DCFCE7' },
  // Parts Awaiting Review's icon chip — amber, matching the pending-review
  // tone used elsewhere (e.g. srTaskForm.tsx's Parts Approval banner).
  partsReviewIconChip: { backgroundColor: '#FEF3C7' },
  acknowledgeTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  acknowledgeSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  acknowledgeButton: {
    backgroundColor: '#F26722',
    borderRadius: 100,
    paddingVertical: 10, paddingHorizontal: 18,
  },
  // Start Work's button — brand navy instead of Acknowledge's orange, so
  // the two actions read as visually distinct steps.
  startWorkButton: {
    backgroundColor: '#1E1951',
    borderRadius: 100,
    paddingVertical: 10, paddingHorizontal: 18,
  },
  // Complete Service's button — green, matching the "done working, submit
  // it" tone used for completion actions elsewhere in the app.
  completeServiceButton: {
    backgroundColor: '#16A34A',
    borderRadius: 100,
    paddingVertical: 10, paddingHorizontal: 18,
  },
  // Ready to Close's own button — full width, centered, below the banner
  // rather than inline within an acknowledgeCard row like the others.
  closeTicketButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },

  // "Approval Request" card — the AM-review/RSM-confirm action card.
  approvalReqHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  approvalReqTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  approvalReqTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  approvalReqStatusPill: {
    backgroundColor: '#FEF9C3', borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  approvalReqStatusPillText: { fontSize: 11, fontWeight: '700', color: '#B45309', letterSpacing: 0.3 },

  approvalChainRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20,
    marginTop: 20,
  },
  approvalChainStep: { alignItems: 'center', gap: 6 },
  approvalChainAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },
  approvalChainAvatarDone: { backgroundColor: '#16A34A' },
  approvalChainAvatarRejected: { backgroundColor: '#DC2626' },
  approvalChainAvatarQ: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  approvalChainLabel: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  approvalChainStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  approvalChainStatus: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  approvalChainStatusDone: { color: '#16A34A' },
  approvalChainStatusRejected: { color: '#DC2626' },

  approvalReqButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  approvalReqRejectButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1,
    borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 100,
    paddingVertical: 14, backgroundColor: '#FFFFFF',
  },
  approvalReqRejectText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  approvalReqApproveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1.4,
    backgroundColor: '#16A34A', borderRadius: 100,
    paddingVertical: 14,
  },
  approvalReqApproveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  acknowledgeButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  acknowledgeErrorText: { color: '#DC2626', fontSize: 12, marginTop: 8, textAlign: 'center' },
  buttonDisabled: { opacity: 0.6 },

  // Task-level category/sub-category collapsible pill — dark full-width
  // bar + RefreshCw icon, same pattern TaskPreviewCard's serviceTagPill
  // already established for this same field elsewhere in the app.
  categoryPillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E1951',
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 18,
  },
  categoryPillText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  // Sub-category gets its own full-width pill directly below category's,
  // always visible (not nested inside the description card) — a lighter
  // shade of the same navy to read as "one level down".
  categorySubPillRow: { backgroundColor: '#433C94', marginTop: 10 },
  categoryDescCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    gap: 12,
  },
  categoryDescText: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  // "Fully Approved" banner — shown once the RSM has confirmed the work
  // but the ticket is still open, right before the Close Ticket action.
  fullyApprovedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 14,
    padding: 16,
  },
  fullyApprovedTitle: { fontSize: 15, fontWeight: '700', color: '#166534' },
  fullyApprovedSubtitle: { fontSize: 12, color: '#166534', opacity: 0.8, marginTop: 2 },
});
