import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator, Image, StyleSheet, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { TextInput } from '@/_components/AppTextInput';
import { Text } from '@/_components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Bell } from 'lucide-react-native';
import { DropdownField } from '../../_components/taskForm/DropdownField';
import { GroupHeader } from '../../_components/taskForm/GroupHeader';
import { PartPickerModal } from '../../_components/taskForm/PartPickerModal';
import { SelectedPartCard } from '../../_components/taskForm/SelectedPartCard';
import { ComplaintCodePickerModal } from '../../_components/taskForm/ComplaintCodePickerModal';
import { ComplaintCodeCard } from '../../_components/taskForm/ComplaintCodeCard';
import { CheckToggleRow, TwoOptionToggleRow, MultiOptionToggleRow } from '../../_components/taskForm/FormToggleRows';
import { useTaskForm } from '../../controllers/taskForm/useTaskForm';
import { TaskSummaryHeader } from '../../_components/shared/TaskSummaryHeader';
import { SplashVideoCircle } from '../../_components/shared/SplashVideoCircle';
import { VideoThumbnail } from '../../_components/shared/VideoThumbnail';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { PendingSyncBanner } from '../../_components/shared/PendingSyncBanner';
import { useFieldFocusChain } from '../../utils/useFieldFocusChain';
import { StepperRow } from '../../_components/shared/StepperRow';
import { CheckCheck, ChevronLeft, ChevronRight, Phone, Plus } from 'lucide-react-native';
import { DocumentsCard } from '../../_components/shared/DocumentsCard';
import { PhotosVideoCard } from '../../_components/shared/PhotosVideoCard';

// "15 JUL" — short uppercase date, no year (the completion summary's date
// pills only ever compare same-day/recent tasks, so a year would be noise).
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
}

// "04:00 PM"
function formatShortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// "2 hr 20 min" — the real elapsed time between assignment and completion.
function formatDuration(startIso: string, endIso: string): string {
  const totalMinutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
}

// Same peach->light radial gradient backdrop as the Dashboard/Commissioning
// screens (duplicated, not extracted — a small, screen-specific visual).
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
          <RadialGradient id="taskFormBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#taskFormBg)" />
      </Svg>
    </View>
  );
}

