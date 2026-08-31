import { Text } from "@/_components/AppText";
import { TextInput } from "@/_components/AppTextInput";
import {
  Bell, CheckCheck,
  ChevronLeft,
  ChevronRight,
  Info
} from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { AddItemButton } from "../../_components/shared/AddItemButton";
import { CompleteTaskButton } from "../../_components/shared/CompleteTaskButton";
import { SectionSaveButton } from "../../_components/shared/SectionSaveButton";
import { DocumentsCard } from "../../_components/shared/DocumentsCard";
import { LoadingOverlay } from "../../_components/shared/LoadingOverlay";
import { MediaUploadOverlay } from "../../_components/shared/MediaUploadOverlay";
import { PendingSyncBanner } from "../../_components/shared/PendingSyncBanner";
import { PhotosVideoCard } from "../../_components/shared/PhotosVideoCard";
import { StepperRow } from "../../_components/shared/StepperRow";
import { SuggestionCommentCard } from "../../_components/shared/SuggestionCommentCard";
import { TaskSummaryHeader } from "../../_components/shared/TaskSummaryHeader";
import { ComplaintCodeCard } from "../../_components/taskForm/ComplaintCodeCard";
import { ComplaintCodePickerModal } from "../../_components/taskForm/ComplaintCodePickerModal";
import { DropdownField } from "../../_components/taskForm/DropdownField";
import {
  CheckToggleRow,
  MultiOptionToggleRow,
  TwoOptionToggleRow,
  YesNoToggleRow,
} from "../../_components/taskForm/FormToggleRows";
import { GroupHeader } from "../../_components/taskForm/GroupHeader";
import { PartPickerModal } from "../../_components/taskForm/PartPickerModal";
import { SelectedPartCard } from "../../_components/taskForm/SelectedPartCard";
import { useTaskForm } from "../../controllers/taskForm/useTaskForm";
import { useFieldFocusChain } from "../../utils/useFieldFocusChain";

