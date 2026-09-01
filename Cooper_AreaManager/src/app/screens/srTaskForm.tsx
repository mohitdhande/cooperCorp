import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, RefreshControl, useWindowDimensions } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { AlertTriangle, Bell, CheckCheck, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Info, Pencil } from 'lucide-react-native';
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
import { MediaUploadOverlay } from '../../_components/shared/MediaUploadOverlay';
import { PendingSyncBanner } from '../../_components/shared/PendingSyncBanner';
import { CompleteTaskButton } from '../../_components/shared/CompleteTaskButton';
import { AddItemButton } from '../../_components/shared/AddItemButton';
import { SuggestionCommentCard } from '../../_components/shared/SuggestionCommentCard';
import { SectionSaveButton } from '../../_components/shared/SectionSaveButton';
import { useFieldFocusChain } from '../../utils/useFieldFocusChain';
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

  // Every real API call this screen can trigger fades the whole screen
  // with the loading video rather than just the one button's own small
  // spinner — same treatment as the commissioning form. Complaint codes
  // (step2Saving) and parts (step3Saving) are the deliberate exception:
  // each card already has its own save button with its own spinner
  // (isSaving), so saving one card shouldn't lock the whole screen and
  // make it look like every code/part is being saved together. Photo/
  // video/PDF upload no longer blocks this generic overlay either — it has
  // its own dedicated MediaUploadOverlay (see below) with real progress and
  // a Cancel button, mounted whenever vm.mediaUploadQueue is active.
  const isBusy = (
    vm.initialDataLoading ||
    vm.step5Saving || vm.step6Saving ||
    vm.faultCodesLoading || vm.partsLoading || vm.finishing ||
    Object.values(vm.sectionSaving).some(Boolean)
  );

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

  // Once COMPLETED, this screen is done — OTP sign-off, Approval Status,
  // and Close Ticket all moved to srTaskReport.tsx (handleFinishService
  // navigates straight there on success). Kept here only to keep the form
  // read-only if this screen is ever somehow reached with an already-
  // COMPLETED task (e.g. a stale nav param), rather than as a live view.
  const isEngineerFinished = vm.isEngineer && vm.task?.status === 'COMPLETED';

  // Step 1's five sections auto-minimize right after a successful save,
  // same pattern as the commissioning form — this tracks only the manual
  // override once a user taps a minimized header to look at/edit it again.
  const [sectionReopened, setSectionReopened] = useState<Record<string, boolean>>({});
  const isSectionExpanded = (key: string) => !vm.sectionSuccess[key] || !!sectionReopened[key];

  const toggleSectionReopen = (key: string) => setSectionReopened((prev) => ({ ...prev, [key]: !prev[key] }));

  // Genset Identification / Alternator & Panel fields are asset-level, not
  // task-level — every task type (pre-commissioning, commissioning,
  // re-commissioning, revalidation, service) reads/writes the exact same
  // asset record, so whatever an earlier task already filled in shows up
  // here automatically. This locks each field that already had a value in
  // the last successful fetch (vm.assetDetail — the raw fetched object,
  // not the live editable state, so typing into a field that was empty
  // never locks it out mid-edit) so it can't be accidentally overwritten;
  // fields still blank stay editable for this task to fill in. Keyed by
  // the asset's own backend field names, not the local state names.
  const isAssetFieldLocked = (key: string) => !!vm.assetDetail?.[key];

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
      {isBusy && <LoadingOverlay />}
      {/* Both mounted here so whichever one is actually running (site
          photos vs. the Running Hours photo) shows its own overlay. */}
      <MediaUploadOverlay
        visible={vm.mediaUploadQueue.state.visible}
        items={vm.mediaUploadQueue.state.items}
        onCancelItem={vm.mediaUploadQueue.cancelItem}
        onCancelAll={vm.mediaUploadQueue.cancel}
        onDismiss={vm.mediaUploadQueue.dismiss}
      />
      <MediaUploadOverlay
        visible={vm.runningHoursUploadQueue.state.visible}
        items={vm.runningHoursUploadQueue.state.items}
        onCancelItem={vm.runningHoursUploadQueue.cancelItem}
        onCancelAll={vm.runningHoursUploadQueue.cancel}
        onDismiss={vm.runningHoursUploadQueue.dismiss}
      />

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
          {/* App bar is now the ScrollView's own first child (was a fixed
              sibling above it) — the whole screen, header included, scrolls
              as one unit, same fix already applied to newJob.tsx/
              newServiceJob.tsx. paddingHorizontal: 0 override — scrollArea's
              own style already insets the ScrollView by the same 20px this
              header used, so keeping its own would double it up. */}
          <View style={[styles.header, { paddingHorizontal: 0 }]}>
            <TouchableOpacity style={styles.headerButton} onPress={vm.handleCancel}>
              <ChevronLeft size={22} color="#979797" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SERVICE</Text>
            <View style={styles.headerButton}>
              <Bell size={22} color="#979797" />
            </View>
          </View>

          <StepperRow
            steps={SR_STEP_SEQUENCE}
            currentStep={vm.currentStep}
            onSelectStep={vm.setCurrentStep}
          />

          {/* Once the task is fully completed (OTP verified), every step's
              fields become read-only — the stepper above stays interactive
              so the user can still page back through and review what was
              submitted, they just can't change anything. */}
          <View pointerEvents={vm.task?.status === 'COMPLETED' ? 'none' : 'auto'} style={vm.task?.status === 'COMPLETED' ? styles.readOnlyDim : undefined}>

          {/* Step 1 and Step 6 only — reverted from showing on every step,
              then Step 6 (Category & Complete, was Step 5 before Load
              Unbalance/Engine Parameters/Electrical Readings got their own
              step) added back since the post-Complete/Send-for-Approval
              view (Customer Sign-off/Approval Status) needs the same
              task-identity context Step 1 has. */}
          {(vm.currentStep === 1 || vm.currentStep === 6) && (
            <TaskSummaryHeader task={vm.task} asset={vm.assetDetail} />
          )}

          <PendingSyncBanner />

          {/* ══════════════ STEP 1 — ASSET INFORMATION ══════════════ */}
          {vm.currentStep === 1 && (
            <>
              {/* The landing step — shows loading feedback on whichever
                  step the user actually lands on first when reopening a
                  task, not one buried a few steps ahead. */}
              {vm.initialDataLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#F26722" />
                  <Text style={styles.loadingText}>Loading task data...</Text>
                </View>
              )}

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
                          style={[styles.fieldInput, isAssetFieldLocked('gensetModel') && styles.fieldInputReadOnly]} value={vm.gensetModel} onChangeText={vm.setGensetModel}
                          editable={!isAssetFieldLocked('gensetModel')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('gensetSrNumber')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Genset SR Number</Text>
                        <TextInput
                          ref={register('gensetSrNumber')}
                          style={[styles.fieldInput, isAssetFieldLocked('gensetNumber') && styles.fieldInputReadOnly]} value={vm.gensetSrNumber} onChangeText={vm.setGensetSrNumber}
                          editable={!isAssetFieldLocked('gensetNumber')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineModel')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Engine Model</Text>
                        <TextInput
                          ref={register('engineModel')}
                          style={[styles.fieldInput, isAssetFieldLocked('engineModel') && styles.fieldInputReadOnly]} value={vm.engineModel} onChangeText={vm.setEngineModel}
                          editable={!isAssetFieldLocked('engineModel')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineNumber')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Engine SR Number</Text>
                        <TextInput
                          ref={register('engineNumber')}
                          style={[styles.fieldInput, isAssetFieldLocked('engineNumber') && styles.fieldInputReadOnly]} value={vm.engineNumber} onChangeText={vm.setEngineNumber}
                          editable={!isAssetFieldLocked('engineNumber')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineKw')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Engine KW</Text>
                        <TextInput
                          ref={register('engineKw')}
                          style={[styles.fieldInput, isAssetFieldLocked('kw') && styles.fieldInputReadOnly]} value={vm.engineKw} onChangeText={vm.setEngineKw} keyboardType="numeric"
                          editable={!isAssetFieldLocked('kw')}
                          returnKeyType="done"
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Engine Type" value={vm.engineType} options={vm.ENGINE_TYPE_OPTIONS} onSelect={vm.setEngineType} disabled={isAssetFieldLocked('engineType')} />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Engine Family" value={vm.engineFamily} options={vm.ENGINE_FAMILY_OPTIONS} onSelect={vm.setEngineFamily} disabled={isAssetFieldLocked('engineFamily')} />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Fuel Type" value={vm.fuelType} options={vm.FUEL_TYPE_OPTIONS} onSelect={vm.setFuelType} disabled={isAssetFieldLocked('fuelType')} />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Application" value={vm.application} options={vm.APPLICATION_OPTIONS} onSelect={vm.setApplication} disabled={isAssetFieldLocked('applicationMaterial')} />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="CPCB Norm" value={vm.cpcbNorm} options={vm.CPCB_NORM_OPTIONS} onSelect={vm.setCpcbNorm} disabled={isAssetFieldLocked('cpcb')} />
                      </View>
                    </View>
                    {/* ATS S/N — moved here from Alternator & Panel. */}
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>ATS S/N</Text>
                        <TextInput
                          ref={register('atsSn')}
                          style={[styles.fieldInput, isAssetFieldLocked('atsSerialNumber') && styles.fieldInputReadOnly]} value={vm.atsSn} onChangeText={vm.setAtsSn}
                          editable={!isAssetFieldLocked('atsSerialNumber')}
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    {vm.sectionError['genset'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['genset']}</Text> : null}
                    <SectionSaveButton
                      onPress={() => vm.handleSaveAssetSection('genset')}
                      saving={vm.sectionSaving['genset']}
                      done={vm.sectionSuccess['genset']}
                    />
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
                          style={[styles.fieldInput, isAssetFieldLocked('alternatorMake') && styles.fieldInputReadOnly]} value={vm.altMake} onChangeText={vm.setAltMake}
                          editable={!isAssetFieldLocked('alternatorMake')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('altModel')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Alt. Model</Text>
                        <TextInput
                          ref={register('altModel')}
                          style={[styles.fieldInput, isAssetFieldLocked('alternatorModel') && styles.fieldInputReadOnly]} value={vm.altModel} onChangeText={vm.setAltModel}
                          editable={!isAssetFieldLocked('alternatorModel')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('altSn')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Alt. S/N</Text>
                        <TextInput
                          ref={register('altSn')}
                          style={[styles.fieldInput, isAssetFieldLocked('alternatorSerialNumber') && styles.fieldInputReadOnly]} value={vm.altSn} onChangeText={vm.setAltSn}
                          editable={!isAssetFieldLocked('alternatorSerialNumber')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('batteryType')}
                        />
                      </View>
                      {/* Was a single "Battery S/N" field — now Battery Type
                          plus two separate serial numbers, since a genset
                          can have 2 batteries. */}
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Battery Type</Text>
                        <TextInput
                          ref={register('batteryType')}
                          style={[styles.fieldInput, isAssetFieldLocked('batteryType') && styles.fieldInputReadOnly]} value={vm.batteryType} onChangeText={vm.setBatteryType}
                          editable={!isAssetFieldLocked('batteryType')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('batterySn')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Battery 1 S/N</Text>
                        <TextInput
                          ref={register('batterySn')}
                          style={[styles.fieldInput, isAssetFieldLocked('battery1SerialNumber') && styles.fieldInputReadOnly]} value={vm.batterySn} onChangeText={vm.setBatterySn}
                          editable={!isAssetFieldLocked('battery1SerialNumber')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('battery2Sn')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Battery 2 S/N</Text>
                        <TextInput
                          ref={register('battery2Sn')}
                          style={[styles.fieldInput, isAssetFieldLocked('battery2SerialNumber') && styles.fieldInputReadOnly]} value={vm.battery2Sn} onChangeText={vm.setBattery2Sn}
                          editable={!isAssetFieldLocked('battery2SerialNumber')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('kva')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>KVA Rating</Text>
                        <TextInput
                          ref={register('kva')}
                          style={[styles.fieldInput, isAssetFieldLocked('kva') && styles.fieldInputReadOnly]} value={vm.kva} onChangeText={vm.setKva} keyboardType="numeric"
                          editable={!isAssetFieldLocked('kva')}
                          returnKeyType="done"
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Phase" value={vm.phase} options={vm.PHASE_OPTIONS} onSelect={vm.setPhase} disabled={isAssetFieldLocked('phase')} />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <DropdownField plainLabel label="Panel Type" value={vm.panelType} options={vm.PANEL_TYPE_OPTIONS} onSelect={vm.setPanelType} disabled={isAssetFieldLocked('panelType')} />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Panel S/N</Text>
                        <TextInput
                          ref={register('panelSn')}
                          style={[styles.fieldInput, isAssetFieldLocked('controlPanelSerialNumber') && styles.fieldInputReadOnly]} value={vm.panelSn} onChangeText={vm.setPanelSn}
                          editable={!isAssetFieldLocked('controlPanelSerialNumber')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('controllerType')}
                        />
                      </View>
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Controller Type</Text>
                        <TextInput
                          ref={register('controllerType')}
                          style={[styles.fieldInput, isAssetFieldLocked('controllerType') && styles.fieldInputReadOnly]} value={vm.controllerType} onChangeText={vm.setControllerType}
                          editable={!isAssetFieldLocked('controllerType')}
                          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('controllerSr')}
                        />
                      </View>
                      <View style={styles.fieldHalf}>
                        <Text style={styles.fieldLabel}>Controller S/R</Text>
                        <TextInput
                          ref={register('controllerSr')}
                          style={[styles.fieldInput, isAssetFieldLocked('controllerSerialNumber') && styles.fieldInputReadOnly]} value={vm.controllerSr} onChangeText={vm.setControllerSr}
                          editable={!isAssetFieldLocked('controllerSerialNumber')}
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    {vm.sectionError['alternator'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['alternator']}</Text> : null}
                    <SectionSaveButton
                      onPress={() => vm.handleSaveAssetSection('alternator')}
                      saving={vm.sectionSaving['alternator']}
                      done={vm.sectionSuccess['alternator']}
                    />
                  </>
                )}
              </View>

            </>
          )}

          {/* ══════════════ STEP 2 — COMPLAINT / FAULT CODES ══════════════ */}
          {vm.currentStep === 2 && (
            <>
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
              <AddItemButton label="Add Code" onPress={openComplaintPicker} disabled={vm.task?.status === 'COMPLETED'} style={{ marginBottom: 16 }} />

              <ComplaintCodePickerModal
                visible={vm.complaintPickerVisible}
                onClose={() => vm.setComplaintPickerVisible(false)}
                faultCodes={vm.apiFaultCodes}
                loading={vm.faultCodesLoading}
                onSelectCode={vm.handleSelectComplaintCode}
              />
            </>
          )}

          {/* ══════════════ STEP 3 — PARTS USED ══════════════ */}
          {vm.currentStep === 3 && (
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
              <AddItemButton label="Add Part" onPress={openPartPicker} disabled={vm.task?.status === 'COMPLETED'} style={{ marginBottom: 16 }} />

              <PartPickerModal
                visible={vm.partPickerVisible}
                onClose={() => vm.setPartPickerVisible(false)}
                parts={vm.apiParts}
                loading={vm.partsLoading}
                onSelectPart={vm.handleSelectPart}
                assetEngineFamily={vm.engineFamily}
                assetCpcbNorm={vm.cpcbNorm}
              />
            </>
          )}

          {/* ══════════════ STEP 4 — ENGINE PARAMETERS, GENSET ELECTRICAL
              READINGS, RUNNING HOURS, LOAD UNBALANCE ══════════════
              Genset Identification/Alternator & Panel stay in Step 1;
              these four moved into their own step, in this order. Running
              Hours is new here (no equivalent existed in the SR form
              before); the other three keep the same fields/save actions
              they always had — only the on-screen step/order changed. */}
          {vm.currentStep === 4 && (
            <>
              {/* Engine Parameters — first now, then Genset Electrical
                  Readings, Running Hours, Load Unbalance. Same
                  display/edit toggle either way. */}
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
                      {/* DEF Level only applies to gensets rated 75 KVA or
                      above — locked (not just hidden, so a value entered
                      before a later KVA edit dropped it below 75 isn't
                      silently lost) until that threshold is met. */}
                      <NumberStepperField
                        label="DEF LEVEL"
                        value={vm.defLevel}
                        onChangeValue={vm.setDefLevel}
                        unit="%"
                        readOnly={(parseFloat(vm.kva) || 0) < 75}
                      />
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
                    <SectionSaveButton
                      onPress={() => vm.handleSaveAssetSection('engineParams')}
                      saving={vm.sectionSaving['engineParams']}
                      done={vm.sectionSuccess['engineParams']}
                    />
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

              {/* Electrical Readings — read-only display by default (real
                  values once saved, "null" placeholders until then); "Edit"
                  swaps in the input fields below. */}
              <View style={styles.sectionCard}>
                <ReadingsSectionHeader
                  title="Genset Electrical Readings"
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
                    ] as const).map((row, i) => (
                      <View key={i} style={[styles.fieldRow, { marginTop: i === 0 ? 0 : 14 }]}>
                        {row.map(([label, value, setter, unit]) => (
                          <NumberStepperField key={label} label={label} value={value} onChangeValue={setter} unit={unit} />
                        ))}
                      </View>
                    ))}
                    <View style={[styles.fieldRow, { marginTop: 14 }]}>
                      <NumberStepperField label="LOAD KW B" value={vm.loadKwB} onChangeValue={vm.setLoadKwB} />
                      <View style={{ flex: 1 }} />
                    </View>
                    {/* Total Load KW / Load % — both read-only now, both
                    computed off other fields (see useSrTaskForm.ts's own
                    effects), neither separately typed in. */}
                    <View style={[styles.fieldRow, { marginTop: 14 }]}>
                      <NumberStepperField label="TOTAL LOAD KW" value={vm.totalKw} onChangeValue={() => {}} readOnly />
                      <NumberStepperField
                        label="LOAD %"
                        value={vm.loadPercent}
                        onChangeValue={() => {}}
                        unit="%"
                        readOnly
                        placeholder={vm.kva ? undefined : "KVA Rating not filled"}
                      />
                    </View>

                    {vm.sectionError['electrical'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['electrical']}</Text> : null}
                    <SectionSaveButton
                      onPress={() => vm.handleSaveAssetSection('electrical')}
                      saving={vm.sectionSaving['electrical']}
                      done={vm.sectionSuccess['electrical']}
                    />
                  </>
                ) : (
                  <View style={styles.readingsDisplayGrid}>
                    {([
                      [{ kind: 'value', label: 'AC Volt RY', value: vm.acVoltRY, unit: 'V' }, { kind: 'value', label: 'AC Volt YB', value: vm.acVoltYB, unit: 'V' }],
                      [{ kind: 'value', label: 'AC Volt BR', value: vm.acVoltBR, unit: 'V' }, { kind: 'value', label: 'AC Amp R', value: vm.acAmpR, unit: 'A' }],
                      [{ kind: 'value', label: 'AC Amp Y', value: vm.acAmpY, unit: 'A' }, { kind: 'value', label: 'AC Amp B', value: vm.acAmpB, unit: 'A' }],
                      [{ kind: 'value', label: 'Load KW R', value: vm.loadKwR }, { kind: 'value', label: 'Load KW Y', value: vm.loadKwY }],
                      [{ kind: 'value', label: 'Load KW B', value: vm.loadKwB }],
                      [
                        { kind: 'value', label: 'Total Load KW', value: vm.totalKw },
                        // Blank Load % means KVA Rating isn't filled yet
                        // (can't compute a % of an unknown capacity) —
                        // says so explicitly here too, matching the
                        // editable NumberStepperField's own placeholder,
                        // instead of falling through to this grid's usual
                        // literal "null" for an unset value.
                        vm.kva
                          ? ({ kind: 'value', label: 'Load %', value: vm.loadPercent, unit: '%' } as const)
                          : ({ kind: 'value', label: 'Load %', value: 'KVA Rating not filled' } as const),
                      ],
                    ] as const).map((row, i) => (
                      <View key={i} style={[styles.readingsDisplayRow, i === 0 && { marginTop: 4 }]}>
                        {row.map((item) => (
                          // 11 fields, 2 per row, doesn't divide evenly —
                          // Load KW B is the odd one left alone in its own
                          // row. Rather than leave dead space where a
                          // second column would be (readingsDisplayHalf is
                          // a fixed 48%), a lone item in a row spans the
                          // full width instead.
                          <View key={item.label} style={row.length === 1 ? styles.readingsDisplayFull : styles.readingsDisplayHalf}>
                            <ReadingsDisplayField item={item} />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                ))}
              </View>

              {/* Running Hours — new field, no confirmed backend key yet
                  (see runningHours' own state comment in
                  useSrTaskForm.ts). Its own Save button still sends the
                  whole asset record like every other section here. */}
              <View style={styles.sectionCard}>
                <GroupHeader
                  title="Running Hours"
                  saved={!!vm.sectionSuccess['runningHours']}
                  onPress={() => toggleSectionReopen('runningHours')}
                  expanded={isSectionExpanded('runningHours')}
                />

                {isSectionExpanded('runningHours') && (
                  <>
                    <TextInput
                      style={[styles.fieldInput, { marginTop: 12 }]}
                      value={vm.runningHours}
                      onChangeText={(v) => {
                        console.log('[Service] Running Hours input changed to:', v);
                        vm.setRunningHours(v);
                      }}
                      placeholder="Enter running hours..."
                      keyboardType="numeric"
                    />

                    {vm.sectionError['runningHours'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['runningHours']}</Text> : null}
                    <SectionSaveButton
                      onPress={vm.handleSaveRunningHours}
                      saving={vm.sectionSaving['runningHours']}
                      done={vm.sectionSuccess['runningHours']}
                    />

                    {/* Running Hours' own single photo — same pairing
                        Commissioning's form has for its Running Hours
                        step. Uploads immediately on pick via its own
                        queue (vm.runningHoursUploadQueue, see
                        MediaUploadOverlay above), imagesOnly + maxItems=1
                        since only one photo is ever wanted here. No
                        onUpdateTag — this photo always confirms
                        pre-tagged 'Running Hours' (see runningHoursQueue's
                        own defaultTags in useSrTaskForm.ts) and isn't
                        meant to be re-tagged from here, so the tag icon
                        doesn't show on it at all. */}
                    <PhotosVideoCard
                      sitePhotos={vm.runningHoursPhotos}
                      onRemove={vm.handleRemoveRunningHoursPhoto}
                      onAddPress={() => vm.setRunningHoursPhotoOptionsVisible(true)}
                      imagesOnly
                      maxItems={1}
                    />
                  </>
                )}
              </View>

              {/* Load Unbalance — last now, was first. Its own Save
                  button still sends the whole asset record like every
                  other section here (see buildAssetPayload's own
                  comment) — 'loadUnbalance' is just this card's own
                  independent loading/success/error tracking key. */}
              <View style={styles.sectionCard}>
                <GroupHeader
                  title="Load Unbalance"
                  saved={!!vm.sectionSuccess['loadUnbalance']}
                  onPress={() => toggleSectionReopen('loadUnbalance')}
                  expanded={isSectionExpanded('loadUnbalance')}
                />

                {isSectionExpanded('loadUnbalance') && (
                  <>
                    <View style={styles.fieldFull}>
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
                    </View>

                    {vm.sectionError['loadUnbalance'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['loadUnbalance']}</Text> : null}
                    <SectionSaveButton
                      onPress={() => vm.handleSaveAssetSection('loadUnbalance')}
                      saving={vm.sectionSaving['loadUnbalance']}
                      done={vm.sectionSuccess['loadUnbalance']}
                    />
                  </>
                )}
              </View>
            </>
          )}

          {/* ══════════════ STEP 5 — PHOTOS & VIDEO ══════════════
              Each photo/video/PDF uploads immediately when picked (see
              vm.mediaUploadQueue / MediaUploadOverlay) — photos go through
              a multipart call, video/PDF through their own GCS-based
              upload (no multipart endpoint for either, per the backend dev
              guide). Nothing is deferred to Complete at Step 6 anymore. */}
          {vm.currentStep === 5 && (
            <>
              <Text style={styles.stepSectionLabel}>STEP 5 — PHOTOS & VIDEO</Text>

              {/* Photos & Video card — shared with the Commissioning form
                  (same grid + video-list + upload behavior), not a
                  duplicated copy of it. Each item uploads immediately on
                  pick via vm.mediaUploadQueue (see MediaUploadOverlay
                  above), not a batch call. */}
              <View style={{ marginBottom: 16 }}>
                <PhotosVideoCard
                  sitePhotos={vm.sitePhotos}
                  onRemove={vm.handleRemovePhoto}
                  onAddPress={() => vm.setPhotoOptionsVisible(true)}
                  onUpdateTag={vm.handleUpdateMediaTag}
                />
              </View>

              {/* Documents card — shared with the Commissioning form (same
                  PDF pick + GCS video-confirm upload flow), not a
                  duplicated copy of it. */}
              <DocumentsCard
                pdfs={vm.sitePhotos.filter((p) => p.mediaType === 'pdf')}
                onPickPdf={vm.handlePickPdf}
                onRemove={vm.handleRemovePhoto}
                onUpdateTag={vm.handleUpdateMediaTag}
              />

              {/* Moved here from Step 5 (Category & Complete) — sits right
                  below the documents/PDF card now, not down by the finish
                  actions. Still the same optional freetext, submitted once
                  as suggestionComment in the finish call. */}
              <SuggestionCommentCard value={vm.suggestionComment} onChangeText={vm.setSuggestionComment} style={{ marginTop: 16 }} />
            </>
          )}

          {/* ══════════════ STEP 6 (engineer) — CATEGORY & COMPLETE ══════════════
              Distinct from area_manager's Send-for-Approval/OTP flow below
              — engineers lock in category/sub-category (read-only if the
              dealer already set them at creation, otherwise pick from the
              live category-config) then Complete via the finish API. The
              post-finish Approval Status/Close Ticket view renders outside
              the read-only wrapper below, once isEngineerFinished. */}
          {vm.currentStep === 6 && vm.isEngineer && !isEngineerFinished && (
            <>
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
                          options={['Paid', 'Goodwill', 'FOC']}
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
                <CompleteTaskButton
                  onPress={vm.handleFinishService}
                  loading={vm.finishing}
                  disabled={!vm.selectedCategoryLetter || !vm.selectedSubCategory || (needsBillingType && !vm.billingType)}
                />
              </View>
            </>
          )}

          {/* ══════════════ STEP 6 (area_manager) — CATEGORY, APPROVAL & COMPLETION ══════════════ */}
          {vm.currentStep === 6 && !vm.isEngineer && (
            <>
                  {/* Same 3-way branch the engineer's own Step 6 uses —
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
                              options={['Paid', 'Goodwill', 'FOC']}
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
                              options={['Paid', 'Goodwill', 'FOC']}
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
                    <CompleteTaskButton
                      onPress={vm.handleSendForApproval}
                      loading={vm.step6Saving}
                      disabled={!vm.selectedSubCategory || (needsBillingTypeAM && !vm.billingType)}
                    />
                  </View>
            </>
          )}

          </View>

          {/* One combined sheet for the merged Photos & Video card — a
              single gallery row handles both photos and videos
              (handleChoosePhotos accepts either media type in one picker
              launch), alongside the two camera actions. */}
          <Modal visible={vm.photoOptionsVisible} transparent animationType="none" onRequestClose={() => vm.setPhotoOptionsVisible(false)}>
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

          {/* Camera / Gallery picker — Running Hours' own single photo.
              Images only, no video/PDF, same as taskForm.tsx's
              commissioning equivalent. */}
          <Modal visible={vm.runningHoursPhotoOptionsVisible} transparent animationType="none" onRequestClose={() => vm.setRunningHoursPhotoOptionsVisible(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => vm.setRunningHoursPhotoOptionsVisible(false)}>
              <View style={[styles.optionsSheet, { paddingBottom: sheetPaddingBottom }]}>
                <Text style={styles.optionsTitle}>Add Photo</Text>
                <TouchableOpacity style={styles.optionRow} onPress={vm.handleTakeRunningHoursPhoto}><Text style={styles.optionText}>📷  Take Photo</Text></TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity style={styles.optionRow} onPress={vm.handleChooseRunningHoursPhotos}><Text style={styles.optionText}>🖼️  Choose from Gallery</Text></TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity style={styles.optionRow} onPress={() => vm.setRunningHoursPhotoOptionsVisible(false)}><Text style={styles.optionText}>Cancel</Text></TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        {/* Labeled Back/Next bar, alongside the stepper row's flanking
            arrows above — same handlers either way, just a second, more
            discoverable way to move between steps. Steps 1-5 only: step 6's
            own actions (category select + Send for Approval, or the status/
            OTP flow) are already inline in that step's content, so a
            duplicate Next button here would be redundant. Scrolls away with
            the rest of the content instead of staying pinned at the
            screen's bottom edge. */}
        {vm.currentStep !== 6 && (
          <View style={styles.fixedBottomActions}>
            <TouchableOpacity
              style={[styles.backButton, vm.currentStep === 1 && styles.buttonDisabled]}
              onPress={vm.handleBack}
              disabled={vm.currentStep === 1}
            >
              <ChevronLeft size={24} color="#4B5563" />
            </TouchableOpacity>
            {/* Photos/videos/PDFs already upload immediately when picked
                (MediaUploadOverlay blocks the screen while that's
                happening), so Next has nothing left to wait on here —
                same plain handleNext as every other step. */}
            <TouchableOpacity style={styles.nextButton} onPress={vm.handleNext}>
              <ChevronRight size={24} color="#FFFFFF" />
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
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000000', textTransform: 'uppercase' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  // Complaint Codes/Parts Used — matches taskForm.tsx's plain white pill for
  // these same two sections, instead of the purple GroupHeader uses by
  // default everywhere else here.
  sectionPillHeaderWhite: { backgroundColor: '#FFFFFF' },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 12 },
  fieldHalf: { width: '48%' },
  fieldFull: { marginTop: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  // Same spec as fieldLabel (Step 1's Genset Identification labels) —
  // Electrical Readings/Engine Parameters previously had their own
  // smaller, lighter, letter-spaced look instead of matching.
  fieldLabelStatic: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937', backgroundColor: '#fff',
  },
  // Locked fields (already filled by an earlier task on the same asset,
  // e.g. Genset Identification/Alternator & Panel) — same shape as a
  // normal input, just visibly non-interactive.
  fieldInputReadOnly: { backgroundColor: '#F3F4F6', color: '#6B7280' },
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
  readingsDisplayFull: { width: '100%' },
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
  finishActionsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },

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