// Main commissioning task form screen — an 8-step wizard. Renders the UI
// and delegates all state/API logic to the useTaskForm controller.
export default function TaskFormScreen() {
  const vm = useTaskForm();
  const insets = useSafeAreaInsets();
  const sheetPaddingBottom = Math.max(insets.bottom, 16) + 14;

  // Auto-jump-to-next-field, same trick as the login form — only wired for
  // Step 1's two identification sections (Genset ID, Alternator & Panel),
  // where fields are genuinely filled in one narrative sequence. Left out
  // of the Step 2/3 checks and Electrical Readings/Engine Parameters grids
  // deliberately — those are usually filled by reading values off physical
  // gauges non-sequentially, not typed top-to-bottom like a form.
  const { register, focusNext } = useFieldFocusChain();

  // Every real API call this screen can trigger — every section save,
  // every step's save, photo upload, OTP generate/verify, mark-complete —
  // fades the whole screen with the loading video rather than just the
  // one button's own small spinner. Complaint codes (step3Saving) and
  // parts (step4Saving) are the deliberate exception: each card already
  // has its own save button with its own spinner (isSaving), so saving one
  // card shouldn't lock the whole screen and make it look like every code/
  // part is being saved together.
  const isBusy = (
    vm.assetLoading || vm.checksLoading || vm.completionSummaryLoading ||
    vm.readingsSaving || vm.photosUploading ||
    vm.otpLoading || vm.markCompleteLoading ||
    vm.faultCodesLoading || vm.partsLoading ||
    Object.values(vm.sectionSaving).some(Boolean)
  );
  // Photo upload is the one loading state worth a live % instead of the
  // generic "Loading..." — it's the only one that can meaningfully take
  // several seconds with real incremental progress to report.
  const loadingMessage = vm.photosUploading ? `Uploading photos... ${vm.photosUploadProgress}%` : undefined;

  // The complaint-code and part pickers open as full bottom sheets, not
  // anchored to these buttons — just their own visibility toggles.
  const openComplaintPicker = () => vm.handleOpenComplaintPicker();
  const openPartPicker = () => vm.setPartPickerVisible(true);

  // Step 1's three sections auto-minimize right after a successful save
  // (vm.sectionSuccess[key] flips true) — this tracks only the *manual*
  // override once a user taps a minimized header to look at/edit it again,
  // so a section isn't permanently locked away after saving.
  const [sectionReopened, setSectionReopened] = useState<Record<string, boolean>>({});
  const isSectionExpanded = (key: string) => !vm.sectionSuccess[key] || !!sectionReopened[key];
  const toggleSectionReopen = (key: string) => setSectionReopened((prev) => ({ ...prev, [key]: !prev[key] }));

  // Electrical Readings + Engine Parameters (step 5) share one combined
  // save call (vm.handleSaveReadings/vm.readingsSuccess), unlike step 1's
  // three independently-saved sections — so both cards collapse/expand
  // together off the same 'readings' key rather than vm.sectionSuccess.
  const readingsExpanded = !vm.readingsSuccess || !!sectionReopened['readings'];
  const toggleReadingsReopen = () => toggleSectionReopen('readings');

  // Step 6's OTP entry view (tapped into from the success screen's "OTP
  // Verify" button) — stays on step 6 rather than advancing, same as the
  // success screen itself. Auto-generates the OTP the moment this view
  // opens, since the new design has no separate "Generate OTP" button step.
  const [showOtpEntry, setShowOtpEntry] = useState(false);
  React.useEffect(() => {
    if (showOtpEntry && !vm.otpGenerated && !vm.otpLoading) {
      vm.handleGenerateOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOtpEntry]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      {isBusy && <LoadingOverlay message={loadingMessage} />}
      {vm.toastVisible && (
        <View style={[styles.toastContainer, vm.toastType === 'success' ? styles.toastSuccess : styles.toastError]}>
          <Text style={styles.toastText}>{vm.toastMessage}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={vm.goToCommissioningList}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TASK</Text>
        <View style={styles.headerButton}>
          <Bell size={22} color="#979797" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android's own softwareKeyboardLayoutMode is "pan" (app.json) —
        // the OS already shifts the whole screen up to keep the focused
        // input visible on its own. Pairing that with behavior="height"
        // here made RN ALSO shrink this container by the keyboard's
        // height on top of the OS's own pan, double-compensating and
        // leaving a large empty gap between the content and the keyboard.
        // undefined on Android leaves the OS's native pan as the only
        // mechanism at work; iOS has no such OS-level behavior, so it
        // still needs RN's own "padding" here.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">

        {/* Numbered circles only, no prev/next arrows — each screen has its
            own Back/Next buttons lower on the page; tapping a circle still
            jumps directly to that step, unchanged. */}
        <StepperRow
          steps={vm.stepSequence}
          currentStep={vm.currentStep}
          onSelectStep={vm.setCurrentStep}
        />

        {/* Once the task is fully completed (OTP verified), every step's
            fields become read-only — the stepper above stays interactive
            so the user can still page back through and review what was
            submitted, they just can't change anything. */}
        <View pointerEvents={vm.taskCompleted ? 'none' : 'auto'} style={vm.taskCompleted ? styles.readOnlyDim : undefined}>

        {/* Shown on every step now, not just step 1 — gives constant
            context (task type, assignees, genset/engine ID) while paging
            through the form, not only when first landing on it. */}
        <TaskSummaryHeader task={vm.task} gensetNumber={vm.gensetSrNumber} engineNumber={vm.engineNumber} />

        <PendingSyncBanner />

        {/* ══════════════ STEP 1 — ASSET INFORMATION ══════════════ */}
        {vm.currentStep === 1 && (
          <>
            {vm.assetLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#F26722" />
                <Text style={styles.loadingText}>Loading asset data...</Text>
              </View>
            )}

            {/* Genset Identification */}
            <View style={styles.sectionCard}>
              <GroupHeader
                title="Genset Identification"
                saved={!!vm.sectionSuccess['genset']}
                onPress={() => toggleSectionReopen('genset')}
                expanded={isSectionExpanded('genset')}
                missingCount={vm.gensetMissingCount}
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
                        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => focusNext('engineType')}
                      />
                    </View>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.fieldLabel}>Engine Type</Text>
                      <TextInput
                        ref={register('engineType')}
                        style={styles.fieldInput} value={vm.engineType} onChangeText={vm.setEngineType}
                        returnKeyType="done"
                      />
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
                    onPress={vm.handleSaveGensetIdentification}
                    disabled={vm.sectionSaving['genset']}
                  >
                    {vm.sectionSaving['genset']
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <CheckCheck size={20} color="#FFFFFF" />}
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
                missingCount={vm.altMissingCount}
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
                    onPress={vm.handleSaveAlternatorPanel}
                    disabled={vm.sectionSaving['alternator']}
                  >
                    {vm.sectionSaving['alternator']
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <CheckCheck size={20} color="#FFFFFF" />}
                  </TouchableOpacity>
                </>
              )}
            </View>

           
          </>
        )}

        {/* ══════════════ STEP 2 — COMMISSIONING CHECKS ══════════════ */}
        {vm.currentStep === 2 && !vm.isRevalidation && (
          <>
            {vm.checksLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#F26722" />
                <Text style={styles.loadingText}>Loading saved checks...</Text>
              </View>
            )}

            {/* GROUP A */}
            <View style={styles.sectionCard}>
              <GroupHeader
                letter="A" title="Pre-Installation Checks" saved={vm.sectionSuccess['groupA'] || false}
                onPress={() => toggleSectionReopen('groupA')} expanded={isSectionExpanded('groupA')}
              />
              {isSectionExpanded('groupA') && (
                <>
                  <CheckToggleRow index={1} question="Genset Installation" value={vm.commissioningChecks.A1 || ''} comment={vm.commissioningChecks.A1_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A1', v)} onSetComment={(v) => vm.updateCommissioningCheck('A1_comment', v)} />
                  <CheckToggleRow index={2} question="No obstruction to cooling air inlet and air outlet" value={vm.commissioningChecks.A2 || ''} comment={vm.commissioningChecks.A2_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A2', v)} onSetComment={(v) => vm.updateCommissioningCheck('A2_comment', v)} />
                  <CheckToggleRow index={3} question="All canopy doors open fully for service access" value={vm.commissioningChecks.A3 || ''} comment={vm.commissioningChecks.A3_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A3', v)} onSetComment={(v) => vm.updateCommissioningCheck('A3_comment', v)} />
                  <CheckToggleRow index={4} question="DG set room ventilation (if installed in a room)" value={vm.commissioningChecks.A4 || ''} comment={vm.commissioningChecks.A4_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('A4', v)} onSetComment={(v) => vm.updateCommissioningCheck('A4_comment', v)} />
                  <CheckToggleRow index={5} question="Fitment of exhaust silencer and exhaust piping" value={vm.commissioningChecks.A5 || ''} comment={vm.commissioningChecks.A5_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A5', v)} onSetComment={(v) => vm.updateCommissioningCheck('A5_comment', v)} />
                  <CheckToggleRow index={6} question="Earthing (2 pits genset/panel body, 1 neutral, 1 alternator)" value={vm.commissioningChecks.A6 || ''} comment={vm.commissioningChecks.A6_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A6', v)} onSetComment={(v) => vm.updateCommissioningCheck('A6_comment', v)} />
                  <CheckToggleRow index={7} question="Visually check all fasteners" value={vm.commissioningChecks.A7 || ''} comment={vm.commissioningChecks.A7_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A7', v)} onSetComment={(v) => vm.updateCommissioningCheck('A7_comment', v)} />
                  <CheckToggleRow index={8} question="Visually check wiring connections in control panel" value={vm.commissioningChecks.A8 || ''} comment={vm.commissioningChecks.A8_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A8', v)} onSetComment={(v) => vm.updateCommissioningCheck('A8_comment', v)} />
                  <CheckToggleRow index={9} question="230V supply for battery charger (if external charger fitted)" value={vm.commissioningChecks.A9 || ''} comment={vm.commissioningChecks.A9_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('A9', v)} onSetComment={(v) => vm.updateCommissioningCheck('A9_comment', v)} />
                  <CheckToggleRow index={10} question="Visually check all connectors and actuators on engine" value={vm.commissioningChecks.A10 || ''} comment={vm.commissioningChecks.A10_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A10', v)} onSetComment={(v) => vm.updateCommissioningCheck('A10_comment', v)} />

                  <CheckToggleRow index={11} question="Electricity Board (Mains) — Voltage (V) Phase to Phase — R-Y Phase" value={vm.commissioningChecks.A14 || ''} comment={vm.commissioningChecks.A14_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A14', v)} onSetComment={(v) => vm.updateCommissioningCheck('A14_comment', v)} />
                  <CheckToggleRow index={12} question="Electricity Board (Mains) — Voltage (V) Phase to Phase — Y-B Phase" value={vm.commissioningChecks.A15 || ''} comment={vm.commissioningChecks.A15_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A15', v)} onSetComment={(v) => vm.updateCommissioningCheck('A15_comment', v)} />
                  <CheckToggleRow index={13} question="Electricity Board (Mains) — Voltage (V) Phase to Phase — B-R Phase" value={vm.commissioningChecks.A16 || ''} comment={vm.commissioningChecks.A16_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A16', v)} onSetComment={(v) => vm.updateCommissioningCheck('A16_comment', v)} />
                  <CheckToggleRow index={14} question="Electricity Board (Mains) — Voltage (V) Phase to Neutral — R-N Phase" value={vm.commissioningChecks.A17 || ''} comment={vm.commissioningChecks.A17_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A17', v)} onSetComment={(v) => vm.updateCommissioningCheck('A17_comment', v)} />
                  <CheckToggleRow index={15} question="Electricity Board (Mains) — Voltage (V) Phase to Neutral — Y-N Phase" value={vm.commissioningChecks.A18 || ''} comment={vm.commissioningChecks.A18_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A18', v)} onSetComment={(v) => vm.updateCommissioningCheck('A18_comment', v)} />
                  <CheckToggleRow index={16} question="Electricity Board (Mains) — Voltage (V) Phase to Neutral — B-N Phase" value={vm.commissioningChecks.A19 || ''} comment={vm.commissioningChecks.A19_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A19', v)} onSetComment={(v) => vm.updateCommissioningCheck('A19_comment', v)} />
                  <CheckToggleRow index={17} question="Electricity Board (Mains) — Load (A) — R Phase" value={vm.commissioningChecks.A11 || ''} comment={vm.commissioningChecks.A11_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A11', v)} onSetComment={(v) => vm.updateCommissioningCheck('A11_comment', v)} />
                  <CheckToggleRow index={18} question="Electricity Board (Mains) — Load (A) — Y Phase" value={vm.commissioningChecks.A12 || ''} comment={vm.commissioningChecks.A12_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A12', v)} onSetComment={(v) => vm.updateCommissioningCheck('A12_comment', v)} />
                  <CheckToggleRow index={19} question="Electricity Board (Mains) — Load (A) — B Phase" value={vm.commissioningChecks.A13 || ''} comment={vm.commissioningChecks.A13_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('A13', v)} onSetComment={(v) => vm.updateCommissioningCheck('A13_comment', v)} />

                  {vm.sectionError['groupA'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupA']}</Text> : null}
                  <TouchableOpacity
                    style={[styles.checkSaveButton, vm.sectionSuccess['groupA'] && styles.checkSaveButtonDone]}
                    onPress={vm.handleSaveGroupA}
                    disabled={vm.sectionSaving['groupA']}
                  >
                    {vm.sectionSaving['groupA'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* GROUP B */}
            <View style={styles.sectionCard}>
              <GroupHeader
                letter="B" title="Commissioning Instructions" saved={vm.sectionSuccess['groupB'] || false}
                onPress={() => toggleSectionReopen('groupB')} expanded={isSectionExpanded('groupB')}
              />
              {isSectionExpanded('groupB') && (
                <>
                  <CheckToggleRow index={1} question="Lub Oil Level" value={vm.commissioningChecks.B1 || ''} comment={vm.commissioningChecks.B1_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B1', v)} onSetComment={(v) => vm.updateCommissioningCheck('B1_comment', v)} />
                  <CheckToggleRow index={2} question="Fuel Level" value={vm.commissioningChecks.B2 || ''} comment={vm.commissioningChecks.B2_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B2', v)} onSetComment={(v) => vm.updateCommissioningCheck('B2_comment', v)} />
                  <CheckToggleRow index={3} question="Coolant Level" value={vm.commissioningChecks.B3 || ''} comment={vm.commissioningChecks.B3_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B3', v)} onSetComment={(v) => vm.updateCommissioningCheck('B3_comment', v)} />
                  <CheckToggleRow index={4} question="Oil Leakage" value={vm.commissioningChecks.B4a || ''} comment={vm.commissioningChecks.B4a_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B4a', v)} onSetComment={(v) => vm.updateCommissioningCheck('B4a_comment', v)} />
                  <CheckToggleRow index={5} question="Coolant Leakage" value={vm.commissioningChecks.B4b || ''} comment={vm.commissioningChecks.B4b_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B4b', v)} onSetComment={(v) => vm.updateCommissioningCheck('B4b_comment', v)} />
                  <CheckToggleRow index={6} question="Fuel Leakage" value={vm.commissioningChecks.B4c || ''} comment={vm.commissioningChecks.B4c_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B4c', v)} onSetComment={(v) => vm.updateCommissioningCheck('B4c_comment', v)} />
                  <CheckToggleRow index={7} question="Air Leakage" value={vm.commissioningChecks.B4d || ''} comment={vm.commissioningChecks.B4d_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('B4d', v)} onSetComment={(v) => vm.updateCommissioningCheck('B4d_comment', v)} />

                  <View style={styles.checkItemBlock}>
                    <Text style={styles.checkItemQuestion}>8. Phase Difference (A)</Text>
                    <View style={styles.numericFieldRow}>
                      {([['R Phase', 'B5R'], ['Y Phase', 'B5Y'], ['B Phase', 'B5B']] as const).map(([label, key]) => (
                        <View key={key} style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>{label}</Text>
                          <TextInput style={styles.numericFieldInput} value={vm.commissioningChecks[key] || ''} onChangeText={(v) => vm.updateCommissioningCheck(key, v)} keyboardType="numeric" />
                        </View>
                      ))}
                    </View>
                  </View>

                  {vm.sectionError['groupB'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupB']}</Text> : null}
                  <TouchableOpacity
                    style={[styles.checkSaveButton, vm.sectionSuccess['groupB'] && styles.checkSaveButtonDone]}
                    onPress={vm.handleSaveGroupB}
                    disabled={vm.sectionSaving['groupB']}
                  >
                    {vm.sectionSaving['groupB'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* GROUP C */}
            <View style={styles.sectionCard}>
              <GroupHeader
                letter="C" title="CPCB IV+ ATS System Check Points" saved={vm.sectionSuccess['groupC'] || false}
                onPress={() => toggleSectionReopen('groupC')} expanded={isSectionExpanded('groupC')}
              />
              {isSectionExpanded('groupC') && (
                <>
                  <CheckToggleRow index={1} question="DEF / ADD Blue Tank Fitment & Level" value={vm.commissioningChecks.C1 || ''} comment={vm.commissioningChecks.C1_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C1', v)} onSetComment={(v) => vm.updateCommissioningCheck('C1_comment', v)} />
                  <CheckToggleRow index={2} question="Urea Supply & Return Line Fitment" value={vm.commissioningChecks.C2 || ''} comment={vm.commissioningChecks.C2_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C2', v)} onSetComment={(v) => vm.updateCommissioningCheck('C2_comment', v)} />
                  <CheckToggleRow index={3} question="DOC/POC/ATS Fitment/Connections" value={vm.commissioningChecks.C3 || ''} comment={vm.commissioningChecks.C3_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C3', v)} onSetComment={(v) => vm.updateCommissioningCheck('C3_comment', v)} />
                  <CheckToggleRow index={4} question="Exh. Gas Temp. Sensor Connections" value={vm.commissioningChecks.C4 || ''} comment={vm.commissioningChecks.C4_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C4', v)} onSetComment={(v) => vm.updateCommissioningCheck('C4_comment', v)} />
                  <CheckToggleRow index={5} question="NOx Sensor Connections" value={vm.commissioningChecks.C5 || ''} comment={vm.commissioningChecks.C5_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C5', v)} onSetComment={(v) => vm.updateCommissioningCheck('C5_comment', v)} />
                  <CheckToggleRow index={6} question="EGR / ECU Fitment & Connections" value={vm.commissioningChecks.C6 || ''} comment={vm.commissioningChecks.C6_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C6', v)} onSetComment={(v) => vm.updateCommissioningCheck('C6_comment', v)} />
                  <CheckToggleRow index={7} question="Engine ECM Fitment & Connections" value={vm.commissioningChecks.C7 || ''} comment={vm.commissioningChecks.C7_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C7', v)} onSetComment={(v) => vm.updateCommissioningCheck('C7_comment', v)} />
                  <CheckToggleRow index={8} question="Buzzer / Flasher Working" value={vm.commissioningChecks.C8 || ''} comment={vm.commissioningChecks.C8_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('C8', v)} onSetComment={(v) => vm.updateCommissioningCheck('C8_comment', v)} />
                  <CheckToggleRow index={9} question="Ambient Temp. Sensor Fitment & Connections" value={vm.commissioningChecks.C9 || ''} comment={vm.commissioningChecks.C9_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C9', v)} onSetComment={(v) => vm.updateCommissioningCheck('C9_comment', v)} />
                  <CheckToggleRow index={10} question="Exhaust Smoke Colour" value={vm.commissioningChecks.C10 || ''} comment={vm.commissioningChecks.C10_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('C10', v)} onSetComment={(v) => vm.updateCommissioningCheck('C10_comment', v)} />
                  <CheckToggleRow index={11} question="Wiring Harness & Connections" value={vm.commissioningChecks.C11 || ''} comment={vm.commissioningChecks.C11_comment || ''} onSetValue={(v) => vm.updateCommissioningCheck('C11', v)} onSetComment={(v) => vm.updateCommissioningCheck('C11_comment', v)} />

                  <View style={styles.checkItemBlock}>
                    <Text style={styles.checkItemQuestion}>12. Exhaust Temp. on Load DOC (°C)</Text>
                    <View style={styles.numericFieldRow}>
                      {([['Before', 'C12'], ['After', 'C13']] as const).map(([label, key]) => (
                        <View key={key} style={{ width: '48%' }}>
                          <Text style={styles.numericFieldLabel}>{label}</Text>
                          <TextInput style={styles.numericFieldInput} value={vm.commissioningChecks[key] || ''} onChangeText={(v) => vm.updateCommissioningCheck(key, v)} keyboardType="numeric" />
                        </View>
                      ))}
                    </View>
                  </View>

                  <CheckToggleRow index={13} question="Supply Module Fitment & Connection" value={vm.commissioningChecks.C14 || ''} comment={vm.commissioningChecks.C14_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C14', v)} onSetComment={(v) => vm.updateCommissioningCheck('C14_comment', v)} />
                  <CheckToggleRow index={14} question="Dosing Module Fitment & Connection" value={vm.commissioningChecks.C15 || ''} comment={vm.commissioningChecks.C15_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C15', v)} onSetComment={(v) => vm.updateCommissioningCheck('C15_comment', v)} />
                  <CheckToggleRow index={15} question="ATS Control Module Fitment & Connections" value={vm.commissioningChecks.C16 || ''} comment={vm.commissioningChecks.C16_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C16', v)} onSetComment={(v) => vm.updateCommissioningCheck('C16_comment', v)} />
                  <CheckToggleRow index={16} question="ATS System Working" value={vm.commissioningChecks.C17 || ''} comment={vm.commissioningChecks.C17_comment || ''} hasNA onSetValue={(v) => vm.updateCommissioningCheck('C17', v)} onSetComment={(v) => vm.updateCommissioningCheck('C17_comment', v)} />

                  <View style={styles.checkItemBlock}>
                    <Text style={styles.checkItemQuestion}>17. DEF Make (ISO22241 Recommendation)</Text>
                    <TextInput style={styles.fieldInput} value={vm.commissioningChecks.C18 || ''} onChangeText={(v) => vm.updateCommissioningCheck('C18', v)} placeholder="Enter value..." />
                  </View>

                  {vm.sectionError['groupC'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupC']}</Text> : null}
                  <TouchableOpacity
                    style={[styles.checkSaveButton, vm.sectionSuccess['groupC'] && styles.checkSaveButtonDone]}
                    onPress={vm.handleSaveGroupC}
                    disabled={vm.sectionSaving['groupC']}
                  >
                    {vm.sectionSaving['groupC'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* GROUP D — Performance Trial */}
            <View style={styles.sectionCard}>
              <GroupHeader
                letter="D" title="Performance Trial" saved={vm.sectionSuccess['groupD'] || false}
                onPress={() => toggleSectionReopen('groupD')} expanded={isSectionExpanded('groupD')}
              />
              {isSectionExpanded('groupD') && (
              <>
              {([
                { label: '0% Load', duration: '5 min', prefix: 'D0' },
                { label: '25% Load', duration: '5 min', prefix: 'D25' },
                { label: '50% Load', duration: '5 min', prefix: 'D50' },
                { label: '75% Load', duration: '5 min', prefix: 'D75' },
                { label: '100% Load', duration: '10 min', prefix: 'D100' },
              ] as const).map(stage => (
                <View key={stage.prefix} style={styles.loadStageCard}>
                  <View style={styles.loadStageHeaderRow}>
                    <Text style={styles.loadStageLabel}>{stage.label}</Text>
                    <View style={styles.durationPill}><Text style={styles.durationPillText}>{stage.duration}</Text></View>
                  </View>

                  <Text style={styles.numericSubLabel}>LOAD (AMPS)</Text>
                  <View style={styles.numericFieldRow}>
                    {(['LR', 'LY', 'LB'] as const).map((suffix, i) => (
                      <View key={suffix} style={styles.numericFieldThird}>
                        <Text style={styles.numericFieldLabel}>{['R', 'Y', 'B'][i]}</Text>
                        <TextInput style={styles.numericFieldInput} value={vm.commissioningChecks[`${stage.prefix}${suffix}`] || ''} onChangeText={(v) => vm.updateCommissioningCheck(`${stage.prefix}${suffix}`, v)} keyboardType="numeric" />
                      </View>
                    ))}
                  </View>

                  <Text style={[styles.numericSubLabel, { marginTop: 14 }]}>VOLTAGE (VOLTS)</Text>
                  <View style={styles.numericFieldRow}>
                    {(['VR', 'VY', 'VB'] as const).map((suffix, i) => (
                      <View key={suffix} style={styles.numericFieldThird}>
                        <Text style={styles.numericFieldLabel}>{['R', 'Y', 'B'][i]}</Text>
                        <TextInput style={styles.numericFieldInput} value={vm.commissioningChecks[`${stage.prefix}${suffix}`] || ''} onChangeText={(v) => vm.updateCommissioningCheck(`${stage.prefix}${suffix}`, v)} keyboardType="numeric" />
                      </View>
                    ))}
                  </View>

                  <View style={[styles.fieldRow, { marginTop: 14 }]}>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.numericFieldLabel}>Freq (Hz)</Text>
                      <TextInput style={styles.fieldInput} value={vm.commissioningChecks[`${stage.prefix}F`] || ''} onChangeText={(v) => vm.updateCommissioningCheck(`${stage.prefix}F`, v)} keyboardType="numeric" />
                    </View>
                    <View style={styles.fieldHalf}>
                      <Text style={styles.numericFieldLabel}>Battery V</Text>
                      <TextInput style={styles.fieldInput} value={vm.commissioningChecks[`${stage.prefix}BV`] || ''} onChangeText={(v) => vm.updateCommissioningCheck(`${stage.prefix}BV`, v)} keyboardType="numeric" />
                    </View>
                  </View>

                  <Text style={[styles.numericFieldLabel, { marginTop: 14, marginBottom: 6 }]}>Remarks</Text>
                  <TextInput style={styles.issueInput} value={vm.commissioningChecks[`${stage.prefix}REM`] || ''} onChangeText={(v) => vm.updateCommissioningCheck(`${stage.prefix}REM`, v)} placeholder="Optional remarks..." placeholderTextColor="#9CA3AF" multiline />
                </View>
              ))}

              {vm.sectionError['groupD'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupD']}</Text> : null}
              <TouchableOpacity
                style={[styles.checkSaveButton, vm.sectionSuccess['groupD'] && styles.checkSaveButtonDone]}
                onPress={vm.handleSaveGroupD}
                disabled={vm.sectionSaving['groupD']}
              >
                {vm.sectionSaving['groupD'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
              </TouchableOpacity>
              </>
              )}
            </View>

            {/* GROUP E — Running Hours (bundled with its running-hours photo
                upload, which shares the same save action). */}
            <View style={styles.sectionCard}>
              <GroupHeader
                letter="E" title="Running Hours" saved={vm.sectionSuccess['groupE'] || false}
                onPress={() => toggleSectionReopen('groupE')} expanded={isSectionExpanded('groupE')}
              />
              {isSectionExpanded('groupE') && (
              <>
              <TextInput
                style={[styles.fieldInput, { marginTop: 12 }]}
                value={vm.commissioningChecks.E_runHrs || ''}
                onChangeText={(v) => vm.updateCommissioningCheck('E_runHrs', v)}
                placeholder="Enter running hours..."
                keyboardType="numeric"
              />

              {vm.sectionError['groupE'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupE']}</Text> : null}
              <TouchableOpacity
                style={[styles.checkSaveButton, vm.sectionSuccess['groupE'] && styles.checkSaveButtonDone]}
                onPress={vm.handleSaveGroupE}
                disabled={vm.sectionSaving['groupE']}
              >
                {vm.sectionSaving['groupE'] ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
              </TouchableOpacity>

              <View style={[styles.groupDivider, { marginVertical: 12 }]} />

              {/* Running-hours photo upload (uploads together with Step 6's site photos) */}
              <Text style={styles.bigFormTitle}>Upload Photo</Text>
              {vm.runningHoursPhotos.length > 0 && (
                <View style={styles.photoGrid}>
                  {vm.runningHoursPhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoThumbWrapper}>
                      {photo.mediaType === 'video' ? (
                        <VideoThumbnail uri={photo.uri} style={styles.photoThumb} />
                      ) : (
                        <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                      )}
                      <TouchableOpacity style={styles.photoRemoveBadge} onPress={() => vm.handleRemoveRunningHoursPhoto(photo.id)}>
                        <Text style={styles.photoRemoveBadgeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.addPhotoBox} onPress={() => vm.setStep2PhotoOptionsVisible(true)}>
                <View style={styles.addPhotoIconCircle}><Text style={styles.addPhotoIcon}>📤</Text></View>
                <Text style={styles.addPhotoTitle}>Tap to upload photos</Text>
              </TouchableOpacity>
              {vm.runningHoursPhotos.length > 0 && (
                <Text style={styles.photoCountText}>{vm.runningHoursPhotos.length} photo{vm.runningHoursPhotos.length > 1 ? 's' : ''} selected</Text>
              )}
              </>
              )}
            </View>
          </>
        )}

        {/* ══════════════ STEP 2 — VALIDATION CHECKS (Revalidation only) ══════════════ */}
        {vm.currentStep === 2 && vm.isRevalidation && (
          <>
            {vm.checksLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#F26722" />
                <Text style={styles.loadingText}>Loading saved checks...</Text>
              </View>
            )}

            <View style={styles.bigFormCard}>
              <GroupHeader letter="A" title="Air Intake System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Air Cleaner Condition" optionA="Ok" optionB="Replaced" value={vm.validationChecks.A1 || ''} onSetValue={(v) => vm.updateValidationCheck('A1', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.A1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('A1_comment', v)} />
              <TwoOptionToggleRow index="2" question="Environment Condition" optionA="Clean" optionB="Dusty" value={vm.validationChecks.A2 || ''} onSetValue={(v) => vm.updateValidationCheck('A2', v)} commentTriggerValue="Dusty" comment={vm.validationChecks.A2_comment || ''} onSetComment={(v) => vm.updateValidationCheck('A2_comment', v)} />
              <TwoOptionToggleRow index="3" question="Hoses Condition" optionA="Ok" optionB="Replaced" value={vm.validationChecks.A3 || ''} onSetValue={(v) => vm.updateValidationCheck('A3', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.A3_comment || ''} onSetComment={(v) => vm.updateValidationCheck('A3_comment', v)} />

              <View style={styles.groupDivider} />
              <GroupHeader letter="B" title="Exhaust System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Exhaust Leakage" optionA="Ok" optionB="Arrested" value={vm.validationChecks.B1 || ''} onSetValue={(v) => vm.updateValidationCheck('B1', v)} commentTriggerValue="Arrested" comment={vm.validationChecks.B1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('B1_comment', v)} />
              <TwoOptionToggleRow index="2" question="Visible Exhaust Smoke Level" optionA="OK" optionB="Not OK" value={vm.validationChecks.B2 || ''} onSetValue={(v) => vm.updateValidationCheck('B2', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.B2_comment || ''} onSetComment={(v) => vm.updateValidationCheck('B2_comment', v)} />
              <TwoOptionToggleRow index="3" question="Exhaust Bellow Free Fitment" optionA="OK" optionB="Not OK" value={vm.validationChecks.B3 || ''} onSetValue={(v) => vm.updateValidationCheck('B3', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.B3_comment || ''} onSetComment={(v) => vm.updateValidationCheck('B3_comment', v)} />

              <View style={styles.groupDivider} />
              <GroupHeader letter="C" title="Lub Oil System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Lub Oil Level" optionA="Ok" optionB="Replaced" value={vm.validationChecks.C1 || ''} onSetValue={(v) => vm.updateValidationCheck('C1', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.C1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('C1_comment', v)} />
              <MultiOptionToggleRow index="2" question="Brand and Grade of Oil Used" options={['15W40 CH4', '15W40 CI4', '15W40 CI4 Plus']} value={vm.validationChecks.C2 || ''} onSetValue={(v) => vm.updateValidationCheck('C2', v)} />
              <TwoOptionToggleRow index="3" question="Oil Leakage" optionA="Ok" optionB="Corrected" value={vm.validationChecks.C3 || ''} onSetValue={(v) => vm.updateValidationCheck('C3', v)} commentTriggerValue="Corrected" comment={vm.validationChecks.C3_comment || ''} onSetComment={(v) => vm.updateValidationCheck('C3_comment', v)} />
              <TwoOptionToggleRow index="4" question="Lub Oil Filter" optionA="Ok" optionB="Replaced" value={vm.validationChecks.C4 || ''} onSetValue={(v) => vm.updateValidationCheck('C4', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.C4_comment || ''} onSetComment={(v) => vm.updateValidationCheck('C4_comment', v)} />

              <View style={styles.groupDivider} />
              <GroupHeader letter="D" title="Cooling System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Coolant Level and Condition" optionA="Ok" optionB="Replaced" value={vm.validationChecks.D1 || ''} onSetValue={(v) => vm.updateValidationCheck('D1', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.D1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('D1_comment', v)} />
              <TwoOptionToggleRow index="2" question="Coolant Leakage" optionA="Ok" optionB="Arrested" value={vm.validationChecks.D2 || ''} onSetValue={(v) => vm.updateValidationCheck('D2', v)} commentTriggerValue="Arrested" comment={vm.validationChecks.D2_comment || ''} onSetComment={(v) => vm.updateValidationCheck('D2_comment', v)} />
              <TwoOptionToggleRow index="3" question="Belt Condition" optionA="Ok" optionB="Replaced" value={vm.validationChecks.D3 || ''} onSetValue={(v) => vm.updateValidationCheck('D3', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.D3_comment || ''} onSetComment={(v) => vm.updateValidationCheck('D3_comment', v)} />
              <TwoOptionToggleRow index="4" question="Radiator Condition and Cleanliness" optionA="OK" optionB="Not OK" value={vm.validationChecks.D4 || ''} onSetValue={(v) => vm.updateValidationCheck('D4', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.D4_comment || ''} onSetComment={(v) => vm.updateValidationCheck('D4_comment', v)} />
              <TwoOptionToggleRow index="5" question="Condition of all Hoses and Clamps" optionA="Ok" optionB="Replaced" value={vm.validationChecks.D5 || ''} onSetValue={(v) => vm.updateValidationCheck('D5', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.D5_comment || ''} onSetComment={(v) => vm.updateValidationCheck('D5_comment', v)} />

              <View style={styles.groupDivider} />
              <GroupHeader letter="E" title="Fuel System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Fuel Tank Cleanliness" optionA="OK" optionB="Not OK" value={vm.validationChecks.E1 || ''} onSetValue={(v) => vm.updateValidationCheck('E1', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.E1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('E1_comment', v)} />
              <TwoOptionToggleRow index="2" question="Condition of Fuel Hoses and Leakages" optionA="Ok" optionB="Replaced" value={vm.validationChecks.E2 || ''} onSetValue={(v) => vm.updateValidationCheck('E2', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.E2_comment || ''} onSetComment={(v) => vm.updateValidationCheck('E2_comment', v)} />
              <TwoOptionToggleRow index="3" question="Fuel Filter" optionA="Ok" optionB="Replaced" value={vm.validationChecks.E3 || ''} onSetValue={(v) => vm.updateValidationCheck('E3', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.E3_comment || ''} onSetComment={(v) => vm.updateValidationCheck('E3_comment', v)} />

              <View style={styles.groupDivider} />
              <GroupHeader letter="F" title="Electrical Wiring" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Battery" optionA="Ok" optionB="Replaced" value={vm.validationChecks.F1 || ''} onSetValue={(v) => vm.updateValidationCheck('F1', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.F1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('F1_comment', v)} />
              <TwoOptionToggleRow index="2" question="Electrolyte Level and Terminal Condition of Battery" optionA="OK" optionB="Not OK" value={vm.validationChecks.F2 || ''} onSetValue={(v) => vm.updateValidationCheck('F2', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.F2_comment || ''} onSetComment={(v) => vm.updateValidationCheck('F2_comment', v)} />

              <View style={styles.checkItemBlock}>
                <Text style={styles.checkItemQuestion}>3. Battery Voltage in DC</Text>
                <TextInput style={styles.fieldInput} value={vm.validationChecks.F3 || ''} onChangeText={(v) => vm.updateValidationCheck('F3', v)} placeholder="Enter value..." keyboardType="numeric" />
              </View>

              <TwoOptionToggleRow index="4" question="Voltage Drop at Battery During Cranking Within 9V" optionA="OK" optionB="Not OK" value={vm.validationChecks.F4 || ''} onSetValue={(v) => vm.updateValidationCheck('F4', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.F4_comment || ''} onSetComment={(v) => vm.updateValidationCheck('F4_comment', v)} />
              <TwoOptionToggleRow index="5" question="Functioning of Charging Alternator" subtext="Remove the fan belt & check bearing condition" optionA="Ok" optionB="Replaced" value={vm.validationChecks.F5 || ''} onSetValue={(v) => vm.updateValidationCheck('F5', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.F5_comment || ''} onSetComment={(v) => vm.updateValidationCheck('F5_comment', v)} />
              <TwoOptionToggleRow index="6" question="Tightness of All S/W & Sensors" optionA="OK" optionB="Not OK" value={vm.validationChecks.F6 || ''} onSetValue={(v) => vm.updateValidationCheck('F6', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.F6_comment || ''} onSetComment={(v) => vm.updateValidationCheck('F6_comment', v)} />
              <TwoOptionToggleRow index="7" question="Functions of ESU (HWT, LLOP, CLS LFL)" optionA="Ok" optionB="Replaced" value={vm.validationChecks.F7 || ''} onSetValue={(v) => vm.updateValidationCheck('F7', v)} commentTriggerValue="Replaced" comment={vm.validationChecks.F7_comment || ''} onSetComment={(v) => vm.updateValidationCheck('F7_comment', v)} />

              <View style={styles.groupDivider} />
              <GroupHeader letter="G" title="General" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow index="1" question="Abnormal Sound from Engine" optionA="OK" optionB="Not OK" value={vm.validationChecks.G1 || ''} onSetValue={(v) => vm.updateValidationCheck('G1', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.G1_comment || ''} onSetComment={(v) => vm.updateValidationCheck('G1_comment', v)} />
              <TwoOptionToggleRow index="2" question="Overall Condition of Engine and Alternator" optionA="OK" optionB="Not OK" value={vm.validationChecks.G2 || ''} onSetValue={(v) => vm.updateValidationCheck('G2', v)} commentTriggerValue="Not OK" comment={vm.validationChecks.G2_comment || ''} onSetComment={(v) => vm.updateValidationCheck('G2_comment', v)} />

              {vm.sectionError['validationChecks'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['validationChecks']}</Text> : null}
              <TouchableOpacity
                style={[styles.checkSaveButton, vm.sectionSuccess['validationChecks'] && styles.checkSaveButtonDone]}
                onPress={vm.handleSaveValidationChecks}
                disabled={vm.sectionSaving['validationChecks']}
              >
                {vm.sectionSaving['validationChecks']
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <CheckCheck size={20} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════ STEP 3 — COMPLAINT CODES ══════════════ */}
        {vm.currentStep === 3 && (
          <>
            <GroupHeader title="Complaint Codes" saved={false} style={{ backgroundColor: '#FFFFFF' }} />

            {vm.selectedComplaintCodes.map((item) => (
              <ComplaintCodeCard
                key={item.uid}
                item={item}
                onRemove={() => vm.handleRemoveComplaintCode(item.uid)}
                onChangeObservation={(text) => vm.handleChangeComplaintObservation(item.uid, text)}
                onChangeRootCause={(text) => vm.handleChangeComplaintRootCause(item.uid, text)}
                onChangeCorrectiveAction={(text) => vm.handleChangeComplaintCorrectiveAction(item.uid, text)}
                onSave={vm.handleSaveFaultCodes}
                isSaving={vm.step3Saving}
              />
            ))}
            {vm.step3Error ? <Text style={styles.sectionErrorText}>{vm.step3Error}</Text> : null}

            {/* Below the added-codes list now, not above it. */}
            <TouchableOpacity style={[styles.addCodeButton, { marginBottom: 16 }]} onPress={openComplaintPicker} disabled={vm.taskCompleted}>
              <Plus size={18} color="#0F0F0F" />
              <Text style={styles.addCodeButtonText}>ADD CODE</Text>
            </TouchableOpacity>

            <ComplaintCodePickerModal
              visible={vm.complaintPickerVisible}
              onClose={vm.handleCloseComplaintPicker}
              faultCodes={vm.apiFaultCodes}
              loading={vm.faultCodesLoading}
              onSelectCode={vm.handleSelectComplaintCode}
            />
          </>
        )}

        {/* ══════════════ STEP 4 — PARTS USED ══════════════ */}
        {vm.currentStep === 4 && (
          <>
            <GroupHeader title="Parts Used" saved={false} style={{ backgroundColor: '#FFFFFF' }} />

            {vm.selectedParts.map((part) => (
              <SelectedPartCard
                key={part.partId}
                part={part}
                onIncrease={() => vm.handleIncreaseQty(part.partId)}
                onDecrease={() => vm.handleDecreaseQty(part.partId)}
                onRemove={() => vm.handleRemovePart(part.partId)}
              />
            ))}
            {vm.step4Error ? <Text style={styles.sectionErrorText}>{vm.step4Error}</Text> : null}

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

        {/* ══════════════ STEP 5 — GENSET COMMISSIONING READINGS ══════════════ */}
        {vm.currentStep === 5 && (
          <>

            <View style={styles.sectionCard}>
              <GroupHeader
                title="Electrical Readings"
                saved={!!vm.readingsSuccess}
                onPress={toggleReadingsReopen}
                expanded={readingsExpanded}
              />

              {readingsExpanded && (
                <>
                  {([
                    ['AC VOLT R-Y (V)', 'acVoltageRY'], ['AC VOLT Y-B (V)', 'acVoltageYB'], ['AC VOLT B-R (V)', 'acVoltageBR'],
                    ['AC AMP R (A)', 'acAmpR'], ['AC AMP Y (A)', 'acAmpY'], ['AC AMP B (A)', 'acAmpB'],
                    ['LOAD KW R', 'loadKwR'], ['LOAD KW Y', 'loadKwY'], ['LOAD KW B', 'loadKwB'],
                  ] as const).reduce((rows: (readonly [string, string])[][], field, i) => {
                    if (i % 3 === 0) rows.push([]);
                    rows[rows.length - 1].push(field);
                    return rows;
                  }, []).map((row, i) => (
                    <View key={i} style={[styles.fieldRow, i === 0 && { marginTop: 4 }]}>
                      {row.map(([label, key]) => (
                        <View key={key} style={styles.fieldThird}>
                          <Text style={styles.fieldLabelStatic}>{label}</Text>
                          <TextInput style={styles.fieldInput} value={vm.readings[key] || ''} onChangeText={(v) => vm.updateReading(key, v)} keyboardType="numeric" />
                        </View>
                      ))}
                    </View>
                  ))}

                  <View style={styles.fieldFull}>
                    <Text style={styles.fieldLabelStatic}>TOTAL KW</Text>
                    <TextInput style={styles.fieldInput} value={vm.readings.totalKwLoad || ''} onChangeText={(v) => vm.updateReading('totalKwLoad', v)} keyboardType="numeric" />
                  </View>
                  <View style={styles.fieldFull}>
                    <Text style={styles.fieldLabelStatic}>LOAD % (%)</Text>
                    <TextInput style={styles.fieldInput} value={vm.readings.loadPercentage || ''} onChangeText={(v) => vm.updateReading('loadPercentage', v)} keyboardType="numeric" />
                  </View>
                </>
              )}
            </View>

            <View style={styles.sectionCard}>
              <GroupHeader
                title="Engine Parameters"
                saved={!!vm.readingsSuccess}
                onPress={toggleReadingsReopen}
                expanded={readingsExpanded}
              />

              {readingsExpanded && (
                <>
                  {([
                    ['RPM', 'rpm'], ['FREQUENCY (HZ)', 'frequency'], ['DC VOLTAGE (V)', 'dcVoltage'],
                    ['OIL PRESSURE', 'oilPressure'], ['COOLANT TEMP (°C)', 'coolantTemperature'], ['DEF LEVEL (%)', 'defLevelPercentage'],
                  ] as const).reduce((rows: (readonly [string, string])[][], field, i) => {
                    if (i % 3 === 0) rows.push([]);
                    rows[rows.length - 1].push(field);
                    return rows;
                  }, []).map((row, i) => (
                    <View key={i} style={[styles.fieldRow, i === 0 && { marginTop: 4 }]}>
                      {row.map(([label, key]) => (
                        <View key={key} style={styles.fieldThird}>
                          <Text style={styles.fieldLabelStatic}>{label}</Text>
                          <TextInput style={styles.fieldInput} value={vm.readings[key] || ''} onChangeText={(v) => vm.updateReading(key, v)} keyboardType="numeric" />
                        </View>
                      ))}
                    </View>
                  ))}

                  {([['OIL LEVEL', 'oilLevel', 'oilLevelComment'], ['COOLANT LEVEL', 'coolantLevel', 'coolantLevelComment']] as const).map(([label, key, commentKey], i) => (
                    <View key={key} style={i === 0 ? { marginTop: 8 } : { marginTop: 16 }}>
                      <Text style={styles.fieldLabelStatic}>{label}</Text>
                      <View style={styles.okNotOkRow}>
                        <TouchableOpacity style={[styles.okButton, vm.readings[key]?.toUpperCase() === 'OK' && styles.okButtonActive]} onPress={() => vm.updateReading(key, 'OK')}>
                          <Text style={[styles.okButtonText, vm.readings[key]?.toUpperCase() === 'OK' && styles.okButtonTextActive]}>OK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.notOkButton, vm.readings[key]?.toUpperCase() === 'NOT OK' && styles.notOkButtonActive]} onPress={() => vm.updateReading(key, 'Not OK')}>
                          <Text style={[styles.notOkButtonText, vm.readings[key]?.toUpperCase() === 'NOT OK' && styles.notOkButtonTextActive]}>Not OK</Text>
                        </TouchableOpacity>
                      </View>
                      {vm.readings[key]?.toUpperCase() === 'NOT OK' && (
                        <TextInput
                          style={styles.issueInput}
                          placeholder={`Describe ${label.toLowerCase()} issue...`}
                          placeholderTextColor="#D1A3A3"
                          value={vm.readings[commentKey] || ''}
                          onChangeText={(v) => vm.updateReading(commentKey, v)}
                          multiline
                        />
                      )}
                    </View>
                  ))}

                  {vm.readingsError ? <Text style={styles.sectionErrorText}>{vm.readingsError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.checkSaveButton, vm.readingsSuccess && styles.checkSaveButtonDone]}
                    onPress={vm.handleSaveReadings}
                    disabled={vm.readingsSaving}
                  >
                    {vm.readingsSaving ? <ActivityIndicator color="#fff" size="small" /> : <CheckCheck size={20} color="#FFFFFF" />}
                  </TouchableOpacity>
                </>
              )}
            </View>

            {vm.readingsSavedBy && vm.readingsSavedAt && (
              <View style={styles.readingsSavedBox}>
                <Text style={styles.readingsSavedTitle}>Readings saved</Text>
                <Text style={styles.readingsSavedMeta}>
                  By {vm.readingsSavedBy.name} · {new Date(vm.readingsSavedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ══════════════ STEP 6 — PHOTOS ══════════════ */}
        {/* vm.taskCompleted (fully verified) is deliberately excluded here
            and handled just after this read-only wrapper closes below —
            its own "DONE" button needs to stay tappable, which it
            couldn't if it were rendered inside the pointerEvents-none
            block. */}
        {vm.currentStep === 6 && !vm.taskCompleted && (vm.completionSummaryLoading ? (
          <View style={styles.successCard}>
            <ActivityIndicator size="large" color="#4AC686" />
          </View>
        ) : vm.completionSummary && showOtpEntry ? (
          <>
            {!!vm.customerContactNumber && (
              <View style={styles.otpSentToCard}>
                <Phone size={18} color="#2563EB" />
                <View>
                  <Text style={styles.otpSentToLabel}>OTP SENT TO</Text>
                  <Text style={styles.otpSentToNumber}>{vm.customerContactNumber}</Text>
                </View>
              </View>
            )}

            <View style={[styles.otpInlineCard, { marginTop: 16 }]}>
              <Text style={styles.otpInlineStepLabel}>STEP 1 — GENERATE OTP</Text>
              <Text style={styles.otpInlineHint}>Share this code with the customer</Text>
              <View style={[styles.otpBoxRowV2, { justifyContent: 'center', marginTop: 12 }]}>
                {(vm.otpGenerated ? vm.generatedOtp : ['', '', '', '']).map((digit, index) => (
                  <View key={index} style={styles.otpBoxV2Generated}>
                    <Text style={styles.otpBoxV2GeneratedText}>{digit}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={{ alignSelf: 'center', marginTop: 12 }} onPress={vm.handleRegenerateOtp} disabled={vm.otpLoading}>
                <Text style={styles.otpResendLink}>Regenerate</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.otpInlineCard, { marginTop: 16 }]}>
              <Text style={styles.otpInlineStepLabel}>STEP 2 — CUSTOMER ENTERS OTP</Text>
              <View style={[styles.otpBoxRowV2, { justifyContent: 'center', marginTop: 4 }]}>
                {vm.customerOtp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { vm.otpInputRefs.current[index] = ref; }}
                    style={styles.otpBoxV2}
                    value={digit}
                    onChangeText={(text) => vm.handleChangeCustomerOtpDigit(index, text)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                    editable={vm.otpGenerated}
                  />
                ))}
              </View>

              {vm.otpError ? <Text style={styles.sectionErrorText}>{vm.otpError}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.otpVerifyButtonV2,
                  (vm.customerOtp.join('').length < 4 || vm.otpLoading) && styles.buttonDisabled,
                ]}
                onPress={vm.handleVerifyAndComplete}
                disabled={vm.customerOtp.join('').length < 4 || vm.otpLoading}
              >
                {vm.otpLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.otpInlineButtonText}>Verify & Complete</Text>}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.backToTasksButton} onPress={vm.goToCommissioningList}>
              <Text style={styles.backToTasksButtonText}>Back to Tasks</Text>
            </TouchableOpacity>
          </>
        ) : vm.completionSummary ? (
          <View style={styles.successCard}>
            <SplashVideoCircle size={164} />
            <Text style={styles.successTitle}>Successfully</Text>
            <Text style={styles.successSubtitle}>You have successfully completed the task</Text>

            <View style={styles.successPillRow}>
              <View style={styles.successDatePill}>
                <Text style={styles.successDatePillDate}>{formatShortDate(vm.completionSummary.assignedAt)}</Text>
                <Text style={styles.successDatePillTime}>{formatShortTime(vm.completionSummary.assignedAt)}</Text>
              </View>
              <View style={styles.successDurationPill}>
                <Text style={styles.successDurationText}>
                  {formatDuration(vm.completionSummary.assignedAt, vm.completionSummary.completedAt)}
                </Text>
              </View>
              <View style={styles.successDatePill}>
                <Text style={styles.successDatePillDate}>{formatShortDate(vm.completionSummary.completedAt)}</Text>
                <Text style={styles.successDatePillTime}>{formatShortTime(vm.completionSummary.completedAt)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.otpVerifyButtonV2} onPress={() => setShowOtpEntry(true)}>
              <Text style={styles.otpVerifyButtonV2Text}>OTP VERIFY</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Photos & Video card — shared with the Service form (same
                grid + video-list + upload behavior), not a duplicated copy
                of it. */}
            <PhotosVideoCard
              sitePhotos={vm.sitePhotos}
              onRemove={vm.handleRemoveSitePhoto}
              onAddPress={() => vm.setPhotoOptionsVisible(true)}
              photosUploading={vm.photosUploading}
              photosUploadProgress={vm.photosUploadProgress}
              photosUploadSuccess={vm.photosUploadSuccess}
              photosUploadError={vm.photosUploadError}
              videosUploading={vm.videosUploading}
              videosUploadProgress={vm.videosUploadProgress}
              videosUploadSuccess={vm.videosUploadSuccess}
            />

            {/* Documents card — shared with the Service form (same PDF
                pick + GCS video-confirm upload flow), not a duplicated copy
                of it. */}
            <View style={{ marginTop: 16 }}>
              <DocumentsCard
                pdfs={vm.sitePhotos.filter((p) => p.mediaType === 'pdf')}
                uploading={vm.videosUploading}
                uploadProgress={vm.videosUploadProgress}
                uploadSuccess={vm.videosUploadSuccess}
                uploadError={vm.videosUploadError}
                onPickPdf={vm.handlePickPdf}
                onRemove={vm.handleRemoveSitePhoto}
              />
            </View>
          </>
        ))}

        </View>

        {/* Task fully verified — the one piece of step 6 that stays
            interactive even though everything else above is now
            read-only, since its DONE button needs to work. */}
        {vm.currentStep === 6 && vm.taskCompleted && (
          <View style={styles.successCard}>
            <SplashVideoCircle size={164} />
            <Text style={styles.successTitle}>Successfully</Text>
            <Text style={styles.successSubtitle}>Verified the task completion.</Text>
            <TouchableOpacity style={styles.otpVerifyButtonV2} onPress={vm.goToCommissioningList}>
              <Text style={styles.otpVerifyButtonV2Text}>DONE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Camera / Gallery picker — Step 6 site photos. Photo and video
            capture are separate rows (Android's camera intent can't mix
            them in one launch — see captureFromCamera in
            useTaskFormPhotos.ts). Videos are preview-only for now (no
            backend endpoint to save them yet) — they're excluded from the
            actual upload in handleSaveAllPhotos. */}
        <Modal visible={vm.photoOptionsVisible} transparent animationType="fade" onRequestClose={() => vm.setPhotoOptionsVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => vm.setPhotoOptionsVisible(false)}>
            <View style={[styles.optionsSheet, { paddingBottom: sheetPaddingBottom }]}>
              <Text style={styles.optionsTitle}>Add Photo or Video</Text>
              <TouchableOpacity style={styles.optionRow} onPress={vm.handleTakeSitePhoto}><Text style={styles.optionText}>📷  Take Photo</Text></TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={vm.handleRecordSiteVideo}><Text style={styles.optionText}>🎥  Record Video</Text></TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={vm.handleChooseSitePhotos}><Text style={styles.optionText}>🖼️  Choose from Gallery</Text></TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={() => vm.setPhotoOptionsVisible(false)}><Text style={styles.optionText}>Cancel</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Camera / Gallery picker — Step 2 running-hours photos (same
            split-capture / preview-only video note as above). */}
        <Modal visible={vm.step2PhotoOptionsVisible} transparent animationType="fade" onRequestClose={() => vm.setStep2PhotoOptionsVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => vm.setStep2PhotoOptionsVisible(false)}>
            <View style={[styles.optionsSheet, { paddingBottom: sheetPaddingBottom }]}>
              <Text style={styles.optionsTitle}>Add Photo or Video</Text>
              <TouchableOpacity style={styles.optionRow} onPress={vm.handleTakeRunningHoursPhoto}><Text style={styles.optionText}>📷  Take Photo</Text></TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={vm.handleRecordRunningHoursVideo}><Text style={styles.optionText}>🎥  Record Video</Text></TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={vm.handleChooseRunningHoursPhotos}><Text style={styles.optionText}>🖼️  Choose from Gallery</Text></TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={() => vm.setStep2PhotoOptionsVisible(false)}><Text style={styles.optionText}>Cancel</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Labeled Back/Next bar, alongside the stepper row's flanking
            arrows above — same handlers either way, just a second, more
            discoverable way to move between steps. Hidden entirely once
            step 6's completionSummary is set (task done, nothing left to
            navigate). Scrolls away with the rest of the content instead of
            staying pinned at the screen's bottom edge. */}
        {!(vm.currentStep === 6 && !!vm.completionSummary) && (
          <View style={styles.fixedBottomActions}>
            <TouchableOpacity
              style={[styles.backButton, vm.stepSequence.indexOf(vm.currentStep) === 0 && styles.buttonDisabled]}
              onPress={vm.handleBack}
              disabled={vm.stepSequence.indexOf(vm.currentStep) === 0}
            >
              <ChevronLeft size={24} color="#4B5563" />
            </TouchableOpacity>

            {vm.currentStep === 6 ? (
              <TouchableOpacity
                style={[styles.completeTaskButton, vm.markCompleteLoading && styles.buttonDisabled]}
                onPress={vm.handleCompletePhotosStep}
                disabled={vm.markCompleteLoading}
              >
                {vm.markCompleteLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.completeTaskButtonText}>COMPLETE THE TASK</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextButton} onPress={vm.handleNext}>
                <ChevronRight size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },
  readOnlyDim: { opacity: 0.6 },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  buttonDisabled: { opacity: 0.6 },

  toastContainer: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10,
    borderRadius: 12, padding: 14, elevation: 6,
  },
  toastSuccess: { backgroundColor: '#15803D' },
  toastError: { backgroundColor: '#DC2626' },
  toastText: { color: '#fff', fontWeight: '600', textAlign: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8, marginBottom: 12,
  },
  headerButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '400', color: '#000000', textTransform: 'uppercase' },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    padding: 6,
    marginBottom: 16,
  },
  stepArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#616161',
    borderWidth: 0.67, borderColor: '#494747',
    justifyContent: 'center', alignItems: 'center',
  },
  // Same boundary-fade convention as the Dashboard/Commissioning pagination
  // arrows: opacity only, no color swap.
  stepArrowFaded: { opacity: 0.5 },
  stepCircleRow: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  stepCircleActive: { backgroundColor: '#E76124' },
  stepCircleDone: { backgroundColor: '#16A34A' },
  stepCircleText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  stepCircleTextActive: { color: '#fff' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  loadingText: { marginLeft: 8, color: '#9CA3AF', fontSize: 13 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 32, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12, marginBottom: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', letterSpacing: 0.5 },

  // Circular checkmark save button — shared across Step 1's sections, the
  // Revalidation checklist, and the Genset Commissioning Readings cards
  // (the pill header itself is GroupHeader's own now).
  checkSaveButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end', marginTop: 16,
  },
  checkSaveButtonDone: { backgroundColor: '#33A86B' },

  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  fieldHalf: { width: '48%' },
  fieldThird: { width: '31%' },
  fieldFull: { marginTop: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  fieldLabelStatic: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 6, letterSpacing: 0.3 },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1F2937', backgroundColor: '#fff',
  },
  toggleRow: { flexDirection: 'row' },
  toggleOption: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', marginRight: 8, backgroundColor: '#fff',
  },
  toggleOptionActive: { backgroundColor: '#1E1951', borderColor: '#1E1951' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#fff' },

  sectionErrorText: { color: '#DC2626', fontSize: 12, fontWeight: '500', marginTop: 10 },

  bigFormCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  bigFormTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  groupDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },

  checkItemBlock: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 12,
  },
  checkItemQuestion: { fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 10 },
  numericSubLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.3 },
  numericFieldRow: { flexDirection: 'row', justifyContent: 'space-between' },
  numericFieldThird: { width: '31%' },
  numericFieldLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  numericFieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: '#1F2937', backgroundColor: '#fff',
  },
  issueInput: {
    marginTop: 10, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, padding: 10,
    fontSize: 13, color: '#1F2937', minHeight: 44, textAlignVertical: 'top', backgroundColor: '#fff',
  },

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

  loadStageCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 12 },
  loadStageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  loadStageLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  durationPill: { backgroundColor: '#EDE9FE', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  durationPillText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },

  addCodeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 30,
    backgroundColor: '#FFFFFF',
    height: 56, paddingHorizontal: 24,
    overflow: 'hidden',
  },
  addCodeButtonText: { color: '#0F0F0F', fontWeight: '600', fontSize: 18 },

  addPhotoBox: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 24, alignItems: 'center', marginTop: 12,
  },
  addPhotoIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FDECE1',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  addPhotoIcon: { fontSize: 20 },
  addPhotoTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  addPhotoSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  photoCountText: { fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  photoThumbWrapper: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemoveBadge: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },
  photoRemoveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  readingsSavedBox: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 8 },
  readingsSavedTitle: { color: '#065F46', fontWeight: '700', fontSize: 13 },
  readingsSavedMeta: { color: '#059669', fontSize: 12, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16,
  },
  optionsTitle: { fontSize: 16, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 10 },
  optionRow: { paddingVertical: 14 },
  optionText: { fontSize: 16, fontWeight: '500', color: '#222' },
  optionDivider: { height: 1, backgroundColor: '#eee' },

  fixedBottomActions: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
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
  completeTaskButton: {
    flex: 1,
    backgroundColor: '#4AC686',
    borderRadius: 30,
    borderWidth: 1, borderColor: '#DEDEDE',
    height: 56,
    justifyContent: 'center', alignItems: 'center',
  },
  completeTaskButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 18, textTransform: 'uppercase' },

  // Step 6's own completion-success screen (shown in place of the photo
  // upload UI once vm.completionSummary is set — stays on step 6 rather
  // than advancing, per the Figma).
  successCard: { alignItems: 'center', paddingTop: 32, paddingBottom: 16, gap: 12 },
  successTitle: { fontSize: 32, fontWeight: '600', color: '#4AC686', marginTop: 8 },
  successSubtitle: { fontSize: 21, fontWeight: '400', color: '#000000', opacity: 0.4, textAlign: 'center', paddingHorizontal: 24 },
  successPillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, width: '100%' },
  successDatePill: {
    width: 75, height: 56, borderRadius: 8,
    backgroundColor: '#262626',
    justifyContent: 'center', alignItems: 'center',
  },
  successDatePillDate: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  successDatePillTime: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  successDurationPill: {
    flex: 1, height: 56, borderRadius: 8,
    backgroundColor: '#F6C8AF',
    justifyContent: 'center', alignItems: 'center',
  },
  successDurationText: { color: '#071F13', fontSize: 18, fontWeight: '600' },
  otpVerifyButtonV2: {
    width: '100%', height: 56, borderRadius: 24,
    backgroundColor: '#4AC686',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24,
  },
  otpVerifyButtonV2Text: { color: '#FFFFFF', fontWeight: '600', fontSize: 18, textTransform: 'uppercase' },
  otpInlineButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 18 },

  // "OTP SENT TO" card + the STEP 1/STEP 2 inline cards replacing the old
  // centered SplashVideoCircle OTP view — same pattern srTaskForm.tsx's own
  // Customer Sign-off card already uses for the SR flow.
  otpSentToCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 20,
    padding: 16,
  },
  otpSentToLabel: { fontSize: 11, fontWeight: '700', color: '#2563EB', letterSpacing: 0.4 },
  otpSentToNumber: { fontSize: 16, fontWeight: '700', color: '#1D4ED8', marginTop: 2 },
  otpInlineCard: { backgroundColor: '#F3F4F6', borderRadius: 20, padding: 16 },
  otpInlineStepLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.4 },
  otpInlineHint: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  otpBoxV2Generated: {
    width: 60, height: 60, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E76124',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  otpBoxV2GeneratedText: { fontSize: 20, fontWeight: '700', color: '#000000' },
  backToTasksButton: {
    height: 56, borderRadius: 100,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  backToTasksButtonText: { fontSize: 15, fontWeight: '700', color: '#4B5563' },

  otpBoxRowV2: { flexDirection: 'row', gap: 12, marginTop: 16 },
  otpBoxV2: {
    width: 60, height: 60, borderRadius: 12,
    borderWidth: 1, borderColor: '#DBDBDB',
    backgroundColor: '#F8F8F8',
    fontSize: 20, fontWeight: '700', color: '#000000',
  },
  otpResendLink: { fontSize: 16, fontWeight: '400', color: '#E76124', marginTop: 4 },
});
