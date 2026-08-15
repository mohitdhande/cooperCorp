import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ArrowLeft, AlertTriangle, Bell, Check, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, Info, Lock, Pencil, Plus, Smartphone } from 'lucide-react-native';
import { DocumentsCard } from '../../_components/shared/DocumentsCard';
import { PhotosVideoCard } from '../../_components/shared/PhotosVideoCard';
import { DropdownField } from '../../_components/taskForm/DropdownField';
import { NumberStepperField } from '../../_components/taskForm/NumberStepperField';
import { PartPickerModal } from '../../_components/taskForm/PartPickerModal';
import { SelectedPartCard } from '../../_components/taskForm/SelectedPartCard';
import { ComplaintCodePickerModal } from '../../_components/taskForm/ComplaintCodePickerModal';
import { ComplaintCodeCard } from '../../_components/taskForm/ComplaintCodeCard';
import { GroupHeader } from '../../_components/taskForm/GroupHeader';
import { StepperRow } from '../../_components/shared/StepperRow';
import { useSrTaskForm, SR_STEP_SEQUENCE } from '../../controllers/srTaskForm/useSrTaskForm';
import { TaskSummaryHeader } from '../../_components/shared/TaskSummaryHeader';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { PendingSyncBanner } from '../../_components/shared/PendingSyncBanner';
import { useFieldFocusChain } from '../../utils/useFieldFocusChain';
import { PriorityBadge } from '../../_components/taskForm/PriorityBadge';
import { SERVICE_CATEGORIES } from '../../_components/srTaskForm/srDropdownOptions';
import { formatFileSize } from '../../utils/reportFormatters';

// Same peach->light radial gradient backdrop as the Commissioning task form
// (duplicated, not extracted — a small, screen-specific visual).
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
          <RadialGradient id="srTaskFormBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#srTaskFormBg)" />
      </Svg>
    </View>
  );
}