// Same peach->light radial gradient backdrop as the Dashboard/Commissioning
// screens (duplicated, not extracted — a small, screen-specific visual).
function ScreenBackground() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [size, setSize] = React.useState({
    width: windowWidth,
    height: windowHeight,
  });

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
          <RadialGradient
            id="taskFormBg"
            cx={size.width / 2}
            cy={size.height}
            r={size.height / 2}
            gradientUnits="userSpaceOnUse"
          >
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
  // every step's save, photo upload, mark-complete — fades the whole
  // screen with the loading video rather than just the one button's own
  // small spinner. Complaint codes (step3Saving) and parts (step4Saving)
  // are the deliberate exception: each card already has its own save
  // button with its own spinner (isSaving), so saving one card shouldn't
  // lock the whole screen and make it look like every code/part is being
  // saved together.
  // Photo/video/PDF upload no longer blocks this generic overlay — it has
  // its own dedicated MediaUploadOverlay (see below) with real progress and
  // a Cancel button, mounted whenever either photos.siteQueue or
  // photos.runningHoursQueue is active.
  const isBusy =
    vm.assetLoading ||
    vm.checksLoading ||
    vm.readingsSaving ||
    vm.markCompleteLoading ||
    vm.faultCodesLoading ||
    vm.partsLoading ||
    Object.values(vm.sectionSaving).some(Boolean);

  // The complaint-code and part pickers open as full bottom sheets, not
  // anchored to these buttons — just their own visibility toggles.
  const openComplaintPicker = () => vm.handleOpenComplaintPicker();
  const openPartPicker = () => vm.setPartPickerVisible(true);

  // Step 1's three sections auto-minimize right after a successful save
  // (vm.sectionSuccess[key] flips true) — this tracks only the *manual*
  // override once a user taps a minimized header to look at/edit it again,
  // so a section isn't permanently locked away after saving.
  const [sectionReopened, setSectionReopened] = useState<
    Record<string, boolean>
  >({});
  const isSectionExpanded = (key: string) =>
    !vm.sectionSuccess[key] || !!sectionReopened[key];
  const toggleSectionReopen = (key: string) =>
    setSectionReopened((prev) => ({ ...prev, [key]: !prev[key] }));

  // Electrical Readings + Engine Parameters (step 5) share one combined
  // save call (vm.handleSaveReadings/vm.readingsSuccess), unlike step 1's
  // three independently-saved sections — so both cards collapse/expand
  // together off the same 'readings' key rather than vm.sectionSuccess.
  const readingsExpanded = !vm.readingsSuccess || !!sectionReopened["readings"];
  const toggleReadingsReopen = () => toggleSectionReopen("readings");

  // Engine Parameters — shared JSX, rendered in one of two different spots
  // depending on the task type, since a plain commissioning/re-commissioning
  // task and a revalidation task don't share the same Step 2 content:
  // - Commissioning/re-commissioning/pre-commissioning: stays in Step 2,
  //   above Performance Trial (unchanged from before).
  // - Revalidation: Step 2 is the separate validation checklist instead
  //   (no Performance Trial to sit near), so this renders in Step 5,
  //   above Genset Electrical Readings.
  // Still part of the same combined genset-readings payload as Electrical
  // Readings (which always stays in Step 5) either way — either card's
  // Save button saves both, regardless of which step this one is on.
  const engineParametersCard = (
    <View style={styles.sectionCard}>
      <GroupHeader
        title="Engine Parameters"
        saved={!!vm.readingsSuccess}
        onPress={toggleReadingsReopen}
        expanded={readingsExpanded}
      />

      {readingsExpanded && (
        <>
          {(
            [
              ["RPM", "rpm"],
              ["Frequency (HZ)", "frequency"],
              ["DC Voltage (V)", "dcVoltage"],
              ["Oil Pressure", "oilPressure"],
              ["Coolant Temp (°C)", "coolantTemperature"],
              ["DEF Level (%)", "defLevelPercentage"],
            ] as const
          )
            .reduce(
              (rows: (readonly [string, string])[][], field, i) => {
                if (i % 3 === 0) rows.push([]);
                rows[rows.length - 1].push(field);
                return rows;
              },
              [],
            )
            .map((row, i) => (
              <View
                key={i}
                style={[
                  styles.fieldRow,
                  i === 0 && { marginTop: 4 },
                ]}
              >
                {row.map(([label, key]) => {
                  // DEF Level only applies to gensets rated
                  // 75 KVA or above — locked (not just hidden,
                  // so a value entered before a later KVA edit
                  // dropped it below 75 isn't silently lost)
                  // until that threshold is met.
                  const isDefLevel = key === "defLevelPercentage";
                  const defEnabled = (parseFloat(vm.kva) || 0) >= 75;
                  const locked = isDefLevel && !defEnabled;
                  return (
                    <View key={key} style={styles.fieldThird}>
                      <Text style={styles.fieldLabelStatic}>
                        {label}
                      </Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          locked && styles.fieldInputReadOnly,
                        ]}
                        value={vm.readings[key] || ""}
                        onChangeText={(v) => vm.updateReading(key, v)}
                        keyboardType="numeric"
                        editable={!locked}
                      />
                    </View>
                  );
                })}
              </View>
            ))}

          {(
            [
              ["Oil Level", "oilLevel", "oilLevelComment"],
              [
                "Coolant Level",
                "coolantLevel",
                "coolantLevelComment",
              ],
            ] as const
          ).map(([label, key, commentKey], i) => (
            <View
              key={key}
              style={i === 0 ? { marginTop: 8 } : { marginTop: 16 }}
            >
              <Text style={styles.fieldLabelStatic}>{label}</Text>
              <View style={styles.okNotOkRow}>
                <TouchableOpacity
                  style={[
                    styles.okButton,
                    vm.readings[key]?.toUpperCase() === "OK" &&
                      styles.okButtonActive,
                  ]}
                  onPress={() => vm.updateReading(key, "OK")}
                >
                  <Text
                    style={[
                      styles.okButtonText,
                      vm.readings[key]?.toUpperCase() === "OK" &&
                        styles.okButtonTextActive,
                    ]}
                  >
                    OK
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.notOkButton,
                    vm.readings[key]?.toUpperCase() === "NOT OK" &&
                      styles.notOkButtonActive,
                  ]}
                  onPress={() => vm.updateReading(key, "Not OK")}
                >
                  <Text
                    style={[
                      styles.notOkButtonText,
                      vm.readings[key]?.toUpperCase() ===
                        "NOT OK" && styles.notOkButtonTextActive,
                    ]}
                  >
                    Not OK
                  </Text>
                </TouchableOpacity>
              </View>
              {vm.readings[key]?.toUpperCase() === "NOT OK" && (
                <TextInput
                  style={styles.issueInput}
                  placeholder={`Describe ${label.toLowerCase()} issue...`}
                  placeholderTextColor="#D1A3A3"
                  value={vm.readings[commentKey] || ""}
                  onChangeText={(v) =>
                    vm.updateReading(commentKey, v)
                  }
                  multiline
                />
              )}
            </View>
          ))}

          {vm.readingsError ? (
            <Text style={styles.sectionErrorText}>
              {vm.readingsError}
            </Text>
          ) : null}
          <SectionSaveButton
            onPress={vm.handleSaveReadings}
            saving={vm.readingsSaving}
            done={vm.readingsSuccess}
          />
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      {isBusy && <LoadingOverlay />}
      {/* Only one of these two queues is ever active at once — Step 2 and
          Step 6 aren't shown at the same time — but both are mounted here
          so whichever one is running shows its own overlay. */}
      <MediaUploadOverlay
        visible={vm.siteUploadQueue.state.visible}
        items={vm.siteUploadQueue.state.items}
        onCancelItem={vm.siteUploadQueue.cancelItem}
        onCancelAll={vm.siteUploadQueue.cancel}
        onDismiss={vm.siteUploadQueue.dismiss}
      />
      <MediaUploadOverlay
        visible={vm.runningHoursUploadQueue.state.visible}
        items={vm.runningHoursUploadQueue.state.items}
        onCancelItem={vm.runningHoursUploadQueue.cancelItem}
        onCancelAll={vm.runningHoursUploadQueue.cancel}
        onDismiss={vm.runningHoursUploadQueue.dismiss}
      />
      {vm.toastVisible && (
        <View
          style={[
            styles.toastContainer,
            vm.toastType === "success"
              ? styles.toastSuccess
              : styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>{vm.toastMessage}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={vm.goToCommissioningList}
        >
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{vm.taskTypeLabel}</Text>
        <View style={styles.headerButton}>
          <Bell size={22} color="#979797" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android's own native "pan" mode (app.json's softwareKeyboardLayoutMode)
        // is the default across most of this app's simpler screens, but on a
        // form this long (6 steps, dozens of fields) it doesn't reliably
        // scroll a field near the bottom of a step into view above the
        // keyboard — same reachability problem createAssetCommission.tsx
        // hit, fixed there the same way: behavior="height" actively shrinks
        // this container so the ScrollView (and its own focus-scroll
        // behavior) has real room to work with, accepting the risk of a
        // double-compensation gap in exchange for fields actually being
        // reachable.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Numbered circles only, no prev/next arrows — each screen has its
            own Back/Next buttons lower on the page; tapping a circle still
            jumps directly to that step, unchanged. */}
          <StepperRow
            steps={vm.stepSequence}
            currentStep={vm.currentStep}
            onSelectStep={vm.setCurrentStep}
          />

          <View>
            {/* Shown on every step now, not just step 1 — gives constant
            context (task type, assignees, genset/engine ID) while paging
            through the form, not only when first landing on it. */}
            <TaskSummaryHeader task={vm.task} asset={vm.assetDetail} />

            <PendingSyncBanner />

            {/* ══════════════ STEP 1 — ASSET INFORMATION ══════════════ */}
            {vm.currentStep === 1 && (
              <>
                {vm.assetLoading && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#F26722" />
                    <Text style={styles.loadingText}>
                      Loading asset data...
                    </Text>
                  </View>
                )}

                {/* Genset Identification */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    title="Genset Identification"
                    saved={!!vm.sectionSuccess["genset"]}
                    onPress={() => toggleSectionReopen("genset")}
                    expanded={isSectionExpanded("genset")}
                    missingCount={vm.gensetMissingCount}
                  />

                  {isSectionExpanded("genset") && (
                    <>
                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Genset Model</Text>
                          <TextInput
                            style={styles.fieldInput}
                            value={vm.gensetModel}
                            onChangeText={vm.setGensetModel}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("gensetSrNumber")}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>
                            Genset SR Number
                          </Text>
                          <TextInput
                            ref={register("gensetSrNumber")}
                            style={styles.fieldInput}
                            value={vm.gensetSrNumber}
                            onChangeText={vm.setGensetSrNumber}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("engineModel")}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Engine Model</Text>
                          <TextInput
                            ref={register("engineModel")}
                            style={styles.fieldInput}
                            value={vm.engineModel}
                            onChangeText={vm.setEngineModel}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("engineNumber")}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>
                            Engine SR Number
                          </Text>
                          <TextInput
                            ref={register("engineNumber")}
                            style={styles.fieldInput}
                            value={vm.engineNumber}
                            onChangeText={vm.setEngineNumber}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("engineKw")}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Engine KW</Text>
                          <TextInput
                            ref={register("engineKw")}
                            style={styles.fieldInput}
                            value={vm.engineKw}
                            onChangeText={vm.setEngineKw}
                            keyboardType="numeric"
                            returnKeyType="done"
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="Engine Type"
                            value={vm.engineType}
                            options={vm.ENGINE_TYPE_OPTIONS}
                            onSelect={vm.setEngineType}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="Engine Family"
                            value={vm.engineFamily}
                            options={vm.ENGINE_FAMILY_OPTIONS}
                            onSelect={vm.setEngineFamily}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="Fuel Type"
                            value={vm.fuelType}
                            options={vm.FUEL_TYPE_OPTIONS}
                            onSelect={vm.setFuelType}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="Application"
                            value={vm.application}
                            options={vm.APPLICATION_OPTIONS}
                            onSelect={vm.setApplication}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="CPCB Norm"
                            value={vm.cpcbNorm}
                            options={vm.CPCB_NORM_OPTIONS}
                            onSelect={vm.setCpcbNorm}
                          />
                        </View>
                      </View>

                      {/* ATS S/N — moved here from Alternator & Panel. */}
                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>ATS S/N</Text>
                          <TextInput
                            ref={register("atsSn")}
                            style={styles.fieldInput}
                            value={vm.atsSn}
                            onChangeText={vm.setAtsSn}
                            returnKeyType="done"
                          />
                        </View>
                      </View>

                      {vm.sectionError["genset"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["genset"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveGensetIdentification}
                        saving={vm.sectionSaving["genset"]}
                        done={vm.sectionSuccess["genset"]}
                      />
                    </>
                  )}
                </View>

                {/* Alternator & Panel */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    title="Alternator & Panel"
                    saved={!!vm.sectionSuccess["alternator"]}
                    onPress={() => toggleSectionReopen("alternator")}
                    expanded={isSectionExpanded("alternator")}
                    missingCount={vm.altMissingCount}
                  />

                  {isSectionExpanded("alternator") && (
                    <>
                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Alt. Make</Text>
                          <TextInput
                            style={styles.fieldInput}
                            value={vm.altMake}
                            onChangeText={vm.setAltMake}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("altModel")}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Alt. Model</Text>
                          <TextInput
                            ref={register("altModel")}
                            style={styles.fieldInput}
                            value={vm.altModel}
                            onChangeText={vm.setAltModel}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("altSn")}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Alt. S/N</Text>
                          <TextInput
                            ref={register("altSn")}
                            style={styles.fieldInput}
                            value={vm.altSn}
                            onChangeText={vm.setAltSn}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("batteryType")}
                          />
                        </View>
                        {/* Was a single "Battery S/N" field — now Battery
                            Type plus two separate serial numbers, since a
                            genset can have 2 batteries. */}
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Battery Type</Text>
                          <TextInput
                            ref={register("batteryType")}
                            style={styles.fieldInput}
                            value={vm.batteryType}
                            onChangeText={vm.setBatteryType}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("batterySn")}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Battery 1 S/N</Text>
                          <TextInput
                            ref={register("batterySn")}
                            style={styles.fieldInput}
                            value={vm.batterySn}
                            onChangeText={vm.setBatterySn}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("battery2Sn")}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Battery 2 S/N</Text>
                          <TextInput
                            ref={register("battery2Sn")}
                            style={styles.fieldInput}
                            value={vm.battery2Sn}
                            onChangeText={vm.setBattery2Sn}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("kva")}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>KVA Rating</Text>
                          <TextInput
                            ref={register("kva")}
                            style={styles.fieldInput}
                            value={vm.kva}
                            onChangeText={vm.setKva}
                            keyboardType="numeric"
                            returnKeyType="done"
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="Phase"
                            value={vm.phase}
                            options={vm.PHASE_OPTIONS}
                            onSelect={vm.setPhase}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <DropdownField
                            plainLabel
                            label="Panel Type"
                            value={vm.panelType}
                            options={vm.PANEL_TYPE_OPTIONS}
                            onSelect={vm.setPanelType}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Panel S/N</Text>
                          <TextInput
                            ref={register("panelSn")}
                            style={styles.fieldInput}
                            value={vm.panelSn}
                            onChangeText={vm.setPanelSn}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("controllerType")}
                          />
                        </View>
                      </View>

                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Controller Type</Text>
                          <TextInput
                            ref={register("controllerType")}
                            style={styles.fieldInput}
                            value={vm.controllerType}
                            onChangeText={vm.setControllerType}
                            returnKeyType="next"
                            submitBehavior="submit"
                            onSubmitEditing={() => focusNext("controllerSr")}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabel}>Controller S/R</Text>
                          <TextInput
                            ref={register("controllerSr")}
                            style={styles.fieldInput}
                            value={vm.controllerSr}
                            onChangeText={vm.setControllerSr}
                            returnKeyType="done"
                          />
                        </View>
                      </View>

                      {vm.sectionError["alternator"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["alternator"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveAlternatorPanel}
                        saving={vm.sectionSaving["alternator"]}
                        done={vm.sectionSuccess["alternator"]}
                      />
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
                    <Text style={styles.loadingText}>
                      Loading saved checks...
                    </Text>
                  </View>
                )}

                {!!vm.prefillChecks && (
                  <View style={styles.prefillCard}>
                    <Info size={18} color="#B45309" />
                    <Text style={styles.prefillCardText}>
                      Pre-Commissioning checks available — load as starting
                      point.
                    </Text>
                    <TouchableOpacity
                      style={styles.prefillLoadButton}
                      onPress={vm.handleLoadPrefillChecks}
                    >
                      <Text style={styles.prefillLoadButtonText}>Load</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* GROUP A */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    letter="A"
                    title="Pre-Installation Checks"
                    saved={vm.sectionSuccess["groupA"] || false}
                    onPress={() => toggleSectionReopen("groupA")}
                    expanded={isSectionExpanded("groupA")}
                  />
                  {isSectionExpanded("groupA") && (
                    <>
                      <CheckToggleRow
                        index={1}
                        question="Genset Installation"
                        value={vm.commissioningChecks.A1 || ""}
                        comment={vm.commissioningChecks.A1_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("A1", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A1_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={2}
                        question="No obstruction to cooling air inlet and air outlet"
                        value={vm.commissioningChecks.A2 || ""}
                        comment={vm.commissioningChecks.A2_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("A2", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A2_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={3}
                        question="All canopy doors open fully for service access"
                        value={vm.commissioningChecks.A3 || ""}
                        comment={vm.commissioningChecks.A3_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("A3", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A3_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={4}
                        question="DG set room ventilation (if installed in a room)"
                        value={vm.commissioningChecks.A4 || ""}
                        comment={vm.commissioningChecks.A4_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("A4", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A4_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={5}
                        question="Fitment of exhaust silencer and exhaust piping"
                        value={vm.commissioningChecks.A5 || ""}
                        comment={vm.commissioningChecks.A5_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("A5", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A5_comment", v)
                        }
                      />
                      {/* Split into 3 separate sub-checks (was one combined
                      row) — A6a/A6b/A6c (with _comment variants, shown
                      once a row is marked Not OK) are the confirmed real
                      backend field keys for these. */}
                      <Text style={styles.checkGroupHeading}>
                        <Text style={styles.checkGroupHeadingNumber}>06.</Text>{" "}
                        Earthing
                      </Text>
                      <CheckToggleRow
                        index={null}
                        question="A. 1 Nos earthing pits for Genset and Control Panel Body"
                        value={vm.commissioningChecks.A6a || ""}
                        comment={vm.commissioningChecks.A6a_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("A6a", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A6a_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={null}
                        question="B. 2 Nos. of earthing pits for Neutral"
                        value={vm.commissioningChecks.A6b || ""}
                        comment={vm.commissioningChecks.A6b_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("A6b", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A6b_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={null}
                        question="C. 1 Nos. of earthing pits for Alternator Body"
                        value={vm.commissioningChecks.A6c || ""}
                        comment={vm.commissioningChecks.A6c_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("A6c", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A6c_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={7}
                        question="Visually check all fasteners"
                        value={vm.commissioningChecks.A7 || ""}
                        comment={vm.commissioningChecks.A7_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("A7", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A7_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={8}
                        question="Visually check wiring connections in control panel"
                        value={vm.commissioningChecks.A8 || ""}
                        comment={vm.commissioningChecks.A8_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("A8", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A8_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={9}
                        question="230V supply for battery charger"
                        value={vm.commissioningChecks.A9 || ""}
                        comment={vm.commissioningChecks.A9_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("A9", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A9_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={10}
                        question="Visually check all connectors and actuators on engine"
                        value={vm.commissioningChecks.A10 || ""}
                        comment={vm.commissioningChecks.A10_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("A10", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("A10_comment", v)
                        }
                      />

                      {/* Numeric readings, not OK/Not-OK toggles — same A11-A19
                      keys as before, just a different input type/layout
                      (split into its own 11/12 group headings, matching
                      the reference design). */}
                      <Text style={styles.checkGroupHeading}>
                        <Text style={styles.checkGroupHeadingNumber}>11.</Text>{" "}
                        Electricity board (Mains) Load
                      </Text>
                      <View
                        style={[
                          styles.numericFieldRow,
                          { marginTop: 8, paddingHorizontal: 34 },
                        ]}
                      >
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. R Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A11 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A11", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. Y Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A12 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A12", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. B Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A13 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A13", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <Text
                        style={[styles.checkGroupHeading, { marginTop: 16 }]}
                      >
                        <Text style={styles.checkGroupHeadingNumber}>12.</Text>{" "}
                        Electricity board (Mains) Voltage
                      </Text>

                      <Text style={styles.voltageGroupSubheading}>
                        Line Voltage
                      </Text>
                      <View
                        style={[
                          styles.numericFieldRow,
                          { marginTop: 8, paddingHorizontal: 34 },
                        ]}
                      >
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. R-Y Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A14 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A14", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. Y-B Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A15 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A15", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. B-R Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A16 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A16", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.voltageGroupSubheading,
                          { marginTop: 14 },
                        ]}
                      >
                        Phase-Neutral Voltage
                      </Text>
                      <View
                        style={[
                          styles.numericFieldRow,
                          { marginTop: 8, paddingHorizontal: 34 },
                        ]}
                      >
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            A. R-N Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A17 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A17", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            B. Y-N Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A18 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A18", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={styles.numericFieldThird}>
                          <Text style={styles.numericFieldLabel}>
                            C. B-N Phase
                          </Text>
                          <TextInput
                            style={[
                              styles.numericFieldInput,
                              { textAlign: "center" },
                            ]}
                            value={vm.commissioningChecks.A19 || ""}
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck("A19", v)
                            }
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      {vm.sectionError["groupA"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["groupA"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveGroupA}
                        saving={vm.sectionSaving["groupA"]}
                        done={vm.sectionSuccess["groupA"]}
                      />
                    </>
                  )}
                </View>

                {/* GROUP B */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    letter="B"
                    title="Commissioning Instructions"
                    saved={vm.sectionSuccess["groupB"] || false}
                    onPress={() => toggleSectionReopen("groupB")}
                    expanded={isSectionExpanded("groupB")}
                  />
                  {isSectionExpanded("groupB") && (
                    <>
                      <CheckToggleRow
                        index={1}
                        question="Lub Oil Level"
                        value={vm.commissioningChecks.B1 || ""}
                        comment={vm.commissioningChecks.B1_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("B1", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B1_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={2}
                        question="Fuel Level"
                        value={vm.commissioningChecks.B2 || ""}
                        comment={vm.commissioningChecks.B2_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("B2", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B2_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={3}
                        question="Coolant Level"
                        value={vm.commissioningChecks.B3 || ""}
                        comment={vm.commissioningChecks.B3_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("B3", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B3_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={4}
                        question="Oil Leakage (Cam cover, Chain case Cover, Oil sump, Oil filter, Turbo, All hoses)"
                        value={vm.commissioningChecks.B4a || ""}
                        comment={vm.commissioningChecks.B4a_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("B4a", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B4a_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={5}
                        question="Coolant Leakage (Radiator, Radiator inlet and outlet Hoses, Coolant Pump, Engine inlet and outlet Hoses, Oil Cooler)"
                        value={vm.commissioningChecks.B4b || ""}
                        comment={vm.commissioningChecks.B4b_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("B4b", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B4b_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={6}
                        question="Fuel Leakage (Fuel Filter, Fuel Feed pump, Low pressure pipe, IMV Pump, HP Pipe, Back Leak pipe, Fuel tank, Fuel tank Drain plug)"
                        value={vm.commissioningChecks.B4c || ""}
                        comment={vm.commissioningChecks.B4c_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("B4c", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B4c_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={7}
                        question="Air Leakage"
                        value={vm.commissioningChecks.B4d || ""}
                        comment={vm.commissioningChecks.B4d_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("B4d", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("B4d_comment", v)
                        }
                      />

                      {vm.sectionError["groupB"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["groupB"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveGroupB}
                        saving={vm.sectionSaving["groupB"]}
                        done={vm.sectionSuccess["groupB"]}
                      />
                    </>
                  )}
                </View>

                {/* GROUP C */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    letter="C"
                    title="CPCB IV+ ATS System Check Points"
                    saved={vm.sectionSuccess["groupC"] || false}
                    onPress={() => toggleSectionReopen("groupC")}
                    expanded={isSectionExpanded("groupC")}
                  />
                  {isSectionExpanded("groupC") && (
                    <>
                      <CheckToggleRow
                        index={1}
                        question="DEF / ADD Blue Tank Fitment & Level"
                        value={vm.commissioningChecks.C1 || ""}
                        comment={vm.commissioningChecks.C1_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C1", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C1_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={2}
                        question="Urea Supply & Return Line Fitment"
                        value={vm.commissioningChecks.C2 || ""}
                        comment={vm.commissioningChecks.C2_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C2", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C2_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={3}
                        question="DOC/POC/ATS Fitment/Connections"
                        value={vm.commissioningChecks.C3 || ""}
                        comment={vm.commissioningChecks.C3_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C3", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C3_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={4}
                        question="Exh. Gas Temp. Sensor Connections"
                        value={vm.commissioningChecks.C4 || ""}
                        comment={vm.commissioningChecks.C4_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C4", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C4_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={5}
                        question="NOx Sensor Connections"
                        value={vm.commissioningChecks.C5 || ""}
                        comment={vm.commissioningChecks.C5_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C5", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C5_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={6}
                        question="EGR / ECU Fitment & Connections"
                        value={vm.commissioningChecks.C6 || ""}
                        comment={vm.commissioningChecks.C6_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C6", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C6_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={7}
                        question="Engine ECM Fitment & Connections"
                        value={vm.commissioningChecks.C7 || ""}
                        comment={vm.commissioningChecks.C7_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C7", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C7_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={8}
                        question="Buzzer / Flasher Working"
                        value={vm.commissioningChecks.C8 || ""}
                        comment={vm.commissioningChecks.C8_comment || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("C8", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C8_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={9}
                        question="Ambient Temp. Sensor Fitment & Connections"
                        value={vm.commissioningChecks.C9 || ""}
                        comment={vm.commissioningChecks.C9_comment || ""}
                        hasNA
                        onSetValue={(v) => vm.updateCommissioningCheck("C9", v)}
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C9_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={10}
                        question="Exhaust Smoke Colour"
                        value={vm.commissioningChecks.C10 || ""}
                        comment={vm.commissioningChecks.C10_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("C10", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C10_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={11}
                        question="Wiring Harness & Connections"
                        value={vm.commissioningChecks.C11 || ""}
                        comment={vm.commissioningChecks.C11_comment || ""}
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("C11", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C11_comment", v)
                        }
                      />

                      <View style={styles.checkItemBlock}>
                        <Text style={styles.checkItemQuestion}>
                          12. Exhaust Temp. on Load DOC (°C)
                        </Text>
                        <View style={styles.numericFieldRow}>
                          {(
                            [
                              ["Before", "C12"],
                              ["After", "C13"],
                            ] as const
                          ).map(([label, key]) => (
                            <View key={key} style={{ width: "48%" }}>
                              <Text style={styles.numericFieldLabel}>
                                {label}
                              </Text>
                              <TextInput
                                style={styles.numericFieldInput}
                                value={vm.commissioningChecks[key] || ""}
                                onChangeText={(v) =>
                                  vm.updateCommissioningCheck(key, v)
                                }
                                keyboardType="numeric"
                              />
                            </View>
                          ))}
                        </View>
                      </View>

                      <CheckToggleRow
                        index={13}
                        question="Supply Module Fitment & Connection"
                        value={vm.commissioningChecks.C14 || ""}
                        comment={vm.commissioningChecks.C14_comment || ""}
                        hasNA
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("C14", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C14_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={14}
                        question="Dosing Module Fitment & Connection"
                        value={vm.commissioningChecks.C15 || ""}
                        comment={vm.commissioningChecks.C15_comment || ""}
                        hasNA
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("C15", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C15_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={15}
                        question="ATS Control Module Fitment & Connections"
                        value={vm.commissioningChecks.C16 || ""}
                        comment={vm.commissioningChecks.C16_comment || ""}
                        hasNA
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("C16", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C16_comment", v)
                        }
                      />
                      <CheckToggleRow
                        index={16}
                        question="ATS System Working"
                        value={vm.commissioningChecks.C17 || ""}
                        comment={vm.commissioningChecks.C17_comment || ""}
                        hasNA
                        onSetValue={(v) =>
                          vm.updateCommissioningCheck("C17", v)
                        }
                        onSetComment={(v) =>
                          vm.updateCommissioningCheck("C17_comment", v)
                        }
                      />

                      <View style={styles.checkItemBlock}>
                        <Text style={styles.checkItemQuestion}>
                          17. DEF Make (ISO22241 Recommendation)
                        </Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={vm.commissioningChecks.C18 || ""}
                          onChangeText={(v) =>
                            vm.updateCommissioningCheck("C18", v)
                          }
                          placeholder="Enter value..."
                        />
                      </View>

                      {vm.sectionError["groupC"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["groupC"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveGroupC}
                        saving={vm.sectionSaving["groupC"]}
                        done={vm.sectionSuccess["groupC"]}
                      />
                    </>
                  )}
                </View>

                {engineParametersCard}

                {/* GROUP D — Performance Trial */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    letter="D"
                    title="Performance Trial"
                    saved={vm.sectionSuccess["groupD"] || false}
                    onPress={() => toggleSectionReopen("groupD")}
                    expanded={isSectionExpanded("groupD")}
                  />
                  {isSectionExpanded("groupD") && (
                    <>
                      {(
                        [
                          { label: "0% Load", duration: "5 min", prefix: "D0" },
                          {
                            label: "25% Load",
                            duration: "5 min",
                            prefix: "D25",
                          },
                          {
                            label: "50% Load",
                            duration: "5 min",
                            prefix: "D50",
                          },
                          {
                            label: "75% Load",
                            duration: "5 min",
                            prefix: "D75",
                          },
                          {
                            label: "100% Load",
                            duration: "10 min",
                            prefix: "D100",
                          },
                        ] as const
                      ).map((stage) => (
                        <View key={stage.prefix} style={styles.loadStageCard}>
                          <View style={styles.loadStageHeaderRow}>
                            <Text style={styles.loadStageLabel}>
                              {stage.label}
                            </Text>
                            <View style={styles.durationPill}>
                              <Text style={styles.durationPillText}>
                                {stage.duration}
                              </Text>
                            </View>
                          </View>

                          {/* 0% Load has no actual load on the genset yet, so
                      there's nothing to read here — only every other
                      stage (25/50/75/100%) asks for it. */}
                          {stage.prefix !== "D0" && (
                            <>
                              <Text style={styles.numericSubLabel}>
                                Load (AMPS)
                              </Text>
                              <View style={styles.numericFieldRow}>
                                {(["LR", "LY", "LB"] as const).map(
                                  (suffix, i) => (
                                    <View
                                      key={suffix}
                                      style={styles.numericFieldThird}
                                    >
                                      <Text style={styles.numericFieldLabel}>
                                        {["R", "Y", "B"][i]}
                                      </Text>
                                      <TextInput
                                        style={styles.numericFieldInput}
                                        value={
                                          vm.commissioningChecks[
                                            `${stage.prefix}${suffix}`
                                          ] || ""
                                        }
                                        onChangeText={(v) =>
                                          vm.updateCommissioningCheck(
                                            `${stage.prefix}${suffix}`,
                                            v,
                                          )
                                        }
                                        keyboardType="numeric"
                                      />
                                    </View>
                                  ),
                                )}
                              </View>
                            </>
                          )}

                          <Text
                            style={[styles.numericSubLabel, { marginTop: 14 }]}
                          >
                            Voltage (VOLTS)
                          </Text>
                          <View style={styles.numericFieldRow}>
                            {(["VR", "VY", "VB"] as const).map((suffix, i) => (
                              <View
                                key={suffix}
                                style={styles.numericFieldThird}
                              >
                                <Text style={styles.numericFieldLabel}>
                                  {["R", "Y", "B"][i]}
                                </Text>
                                <TextInput
                                  style={styles.numericFieldInput}
                                  value={
                                    vm.commissioningChecks[
                                      `${stage.prefix}${suffix}`
                                    ] || ""
                                  }
                                  onChangeText={(v) =>
                                    vm.updateCommissioningCheck(
                                      `${stage.prefix}${suffix}`,
                                      v,
                                    )
                                  }
                                  keyboardType="numeric"
                                />
                              </View>
                            ))}
                          </View>

                          <View style={[styles.fieldRow, { marginTop: 14 }]}>
                            <View style={styles.fieldHalf}>
                              <Text style={styles.numericFieldLabel}>
                                Freq (Hz)
                              </Text>
                              <TextInput
                                style={styles.fieldInput}
                                value={
                                  vm.commissioningChecks[`${stage.prefix}F`] ||
                                  ""
                                }
                                onChangeText={(v) =>
                                  vm.updateCommissioningCheck(
                                    `${stage.prefix}F`,
                                    v,
                                  )
                                }
                                keyboardType="numeric"
                              />
                            </View>
                            <View style={styles.fieldHalf}>
                              <Text style={styles.numericFieldLabel}>
                                Battery V
                              </Text>
                              <TextInput
                                style={styles.fieldInput}
                                value={
                                  vm.commissioningChecks[`${stage.prefix}BV`] ||
                                  ""
                                }
                                onChangeText={(v) =>
                                  vm.updateCommissioningCheck(
                                    `${stage.prefix}BV`,
                                    v,
                                  )
                                }
                                keyboardType="numeric"
                              />
                            </View>
                          </View>

                          <Text
                            style={[
                              styles.numericFieldLabel,
                              { marginTop: 14, marginBottom: 6 },
                            ]}
                          >
                            Remarks
                          </Text>
                          <TextInput
                            style={styles.issueInput}
                            value={
                              vm.commissioningChecks[`${stage.prefix}REM`] || ""
                            }
                            onChangeText={(v) =>
                              vm.updateCommissioningCheck(
                                `${stage.prefix}REM`,
                                v,
                              )
                            }
                            placeholder="Optional remarks..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                          />
                        </View>
                      ))}

                      {vm.sectionError["groupD"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["groupD"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveGroupD}
                        saving={vm.sectionSaving["groupD"]}
                        done={vm.sectionSuccess["groupD"]}
                      />
                    </>
                  )}
                </View>

                {/* Load Unbalance (moved from Step 1's Alternator & Panel)
                    and Phase Difference (A) (moved from Group B's item 8) —
                    sit here, between Performance Trial and Running Hours, in
                    their own unlettered section. Still saved by their
                    original actions (handleSaveAlternatorPanel/
                    handleSaveGroupB) — only the on-screen position changed,
                    not which payload each field's value is actually part
                    of, so saving from here updates the exact same
                    Alternator & Panel / Group B success state those cards
                    show too. */}
                <View style={styles.sectionCard}>
                  <GroupHeader title="Load & Phase Check" saved={false} />
                  <Text style={styles.fieldLabel}>Load Unbalance</Text>
                  <View style={[styles.fieldFull, { marginTop: 10 }]}>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.toggleOption,
                          vm.loadUnbalance === "Yes" &&
                            styles.toggleOptionActive,
                        ]}
                        onPress={() => vm.setLoadUnbalance("Yes")}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            vm.loadUnbalance === "Yes" &&
                              styles.toggleTextActive,
                          ]}
                        >
                          Yes
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.toggleOption,
                          vm.loadUnbalance === "No" &&
                            styles.toggleOptionActive,
                        ]}
                        onPress={() => vm.setLoadUnbalance("No")}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            vm.loadUnbalance === "No" &&
                              styles.toggleTextActive,
                          ]}
                        >
                          No
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {vm.loadUnbalance === "Yes" && (
                      <View style={[styles.fieldFull, { marginTop: 12 }]}>
                        <Text style={styles.fieldLabel}>Unbalance %</Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={vm.loadUnbalancePercentage}
                          onChangeText={vm.setLoadUnbalancePercentage}
                          keyboardType="numeric"
                        />
                      </View>
                    )}
                    {vm.loadUnbalance === "No" && (
                      <View style={[styles.fieldFull, { marginTop: 12 }]}>
                        <Text style={styles.fieldLabel}>Comment</Text>
                        <TextInput
                          style={styles.fieldInput}
                          value={vm.loadUnbalanceComment}
                          onChangeText={vm.setLoadUnbalanceComment}
                        />
                      </View>
                    )}
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                    Phase Difference Genset (A)
                  </Text>
                  <View
                    style={[
                      styles.numericFieldRow,
                      { marginTop: 10 },
                    ]}
                  >
                    {(
                      [
                        ["R Phase", "B5R"],
                        ["Y Phase", "B5Y"],
                        ["B Phase", "B5B"],
                      ] as const
                    ).map(([label, key]) => (
                      <View key={key} style={styles.numericFieldThird}>
                        <Text style={styles.numericFieldLabel}>{label}</Text>
                        <TextInput
                          style={styles.numericFieldInput}
                          value={vm.commissioningChecks[key] || ""}
                          onChangeText={(v) =>
                            vm.updateCommissioningCheck(key, v)
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    ))}
                  </View>

                  {/* One button saves both halves of this card — Load
                  Unbalance (Alternator & Panel's payload) and Phase
                  Difference Genset A (Group B's payload) — via
                  handleSaveLoadAndPhaseCheck, which fires both underlying
                  saves together. */}
                  {vm.sectionError["alternator"] ? (
                    <Text style={styles.sectionErrorText}>
                      {vm.sectionError["alternator"]}
                    </Text>
                  ) : null}
                  {vm.sectionError["groupB"] ? (
                    <Text style={styles.sectionErrorText}>
                      {vm.sectionError["groupB"]}
                    </Text>
                  ) : null}
                  <SectionSaveButton
                    onPress={vm.handleSaveLoadAndPhaseCheck}
                    saving={vm.sectionSaving["alternator"] || vm.sectionSaving["groupB"]}
                    done={vm.sectionSuccess["alternator"] && vm.sectionSuccess["groupB"]}
                  />
                </View>

                {/* GROUP E — Running Hours (bundled with its running-hours photo
                upload, which shares the same save action). */}
                <View style={styles.sectionCard}>
                  <GroupHeader
                    letter="E"
                    title="Running Hours"
                    saved={vm.sectionSuccess["groupE"] || false}
                    onPress={() => toggleSectionReopen("groupE")}
                    expanded={isSectionExpanded("groupE")}
                  />
                  {isSectionExpanded("groupE") && (
                    <>
                      <TextInput
                        style={[styles.fieldInput, { marginTop: 12 }]}
                        value={vm.commissioningChecks.E_runHrs || ""}
                        onChangeText={(v) =>
                          vm.updateCommissioningCheck("E_runHrs", v)
                        }
                        placeholder="Enter running hours..."
                        keyboardType="numeric"
                      />

                      {vm.sectionError["groupE"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["groupE"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveGroupE}
                        saving={vm.sectionSaving["groupE"]}
                        done={vm.sectionSuccess["groupE"]}
                      />

                      <View style={[styles.groupDivider, { marginVertical: 12 }]} />

                      {/* Running-hours photo upload — same PhotosVideoCard Step 6
                          uses. Each photo uploads immediately on pick via its own
                          queue (vm.runningHoursUploadQueue, see MediaUploadOverlay
                          above) rather than a batch call — imagesOnly since this
                          step never takes video or PDF (the step2 picker below
                          only offers Take Photo/Choose from Gallery, both
                          images-only). */}
                      <PhotosVideoCard
                        sitePhotos={vm.runningHoursPhotos}
                        onRemove={vm.handleRemoveRunningHoursPhoto}
                        onAddPress={() => vm.setStep2PhotoOptionsVisible(true)}
                        imagesOnly
                      />
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
                    <Text style={styles.loadingText}>
                      Loading saved checks...
                    </Text>
                  </View>
                )}

                <View style={styles.bigFormCard}>
                  <GroupHeader
                    letter="A"
                    title="Air Intake System"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Air Cleaner Condition"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.A1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("A1", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.A1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("A1_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="2"
                    question="Environment Condition"
                    optionA="Clean"
                    optionB="Dusty"
                    value={vm.validationChecks.A2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("A2", v)}
                    commentTriggerValue="Dusty"
                    comment={vm.validationChecks.A2_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("A2_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="3"
                    question="Hoses Condition"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.A3 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("A3", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.A3_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("A3_comment", v)
                    }
                  />

                  <View style={styles.groupDivider} />
                  <GroupHeader
                    letter="B"
                    title="Exhaust System"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Exhaust Leakage"
                    optionA="Ok"
                    optionB="Arrested"
                    value={vm.validationChecks.B1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("B1", v)}
                    commentTriggerValue="Arrested"
                    comment={vm.validationChecks.B1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("B1_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="2"
                    question="Visible Exhaust Smoke Level"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.B2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("B2", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.B2_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("B2_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="3"
                    question="Exhaust Bellow Free Fitment"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.B3 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("B3", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.B3_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("B3_comment", v)
                    }
                  />

                  <View style={styles.groupDivider} />
                  <GroupHeader
                    letter="C"
                    title="Lub Oil System"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Lub Oil Level"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.C1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("C1", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.C1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("C1_comment", v)
                    }
                  />
                  <MultiOptionToggleRow
                    index="2"
                    question="Brand and Grade of Oil Used"
                    options={["15W40 CH4", "15W40 CI4", "15W40 CI4 Plus"]}
                    value={vm.validationChecks.C2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("C2", v)}
                  />
                  <TwoOptionToggleRow
                    index="3"
                    question="Oil Leakage"
                    optionA="Ok"
                    optionB="Corrected"
                    value={vm.validationChecks.C3 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("C3", v)}
                    commentTriggerValue="Corrected"
                    comment={vm.validationChecks.C3_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("C3_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="4"
                    question="Lub Oil Filter"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.C4 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("C4", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.C4_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("C4_comment", v)
                    }
                  />

                  <View style={styles.groupDivider} />
                  <GroupHeader
                    letter="D"
                    title="Cooling System"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Coolant Level and Condition"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.D1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("D1", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.D1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("D1_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="2"
                    question="Coolant Leakage"
                    optionA="Ok"
                    optionB="Arrested"
                    value={vm.validationChecks.D2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("D2", v)}
                    commentTriggerValue="Arrested"
                    comment={vm.validationChecks.D2_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("D2_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="3"
                    question="Belt Condition"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.D3 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("D3", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.D3_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("D3_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="4"
                    question="Radiator Condition and Cleanliness"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.D4 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("D4", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.D4_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("D4_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="5"
                    question="Condition of all Hoses and Clamps"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.D5 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("D5", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.D5_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("D5_comment", v)
                    }
                  />

                  <View style={styles.groupDivider} />
                  <GroupHeader
                    letter="E"
                    title="Fuel System"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Fuel Tank Cleanliness"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.E1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("E1", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.E1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("E1_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="2"
                    question="Condition of Fuel Hoses and Leakages"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.E2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("E2", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.E2_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("E2_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="3"
                    question="Fuel Filter"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.E3 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("E3", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.E3_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("E3_comment", v)
                    }
                  />

                  <View style={styles.groupDivider} />
                  <GroupHeader
                    letter="F"
                    title="Electrical Wiring"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Battery"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.F1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("F1", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.F1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("F1_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="2"
                    question="Electrolyte Level and Terminal Condition of Battery"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.F2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("F2", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.F2_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("F2_comment", v)
                    }
                  />

                  <View style={styles.checkItemBlock}>
                    <Text style={styles.checkItemQuestion}>
                      3. Battery Voltage in DC
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={vm.validationChecks.F3 || ""}
                      onChangeText={(v) => vm.updateValidationCheck("F3", v)}
                      placeholder="Enter value..."
                      keyboardType="numeric"
                    />
                  </View>

                  <TwoOptionToggleRow
                    index="4"
                    question="Voltage Drop at Battery During Cranking Within 9V"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.F4 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("F4", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.F4_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("F4_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="5"
                    question="Functioning of Charging Alternator"
                    subtext="Remove the fan belt & check bearing condition"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.F5 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("F5", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.F5_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("F5_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="6"
                    question="Tightness of All S/W & Sensors"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.F6 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("F6", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.F6_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("F6_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="7"
                    question="Functions of ESU (HWT, LLOP, CLS LFL)"
                    optionA="Ok"
                    optionB="Replaced"
                    value={vm.validationChecks.F7 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("F7", v)}
                    commentTriggerValue="Replaced"
                    comment={vm.validationChecks.F7_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("F7_comment", v)
                    }
                  />

                  <View style={styles.groupDivider} />
                  <GroupHeader
                    letter="G"
                    title="General"
                    saved={vm.sectionSuccess["validationChecks"] || false}
                  />
                  <TwoOptionToggleRow
                    index="1"
                    question="Abnormal Sound from Engine"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.G1 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("G1", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.G1_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("G1_comment", v)
                    }
                  />
                  <TwoOptionToggleRow
                    index="2"
                    question="Overall Condition of Engine and Alternator"
                    optionA="OK"
                    optionB="Not OK"
                    value={vm.validationChecks.G2 || ""}
                    onSetValue={(v) => vm.updateValidationCheck("G2", v)}
                    commentTriggerValue="Not OK"
                    comment={vm.validationChecks.G2_comment || ""}
                    onSetComment={(v) =>
                      vm.updateValidationCheck("G2_comment", v)
                    }
                  />

                  {vm.sectionError["validationChecks"] ? (
                    <Text style={styles.sectionErrorText}>
                      {vm.sectionError["validationChecks"]}
                    </Text>
                  ) : null}
                  <SectionSaveButton
                    onPress={vm.handleSaveValidationChecks}
                    saving={vm.sectionSaving["validationChecks"]}
                    done={vm.sectionSuccess["validationChecks"]}
                  />
                </View>
              </>
            )}

            {/* ══════════════ STEP 3 — COMPLAINT CODES ══════════════ */}
            {vm.currentStep === 3 && (
              <>
                <GroupHeader
                  title="Complaint Codes"
                  saved={false}
                  style={{ backgroundColor: "#FFFFFF" }}
                />

                {vm.selectedComplaintCodes.map((item) => (
                  <ComplaintCodeCard
                    key={item.uid}
                    item={item}
                    onRemove={() => vm.handleRemoveComplaintCode(item.uid)}
                    onChangeObservation={(text) =>
                      vm.handleChangeComplaintObservation(item.uid, text)
                    }
                    onChangeRootCause={(text) =>
                      vm.handleChangeComplaintRootCause(item.uid, text)
                    }
                    onChangeCorrectiveAction={(text) =>
                      vm.handleChangeComplaintCorrectiveAction(item.uid, text)
                    }
                    onSave={vm.handleSaveFaultCodes}
                    isSaving={vm.step3Saving}
                  />
                ))}
                {vm.step3Error ? (
                  <Text style={styles.sectionErrorText}>{vm.step3Error}</Text>
                ) : null}

                {/* Below the added-codes list now, not above it. */}
                <AddItemButton
                  label="Add Code"
                  onPress={openComplaintPicker}
                  style={{ marginBottom: 16 }}
                />

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
                <GroupHeader
                  title="Parts Used"
                  saved={false}
                  style={{ backgroundColor: "#FFFFFF" }}
                />

                {vm.selectedParts.map((part) => (
                  <SelectedPartCard
                    key={part.partId}
                    part={part}
                    onIncrease={() => vm.handleIncreaseQty(part.partId)}
                    onDecrease={() => vm.handleDecreaseQty(part.partId)}
                    onRemove={() => vm.handleRemovePart(part.partId)}
                  />
                ))}
                {vm.step4Error ? (
                  <Text style={styles.sectionErrorText}>{vm.step4Error}</Text>
                ) : null}

                {/* Below the added-parts list now, not above it. */}
                <AddItemButton
                  label="Add Part"
                  onPress={openPartPicker}
                  style={{ marginBottom: 16 }}
                />

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

            {/* ══════════════ STEP 5 — GENSET COMMISSIONING READINGS ══════════════ */}
            {vm.currentStep === 5 && (
              <>
                {/* Revalidation only — its Step 2 is the separate
                validation checklist (no Performance Trial to sit above),
                so Engine Parameters shows here instead, above Genset
                Electrical Readings. Every other task type keeps it in
                Step 2 (see engineParametersCard's own comment). */}
                {vm.isRevalidation && engineParametersCard}

                <View style={styles.sectionCard}>
                  <GroupHeader
                    title="Genset Electrical Readings"
                    saved={!!vm.readingsSuccess}
                    onPress={toggleReadingsReopen}
                    expanded={readingsExpanded}
                  />

                  {readingsExpanded && (
                    <>
                      {(
                        [
                          ["AC VOLT R-Y", "acVoltageRY"],
                          ["AC VOLT Y-B", "acVoltageYB"],
                          ["AC VOLT B-R", "acVoltageBR"],
                          ["AC AMP R", "acAmpR"],
                          ["AC AMP Y", "acAmpY"],
                          ["AC AMP B", "acAmpB"],
                          ["Load KW R", "loadKwR"],
                          ["Load KW Y", "loadKwY"],
                          ["Load KW B", "loadKwB"],
                        ] as const
                      )
                        .reduce(
                          (rows: (readonly [string, string])[][], field, i) => {
                            if (i % 3 === 0) rows.push([]);
                            rows[rows.length - 1].push(field);
                            return rows;
                          },
                          [],
                        )
                        .map((row, i) => (
                          <View
                            key={i}
                            style={[
                              styles.fieldRow,
                              i === 0 && { marginTop: 4 },
                            ]}
                          >
                            {row.map(([label, key]) => (
                              <View key={key} style={styles.fieldThird}>
                                <Text style={styles.fieldLabelStatic}>
                                  {label}
                                </Text>
                                <TextInput
                                  style={styles.fieldInput}
                                  value={vm.readings[key] || ""}
                                  onChangeText={(v) => vm.updateReading(key, v)}
                                  keyboardType="numeric"
                                />
                              </View>
                            ))}
                          </View>
                        ))}

                      {/* Read-only now — always Load KW R + Y + B added
                      together (see useTaskForm.ts's own effect), not
                      separately typed in. */}
                      <View style={styles.fieldRow}>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabelStatic}>Total Load KW</Text>
                          <TextInput
                            style={[styles.fieldInput, styles.fieldInputReadOnly]}
                            value={vm.readings.totalKwLoad || ""}
                            editable={false}
                          />
                        </View>
                        <View style={styles.fieldHalf}>
                          <Text style={styles.fieldLabelStatic}>Load (%)</Text>
                          <TextInput
                            style={[styles.fieldInput, styles.fieldInputReadOnly]}
                            value={vm.readings.loadPercentage || ""}
                            editable={false}
                          />
                        </View>
                      </View>

                      {/* Engine Parameters (this section's other half) now
                      lives in Step 2, above Performance Trial — this button
                      still saves the same combined readings payload, so
                      either card can be used to save regardless of which
                      one the user fills in last. */}
                      {vm.readingsError ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.readingsError}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveReadings}
                        saving={vm.readingsSaving}
                        done={vm.readingsSuccess}
                      />
                    </>
                  )}
                </View>

                {/* Customer Handover — shown with an "E" badge to match the
                reference design. Confirmed real backend keys: E1-E7, with
                Yes/No values (not OK/Not-OK) and "c"-suffixed comment
                fields (E1c, not E1_comment) shown once a row is "No".
                Revalidation-only tasks skip this entirely — not needed on
                a revalidation, only a genuine commissioning. */}
                {!vm.isRevalidation && (
                <View style={styles.sectionCard}>
                  <GroupHeader
                    letter="E"
                    title="Customer Handover"
                    saved={vm.sectionSuccess["groupF"] || false}
                    onPress={() => toggleSectionReopen("groupF")}
                    expanded={isSectionExpanded("groupF")}
                  />
                  {isSectionExpanded("groupF") && (
                    <>
                      <YesNoToggleRow
                        question="Demonstrate operation of Genset — Starting & stopping."
                        value={vm.commissioningChecks.E1 || ""}
                        comment={vm.commissioningChecks.E1c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E1", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E1c", v)}
                      />
                      <YesNoToggleRow
                        question="Demonstrate daily checks of Genset."
                        value={vm.commissioningChecks.E2 || ""}
                        comment={vm.commissioningChecks.E2c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E2", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E2c", v)}
                      />
                      <YesNoToggleRow
                        question="Demonstrate AMF panel operation (if applicable)."
                        value={vm.commissioningChecks.E3 || ""}
                        comment={vm.commissioningChecks.E3c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E3", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E3c", v)}
                      />
                      <YesNoToggleRow
                        question="Demonstrate how to put load on DG set."
                        value={vm.commissioningChecks.E4 || ""}
                        comment={vm.commissioningChecks.E4c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E4", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E4c", v)}
                      />
                      <YesNoToggleRow
                        question="Explain Do's & Don'ts of DG set."
                        value={vm.commissioningChecks.E5 || ""}
                        comment={vm.commissioningChecks.E5c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E5", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E5c", v)}
                      />
                      <YesNoToggleRow
                        question="Explain ATS function & DEF filling process."
                        value={vm.commissioningChecks.E6 || ""}
                        comment={vm.commissioningChecks.E6c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E6", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E6c", v)}
                      />
                      <YesNoToggleRow
                        question="Use Low Sulphur Diesel only as per standard specified."
                        value={vm.commissioningChecks.E7 || ""}
                        comment={vm.commissioningChecks.E7c || ""}
                        onSetValue={(v) => vm.updateCommissioningCheck("E7", v)}
                        onSetComment={(v) => vm.updateCommissioningCheck("E7c", v)}
                      />

                      {vm.sectionError["groupF"] ? (
                        <Text style={styles.sectionErrorText}>
                          {vm.sectionError["groupF"]}
                        </Text>
                      ) : null}
                      <SectionSaveButton
                        onPress={vm.handleSaveCustomerHandover}
                        saving={vm.sectionSaving["groupF"]}
                        done={vm.sectionSuccess["groupF"]}
                      />
                    </>
                  )}
                </View>
                )}

                {vm.readingsSavedBy && vm.readingsSavedAt && (
                  <View style={styles.readingsSavedBox}>
                    <Text style={styles.readingsSavedTitle}>
                      Readings saved
                    </Text>
                    <Text style={styles.readingsSavedMeta}>
                      By {vm.readingsSavedBy.name} ·{" "}
                      {new Date(vm.readingsSavedAt).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ══════════════ STEP 6 — PHOTOS ══════════════ */}
            {/* Complete navigates straight to View Report once it succeeds
            (see handleCompletePhotosStep) — this step never stays around
            long enough to need its own completed/OTP view anymore. */}
            {vm.currentStep === 6 && (
              <>
                {/* Photos & Video card — shared with the Service form (same
                grid + video-list + upload behavior), not a duplicated copy
                of it. Each item uploads immediately on pick via
                vm.siteUploadQueue (see MediaUploadOverlay above), not a
                batch call. */}
                <PhotosVideoCard
                  sitePhotos={vm.sitePhotos}
                  onRemove={vm.handleRemoveSitePhoto}
                  onAddPress={() => vm.setPhotoOptionsVisible(true)}
                />

                {/* Documents card — shared with the Service form (same PDF
                pick + GCS video-confirm upload flow), not a duplicated copy
                of it. */}
                <View style={{ marginTop: 16 }}>
                  <DocumentsCard
                    pdfs={vm.sitePhotos.filter((p) => p.mediaType === "pdf")}
                    onPickPdf={vm.handlePickPdf}
                    onRemove={vm.handleRemoveSitePhoto}
                  />
                </View>

                {/* Optional freetext, submitted once as suggestionComment in the
                Complete Task call — not a per-step save like the sections
                above. */}
                <SuggestionCommentCard
                  value={vm.suggestionComment}
                  onChangeText={vm.setSuggestionComment}
                  style={{ marginTop: 16 }}
                />
              </>
            )}
          </View>

          {/* Camera / Gallery picker — Step 6 site photos. Photo and video
            capture are separate rows (Android's camera intent can't mix
            them in one launch — see captureFromCamera in
            useTaskFormPhotos.ts). Each pick uploads immediately via
            vm.siteUploadQueue (see MediaUploadOverlay). */}
          <Modal
            visible={vm.photoOptionsVisible}
            transparent
            animationType="none"
            onRequestClose={() => vm.setPhotoOptionsVisible(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => vm.setPhotoOptionsVisible(false)}
            >
              <View
                style={[
                  styles.optionsSheet,
                  { paddingBottom: sheetPaddingBottom },
                ]}
              >
                <Text style={styles.optionsTitle}>Add Photo or Video</Text>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={vm.handleTakeSitePhoto}
                >
                  <Text style={styles.optionText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={vm.handleRecordSiteVideo}
                >
                  <Text style={styles.optionText}>🎥 Record Video</Text>
                </TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={vm.handleChooseSitePhotos}
                >
                  <Text style={styles.optionText}>🖼️ Choose from Gallery</Text>
                </TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => vm.setPhotoOptionsVisible(false)}
                >
                  <Text style={styles.optionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          {/* Camera / Gallery picker — Step 2 running-hours photos. Images
              only, unlike Step 6's site photos (no video, no PDF). */}
          <Modal
            visible={vm.step2PhotoOptionsVisible}
            transparent
            animationType="none"
            onRequestClose={() => vm.setStep2PhotoOptionsVisible(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => vm.setStep2PhotoOptionsVisible(false)}
            >
              <View
                style={[
                  styles.optionsSheet,
                  { paddingBottom: sheetPaddingBottom },
                ]}
              >
                <Text style={styles.optionsTitle}>Add Photo</Text>
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={vm.handleTakeRunningHoursPhoto}
                >
                  <Text style={styles.optionText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={vm.handleChooseRunningHoursPhotos}
                >
                  <Text style={styles.optionText}>🖼️ Choose from Gallery</Text>
                </TouchableOpacity>
                <View style={styles.optionDivider} />
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => vm.setStep2PhotoOptionsVisible(false)}
                >
                  <Text style={styles.optionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          {/* Labeled Back/Next bar, alongside the stepper row's flanking
            arrows above — same handlers either way, just a second, more
            discoverable way to move between steps. In-flow at the bottom
            of each step's own content (not fixed on screen) — it should
            only come into view once you've actually scrolled down through
            that step's fields, right after the last one. */}
          <View style={styles.fixedBottomActions}>
            <TouchableOpacity
              style={[
                styles.backButton,
                vm.stepSequence.indexOf(vm.currentStep) === 0 &&
                  styles.buttonDisabled,
              ]}
              onPress={vm.handleBack}
              disabled={vm.stepSequence.indexOf(vm.currentStep) === 0}
            >
              <ChevronLeft size={24} color="#4B5563" />
            </TouchableOpacity>

            {vm.currentStep === 6 ? (
              <CompleteTaskButton
                onPress={vm.handleCompletePhotosStep}
                loading={vm.markCompleteLoading}
              />
            ) : (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={vm.handleNext}
              >
                <ChevronRight size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F6F6" },
  scrollArea: { flex: 1, paddingHorizontal: 20 },
  buttonDisabled: { opacity: 0.6 },

  toastContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
    borderRadius: 12,
    padding: 14,
    elevation: 6,
  },
  toastSuccess: { backgroundColor: "#15803D" },
  toastError: { backgroundColor: "#DC2626" },
  toastText: { color: "#fff", fontWeight: "600", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#000000",
    textTransform: "uppercase",
  },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 100,
    padding: 6,
    marginBottom: 16,
  },
  stepArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#616161",
    borderWidth: 0.67,
    borderColor: "#494747",
    justifyContent: "center",
    alignItems: "center",
  },
  // Same boundary-fade convention as the Dashboard/Commissioning pagination
  // arrows: opacity only, no color swap.
  stepArrowFaded: { opacity: 0.5 },
  stepCircleRow: {
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: { backgroundColor: "#E76124" },
  stepCircleDone: { backgroundColor: "#16A34A" },
  stepCircleText: { fontSize: 13, fontWeight: "700", color: "#9CA3AF" },
  stepCircleTextActive: { color: "#fff" },

  loadingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  loadingText: { marginLeft: 8, color: "#9CA3AF", fontSize: 13 },

  // Fallback "load as starting point" card for a Commissioning/
  // Re-Commissioning task that reached Step 2 without pre-filled checks —
  // same amber warning tone used elsewhere in the app for a heads-up that
  // isn't an error.
  prefillCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  prefillCardText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#B45309",
    lineHeight: 18,
  },
  prefillLoadButton: {
    borderWidth: 1.5,
    borderColor: "#F26722",
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  prefillLoadButtonText: { fontSize: 13, fontWeight: "700", color: "#F26722" },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 32,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 16,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
    letterSpacing: 0.5,
  },

  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  fieldHalf: { width: "48%" },
  fieldThird: { width: "31%" },
  fieldFull: { marginTop: 14 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  // Same spec as fieldLabel (Step 1's Genset Identification labels) —
  // Electrical Readings/Engine Parameters (Step 5) previously had their
  // own smaller, lighter, letter-spaced look instead of matching.
  fieldLabelStatic: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#fff",
  },
  // Auto-computed fields (e.g. Total Load KW) — same shape as a normal
  // input, just visibly non-interactive.
  fieldInputReadOnly: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
  },
  toggleRow: { flexDirection: "row" },
  toggleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  toggleOptionActive: { backgroundColor: "#1E1951", borderColor: "#1E1951" },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  toggleTextActive: { color: "#fff" },

  sectionErrorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 10,
  },

  bigFormCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  groupDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },

  checkItemBlock: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  checkItemQuestion: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 10,
  },
  numericSubLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  // Sits above 11-19's flat CheckToggleRow list — same "group label between
  // rows" role numericSubLabel plays for Group B/C's numeric fields, just
  // horizontally aligned to the rows' own paddingHorizontal instead of
  // living inside a padded checkItemBlock card.
  checkGroupHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  // The leading "06."/"11." — same gray/weight as a numbered row's own
  // index (rowIndex in FormToggleRows.tsx), so a group heading's number
  // matches every other row's number instead of inheriting the heading's
  // own bold dark color.
  checkGroupHeadingNumber: { color: "#9CA3AF", fontWeight: "500" },
  checkSubGroupHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.3,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  // "Line Voltage"/"Phase-Neutral Voltage" under item 12 — bolder and
  // darker than checkSubGroupHeading above, matching the reference design.
  voltageGroupSubheading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    paddingHorizontal: 34,
    marginBottom: 6,
  },
  numericFieldRow: { flexDirection: "row", justifyContent: "space-between" },
  numericFieldThird: { width: "31%" },
  numericFieldLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
  },
  numericFieldInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    color: "#1F2937",
    backgroundColor: "#fff",
  },
  issueInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: "#1F2937",
    minHeight: 44,
    textAlignVertical: "top",
    backgroundColor: "#fff",
  },

  okNotOkRow: { flexDirection: "row" },
  okButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  okButtonActive: { backgroundColor: "#DCFCE7", borderColor: "#16A34A" },
  okButtonText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  okButtonTextActive: { color: "#15803D" },
  notOkButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  notOkButtonActive: { backgroundColor: "#FEE2E2", borderColor: "#DC2626" },
  notOkButtonText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  notOkButtonTextActive: { color: "#DC2626" },

  loadStageCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  loadStageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  loadStageLabel: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  durationPill: {
    backgroundColor: "#EDE9FE",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationPillText: { fontSize: 11, fontWeight: "700", color: "#7C3AED" },

  addPhotoBox: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: "center",
    marginTop: 12,
  },
  addPhotoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FDECE1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  addPhotoIcon: { fontSize: 20 },
  addPhotoTitle: { fontSize: 14, fontWeight: "700", color: "#1F2937" },
  addPhotoSubtitle: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  photoCountText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  photoThumbWrapper: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
  },
  photoThumb: { width: "100%", height: "100%" },
  photoRemoveBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoRemoveBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  readingsSavedBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  readingsSavedTitle: { color: "#065F46", fontWeight: "700", fontSize: 13 },
  readingsSavedMeta: { color: "#059669", fontSize: 12, marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  optionsSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 10,
  },
  optionRow: { paddingVertical: 14 },
  optionText: { fontSize: 16, fontWeight: "500", color: "#222" },
  optionDivider: { height: 1, backgroundColor: "#eee" },

  fixedBottomActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Circular chevron-only controls (not a full-width pill) — the back
  // circle stays pale/neutral, the next circle is filled solid so it
  // reads as the primary action, matching the reference design.
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  nextButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E1951",
    justifyContent: "center",
    alignItems: "center",
  },
});