// Electrical Readings/Engine Parameters' own header — a light-blue pill with
// an "Edit" button (hidden once editing starts) plus a chevron that always
// collapses/expands the card, independent of whether it's mid-edit. Distinct
// from GroupHeader (used by every other Step 1 section here) since those
// sections have no read-only display mode at all — they're edit-only, and
// only ever collapse once saved.
function ReadingsSectionHeader({ title, expanded, onToggleExpanded, editing, onEditPress }: {
  title: string; expanded: boolean; onToggleExpanded: () => void; editing: boolean; onEditPress: () => void;
}) {
  return (
    <View style={styles.readingsHeaderPill}>
      <Text style={styles.readingsHeaderTitle}>{title.toUpperCase()}</Text>
      <View style={styles.readingsHeaderRight}>
        {!editing && (
          <TouchableOpacity style={styles.readingsEditButton} onPress={onEditPress} activeOpacity={0.8}>
            <Pencil size={13} color="#374151" />
            <Text style={styles.readingsEditButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onToggleExpanded} hitSlop={8}>
          {expanded ? <ChevronUp size={18} color="#1E1951" /> : <ChevronDown size={18} color="#1E1951" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// One read-only row of the display grid — a value field ("AC Volt RY" ->
// "null V" when unset, matching the reference's own literal "null"
// placeholder rather than a blank or "--") or a status field (Oil/Coolant
// Level -> a colored pill, green once "OK", red otherwise including unset).
function ReadingsDisplayField({ item }: { item: { kind: 'value'; label: string; value: string; unit?: string } | { kind: 'status'; label: string; value: string } }) {
  if (item.kind === 'status') {
    const isOk = item.value === 'OK';
    return (
      <View>
        <Text style={styles.readingsDisplayLabel}>{item.label}</Text>
        <View style={[styles.readingsStatusPill, isOk && styles.readingsStatusPillOk]}>
          <View style={[styles.readingsStatusDot, isOk && styles.readingsStatusDotOk]} />
          <Text style={[styles.readingsStatusText, isOk && styles.readingsStatusTextOk]}>{item.value || 'null'}</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.readingsDisplayLabel}>{item.label}</Text>
      <Text style={styles.readingsDisplayValue}>{item.value || 'null'}{item.unit ? ` ${item.unit}` : ''}</Text>
    </View>
  );
}

// Orange banner shown at the top of Step 5's post-Complete view while OTP
// sign-off is still outstanding — mirrors the reference design's "Pending
// Customer Sign-off" card. Hidden once vm.taskCompleted (OTP verified).
function PendingSignOffBanner() {
  return (
    <View style={styles.pendingSignOffBanner}>
      <View style={styles.pendingSignOffIconChip}>
        <Clock size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pendingSignOffTitle}>Pending Customer Sign-off</Text>
        <Text style={styles.pendingSignOffSubtitle}>Collect OTP from the customer to proceed.</Text>
      </View>
    </View>
  );
}

// Green banner — the sign-off banner's next state once OTP has been
// verified but Close Ticket is still blocked on Parts/Work approval.
function CompletedWaitingBanner() {
  return (
    <View style={styles.completedWaitingBanner}>
      <View style={styles.completedWaitingIconChip}>
        <Check size={18} color="#FFFFFF" strokeWidth={3} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.completedWaitingTitle}>Completed</Text>
        <Text style={styles.completedWaitingSubtitle}>Waiting for approvals before closing.</Text>
      </View>
    </View>
  );
}

// Customer Sign-off card — Send OTP (before generated) or the OTP-sent
// state (code reveal, then the customer's entry boxes) once it has been.
// The generated code stays visible until Verify succeeds or Resend
// replaces it — same persistent behavior as the commissioning form's own
// OTP step (taskForm.tsx), not a timed auto-hide. Shared by both the
// engineer and area_manager Step 5 branches, which otherwise duplicate
// this exact card.
function CustomerSignOffCard({ vm }: { vm: any }) {
  const cardRef = useRef<View>(null);

  // Scrolls so this whole card (not just the tapped input) sits above the
  // keyboard — a plain scrollToEnd would jump past this card entirely once
  // Fault Codes/Parts Used/Notes render below it, cutting the OTP boxes
  // and Verify button off-screen instead of showing them. Measures the
  // card's own position relative to the ScrollView and scrolls exactly
  // there, with a small top margin, instead of guessing.
  const scrollCardIntoView = () => {
    const scrollView = vm.scrollViewRef?.current;
    const card = cardRef.current;
    if (!scrollView || !card) return;
    // A tick after focus — measureLayout on the same frame focus fires can
    // read a stale (pre-keyboard-transition) layout on some Android
    // devices.
    setTimeout(() => {
      // Pass the ScrollView ref itself, not a findNodeHandle()-derived
      // numeric handle — under the New Architecture (default since RN
      // 0.76+, this project's on 0.86), measureLayout's first argument
      // must be an actual native component ref; a plain number throws
      // "ref.measureLayout must be called with a ref to a native
      // component" instead of silently working like it did on the old
      // architecture.
      card.measureLayout(
        scrollView,
        (_x: number, y: number) => { scrollView.scrollTo({ y: Math.max(0, y - 16), animated: true }); },
        () => {}
      );
    }, 100);
  };

  // Auto-focuses the first OTP box the moment the entry row appears —
  // the customer shouldn't need to tap it manually. A short delay lets the
  // boxes actually mount first (focusing a not-yet-rendered ref is a
  // no-op). Same dependency pair as the reveal countdown above — Resend
  // clears customerOtp and generates a fresh code, so it re-focuses box 1
  // too rather than leaving focus wherever it was. Programmatic .focus()
  // still fires box 0's own onFocus (scrollCardIntoView above), which is
  // scoped to only that one box — not the per-digit auto-advance between
  // boxes — so this doesn't reintroduce the screen-jumping-while-typing
  // issue.
  useEffect(() => {
    if (!vm.otpGenerated) return;
    const timeout = setTimeout(() => { vm.otpInputRefs.current[0]?.focus(); }, 150);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.otpGenerated, vm.generatedOtp.join('')]);

  const canVerify = vm.customerOtp.join('').length >= 4 && !vm.otpLoading;

  return (
    <View ref={cardRef} style={styles.sectionCard}>
      <Text style={styles.approvalStatusLabel}>CUSTOMER SIGN-OFF</Text>
      {vm.taskCompleted ? (
        <View style={styles.otpVerifiedBanner}>
          <CheckCircle2 size={18} color="#16A34A" />
          <Text style={styles.otpVerifiedBannerText}>Customer OTP Verified</Text>
        </View>
      ) : (
        <View style={styles.otpInlineCard}>
          {!vm.otpGenerated ? (
            <TouchableOpacity
              style={[styles.otpSendButton, vm.otpLoading && styles.buttonDisabled]}
              onPress={vm.handleGenerateOtp}
              disabled={vm.otpLoading}
            >
              {vm.otpLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Smartphone size={18} color="#FFFFFF" />
                  <Text style={styles.otpInlineButtonText}>Send OTP to Customer</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.otpSentRow}>
                <View style={styles.otpSentLeft}>
                  <View style={styles.otpSentCheck}>
                    <Check size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <Text style={styles.otpSentText}>OTP sent</Text>
                </View>
                <TouchableOpacity onPress={vm.handleRegenerateOtp} disabled={vm.otpLoading} hitSlop={8}>
                  <Text style={styles.otpResendLinkV2}>Resend</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.otpRevealBox}>
                <Text style={styles.otpRevealLabel}>SHARE WITH CUSTOMER</Text>
                <Text style={styles.otpRevealCode}>{vm.generatedOtp.join('  ')}</Text>
              </View>

              <View style={styles.otpDividerRow}>
                <View style={styles.otpDividerLine} />
                <Text style={styles.otpDividerText}>CUSTOMER ENTERS</Text>
                <View style={styles.otpDividerLine} />
              </View>

              <View style={styles.otpBoxRowV2}>
                {vm.customerOtp.map((digit: string, index: number) => (
                  <TextInput
                    key={index}
                    ref={(ref: any) => { vm.otpInputRefs.current[index] = ref; }}
                    style={styles.otpBoxV2}
                    value={digit}
                    onChangeText={(text: string) => vm.handleChangeCustomerOtpDigit(index, text)}
                    // Only the first box scrolls the row into view above the
                    // keyboard — typing auto-advances focus through the
                    // other three (see handleChangeCustomerOtpDigit), and
                    // re-firing scrollToEnd on every one of those handoffs
                    // was snapping the whole screen to the bottom after
                    // every single digit, which read as the screen
                    // "jumping" while entering the OTP.
                    onFocus={index === 0 ? scrollCardIntoView : undefined}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>
              {vm.otpError ? <Text style={styles.sectionErrorText}>{vm.otpError}</Text> : null}

              <TouchableOpacity
                style={[styles.otpVerifyCompleteButton, (!canVerify) && styles.buttonDisabled]}
                onPress={vm.handleVerifyAndComplete}
                disabled={!canVerify}
              >
                {vm.otpLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpVerifyCompleteButtonText}>Verify & Complete</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// Step 5's read-only "what was actually submitted" summary — plain
// uppercase section labels with each fault code's Observation/Root
// Cause/Corrective Action called out in its own colored box. Rendered
// inside a collapsible GroupHeader card by the caller now (see
// summaryExpanded/toggleSummarySection) — this component itself is just
// the body content, same as before.
function SubmittedFaultCodesSection({ faultCodes }: { faultCodes: any[] }) {
  return (
    <View style={styles.submittedSection}>
      {faultCodes.length === 0 ? (
        <View style={styles.submittedCard}>
          <Text style={styles.emptyApprovalText}>No fault codes recorded.</Text>
        </View>
      ) : (
        faultCodes.map((fc) => (
          <View key={fc.uid} style={styles.submittedCard}>
            <View style={styles.approvalFaultHeader}>
              <View style={styles.approvalCodeBadge}>
                <Text style={styles.approvalCodeBadgeText}>{fc.code}</Text>
              </View>
              <Text style={styles.approvalFaultTitle} numberOfLines={1}>{fc.title}</Text>
              <PriorityBadge priority={fc.priority} />
            </View>
            {!!(fc.categoryName || fc.subcategoryName) && (
              <Text style={styles.submittedCardSubtitle}>
                {fc.categoryName}{fc.categoryName && fc.subcategoryName ? ' › ' : ''}{fc.subcategoryName}
              </Text>
            )}
            <View style={[styles.submittedDetailBox, fc.observation ? styles.submittedDetailBoxObservation : styles.submittedDetailBoxEmpty]}>
              <Text style={[styles.submittedDetailLabel, fc.observation ? styles.submittedDetailLabelObservation : styles.submittedDetailLabelEmpty]}>OBSERVATION</Text>
              {fc.observation ? (
                <Text style={styles.submittedDetailValue}>{fc.observation}</Text>
              ) : (
                <Text style={styles.submittedDetailValueEmpty}>Not filled</Text>
              )}
            </View>
            <View style={[styles.submittedDetailBox, fc.rootCause ? styles.submittedDetailBoxRootCause : styles.submittedDetailBoxEmpty]}>
              <Text style={[styles.submittedDetailLabel, fc.rootCause ? styles.submittedDetailLabelRootCause : styles.submittedDetailLabelEmpty]}>ROOT CAUSE</Text>
              {fc.rootCause ? (
                <Text style={styles.submittedDetailValue}>{fc.rootCause}</Text>
              ) : (
                <Text style={styles.submittedDetailValueEmpty}>Not filled</Text>
              )}
            </View>
            <View style={[styles.submittedDetailBox, fc.correctiveAction ? styles.submittedDetailBoxAction : styles.submittedDetailBoxEmpty]}>
              <Text style={[styles.submittedDetailLabel, fc.correctiveAction ? styles.submittedDetailLabelAction : styles.submittedDetailLabelEmpty]}>CORRECTIVE ACTION</Text>
              {fc.correctiveAction ? (
                <Text style={styles.submittedDetailValue}>{fc.correctiveAction}</Text>
              ) : (
                <Text style={styles.submittedDetailValueEmpty}>Not filled</Text>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// Same plain-label pattern for parts — a code/unit tag pair plus an "AM
// Review" tag while part approval is still pending, a lock icon marking the
// row read-only (parts can no longer be added/removed once submitted).
function SubmittedPartsSection({ parts, awaitingAmReview }: { parts: any[]; awaitingAmReview: boolean }) {
  return (
    <View style={styles.submittedSection}>
      {parts.length === 0 ? (
        <View style={styles.submittedCard}>
          <Text style={styles.emptyApprovalText}>No parts recorded.</Text>
        </View>
      ) : (
        parts.map((p) => (
          <View key={p.partId} style={styles.submittedCard}>
            <View style={styles.submittedPartTagRow}>
              <View style={styles.submittedPartTag}>
                <Text style={styles.submittedPartTagText}>{p.code}</Text>
              </View>
              <View style={styles.submittedPartTag}>
                <Text style={styles.submittedPartTagText}>{p.unit}</Text>
              </View>
              {awaitingAmReview && (
                <View style={styles.submittedPartReviewTag}>
                  <Text style={styles.submittedPartReviewTagText}>AM Review</Text>
                </View>
              )}
              <View style={styles.submittedPartLock}>
                <Lock size={13} color="#9CA3AF" />
              </View>
            </View>
            <Text style={styles.approvalPartName}>{p.name}</Text>
            {!!(p.category || p.subCategory) && (
              <Text style={styles.submittedCardSubtitle}>
                {p.category}{p.category && p.subCategory ? ' › ' : ''}{p.subCategory}
              </Text>
            )}
            <View style={styles.submittedPartQtyRow}>
              <View style={styles.submittedPartQtyPill}>
                <Text style={styles.submittedPartQtyPillText}>×{p.quantity}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function SubmittedNotesSection({ notes }: { notes: string }) {
  return (
    <View style={styles.submittedSection}>
      <View style={styles.submittedCard}>
        {notes ? (
          <Text style={styles.approvalNotesText}>{notes}</Text>
        ) : (
          <Text style={styles.emptyApprovalText}>No notes recorded.</Text>
        )}
      </View>
    </View>
  );
}

// Main SR (service) task form screen — a 6-step wizard, redesigned to match
// the commissioning task form (taskForm.tsx). Renders the UI and delegates
// all state/API logic to the useSrTaskForm controller. The one genuine
// flow difference (kept, not redesigned away): SR completes and OTP-
// verifies in one combined action, not the commissioning form's separate
// "Complete" (step 6) then "OTP Verify" (step 8) split.
export default function SrTaskFormScreen() {
  const vm = useSrTaskForm();
  const insets = useSafeAreaInsets();
  const sheetPaddingBottom = Math.max(insets.bottom, 16) + 14;

  // Auto-jump-to-next-field, same as the commissioning form and the login
  // screen — only wired for Asset Information's identification sections
  // (Genset ID, Alternator & Panel), where fields are genuinely filled in
  // one narrative sequence. Left out of the checks/readings-style grids
  // elsewhere in this form for the same reason as taskForm.tsx.
  const { register, focusNext } = useFieldFocusChain();

  // Photos/videos now upload on leaving the Photos & Video step (Next), not
  // deferred all the way to Step 5's Complete Task tap — the % progress is
  // visible right here on the step that actually added them, and Step 5 no
  // longer has to do this work (its own handlers still gate on
  // photosUploadSuccess/videosUploadSuccess as a safety net, so nothing
  // double-uploads if this already succeeded, or if a user reaches Step 5
  // some other way, e.g. tapping the stepper directly instead of Next).
  const handleNextFromMediaStep = async () => {
    const hasPhotos = vm.sitePhotos.some((p) => p.mediaType !== 'video' && p.mediaType !== 'pdf');
    // PDFs ride the same GCS flow as videos (handleSaveAllVideos), not the
    // photos multipart call — see SitePhoto.mediaType.
    const hasVideos = vm.sitePhotos.some((p) => p.mediaType === 'video' || p.mediaType === 'pdf');
    if (hasPhotos && !vm.photosUploadSuccess) {
      const ok = await vm.handleSaveAllPhotos();
      if (!ok) return;
    }
    if (hasVideos && !vm.videosUploadSuccess) {
      const ok = await vm.handleSaveAllVideos();
      if (!ok) return;
    }
    vm.handleNext();
  };

  // Every real API call this screen can trigger fades the whole screen
  // with the loading video rather than just the one button's own small
  // spinner — same treatment as the commissioning form. Complaint codes
  // (step2Saving) and parts (step3Saving) are the deliberate exception:
  // each card already has its own save button with its own spinner
  // (isSaving), so saving one card shouldn't lock the whole screen and
  // make it look like every code/part is being saved together.
  const isBusy = (
    vm.initialDataLoading ||
    vm.photosUploading || vm.videosUploading || vm.step5Saving || vm.step6Saving || vm.otpLoading ||
    vm.faultCodesLoading || vm.partsLoading || vm.finishing || vm.closingTicket ||
    Object.values(vm.sectionSaving).some(Boolean)
  );
  // Photo/video upload is the one loading state worth a live % instead of
  // the generic "Loading..." — it's the only one that can meaningfully
  // take several seconds with real incremental progress to report.
  const loadingMessage = vm.photosUploading
    ? `Uploading photos... ${vm.photosUploadProgress}%`
    : vm.videosUploading
    ? `Uploading video... ${vm.videosUploadProgress}%`
    : undefined;

  // The complaint-code and part pickers open as full bottom sheets, not
  // anchored to these buttons — just their own visibility toggles.
  const openComplaintPicker = () => vm.setComplaintPickerVisible(true);
  const openPartPicker = () => vm.setPartPickerVisible(true);

  const selectedCategoryColor =
    SERVICE_CATEGORIES.find(c => c.letter === vm.selectedCategoryLetter) ||
    { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' };

  // Engineer-only Step 5: the finished/selected category's display info —
  // prefers the live categoryConfig fetch (real title/description), falls
  // back to the local SERVICE_CATEGORIES/selectedCategoryColor lookup while
  // that fetch is still in flight.
  const finishedCategoryMeta = vm.categoryConfig.find(c => c.letter === vm.selectedCategoryLetter);
  const finishedCategoryTitle = finishedCategoryMeta?.title
    || SERVICE_CATEGORIES.find(c => c.letter === vm.selectedCategoryLetter)?.name || '';
  const finishedCategoryDescription = finishedCategoryMeta?.description || '';
  const finishedCategoryBg = finishedCategoryMeta?.bg || selectedCategoryColor.bg;
  const finishedCategoryBorder = finishedCategoryMeta?.border || selectedCategoryColor.border;
  const finishedCategoryText = finishedCategoryMeta?.text || selectedCategoryColor.text;

  // D/E always seed a workApproval gate (AM review, then RSM confirm) once
  // finished; B/C only do when the picked Service Type (selectedSubCategory)
  // is literally "Goodwill" — per finishServiceTask's own doc comment in
  // commisionAPi.ts ("B/C only when subCategory is 'Goodwill'"), matching
  // the backend dev guide. Purely informational here — the actual gate is
  // seeded server-side by /finish regardless of what this banner shows.
  //
  // NOT billingType — billingType (Paid/Goodwill) is a separate field that
  // only appears when the sub-type is Breakdown/BIS, and answers a
  // different question (is this specific repair being billed or done free)
  // from whether "Goodwill" itself was picked as the sub-type/Service Type.
  // Comparing against billingType here previously meant this banner never
  // showed at all when "Goodwill" was picked as the actual sub-type, since
  // billingType stays unset for any sub-type other than Breakdown/BIS.
  const needsWorkApproval = ['D', 'E'].includes(vm.selectedCategoryLetter)
    || (['B', 'C'].includes(vm.selectedCategoryLetter) && vm.selectedSubCategory === 'Goodwill');

  // Billing Type — a second required pick, shown for two independent
  // cases: category B (Warranty Repair) when the sub-type is Breakdown/BIS
  // (is this covered under warranty or extended as goodwill), and category
  // E (CAMC) when the sub-type is "AMC Out Of Scope" (UI only for now —
  // what the picked value actually drives here is still TBD). "Breakdown"
  // is also a valid sub-type under C/D/E, but those never ask for Billing
  // Type — C (Out Of Warranty) is inherently paid work already (a
  // free-of-charge repair there is picked directly as the "Goodwill"
  // sub-type, not via a separate flag). Scoped to categoryOnlyPresetAtCreation
  // — the only branch that actually renders this field — so Complete's
  // gating below can never disable itself with no way to satisfy it in the
  // other two category-selection branches.
  const needsBillingType = vm.categoryOnlyPresetAtCreation && (
    (vm.selectedCategoryLetter === 'B' && ['Breakdown', 'BIS'].includes(vm.selectedSubCategory))
    || (vm.selectedCategoryLetter === 'E' && vm.selectedSubCategory === 'AMC Out Of Scope')
  );

  // Same Billing Type rule for the area_manager's own "Select Service
  // Category" accordion below — not scoped to categoryOnlyPresetAtCreation
  // (that flag only applies to the engineer's locked-category branch);
  // this one just checks whichever category/sub-type the accordion
  // currently has picked, since that branch always renders its own Billing
  // Type field once it applies.
  const needsBillingTypeAM =
    (vm.selectedCategoryLetter === 'B' && ['Breakdown', 'BIS'].includes(vm.selectedSubCategory))
    || (vm.selectedCategoryLetter === 'E' && vm.selectedSubCategory === 'AMC Out Of Scope');

  // Once finished, the task's own workApproval (the same object
  // TaskPreviewCard/srDetail read) tells us whether it's still pending —
  // this screen just labels it "Parts Approval" instead of "Work Approval".
  const isEngineerFinished = vm.isEngineer && vm.task?.status === 'COMPLETED';
  // Pending-sign-off banner — shown once per screen, above the
  // date/assignee summary card (TaskSummaryHeader) rather than buried
  // inside the role-specific Customer Sign-off card below it. Only once
  // the task has actually reached COMPLETED (work done, OTP outstanding)
  // and only until that OTP is verified — never for IN_PROGRESS or earlier
  // active statuses, and never once taskCompleted flips true.
  const showPendingSignOffBanner = vm.currentStep === 5 && vm.task?.status === 'COMPLETED' && !vm.taskCompleted;
  const engineerWorkApproval = vm.task?.workApproval;
  // Categories that never need work approval at all (A/F/G, or B/C without
  // Goodwill) never get a workApproval object — treating that as "blocked
  // until CONFIRMED" left Close Ticket permanently disabled for them, since
  // nothing was ever going to set a status. No workApproval means nothing
  // to wait for.
  const partsApprovalConfirmed = !engineerWorkApproval || engineerWorkApproval.status === 'CONFIRMED';
  const partsApprovalSubtitle = engineerWorkApproval?.status === 'PENDING_RSM' ? 'Pending RSM confirmation' : 'Pending AM review';

  // Close Ticket's real 3-gate rule per the backend dev guide — work
  // approval (above) is only one of them; part approval is a genuinely
  // separate gate the button was never actually checking before, so it
  // could show "enabled" for a task the backend would still 400 on.
  const enginePartApproval = vm.task?.partApproval;
  const partApprovalDone = !enginePartApproval || enginePartApproval.status !== 'PENDING';
  // OTP-verified via either this session's own flag (just verified, before
  // any refetch) or the task's own persisted state (already verified in an
  // earlier session) — taskCompleted alone missed the second case, leaving
  // Close Ticket looking un-verified for a task that already was.
  const otpVerifiedForClose = vm.taskCompleted || vm.task?.status === 'CLIENT_APPROVED' || vm.task?.completionOtp?.verified === true;
  const canCloseTicketEngineer = partsApprovalConfirmed && partApprovalDone && otpVerifiedForClose;

  const amPartApproval = vm.task?.partApproval;
  const amPartApprovalDone = !amPartApproval || amPartApproval.status !== 'PENDING';
  const canCloseTicketAM = vm.workApprovalStatus === 'CONFIRMED' && amPartApprovalDone && otpVerifiedForClose;

  // Green "Completed / waiting for approvals" banner — the sign-off
  // banner's own next state once OTP has actually been verified but Close
  // Ticket is still blocked on Parts/Work approval. Mutually exclusive with
  // showPendingSignOffBanner (that one requires status === 'COMPLETED',
  // this one requires the task to have already moved past it).
  const canCloseTicketFinal = vm.isEngineer ? canCloseTicketEngineer : canCloseTicketAM;
  const showCompletedWaitingBanner = vm.currentStep === 5 && otpVerifiedForClose && !canCloseTicketFinal;

  // Step 1's five sections auto-minimize right after a successful save,
  // same pattern as the commissioning form — this tracks only the manual
  // override once a user taps a minimized header to look at/edit it again.
  const [sectionReopened, setSectionReopened] = useState<Record<string, boolean>>({});
  const isSectionExpanded = (key: string) => !vm.sectionSuccess[key] || !!sectionReopened[key];

  const toggleSectionReopen = (key: string) => setSectionReopened((prev) => ({ ...prev, [key]: !prev[key] }));

  // Step 5's post-submission "what was actually submitted" cards (Fault
  // Codes/Parts Used/Notes) — same collapse-by-default, tap-header-to-
  // expand pattern as Step 1's sections above, but this data was never
  // "saved" via its own button (it's read straight from steps 2/3's already-
  // submitted state), so it gets its own independent toggle dict rather
  // than reusing isSectionExpanded/vm.sectionSuccess, which would always
  // read as expanded here (no matching sectionSuccess key ever gets set).
  const [summaryExpanded, setSummaryExpanded] = useState<Record<string, boolean>>({});
  const toggleSummarySection = (key: string) => setSummaryExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Electrical Readings/Engine Parameters — unlike this step's other
  // sections, these default to an always-visible read-only display (real
  // values once saved, "null" placeholders until then) rather than
  // collapsing away entirely; "Edit" swaps in the existing input fields,
  // and a successful save swaps back to the display view automatically.
  const [electricalExpanded, setElectricalExpanded] = useState(true);
  const [electricalEditing, setElectricalEditing] = useState(false);
  const [engineParamsExpanded, setEngineParamsExpanded] = useState(true);
  const [engineParamsEditing, setEngineParamsEditing] = useState(false);
  React.useEffect(() => {
    if (vm.sectionSuccess['electrical']) setElectricalEditing(false);
  }, [vm.sectionSuccess['electrical']]);
  React.useEffect(() => {
    if (vm.sectionSuccess['engineParams']) setEngineParamsEditing(false);
  }, [vm.sectionSuccess['engineParams']]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      {isBusy && <LoadingOverlay message={loadingMessage} />}

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={vm.handleCancel}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SERVICE</Text>
        <View style={styles.headerButton}>
          <Bell size={22} color="#979797" />
        </View>
      </View>

      {/* Android's own softwareKeyboardLayoutMode is "pan" (app.json) — the
          OS already shifts the whole screen up to keep the focused input
          visible on its own. Pairing that with behavior="height" here made
          RN ALSO shrink this container by the keyboard's height on top of
          the OS's own pan, double-compensating and leaving a large empty
          gap between the content and the keyboard (e.g. the OTP entry
          card). undefined on Android leaves the OS's native pan as the
          only mechanism at work; iOS has no such OS-level behavior, so it
          still needs RN's own "padding" here. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          ref={vm.scrollViewRef}
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
          // Generous bottom padding (not just enough to clear the last
          // field) so every step always has real overflow to scroll
          // through, even a short one like Step 5's pre-completion category
          // card — on a shorter step, 30 left the content height at or just
          // under the viewport, which reads as "frozen"/not scrollable even
          // though nothing was actually blocking the gesture.
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={vm.onRefresh} colors={['#F26722']} tintColor="#F26722" />}
        >
          <StepperRow
            steps={SR_STEP_SEQUENCE}
            currentStep={vm.currentStep}
            onSelectStep={vm.setCurrentStep}
          />

          {/* Once the task is fully completed (OTP verified), every step's
              fields become read-only — the stepper above stays interactive
              so the user can still page back through and review what was
              submitted, they just can't change anything. */}
          <View pointerEvents={(vm.taskCompleted || isEngineerFinished) ? 'none' : 'auto'} style={(vm.taskCompleted || isEngineerFinished) ? styles.readOnlyDim : undefined}>

          {/* Pending-sign-off banner sits above the summary card (not
              inside the Customer Sign-off card below), matching the
              reference design's top-of-screen placement. Once OTP is
              verified, the green "Completed / waiting for approvals"
              banner takes over the same slot until Close Ticket is
              actually enabled. */}
          {showPendingSignOffBanner && <PendingSignOffBanner />}
          {showCompletedWaitingBanner && <CompletedWaitingBanner />}

          {/* Step 1 and Step 5 only — reverted from showing on every step,
              then Step 5 added back since the post-Complete/Send-for-
              Approval view (Customer Sign-off/Approval Status) needs the
              same task-identity context Step 1 has. */}
          {(vm.currentStep === 1 || vm.currentStep === 5) && (
            <TaskSummaryHeader task={vm.task} gensetNumber={vm.gensetSrNumber} engineNumber={vm.engineNumber} />
          )}

          <PendingSyncBanner />

          {/* ══════════════ STEP 4 — ASSET INFORMATION ══════════════ */}
          {vm.currentStep === 4 && (
            <>
              {/* Genset Identification */}
              <View style={styles.sectionCard}>
                <GroupHeader
                  title="Genset Identification"
                  saved={!!vm.sectionSuccess['genset']}
                  onPress={() => toggleSectionReopen('genset')}
                  expanded={isSectionExpanded('genset')}
                />

                {isSectionExpanded('genset') && (
                  <>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Genset Model</Text>
                        <TextInput
                          style={styles.fieldInput} value={vm.gensetModel} onChangeText={vm.setGensetModel}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('gensetSrNumber')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Genset SR Number</Text>
                        <TextInput
                          ref={register('gensetSrNumber')}
                          style={styles.fieldInput} value={vm.gensetSrNumber} onChangeText={vm.setGensetSrNumber}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineModel')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Engine Model</Text>
                        <TextInput
                          ref={register('engineModel')}
                          style={styles.fieldInput} value={vm.engineModel} onChangeText={vm.setEngineModel}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineNumber')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Engine Number</Text>
                        <TextInput
                          ref={register('engineNumber')}
                          style={styles.fieldInput} value={vm.engineNumber} onChangeText={vm.setEngineNumber}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineKw')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Engine KW</Text>
                        <TextInput
                          ref={register('engineKw')}
                          style={styles.fieldInput} value={vm.engineKw} onChangeText={vm.setEngineKw} keyboardType="numeric"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Engine Type" value={vm.engineType} options={vm.ENGINE_TYPE_OPTIONS} onSelect={vm.setEngineType} />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Engine Family" value={vm.engineFamily} options={vm.ENGINE_FAMILY_OPTIONS} onSelect={vm.setEngineFamily} />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Fuel Type" value={vm.fuelType} options={vm.FUEL_TYPE_OPTIONS} onSelect={vm.setFuelType} />
                      </View>
                    </View>
                    <View style={styles.fieldFull}>
                      <DropdownField plainLabel label="Application" value={vm.application} options={vm.APPLICATION_OPTIONS} onSelect={vm.setApplication} />
                    </View>

                    {vm.sectionError['genset'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['genset']}</Text> : null}
                    <TouchableOpacity
                      style={[styles.checkSaveButton, vm.sectionSuccess['genset'] && styles.checkSaveButtonDone]}
                      onPress={() => vm.handleSaveAssetSection('genset')}
                      disabled={vm.sectionSaving['genset']}
                    >
                      {vm.sectionSaving['genset'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Alternator & Panel */}
              <View style={styles.sectionCard}>
                <GroupHeader
                  title="Alternator & Panel"
                  saved={!!vm.sectionSuccess['alternator']}
                  onPress={() => toggleSectionReopen('alternator')}
                  expanded={isSectionExpanded('alternator')}
                />

                {isSectionExpanded('alternator') && (
                  <>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Alt. Make</Text>
                        <TextInput
                          style={styles.fieldInput} value={vm.altMake} onChangeText={vm.setAltMake}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('altModel')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Alt. Model</Text>
                        <TextInput
                          ref={register('altModel')}
                          style={styles.fieldInput} value={vm.altModel} onChangeText={vm.setAltModel}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('altSn')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Alt. S/N</Text>
                        <TextInput
                          ref={register('altSn')}
                          style={styles.fieldInput} value={vm.altSn} onChangeText={vm.setAltSn}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('atsSn')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>ATS S/N</Text>
                        <TextInput
                          ref={register('atsSn')}
                          style={styles.fieldInput} value={vm.atsSn} onChangeText={vm.setAtsSn}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('batterySn')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Battery S/N</Text>
                        <TextInput
                          ref={register('batterySn')}
                          style={styles.fieldInput} value={vm.batterySn} onChangeText={vm.setBatterySn}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('kva')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>KVA</Text>
                        <TextInput
                          ref={register('kva')}
                          style={styles.fieldInput} value={vm.kva} onChangeText={vm.setKva} keyboardType="numeric"
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Phase" value={vm.phase} options={vm.PHASE_OPTIONS} onSelect={vm.setPhase} />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Panel Type" value={vm.panelType} options={vm.PANEL_TYPE_OPTIONS} onSelect={vm.setPanelType} />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Panel S/N</Text>
                        <TextInput style={styles.fieldInput} value={vm.panelSn} onChangeText={vm.setPanelSn} />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="CPCB Norm" value={vm.cpcbNorm} options={vm.CPCB_NORM_OPTIONS} onSelect={vm.setCpcbNorm} />
                      </View>
                    </View>

                    <View style={styles.fieldFull}>
                      <Text style={styles.fieldLabel}>Load Unbalance</Text>
                      <View style={styles.toggleRow}>
                        <TouchableOpacity style={[styles.toggleOption, vm.loadUnbalance === 'Yes' && styles.toggleOptionActive]} onPress={() => vm.setLoadUnbalance('Yes')}>
                          <Text style={[styles.toggleText, vm.loadUnbalance === 'Yes' && styles.toggleTextActive]}>Yes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.toggleOption, vm.loadUnbalance === 'No' && styles.toggleOptionActive]} onPress={() => vm.setLoadUnbalance('No')}>
                          <Text style={[styles.toggleText, vm.loadUnbalance === 'No' && styles.toggleTextActive]}>No</Text>
                        </TouchableOpacity>
                      </View>
                      {vm.loadUnbalance === 'Yes' && (
                        <View style={[styles.fieldFull, { marginTop: 12 }]}>
                          <Text style={styles.fieldLabel}>Unbalance %</Text>
                          <TextInput style={styles.fieldInput} value={vm.loadUnbalancePercentage} onChangeText={vm.setLoadUnbalancePercentage} keyboardType="numeric" />
                        </View>
                      )}
                      {vm.loadUnbalance === 'No' && (
                        <View style={[styles.fieldFull, { marginTop: 12 }]}>
                          <Text style={styles.fieldLabel}>Comment</Text>
                          <TextInput style={styles.fieldInput} value={vm.loadUnbalanceComment} onChangeText={vm.setLoadUnbalanceComment} />
                        </View>
                      )}
                    </View>

                    {vm.sectionError['alternator'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['alternator']}</Text> : null}
                    <TouchableOpacity
                      style={[styles.checkSaveButton, vm.sectionSuccess['alternator'] && styles.checkSaveButtonDone]}
                      onPress={() => vm.handleSaveAssetSection('alternator')}
                      disabled={vm.sectionSaving['alternator']}
                    >
                      {vm.sectionSaving['alternator'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Electrical Readings — read-only display by default (real
                  values once saved, "null" placeholders until then); "Edit"
                  swaps in the input fields below. */}
              <View style={styles.sectionCard}>
                <ReadingsSectionHeader
                  title="Electrical Readings"
                  expanded={electricalExpanded}
                  onToggleExpanded={() => setElectricalExpanded((v) => !v)}
                  editing={electricalEditing}
                  onEditPress={() => setElectricalEditing(true)}
                />

                {electricalExpanded && (electricalEditing ? (
                  <>
                    {([
                      [['AC VOLT RY', vm.acVoltRY, vm.setAcVoltRY, 'V'], ['AC VOLT YB', vm.acVoltYB, vm.setAcVoltYB, 'V']],
                      [['AC VOLT BR', vm.acVoltBR, vm.setAcVoltBR, 'V'], ['AC AMP R', vm.acAmpR, vm.setAcAmpR, 'A']],
                      [['AC AMP Y', vm.acAmpY, vm.setAcAmpY, 'A'], ['AC AMP B', vm.acAmpB, vm.setAcAmpB, 'A']],
                      [['LOAD KW R', vm.loadKwR, vm.setLoadKwR, undefined], ['LOAD KW Y', vm.loadKwY, vm.setLoadKwY, undefined]],
                      [['LOAD KW B', vm.loadKwB, vm.setLoadKwB, undefined], ['TOTAL KW', vm.totalKw, vm.setTotalKw, undefined]],
                    ] as const).map((row, i) => (
                      <View key={i} style={[styles.fieldRow, { marginTop: i === 0 ? 0 : 14 }]}>
                        {row.map(([label, value, setter, unit]) => (
                          <NumberStepperField key={label} label={label} value={value} onChangeValue={setter} unit={unit} />
                        ))}
                      </View>
                    ))}
                    <View style={[styles.fieldRow, { marginTop: 14 }]}>
                      <NumberStepperField label="LOAD %" value={vm.loadPercent} onChangeValue={vm.setLoadPercent} unit="%" />
                      <View style={{ flex: 1 }} />
                    </View>

                    {vm.sectionError['electrical'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['electrical']}</Text> : null}
                    <TouchableOpacity
                      style={[styles.checkSaveButton, vm.sectionSuccess['electrical'] && styles.checkSaveButtonDone]}
                      onPress={() => vm.handleSaveAssetSection('electrical')}
                      disabled={vm.sectionSaving['electrical']}
                    >
                      {vm.sectionSaving['electrical'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.readingsDisplayGrid}>
                    {([
                      [{ kind: 'value', label: 'AC Volt RY', value: vm.acVoltRY, unit: 'V' }, { kind: 'value', label: 'AC Volt YB', value: vm.acVoltYB, unit: 'V' }],
                      [{ kind: 'value', label: 'AC Volt BR', value: vm.acVoltBR, unit: 'V' }, { kind: 'value', label: 'AC Amp R', value: vm.acAmpR, unit: 'A' }],
                      [{ kind: 'value', label: 'AC Amp Y', value: vm.acAmpY, unit: 'A' }, { kind: 'value', label: 'AC Amp B', value: vm.acAmpB, unit: 'A' }],
                      [{ kind: 'value', label: 'Load KW R', value: vm.loadKwR }, { kind: 'value', label: 'Load KW Y', value: vm.loadKwY }],
                      [{ kind: 'value', label: 'Load KW B', value: vm.loadKwB }, { kind: 'value', label: 'Total KW', value: vm.totalKw }],
                      [{ kind: 'value', label: 'Load %', value: vm.loadPercent, unit: '%' }],
                    ] as const).map((row, i) => (
                      <View key={i} style={[styles.readingsDisplayRow, i === 0 && { marginTop: 4 }]}>
                        {row.map((item) => (
                          <View key={item.label} style={styles.readingsDisplayHalf}>
                            <ReadingsDisplayField item={item} />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </View>

              {/* Engine Parameters — same display/edit toggle. */}
              <View style={styles.sectionCard}>
                <ReadingsSectionHeader
                  title="Engine Parameters"
                  expanded={engineParamsExpanded}
                  onToggleExpanded={() => setEngineParamsExpanded((v) => !v)}
                  editing={engineParamsEditing}
                  onEditPress={() => setEngineParamsEditing(true)}
                />

                {engineParamsExpanded && (engineParamsEditing ? (
                  <>
                    <View style={styles.fieldRow}>
                      <NumberStepperField label="RPM" value={vm.rpm} onChangeValue={vm.setRpm} />
                      <NumberStepperField label="FREQUENCY" value={vm.frequency} onChangeValue={vm.setFrequency} unit="Hz" />
                    </View>
                    <View style={[styles.fieldRow, { marginTop: 14 }]}>
                      <NumberStepperField label="DC VOLTAGE" value={vm.dcVoltage} onChangeValue={vm.setDcVoltage} unit="V" />
                      <NumberStepperField label="OIL PRESSURE" value={vm.oilPressure} onChangeValue={vm.setOilPressure} />
                    </View>
                    <View style={[styles.fieldRow, { marginTop: 14 }]}>
                      <NumberStepperField label="COOLANT TEMP" value={vm.coolantTemp} onChangeValue={vm.setCoolantTemp} unit="°C" />
                      <NumberStepperField label="DEF LEVEL" value={vm.defLevel} onChangeValue={vm.setDefLevel} unit="%" />
                    </View>

                    {([
                      ['OIL LEVEL', vm.oilLevel, vm.setOilLevel, vm.oilLevelComment, vm.setOilLevelComment],
                      ['COOLANT LEVEL', vm.coolantLevel, vm.setCoolantLevel, vm.coolantLevelComment, vm.setCoolantLevelComment],
                    ] as const).map(([label, value, setter, comment, setComment], i) => (
                      <View key={label} style={{ marginTop: i === 0 ? 18 : 16 }}>
                        <Text style={styles.fieldLabelStatic}>{label}</Text>
                        <View style={styles.okNotOkRow}>
                          <TouchableOpacity style={[styles.okButton, value === 'OK' && styles.okButtonActive]} onPress={() => setter('OK')}>
                            <Text style={[styles.okButtonText, value === 'OK' && styles.okButtonTextActive]}>OK</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.notOkButton, value === 'Not OK' && styles.notOkButtonActive]} onPress={() => setter('Not OK')}>
                            <Text style={[styles.notOkButtonText, value === 'Not OK' && styles.notOkButtonTextActive]}>Not OK</Text>
                          </TouchableOpacity>
                        </View>
                        {value === 'Not OK' && (
                          <View style={{ marginTop: 12 }}>
                            <Text style={styles.fieldLabel}>Description</Text>
                            <TextInput
                              style={styles.fieldInput}
                              value={comment}
                              onChangeText={setComment}
                              placeholder={`Describe ${label.toLowerCase()} issue...`}
                              placeholderTextColor="#9CA3AF"
                            />
                          </View>
                        )}
                      </View>
                    ))}

                    {vm.sectionError['engineParams'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['engineParams']}</Text> : null}
                    <TouchableOpacity
                      style={[styles.checkSaveButton, vm.sectionSuccess['engineParams'] && styles.checkSaveButtonDone]}
                      onPress={() => vm.handleSaveAssetSection('engineParams')}
                      disabled={vm.sectionSaving['engineParams']}
                    >
                      {vm.sectionSaving['engineParams'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.readingsDisplayGrid}>
                    <View style={[styles.readingsDisplayRow, { marginTop: 4 }]}>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'value', label: 'RPM', value: vm.rpm }} /></View>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'value', label: 'Frequency', value: vm.frequency, unit: 'Hz' }} /></View>
                    </View>
                    <View style={styles.readingsDisplayRow}>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'value', label: 'DC Voltage', value: vm.dcVoltage, unit: 'V' }} /></View>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'status', label: 'Oil Level', value: vm.oilLevel }} /></View>
                    </View>
                    <View style={styles.readingsDisplayRow}>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'value', label: 'Oil Pressure', value: vm.oilPressure }} /></View>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'status', label: 'Coolant Level', value: vm.coolantLevel }} /></View>
                    </View>
                    <View style={styles.readingsDisplayRow}>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'value', label: 'Coolant Temp', value: vm.coolantTemp, unit: '°C' }} /></View>
                      <View style={styles.readingsDisplayHalf}><ReadingsDisplayField item={{ kind: 'value', label: 'DEF Level', value: vm.defLevel, unit: '%' }} /></View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ══════════════ STEP 1 — COMPLAINT / FAULT CODES ══════════════ */}
          {vm.currentStep === 1 && (
            <>
              {/* Now the landing step — the initial-load spinner moved here
                  from Asset Information (now Step 4) so reopening a task
                  shows loading feedback on whichever step the user actually
                  lands on first, not one buried three steps ahead. */}
              {vm.initialDataLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#F26722" />
                  <Text style={styles.loadingText}>Loading task data...</Text>
                </View>
              )}

              <GroupHeader title="Complaint Codes" saved={false} style={styles.sectionPillHeaderWhite} />

              {vm.selectedComplaintCodes.map((item) => (
                <ComplaintCodeCard
                  key={item.uid}
                  item={item}
                  onRemove={() => vm.handleRemoveComplaintCode(item.uid)}
                  onChangeObservation={(text) => vm.handleChangeComplaintObservation(item.uid, text)}
                  onChangeRootCause={(text) => vm.handleChangeComplaintRootCause(item.uid, text)}
                  onChangeCorrectiveAction={(text) => vm.handleChangeComplaintCorrectiveAction(item.uid, text)}
                  onSave={vm.handleSaveFaultCodes}
                  isSaving={vm.step2Saving}
                />
              ))}
              {vm.step2Error ? <Text style={styles.sectionErrorText}>{vm.step2Error}</Text> : null}

              {/* Below the added-codes list now, not above it. */}
              <TouchableOpacity style={[styles.addCodeButton, { marginBottom: 16 }]} onPress={openComplaintPicker} disabled={vm.taskCompleted}>
                <Plus size={18} color="#0F0F0F" />
                <Text style={styles.addCodeButtonText}>ADD CODE</Text>
              </TouchableOpacity>

              <ComplaintCodePickerModal
                visible={vm.complaintPickerVisible}
                onClose={() => vm.setComplaintPickerVisible(false)}
                faultCodes={vm.apiFaultCodes}
                loading={vm.faultCodesLoading}
                onSelectCode={vm.handleSelectComplaintCode}
              />
            </>
          )}

          {/* ══════════════ STEP 2 — PARTS USED ══════════════ */}
          {vm.currentStep === 2 && (
            <>
              <GroupHeader title="Parts Used" saved={false} style={styles.sectionPillHeaderWhite} />

              {vm.selectedParts.map((part) => (
                <SelectedPartCard
                  key={part.partId}
                  part={part}
                  onIncrease={() => vm.handleIncreaseQty(part.partId)}
                  onDecrease={() => vm.handleDecreaseQty(part.partId)}
                  onRemove={() => vm.handleRemovePart(part.partId)}
                />
              ))}
              {vm.step3Error ? <Text style={styles.sectionErrorText}>{vm.step3Error}</Text> : null}

              {/* Below the added-parts list now, not above it. */}
              <TouchableOpacity style={[styles.addCodeButton, { marginBottom: 16 }]} onPress={openPartPicker} disabled={vm.taskCompleted}>
                <Plus size={18} color="#0F0F0F" />
                <Text style={styles.addCodeButtonText}>ADD PARTS</Text>
              </TouchableOpacity>

              <PartPickerModal
                visible={vm.partPickerVisible}
                onClose={() => vm.setPartPickerVisible(false)}
                parts={vm.apiParts}
                loading={vm.partsLoading}
                onSelectPart={vm.handleSelectPart}
              />
            </>
          )}

          {/* ══════════════ STEP 3 — PHOTOS & VIDEO ══════════════
              Two separate cards now, not one combined grid — Photos keeps
              its existing tap-to-open-camera-or-gallery box and multipart
              upload; Video gets its own Record/Upload actions and its own
              GCS-based upload (handleSaveAllVideos — no multipart endpoint
              for video, per the backend dev guide). Both upload at the same
              point, right before Complete at Step 5. */}
          {vm.currentStep === 3 && (
            <>
              <Text style={styles.stepSectionLabel}>STEP 3 — PHOTOS & VIDEO</Text>

              {/* Photos & Video card — shared with the Commissioning form
                  (same grid + video-list + upload behavior), not a
                  duplicated copy of it. */}
              <View style={{ marginBottom: 16 }}>
                <PhotosVideoCard
                  sitePhotos={vm.sitePhotos}
                  onRemove={vm.handleRemovePhoto}
                  onAddPress={() => vm.setPhotoOptionsVisible(true)}
                  photosUploading={vm.photosUploading}
                  photosUploadProgress={vm.photosUploadProgress}
                  photosUploadSuccess={vm.photosUploadSuccess}
                  photosUploadError={vm.photosUploadError}
                  videosUploading={vm.videosUploading}
                  videosUploadProgress={vm.videosUploadProgress}
                  videosUploadSuccess={vm.videosUploadSuccess}
                />
              </View>

              {/* Documents card — shared with the Commissioning form (same
                  PDF pick + GCS video-confirm upload flow), not a
                  duplicated copy of it. */}
              <DocumentsCard
                pdfs={vm.sitePhotos.filter((p) => p.mediaType === 'pdf')}
                uploading={vm.videosUploading}
                uploadProgress={vm.videosUploadProgress}
                uploadSuccess={vm.videosUploadSuccess}
                uploadError={vm.videosUploadError}
                onPickPdf={vm.handlePickPdf}
                onRemove={vm.handleRemovePhoto}
              />
            </>
          )}

          {/* ══════════════ STEP 5 (engineer) — CATEGORY & COMPLETE ══════════════
              Notes & Summary (formerly its own step 5) removed — step 6
              renumbered to 5. Distinct from area_manager's Send-for-Approval/
              OTP flow below — engineers lock in category/sub-category
              (read-only if the dealer already set them at creation,
              otherwise pick from the live category-config) then Complete
              via the finish API. The post-finish Approval Status/Close
              Ticket view renders outside the read-only wrapper below, once
              isEngineerFinished. */}
          {vm.currentStep === 5 && vm.isEngineer && !isEngineerFinished && (
            <>
              <Text style={styles.stepSectionLabel}>STEP 5 — CATEGORY & APPROVAL</Text>

              <View style={styles.sectionCard}>
                {vm.categoryPresetAtCreation ? (
                  <>
                    <View style={styles.finishCatRow}>
                      <View style={[styles.finishCatBadgeCircle, { backgroundColor: finishedCategoryBg }]}>
                        <Text style={[styles.finishCatBadgeLetter, { color: finishedCategoryText }]}>{vm.selectedCategoryLetter}</Text>
                      </View>
                      <Text style={styles.finishCatTitle}>{finishedCategoryTitle}</Text>
                    </View>
                    {!!finishedCategoryDescription && (
                      <Text style={styles.finishCatDescription}>{finishedCategoryDescription}</Text>
                    )}
                    <View style={styles.finishCatDivider} />
                    <View style={styles.finishCatSubRow}>
                      <View style={[styles.finishCatSubPill, { backgroundColor: finishedCategoryBg }]}>
                        <Text style={[styles.finishCatSubPillText, { color: finishedCategoryText }]}>{vm.selectedSubCategory}</Text>
                      </View>
                      <Text style={styles.finishCatSetAtCreationText}>Category & sub-type set at creation</Text>
                    </View>
                  </>
                ) : vm.categoryOnlyPresetAtCreation ? (
                  // B/C/D/E: category was locked in by the dealer/AM at
                  // creation — only the sub-type is picked here, from the
                  // live category-config's own subCategories for that letter.
                  <>
                    <View style={styles.finishCatRow}>
                      <View style={[styles.finishCatBadgeCircle, { backgroundColor: finishedCategoryBg }]}>
                        <Text style={[styles.finishCatBadgeLetter, { color: finishedCategoryText }]}>{vm.selectedCategoryLetter}</Text>
                      </View>
                      <Text style={styles.finishCatTitle}>{finishedCategoryTitle}</Text>
                    </View>
                    {!!finishedCategoryDescription && (
                      <Text style={styles.finishCatDescription}>{finishedCategoryDescription}</Text>
                    )}
                    <View style={styles.subTypeHintRow}>
                      <Info size={16} color="#F26722" />
                      <Text style={styles.subTypeHintText}>Select the service sub-type below</Text>
                    </View>

                    <View style={{ marginTop: 16 }}>
                      <DropdownField
                        label="Service Type"
                        plainLabel
                        requiredAsterisk
                        value={vm.selectedSubCategory}
                        options={finishedCategoryMeta?.subCategories || []}
                        onSelect={(sub) => { vm.selectSubCategory(vm.selectedCategoryLetter, sub); vm.setBillingType(''); }}
                        placeholder="Select service type..."
                      />
                    </View>

                    {/* Only once the sub-type itself is Breakdown/BIS — every
                        other sub-type skips this second pick entirely.
                        Resets whenever Service Type changes (above), so a
                        stale Billing Type never survives a different pick. */}
                    {needsBillingType && (
                      <View style={{ marginTop: 16 }}>
                        <DropdownField
                          label="Billing Type"
                          plainLabel
                          requiredAsterisk
                          value={vm.billingType}
                          options={['Paid', 'Goodwill']}
                          onSelect={vm.setBillingType}
                          placeholder="Select billing type..."
                        />
                      </View>
                    )}

                    {needsWorkApproval && (
                      <View style={styles.workApprovalNoticeRow}>
                        <AlertTriangle size={16} color="#B45309" />
                        <Text style={styles.workApprovalNoticeText}>AM Review required → RSM Approval</Text>
                      </View>
                    )}

                    {vm.selectedParts.length > 0 && (
                      <View style={styles.partsApprovalNoticeRow}>
                        <AlertTriangle size={16} color="#2563EB" />
                        <Text style={styles.partsApprovalNoticeText}>Parts added — AM Part Approval required</Text>
                      </View>
                    )}

                    <Text style={styles.subTypeCommentLabel}>COMMENT (OPTIONAL)</Text>
                    <TextInput
                      style={styles.subTypeCommentInput}
                      placeholder="Add a note about this service..."
                      placeholderTextColor="#9CA3AF"
                      value={vm.completionComment}
                      onChangeText={vm.setCompletionComment}
                      // Content height varies with how many notice banners
                      // are showing above (workApproval/parts) — scrolling
                      // to the very end on focus, rather than relying on
                      // the KeyboardAvoidingView's fixed offset, is what
                      // keeps this field just above the keyboard regardless
                      // of how tall the card is that day.
                      onFocus={() => setTimeout(() => vm.scrollViewRef.current?.scrollToEnd({ animated: true }), 100)}
                    />
                  </>
                ) : vm.categoryConfigLoading ? (
                  <ActivityIndicator color="#F26722" style={{ marginVertical: 20 }} />
                ) : (
                  vm.categoryConfig.map((cat) => {
                    const isExpanded = vm.expandedCategory === cat.letter;
                    const isSelectedCat = vm.selectedCategoryLetter === cat.letter;
                    const highlight = isExpanded || isSelectedCat;
                    // Free Service is gated on the asset's own commissioning
                    // date/window state (GET /free-service-availability) —
                    // every other category is always selectable.
                    const isFreeService = cat.title === 'Free Service';
                    const isBlocked = isFreeService && !vm.freeServiceEligible;
                    return (
                      <View key={cat.letter} style={{ marginBottom: 12 }}>
                        <TouchableOpacity
                          style={[
                            styles.catHeaderRow,
                            highlight && { backgroundColor: cat.bg, borderColor: cat.border },
                            isBlocked && styles.catHeaderRowDisabled,
                          ]}
                          onPress={() => !isBlocked && vm.toggleCategory(cat.letter)}
                          disabled={isBlocked}
                        >
                          <View style={[styles.catLetterCircle, highlight && { backgroundColor: '#fff' }]}>
                            <Text style={[styles.catLetterText, highlight && { color: cat.text }]}>{cat.letter}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.catName, highlight && { color: cat.text }, isBlocked && styles.catNameDisabled]}>{cat.title}</Text>
                            {isBlocked && <Text style={styles.catBlockedReason}>{vm.freeServiceBlockedReason}</Text>}
                          </View>
                          {!isBlocked && (isExpanded ? <ChevronUp size={16} color={highlight ? cat.text : '#9CA3AF'} /> : <ChevronDown size={16} color={highlight ? cat.text : '#9CA3AF'} />)}
                        </TouchableOpacity>

                        {isExpanded && !isBlocked && (
                          <View style={styles.catSubList}>
                            {cat.subCategories.map((sub) => {
                              const isSubSelected = vm.selectedCategoryLetter === cat.letter && vm.selectedSubCategory === sub;
                              return (
                                <TouchableOpacity
                                  key={sub}
                                  style={[styles.catSubRow, isSubSelected && { backgroundColor: cat.bg, borderColor: cat.border }]}
                                  onPress={() => vm.selectSubCategory(cat.letter, sub)}
                                >
                                  <Text style={[styles.catSubText, isSubSelected && { color: cat.text, fontWeight: '700' }]}>{sub}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>

              {!!vm.finishError && <Text style={styles.sectionErrorText}>{vm.finishError}</Text>}

              <View style={styles.finishActionsRow}>
                <TouchableOpacity style={styles.backButton} onPress={vm.handleBack}>
                  <ChevronLeft size={24} color="#4B5563" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.finishCompleteButton, (!vm.selectedCategoryLetter || !vm.selectedSubCategory || (needsBillingType && !vm.billingType) || vm.finishing) && styles.buttonDisabled]}
                  onPress={vm.handleFinishService}
                  disabled={!vm.selectedCategoryLetter || !vm.selectedSubCategory || (needsBillingType && !vm.billingType) || vm.finishing}
                >
                  {vm.finishing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.finishCompleteButtonText}>Complete</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ══════════════ STEP 5 (area_manager) — CATEGORY, APPROVAL & COMPLETION ══════════════ */}
          {vm.currentStep === 5 && !vm.isEngineer && (
            <>
              <Text style={styles.stepSectionLabel}>STEP 5 — CATEGORY & APPROVAL</Text>

              {vm.workApprovalStatus === '' ? (
                <>
                  {/* Same 3-way branch the engineer's own Step 5 uses —
                      category+sub-type both preset at creation (read-only),
                      category only preset (this card + Service Type
                      dropdown + Billing Type), or neither (the original
                      free-pick accordion below, unchanged). Uses the local
                      SERVICE_CATEGORIES lookup rather than engineer's live
                      categoryConfig fetch, since that fetch is
                      engineer-only — area_manager's own accordion already
                      reads off the same local list. */}
                  <View style={styles.sectionCard}>
                    {vm.categoryPresetAtCreation ? (
                      <>
                        <View style={styles.finishCatRow}>
                          <View style={[styles.finishCatBadgeCircle, { backgroundColor: selectedCategoryColor.bg }]}>
                            <Text style={[styles.finishCatBadgeLetter, { color: selectedCategoryColor.text }]}>{vm.selectedCategoryLetter}</Text>
                          </View>
                          <Text style={styles.finishCatTitle}>{(selectedCategoryColor as any).name}</Text>
                        </View>
                        {!!(selectedCategoryColor as any).description && (
                          <Text style={styles.finishCatDescription}>{(selectedCategoryColor as any).description}</Text>
                        )}
                        <View style={styles.finishCatDivider} />
                        <View style={styles.finishCatSubRow}>
                          <View style={[styles.finishCatSubPill, { backgroundColor: selectedCategoryColor.bg }]}>
                            <Text style={[styles.finishCatSubPillText, { color: selectedCategoryColor.text }]}>{vm.selectedSubCategory}</Text>
                          </View>
                          <Text style={styles.finishCatSetAtCreationText}>Category & sub-type set at creation</Text>
                        </View>
                      </>
                    ) : vm.categoryOnlyPresetAtCreation ? (
                      <>
                        <View style={styles.finishCatRow}>
                          <View style={[styles.finishCatBadgeCircle, { backgroundColor: selectedCategoryColor.bg }]}>
                            <Text style={[styles.finishCatBadgeLetter, { color: selectedCategoryColor.text }]}>{vm.selectedCategoryLetter}</Text>
                          </View>
                          <Text style={styles.finishCatTitle}>{(selectedCategoryColor as any).name}</Text>
                        </View>
                        {!!(selectedCategoryColor as any).description && (
                          <Text style={styles.finishCatDescription}>{(selectedCategoryColor as any).description}</Text>
                        )}
                        <View style={styles.subTypeHintRow}>
                          <Info size={16} color="#F26722" />
                          <Text style={styles.subTypeHintText}>Select the service sub-type below</Text>
                        </View>

                        <View style={{ marginTop: 16 }}>
                          <DropdownField
                            label="Service Type"
                            plainLabel
                            requiredAsterisk
                            value={vm.selectedSubCategory}
                            options={(selectedCategoryColor as any).subCategories || []}
                            onSelect={(sub) => { vm.selectSubCategory(vm.selectedCategoryLetter, sub); vm.setBillingType(''); }}
                            placeholder="Select service type..."
                          />
                        </View>

                        {needsBillingTypeAM && (
                          <View style={{ marginTop: 16 }}>
                            <DropdownField
                              label="Billing Type"
                              plainLabel
                              requiredAsterisk
                              value={vm.billingType}
                              options={['Paid', 'Goodwill']}
                              onSelect={vm.setBillingType}
                              placeholder="Select billing type..."
                            />
                          </View>
                        )}

                        {needsWorkApproval && (
                          <View style={styles.workApprovalNoticeRow}>
                            <AlertTriangle size={16} color="#B45309" />
                            <Text style={styles.workApprovalNoticeText}>AM Review required → RSM Approval</Text>
                          </View>
                        )}

                        {vm.selectedParts.length > 0 && (
                          <View style={styles.partsApprovalNoticeRow}>
                            <AlertTriangle size={16} color="#2563EB" />
                            <Text style={styles.partsApprovalNoticeText}>Parts added — AM Part Approval required</Text>
                          </View>
                        )}

                        <Text style={styles.subTypeCommentLabel}>COMMENT (OPTIONAL)</Text>
                        <TextInput
                          style={styles.subTypeCommentInput}
                          placeholder="Add a note about this service..."
                          placeholderTextColor="#9CA3AF"
                          value={vm.completionComment}
                          onChangeText={vm.setCompletionComment}
                        />
                      </>
                    ) : (
                      <>
                        {SERVICE_CATEGORIES.map((cat) => {
                          const isExpanded = vm.expandedCategory === cat.letter;
                          const isSelectedCat = vm.selectedCategoryLetter === cat.letter;
                          const highlight = isExpanded || isSelectedCat;
                          return (
                            <View key={cat.letter} style={{ marginBottom: 12 }}>
                              <TouchableOpacity
                                style={[styles.catHeaderRow, highlight && { backgroundColor: cat.bg, borderColor: cat.border }]}
                                onPress={() => vm.toggleCategory(cat.letter)}
                              >
                                <View style={[styles.catLetterCircle, highlight && { backgroundColor: '#fff' }]}>
                                  <Text style={[styles.catLetterText, highlight && { color: cat.text }]}>{cat.letter}</Text>
                                </View>
                                <Text style={[styles.catName, highlight && { color: cat.text }]}>{cat.name}</Text>
                                {isExpanded ? <ChevronUp size={16} color={highlight ? cat.text : '#9CA3AF'} /> : <ChevronDown size={16} color={highlight ? cat.text : '#9CA3AF'} />}
                              </TouchableOpacity>

                              {isExpanded && (
                                <View style={styles.catSubList}>
                                  {cat.subCategories.map((sub) => {
                                    const isSubSelected = vm.selectedCategoryLetter === cat.letter && vm.selectedSubCategory === sub;
                                    return (
                                      <TouchableOpacity
                                        key={sub}
                                        style={[styles.catSubRow, isSubSelected && { backgroundColor: cat.bg, borderColor: cat.border }]}
                                        onPress={() => { vm.selectSubCategory(cat.letter, sub); vm.setBillingType(''); }}
                                      >
                                        <Text style={[styles.catSubText, isSubSelected && { color: cat.text, fontWeight: '700' }]}>{sub}</Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {needsBillingTypeAM && (
                          <View style={{ marginTop: 4, marginBottom: 12 }}>
                            <DropdownField
                              label="Billing Type"
                              plainLabel
                              requiredAsterisk
                              value={vm.billingType}
                              options={['Paid', 'Goodwill']}
                              onSelect={vm.setBillingType}
                              placeholder="Select billing type..."
                            />
                          </View>
                        )}
                      </>
                    )}

                    {vm.step6Error ? <Text style={styles.sectionErrorText}>{vm.step6Error}</Text> : null}
                  </View>

                  <View style={styles.finishActionsRow}>
                    <TouchableOpacity style={styles.backButton} onPress={vm.handleBack}>
                      <ChevronLeft size={24} color="#4B5563" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.completeTaskButton, { flex: 1, marginTop: 0 }, (!vm.selectedSubCategory || (needsBillingTypeAM && !vm.billingType) || vm.step6Saving) && styles.buttonDisabled]}
                      onPress={vm.handleSendForApproval}
                      disabled={!vm.selectedSubCategory || (needsBillingTypeAM && !vm.billingType) || vm.step6Saving}
                    >
                      {vm.step6Saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.completeTaskButtonText}>Complete Task</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <CustomerSignOffCard vm={vm} />

                  {/* Approval Status — same finishCatRow badge style as the
                      engineer's own version, plus a pending banner for
                      whichever stage (AM/RSM) is still outstanding. */}
                  <View style={styles.sectionCard}>
                    <Text style={styles.approvalStatusLabel}>APPROVAL STATUS</Text>
                    <View style={styles.finishCatRow}>
                      <View style={[styles.finishCatBadgeCircle, { backgroundColor: selectedCategoryColor.bg }]}>
                        <Text style={[styles.finishCatBadgeLetter, { color: selectedCategoryColor.text }]}>{vm.selectedCategoryLetter}</Text>
                      </View>
                      <Text style={styles.finishCatTitle}>{vm.selectedSubCategory}</Text>
                    </View>

                    {(vm.workApprovalStatus === 'PENDING_AM' || vm.workApprovalStatus === 'PENDING_RSM') && (
                      <View style={styles.partsApprovalBanner}>
                        <View style={styles.partsApprovalIconChip}>
                          <Clock size={16} color="#B45309" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partsApprovalTitle}>Work Approval</Text>
                          <Text style={styles.partsApprovalSubtitle}>
                            {vm.workApprovalStatus === 'PENDING_AM' ? 'Awaiting Area Manager review' : 'AM approved — awaiting RSM confirmation'}
                          </Text>
                        </View>
                        <View style={styles.pendingTag}>
                          <Text style={styles.pendingTagText}>{vm.workApprovalStatus === 'PENDING_AM' ? 'PENDING AM' : 'PENDING RSM'}</Text>
                        </View>
                      </View>
                    )}

                    {/* Reads the real task.workApproval, not the simplified
                        workApprovalStatus gate above — that one defaults to
                        'CONFIRMED' for categories that never needed approval
                        at all, which shouldn't claim "RSM confirmed" when
                        RSM was never involved. */}
                    {vm.task?.workApproval?.status === 'CONFIRMED' && (
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

                    {/* A genuinely separate gate from Work Approval above —
                        per the backend dev guide, parts get their own AM
                        review independent of whether the category needs
                        work approval at all (e.g. Category F never does,
                        but can still have a part sitting PENDING). Reads
                        task.partApproval directly rather than being folded
                        into the Work Approval banner. */}
                    {amPartApproval?.status === 'PENDING' && (
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
                    {amPartApproval && amPartApproval.status !== 'PENDING' && (
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

                  {/* Close Ticket's real 3-gate rule per the backend dev
                      guide: OTP verified (CLIENT_APPROVED) AND part
                      approval not still PENDING AND work approval
                      CONFIRMED (or never required). */}
                  <TouchableOpacity
                    style={[styles.otpVerifyButtonV2, (!canCloseTicketAM || vm.closingTicket) && styles.buttonDisabled]}
                    onPress={vm.handleCloseTicket}
                    disabled={!canCloseTicketAM || vm.closingTicket}
                  >
                    {vm.closingTicket ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpVerifyButtonV2Text}>Close Ticket</Text>}
                  </TouchableOpacity>
                  {!canCloseTicketAM && (
                    <Text style={styles.waitingApprovalText}>
                      {!otpVerifiedForClose ? 'Collect customer OTP and wait for approvals' : 'Waiting for approvals before closing'}
                    </Text>
                  )}
                  {!!vm.closeTicketError && <Text style={styles.sectionErrorText}>{vm.closeTicketError}</Text>}

                  {/* What was actually submitted for approval — collapsed
                      by default, same tap-to-expand pattern as Step 1's
                      sections (see summaryExpanded/toggleSummarySection). */}
                  <View style={[styles.sectionCard, { marginTop: 16 }]}>
                    <GroupHeader
                      title={`Fault Codes (${vm.selectedComplaintCodes.length})`}
                      saved
                      onPress={() => toggleSummarySection('amFaultCodes')}
                      expanded={!!summaryExpanded['amFaultCodes']}
                    />
                    {!!summaryExpanded['amFaultCodes'] && (
                      <SubmittedFaultCodesSection faultCodes={vm.selectedComplaintCodes} />
                    )}
                  </View>
                  <View style={styles.sectionCard}>
                    <GroupHeader
                      title={`Parts Used (${vm.selectedParts.length})`}
                      saved
                      onPress={() => toggleSummarySection('amParts')}
                      expanded={!!summaryExpanded['amParts']}
                    />
                    {!!summaryExpanded['amParts'] && (
                      <SubmittedPartsSection parts={vm.selectedParts} awaitingAmReview={amPartApproval?.status === 'PENDING'} />
                    )}
                  </View>
                  <View style={styles.sectionCard}>
                    <GroupHeader
                      title="Notes"
                      saved
                      onPress={() => toggleSummarySection('amNotes')}
                      expanded={!!summaryExpanded['amNotes']}
                    />
                    {!!summaryExpanded['amNotes'] && (
                      <SubmittedNotesSection notes={vm.notes} />
                    )}
                  </View>
                </>
              )}
            </>
          )}

          </View>

          {/* Engineer's post-finish view — stays interactive for the same
              reason as the block above (Close Ticket needs to work even
              though Step 5's category card above is now read-only). */}
          {vm.currentStep === 5 && vm.isEngineer && isEngineerFinished && (
            <>
              <CustomerSignOffCard vm={vm} />

              <View style={styles.sectionCard}>
                <Text style={styles.approvalStatusLabel}>APPROVAL STATUS</Text>
                <View style={styles.finishCatRow}>
                  <View style={[styles.finishCatBadgeCircle, { backgroundColor: finishedCategoryBg }]}>
                    <Text style={[styles.finishCatBadgeLetter, { color: finishedCategoryText }]}>{vm.selectedCategoryLetter}</Text>
                  </View>
                  <Text style={styles.finishCatTitle}>{vm.selectedSubCategory}</Text>
                </View>

                {/* This is genuinely Work Approval (workApproval, AM then
                    RSM) — previously mislabeled "Parts Approval" here even
                    though it reads the same field AM's own version above
                    correctly calls "Work Approval". */}
                {!partsApprovalConfirmed && (
                  <View style={styles.partsApprovalBanner}>
                    <View style={styles.partsApprovalIconChip}>
                      <Clock size={16} color="#B45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partsApprovalTitle}>Work Approval</Text>
                      <Text style={styles.partsApprovalSubtitle}>{partsApprovalSubtitle}</Text>
                    </View>
                    <View style={styles.pendingTag}>
                      <Text style={styles.pendingTagText}>{engineerWorkApproval?.status === 'PENDING_RSM' ? 'PENDING RSM' : 'PENDING AM'}</Text>
                    </View>
                  </View>
                )}

                {/* Only when a real workApproval actually reached
                    CONFIRMED — partsApprovalConfirmed alone is also true
                    for categories that never needed approval in the first
                    place (no workApproval object at all), which shouldn't
                    claim "RSM confirmed" when RSM was never involved. */}
                {engineerWorkApproval?.status === 'CONFIRMED' && (
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

                {/* A genuinely separate gate from Work Approval above — per
                    the backend dev guide, parts get their own AM review
                    independent of whether the category needs work approval
                    at all (e.g. Category F never does, but can still have a
                    part sitting PENDING). Reads task.partApproval directly. */}
                {enginePartApproval?.status === 'PENDING' && (
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
                {enginePartApproval && enginePartApproval.status !== 'PENDING' && (
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

              {/* Close Ticket's real 3-gate rule per the backend dev guide:
                  OTP verified (CLIENT_APPROVED) AND part approval not still
                  PENDING AND work approval CONFIRMED (or never required). */}
              <TouchableOpacity
                style={[styles.otpVerifyButtonV2, (!canCloseTicketEngineer || vm.closingTicket) && styles.buttonDisabled]}
                onPress={vm.handleCloseTicket}
                disabled={!canCloseTicketEngineer || vm.closingTicket}
              >
                {vm.closingTicket ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpVerifyButtonV2Text}>Close Ticket</Text>}
              </TouchableOpacity>
              {!canCloseTicketEngineer && (
                <Text style={styles.waitingApprovalText}>
                  {!otpVerifiedForClose ? 'Collect customer OTP and wait for approvals' : 'Waiting for approvals before closing'}
                </Text>
              )}
              {!!vm.closeTicketError && <Text style={styles.sectionErrorText}>{vm.closeTicketError}</Text>}

              {/* Same "what was actually submitted" pattern as the
                  area_manager's own Step 5 above — collapsed by default,
                  tap the header to expand. */}
              <View style={[styles.sectionCard, { marginTop: 16 }]}>
                <GroupHeader
                  title={`Fault Codes (${vm.selectedComplaintCodes.length})`}
                  saved
                  onPress={() => toggleSummarySection('engFaultCodes')}
                  expanded={!!summaryExpanded['engFaultCodes']}
                />
                {!!summaryExpanded['engFaultCodes'] && (
                  <SubmittedFaultCodesSection faultCodes={vm.selectedComplaintCodes} />
                )}
              </View>
              <View style={styles.sectionCard}>
                <GroupHeader
                  title={`Parts Used (${vm.selectedParts.length})`}
                  saved
                  onPress={() => toggleSummarySection('engParts')}
                  expanded={!!summaryExpanded['engParts']}
                />
                {!!summaryExpanded['engParts'] && (
                  <SubmittedPartsSection parts={vm.selectedParts} awaitingAmReview={enginePartApproval?.status === 'PENDING'} />
                )}
              </View>
              <View style={styles.sectionCard}>
                <GroupHeader
                  title="Notes"
                  saved
                  onPress={() => toggleSummarySection('engNotes')}
                  expanded={!!summaryExpanded['engNotes']}
                />
                {!!summaryExpanded['engNotes'] && (
                  <SubmittedNotesSection notes={vm.notes} />
                )}
              </View>

              <TouchableOpacity style={[styles.finishBackButton, { marginTop: 16 }]} onPress={vm.handleBack}>
                <ArrowLeft size={16} color="#4B5563" />
                <Text style={styles.finishBackButtonText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {/* One combined sheet for the merged Photos & Video card — a
              single gallery row handles both photos and videos
              (handleChoosePhotos accepts either media type in one picker
              launch), alongside the two camera actions. */}
          <Modal visible={vm.photoOptionsVisible} transparent animationType="fade" onRequestClose={() => vm.setPhotoOptionsVisible(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => vm.setPhotoOptionsVisible(false)}>
              <View style={[styles.optionsSheet, { paddingBottom: sheetPaddingBottom }]}>
                <Text style={styles.optionsTitle}>Add Photo or Video</Text>
                <TouchableOpacity style={styles.optionRow} onPress={vm.handleTakePhoto}><Text style={styles.optionText}>📷  Take Photo</Text></TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity style={styles.optionRow} onPress={vm.handleRecordVideo}><Text style={styles.optionText}>🎥  Record Video</Text></TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity style={styles.optionRow} onPress={vm.handleChoosePhotos}><Text style={styles.optionText}>🖼️  Choose Photo / Video from Gallery</Text></TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity style={styles.optionRow} onPress={() => vm.setPhotoOptionsVisible(false)}><Text style={styles.optionText}>Cancel</Text></TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        {/* Labeled Back/Next bar, alongside the stepper row's flanking
            arrows above — same handlers either way, just a second, more
            discoverable way to move between steps. Steps 1-4 only: step 5's
            own actions (category select + Send for Approval, or the status/
            OTP flow) are already inline in that step's content, so a
            duplicate Next button here would be redundant. Scrolls away with
            the rest of the content instead of staying pinned at the
            screen's bottom edge. */}
        {vm.currentStep !== 5 && (
          <View style={styles.fixedBottomActions}>
            <TouchableOpacity
              style={[styles.backButton, vm.currentStep === 1 && styles.buttonDisabled]}
              onPress={vm.handleBack}
              disabled={vm.currentStep === 1}
            >
              <ChevronLeft size={24} color="#4B5563" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextButton, vm.currentStep === 3 && (vm.photosUploading || vm.videosUploading) && styles.buttonDisabled]}
              onPress={vm.currentStep === 3 ? handleNextFromMediaStep : vm.handleNext}
              disabled={vm.currentStep === 3 && (vm.photosUploading || vm.videosUploading)}
            >
              {vm.currentStep === 3 && (vm.photosUploading || vm.videosUploading) ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ChevronRight size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  buttonDisabled: { opacity: 0.6 },
  readOnlyDim: { opacity: 0.6 },

  fixedBottomActions: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  // Circular chevron-only controls (not a full-width pill) — the back
  // circle stays pale/neutral, the next circle is filled solid so it
  // reads as the primary action, matching the reference design.
  backButton: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  nextButton: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginTop: 8, marginBottom: 12,
  },
  headerButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '400', color: '#000000', textTransform: 'uppercase' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  // Complaint Codes/Parts Used — matches taskForm.tsx's plain white pill for
  // these same two sections, instead of the purple GroupHeader uses by
  // default everywhere else here.
  sectionPillHeaderWhite: { backgroundColor: '#FFFFFF' },
  checkSaveButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end', marginTop: 16,
  },
  checkSaveButtonDone: { backgroundColor: '#33A86B' },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 12 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginTop: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  fieldLabelStatic: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.3 },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937', backgroundColor: '#fff',
  },
  feedbackTextArea: { minHeight: 100, textAlignVertical: 'top' },

  toggleRow: { flexDirection: 'row' },
  toggleOption: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginRight: 8, backgroundColor: '#fff',
  },
  toggleOptionActive: { backgroundColor: '#1E1951', borderColor: '#1E1951' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#fff' },

  sectionErrorText: { color: '#DC2626', fontSize: 12, fontWeight: '500', marginTop: 10 },

  readingsHeaderPill: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#DBEAFE',
    borderRadius: 100,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  readingsHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#1E1951', letterSpacing: 0.4 },
  readingsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readingsEditButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  readingsEditButtonText: { fontSize: 13, fontWeight: '700', color: '#374151' },

  readingsDisplayGrid: { marginTop: 4 },
  readingsDisplayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 12 },
  readingsDisplayHalf: { width: '48%' },
  readingsDisplayLabel: { fontSize: 14, fontWeight: '500', color: '#9CA3AF', marginBottom: 6 },
  readingsDisplayValue: { fontSize: 18, fontWeight: '700', color: '#000000' },
  readingsStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  readingsStatusPillOk: { backgroundColor: '#DCFCE7' },
  readingsStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' },
  readingsStatusDotOk: { backgroundColor: '#16A34A' },
  readingsStatusText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  readingsStatusTextOk: { color: '#15803D' },

  okNotOkRow: { flexDirection: 'row' },
  okButton: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginRight: 8, backgroundColor: '#fff',
  },
  okButtonActive: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  okButtonText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  okButtonTextActive: { color: '#15803D' },
  notOkButton: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff',
  },
  notOkButtonActive: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  notOkButtonText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  notOkButtonTextActive: { color: '#DC2626' },

  addCodeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#DEDEDE', borderRadius: 24,
    backgroundColor: '#FFFFFF',
    height: 56, paddingHorizontal: 24, marginTop: 8, marginBottom: 16,
    overflow: 'hidden',
  },
  addCodeButtonText: { color: '#0F0F0F', fontWeight: '600', fontSize: 18 },

  stepSectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: 12, marginTop: 4 },

  // Category selection (Step 5)
  catHeaderRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: '#fff', gap: 12,
  },
  catLetterCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  catLetterText: { fontWeight: '700', fontSize: 14, color: '#374151' },
  catName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1E1951' },
  catHeaderRowDisabled: { backgroundColor: '#F9FAFB', opacity: 0.7 },
  catNameDisabled: { color: '#9CA3AF' },
  catBlockedReason: { fontSize: 12, fontWeight: '600', color: '#F04438', marginTop: 2 },
  catSubList: { marginTop: 8, gap: 8, paddingLeft: 8 },
  catSubRow: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#F9FAFB', marginBottom: 8,
  },
  catSubText: { fontSize: 14, color: '#475467', fontWeight: '500' },

  // The read-only "category already set" card — shared by both engineer's
  // and area_manager's Step 5 branches.
  finishCatRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  finishCatBadgeCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  finishCatBadgeLetter: { fontSize: 16, fontWeight: '700' },
  finishCatTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1F2937' },
  finishCatDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginTop: 10 },
  finishCatDivider: { height: 1, backgroundColor: '#E5E7EB', marginTop: 16, marginBottom: 14 },
  finishCatSubRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  finishCatSubPill: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  finishCatSubPillText: { fontSize: 14, fontWeight: '700' },
  finishCatSetAtCreationText: { fontSize: 12, color: '#9CA3AF', flexShrink: 1 },

  // Step 5 — category locked at creation, sub-type picked here (both roles).
  subTypeHintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 14, marginBottom: 4,
  },
  subTypeHintText: { fontSize: 13, fontWeight: '600', color: '#F26722' },
  workApprovalNoticeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF9C3', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 16,
  },
  workApprovalNoticeText: { fontSize: 13, fontWeight: '600', color: '#B45309', flexShrink: 1 },
  partsApprovalNoticeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, marginTop: 16,
  },
  partsApprovalNoticeText: { fontSize: 13, fontWeight: '600', color: '#2563EB', flexShrink: 1 },
  subTypeCommentLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.3, marginTop: 18, marginBottom: 8 },
  subTypeCommentInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: '#1F2937', backgroundColor: '#fff',
  },
  finishActionsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  finishBackButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    flex: 1,
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 100,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  finishBackButtonText: { fontSize: 15, fontWeight: '700', color: '#4B5563' },
  finishCompleteButton: {
    flex: 1.4,
    backgroundColor: '#1E1951',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishCompleteButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Engineer's post-finish Approval Status card.
  approvalStatusLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 14 },

  otpInlineCard: { backgroundColor: '#F3F4F6', borderRadius: 20, padding: 16 },
  otpInlineButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // OTP-sent state — "OTP sent" check + Resend link row.
  otpSentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  otpSentLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpSentCheck: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  otpSentText: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  otpResendLinkV2: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  // Code-reveal box — stays visible until Verify succeeds or Resend
  // replaces the code, same as the commissioning form's own OTP step.
  otpRevealBox: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginTop: 14 },
  otpRevealLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.4 },
  otpRevealCode: { fontSize: 24, fontWeight: '700', color: '#1F2937', letterSpacing: 6, marginTop: 8 },

  otpDividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  otpDividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  otpDividerText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.4 },

  otpVerifyCompleteButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#4AC686',
    borderRadius: 100,
    paddingVertical: 15,
    marginTop: 18,
  },
  otpVerifyCompleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  otpVerifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  otpVerifiedBannerText: { fontSize: 15, fontWeight: '700', color: '#15803D' },

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
  waitingApprovalText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },

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

  // Step 5's post-submission "what did I send for approval" cards.
  emptyApprovalText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  approvalFaultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  approvalCodeBadge: { backgroundColor: '#FFEDD5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  approvalCodeBadgeText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  approvalFaultTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1F2937' },
  approvalPartName: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 2 },
  approvalNotesText: { fontSize: 13, color: '#374151', lineHeight: 19 },

  // Pending Customer Sign-off banner — Step 5's post-Complete orange call-
  // out, shown until OTP is verified.
  pendingSignOffBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#E76124',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  pendingSignOffIconChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingSignOffTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  pendingSignOffSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  // Green "Completed / waiting for approvals" banner — same shape as
  // pendingSignOffBanner, takes over its slot once OTP is verified.
  completedWaitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#16A34A',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  completedWaitingIconChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  completedWaitingTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  completedWaitingSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  // "Send OTP to Customer" — the same pill shape as otpInlineButton, just
  // navy instead of orange to match the reference design's first-step CTA.
  otpSendButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: '#1E1951',
    borderRadius: 100,
    paddingVertical: 15,
  },

  // Plain-label "what was submitted" sections (Fault Codes/Parts Used/
  // Notes) — the body content sits inside a collapsible GroupHeader card
  // now (see summaryExpanded), these styles are just the cards themselves.
  submittedSection: { marginTop: 16 },
  submittedCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  submittedCardSubtitle: { fontSize: 12, color: '#9CA3AF', marginBottom: 10 },
  submittedDetailBox: { borderRadius: 12, padding: 10, marginTop: 8 },
  submittedDetailBoxObservation: { backgroundColor: '#FEF9C3' },
  submittedDetailBoxRootCause: { backgroundColor: '#FEE2E2' },
  submittedDetailBoxAction: { backgroundColor: '#DCFCE7' },
  // Neutral gray variant for whichever of the three fields wasn't filled in
  // — shown always (not hidden) so the card's shape stays consistent
  // whether or not the engineer recorded that particular field.
  submittedDetailBoxEmpty: { backgroundColor: '#F3F4F6' },
  submittedDetailLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  submittedDetailLabelObservation: { color: '#A16207' },
  submittedDetailLabelRootCause: { color: '#B91C1C' },
  submittedDetailLabelAction: { color: '#15803D' },
  submittedDetailLabelEmpty: { color: '#9CA3AF' },
  submittedDetailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  submittedDetailValueEmpty: { fontSize: 13, fontWeight: '500', fontStyle: 'italic', color: '#9CA3AF' },

  submittedPartTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  submittedPartTag: { backgroundColor: '#FFEDD5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  submittedPartTagText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  submittedPartReviewTag: { backgroundColor: '#FEF9C3', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  submittedPartReviewTagText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  submittedPartLock: { marginLeft: 'auto' },
  submittedPartQtyRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  submittedPartQtyPill: { backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 },
  submittedPartQtyPillText: { fontSize: 12, fontWeight: '700', color: '#1F2937' },

  completeTaskButton: {
    backgroundColor: '#4AC686', borderRadius: 24,
    borderWidth: 1, borderColor: '#DEDEDE',
    height: 56, justifyContent: 'center', alignItems: 'center',
    marginTop: 20,
  },
  completeTaskButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 18, textTransform: 'uppercase' },

  otpBoxRowV2: { flexDirection: 'row', gap: 12, marginTop: 16 },
  otpBoxV2: {
    width: 60, height: 60, borderRadius: 12,
    borderWidth: 1, borderColor: '#DBDBDB',
    backgroundColor: '#F8F8F8',
    fontSize: 20, fontWeight: '700', color: '#000000',
  },
  otpVerifyButtonV2: {
    width: '100%', height: 56, borderRadius: 24,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24,
  },
  otpVerifyButtonV2Text: { color: '#FFFFFF', fontWeight: '600', fontSize: 18, textTransform: 'uppercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16,
  },
  optionsTitle: { fontSize: 16, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 10 },
  optionRow: { paddingVertical: 14 },
  optionText: { fontSize: 16, fontWeight: '500', color: '#222' },
  optionDivider: { height: 1, backgroundColor: '#eee' },
});
