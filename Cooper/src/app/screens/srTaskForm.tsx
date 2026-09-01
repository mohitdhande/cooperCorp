import React from 'react';
import {
  Image, View, Text, TouchableOpacity, Dimensions, ScrollView,
  TextInput, Modal, Pressable, ActivityIndicator, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { styles } from '../../_components/taskForm/TaskForm.styles';
import { DropdownField } from '../../_components/taskForm/_components/DropdownField';
import { ComplaintCodePickerModal } from '../../_components/taskForm/_components/ComplaintCodePickerModal';
import { ComplaintCodeCard } from '../../_components/taskForm/_components/ComplaintCodeCard';
import { PartPickerModal } from '../../_components/taskForm/_components/PartPickerModal';
import { SelectedPartCard } from '../../_components/taskForm/_components/SelectedPartCard';
import { NumberStepperField } from '../../_components/taskForm/_components/NumberStepperField';
import { Ionicons } from '@expo/vector-icons';
import { useSrTaskForm } from '@/_components/srTaskForm/useSrTaskForm';
import { catStyles } from '@/_components/srTaskForm/SrTaskForm.styles';
import {
  ENGINE_TYPE_OPTIONS, ENGINE_FAMILY_OPTIONS, FUEL_TYPE_OPTIONS, APPLICATION_OPTIONS,
  PHASE_OPTIONS, PANEL_TYPE_OPTIONS, CPCB_NORM_OPTIONS,
  TYPE_OF_SERVICE_OPTIONS, WARRANTY_STATUS_OPTIONS,SERVICE_CATEGORIES,
} from '../../_components/srTaskForm/srDropdownOptions';
import { ApiFaultCode, ApiPart } from '@/models/taskForm.types';

const { width } = Dimensions.get('window');

const SR_STEP_SEQUENCE = [1, 2, 3, 4, 5, 6];

export default function SrTaskFormScreen() {
  const {
    params,
    notes, setNotes,
    photosUploading, photosUploadSuccess, photosUploadError, handleSaveAllPhotos,
    workApprovalStatus,
    refreshing, onRefresh,
    expandedCategory, toggleCategory,
    selectedCategoryLetter, selectedSubCategory, selectSubCategory,
    step6Saving, step6Success, step6Error, handleSendForApproval,
    step5Saving, step5Success, step5Error, handleSaveNotes,
    userName, userProfilePic,
    apiFaultCodes, faultCodesLoading,
    apiParts, partsLoading,
    step2Saving, step2Success, step2Error, handleSaveFaultCodes,
    step3Saving, step3Success, step3Error, handleSavePartsUsed,
    handleLogout,
    currentStep, setCurrentStep,
    initialDataLoading,
    gensetModel, gensetSrNumber, engineModel, engineNumber, engineKw, engineType,
    engineFamily, fuelType, application,
    setGensetModel, setGensetSrNumber, setEngineModel, setEngineNumber, setEngineKw,
    setEngineType, setEngineFamily, setFuelType, setApplication,
    altMake, altModel, altSn, atsSn, batterySn, kva, phase, panelType, panelSn, cpcbNorm,
    loadUnbalance, loadUnbalancePercentage, loadUnbalanceComment,
    setAltMake, setAltModel, setAltSn, setAtsSn, setBatterySn, setKva, setPhase,
    setPanelType, setPanelSn, setCpcbNorm, setLoadUnbalance, setLoadUnbalancePercentage,
    setLoadUnbalanceComment,
    typeOfService, warrantyStatus, setTypeOfService, setWarrantyStatus,
    acVoltRY, acVoltYB, acVoltBR, acAmpR, acAmpY, acAmpB, loadKwR, loadKwY, loadKwB, totalKw, loadPercent,
    setAcVoltRY, setAcVoltYB, setAcVoltBR, setAcAmpR, setAcAmpY, setAcAmpB,
    setLoadKwR, setLoadKwY, setLoadKwB, setTotalKw, setLoadPercent,
    rpm, frequency, dcVoltage, oilPressure, oilLevel, coolantLevel, coolantTemp, defLevel,
    setRpm, setFrequency, setDcVoltage, setOilPressure, setOilLevel, setCoolantLevel,
    setCoolantTemp, setDefLevel,
    sectionSaving, sectionSuccess, sectionError, handleSaveAssetSection,
    selectedComplaintCodes, complaintPickerVisible, setComplaintPickerVisible,
    handleSelectComplaintCode, handleRemoveComplaintCode,
    handleChangeComplaintObservation, handleChangeComplaintRootCause, handleChangeComplaintCorrectiveAction,
    otpGenerated, generatedOtp, customerOtp, otpLoading, otpError, taskCompleted,
    otpInputRefs, scrollViewRef,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleOtpInputFocus, handleVerifyAndComplete,
    selectedCategoryColor, getStatusCardStyle,
    selectedParts, partPickerVisible, setPartPickerVisible,
    handleSelectPart, handleIncreaseQty, handleDecreaseQty, handleRemovePart,
    sitePhotos, photoOptionsVisible, setPhotoOptionsVisible,
    handleTakePhoto, handleChoosePhotos, handleRemovePhoto,
    handleBack, handleNext, handleCancel,
  } = useSrTaskForm();

  return (
    <SafeAreaView style={styles.container}>
      {/* ── AppBar ── */}
      

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
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
>
      <ScrollView
  ref={scrollViewRef}
  style={styles.scrollArea}
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingBottom: 30 }}
  keyboardShouldPersistTaps="handled"
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />
  }
>
        {/* ── SR Tasks back link ── */}
        <TouchableOpacity style={styles.myTasksRow} onPress={() => router.back()}>
          <Text style={styles.myTasksArrow}>{'‹'}</Text>
          <Text style={styles.myTasksText}>SR Tasks</Text>
        </TouchableOpacity>

        {/* ── Task + Stepper card ── */}
        <View style={styles.stepperCard}>
          <View style={styles.stepperHeaderRow}>
  <Text style={styles.taskLabel}>{gensetSrNumber || (params.gensetNumber as string) || '—'}</Text>
  {selectedCategoryLetter && selectedSubCategory ? (
    <View style={[catStyles.headerBadge, { backgroundColor: selectedCategoryColor.bg, borderColor: selectedCategoryColor.border }]}>
      <Text style={[catStyles.headerBadgeText, { color: selectedCategoryColor.text }]}>
        {selectedCategoryLetter} — {selectedSubCategory}
      </Text>
    </View>
  ) : null}
</View>
<Text style={{ color: '#98A2B3', marginTop: 2, marginBottom: 10 }}>
  {engineNumber || (params.engineNumber as string) || '—'} · JH
</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepperScroll}>
            {SR_STEP_SEQUENCE.map((step, index) => {
              const isDone = currentStep > step;
              const isActive = step === currentStep;
              return (
                <React.Fragment key={step}>
                  <TouchableOpacity
                    style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}
                    onPress={() => setCurrentStep(step)}
                  >
                    {isDone ? (
                      <Text style={styles.stepCircleTextActive}>✓</Text>
                    ) : (
                      <Text style={[styles.stepCircleText, isActive && styles.stepCircleTextActive]}>{step}</Text>
                    )}
                  </TouchableOpacity>
                  {index < SR_STEP_SEQUENCE.length - 1 && <View style={styles.stepLine} />}
                </React.Fragment>
              );
            })}
          </ScrollView>
        </View>

        {/* ── STEP 1 — ASSET INFORMATION ── */}
        {currentStep === 1 && (
          <>
            <Text style={styles.stepHeading}>STEP 1 — ASSET INFORMATION</Text>
 {initialDataLoading && (
      <View style={styles.assetLoadingRow}>
        <ActivityIndicator size="small" color="#F26722" />
        <Text style={styles.assetLoadingText}>Loading asset data...</Text>
      </View>
    )}
            {/* GENSET IDENTIFICATION */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>GENSET IDENTIFICATION</Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● GENSET MODEL</Text>
                  <TextInput style={styles.fieldInput} value={gensetModel} onChangeText={setGensetModel} placeholder="—" />
                </View>

<View style={styles.fieldHalf}>
  <Text style={styles.fieldLabel}>● GENSET SR NUMBER</Text>
  <TextInput
    style={styles.fieldInput}
    value={gensetSrNumber}
    onChangeText={setGensetSrNumber}
    placeholder="—"
  />
</View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ENGINE MODEL</Text>
                  <TextInput style={styles.fieldInput} value={engineModel} onChangeText={setEngineModel} placeholder="—" />
                </View>
               
<View style={styles.fieldHalf}>
  <Text style={styles.fieldLabel}>● ENGINE NUMBER</Text>
  <TextInput
    style={styles.fieldInput}
    value={engineNumber}
    onChangeText={setEngineNumber}
    placeholder="—"
  />
</View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ENGINE KW</Text>
                  <TextInput style={styles.fieldInput} value={engineKw} onChangeText={setEngineKw} placeholder="—" keyboardType="numeric" />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField label="ENGINE TYPE" value={engineType} options={ENGINE_TYPE_OPTIONS} onSelect={setEngineType} />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <DropdownField label="ENGINE FAMILY" value={engineFamily} options={ENGINE_FAMILY_OPTIONS} onSelect={setEngineFamily} />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField label="FUEL TYPE" value={fuelType} options={FUEL_TYPE_OPTIONS} onSelect={setFuelType} />
                </View>
              </View>

              <View style={styles.fieldFull}>
                <DropdownField label="APPLICATION" value={application} options={APPLICATION_OPTIONS} onSelect={setApplication} />
              </View>

            
{sectionError['genset'] ? (
  <Text style={styles.sectionErrorText}>{sectionError['genset']}</Text>
) : null}
<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    sectionSuccess['genset'] && styles.sectionSaveButtonSuccess,
    sectionSaving['genset'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={() => handleSaveAssetSection('genset')}
  disabled={sectionSaving['genset']}
>
  {sectionSaving['genset']
    ? <ActivityIndicator color="#fff" size="small" />
    : <Text style={styles.sectionSaveButtonText}>{sectionSuccess['genset'] ? '✓ Saved' : 'Save'}</Text>}
</TouchableOpacity>
            </View>

            {/* ALTERNATOR & PANEL */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>ALTERNATOR & PANEL</Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ALT. MAKE</Text>
                  <TextInput style={styles.fieldInput} value={altMake} onChangeText={setAltMake} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ALT. MODEL</Text>
                  <TextInput style={styles.fieldInput} value={altModel} onChangeText={setAltModel} placeholder="—" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ALT. S/N</Text>
                  <TextInput style={styles.fieldInput} value={altSn} onChangeText={setAltSn} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ATS S/N</Text>
                  <TextInput style={styles.fieldInput} value={atsSn} onChangeText={setAtsSn} placeholder="—" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● BATTERY S/N</Text>
                  <TextInput style={styles.fieldInput} value={batterySn} onChangeText={setBatterySn} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● KVA</Text>
                  <TextInput style={styles.fieldInput} value={kva} onChangeText={setKva} placeholder="—" keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <DropdownField label="PHASE" value={phase} options={PHASE_OPTIONS} onSelect={setPhase} />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField label="PANEL TYPE" value={panelType} options={PANEL_TYPE_OPTIONS} onSelect={setPanelType} />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● PANEL S/N</Text>
                  <TextInput style={styles.fieldInput} value={panelSn} onChangeText={setPanelSn} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField label="CPCB NORM" value={cpcbNorm} options={CPCB_NORM_OPTIONS} onSelect={setCpcbNorm} />
                </View>
              </View>

              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>● LOAD UNBALANCE</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleOption, loadUnbalance === 'Yes' && styles.toggleOptionActive]}
                    onPress={() => setLoadUnbalance('Yes')}
                  >
                    <Text style={[styles.toggleText, loadUnbalance === 'Yes' && styles.toggleTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, loadUnbalance === 'No' && styles.toggleOptionActive]}
                    onPress={() => setLoadUnbalance('No')}
                  >
                    <Text style={[styles.toggleText, loadUnbalance === 'No' && styles.toggleTextActive]}>No</Text>
                  </TouchableOpacity>
                </View>

                {loadUnbalance === 'Yes' && (
                  <View style={[styles.fieldFull, { marginTop: 12 }]}>
                    <Text style={styles.fieldLabel}>UNBALANCE %</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={loadUnbalancePercentage}
                      onChangeText={setLoadUnbalancePercentage}
                      placeholder="—"
                      keyboardType="numeric"
                    />
                  </View>
                )}

                {loadUnbalance === 'No' && (
                  <View style={[styles.fieldFull, { marginTop: 12 }]}>
                    <Text style={styles.fieldLabel}>COMMENT</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={loadUnbalanceComment}
                      onChangeText={setLoadUnbalanceComment}
                      placeholder="—"
                    />
                  </View>
                )}
              </View>

              
{sectionError['alternator'] ? (
  <Text style={styles.sectionErrorText}>{sectionError['alternator']}</Text>
) : null}
<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    sectionSuccess['alternator'] && styles.sectionSaveButtonSuccess,
    sectionSaving['alternator'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={() => handleSaveAssetSection('alternator')}
  disabled={sectionSaving['alternator']}
>
  {sectionSaving['alternator']
    ? <ActivityIndicator color="#fff" size="small" />
    : <Text style={styles.sectionSaveButtonText}>{sectionSuccess['alternator'] ? '✓ Saved' : 'Save'}</Text>}
</TouchableOpacity>
            </View>

            {/* SERVICE */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>SERVICE</Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <DropdownField label="TYPE OF SERVICE" value={typeOfService} options={TYPE_OF_SERVICE_OPTIONS} onSelect={setTypeOfService} />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField label="WARRANTY STATUS" value={warrantyStatus} options={WARRANTY_STATUS_OPTIONS} onSelect={setWarrantyStatus} />
                </View>
              </View>

              {sectionError['service'] ? (
  <Text style={styles.sectionErrorText}>{sectionError['service']}</Text>
) : null}
<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    sectionSuccess['service'] && styles.sectionSaveButtonSuccess,
    sectionSaving['service'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={() => handleSaveAssetSection('service')}
  disabled={sectionSaving['service']}
>
  {sectionSaving['service']
    ? <ActivityIndicator color="#fff" size="small" />
    : <Text style={styles.sectionSaveButtonText}>{sectionSuccess['service'] ? '✓ Saved' : 'Save'}</Text>}
</TouchableOpacity>
            </View>

            {/* ELECTRICAL READINGS */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>ELECTRICAL READINGS</Text>

              <View style={[styles.fieldRow, { marginTop: 16 }]}>
                <NumberStepperField label="AC VOLT RY" value={acVoltRY} onChangeValue={setAcVoltRY} unit="V" />
                <View style={{ width: 12 }} />
                <NumberStepperField label="AC VOLT YB" value={acVoltYB} onChangeValue={setAcVoltYB} unit="V" />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="AC VOLT BR" value={acVoltBR} onChangeValue={setAcVoltBR} unit="V" />
                <View style={{ width: 12 }} />
                <NumberStepperField label="AC AMP R" value={acAmpR} onChangeValue={setAcAmpR} unit="A" />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="AC AMP Y" value={acAmpY} onChangeValue={setAcAmpY} unit="A" />
                <View style={{ width: 12 }} />
                <NumberStepperField label="AC AMP B" value={acAmpB} onChangeValue={setAcAmpB} unit="A" />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="LOAD KW R" value={loadKwR} onChangeValue={setLoadKwR} />
                <View style={{ width: 12 }} />
                <NumberStepperField label="LOAD KW Y" value={loadKwY} onChangeValue={setLoadKwY} />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="LOAD KW B" value={loadKwB} onChangeValue={setLoadKwB} />
                <View style={{ width: 12 }} />
                <NumberStepperField label="TOTAL KW" value={totalKw} onChangeValue={setTotalKw} />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="LOAD %" value={loadPercent} onChangeValue={setLoadPercent} unit="%" />
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }} />
              </View>

             {sectionError['electrical'] ? (
  <Text style={styles.sectionErrorText}>{sectionError['electrical']}</Text>
) : null}
<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    sectionSuccess['electrical'] && styles.sectionSaveButtonSuccess,
    sectionSaving['electrical'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={() => handleSaveAssetSection('electrical')}
  disabled={sectionSaving['electrical']}
>
  {sectionSaving['electrical']
    ? <ActivityIndicator color="#fff" size="small" />
    : <Text style={styles.sectionSaveButtonText}>{sectionSuccess['electrical'] ? '✓ Saved' : 'Save'}</Text>}
</TouchableOpacity>
            </View>

            {/* ENGINE PARAMETERS */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>ENGINE PARAMETERS</Text>

              <View style={[styles.fieldRow, { marginTop: 16 }]}>
                <NumberStepperField label="RPM" value={rpm} onChangeValue={setRpm} />
                <View style={{ width: 12 }} />
                <NumberStepperField label="FREQUENCY" value={frequency} onChangeValue={setFrequency} unit="Hz" />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="DC VOLTAGE" value={dcVoltage} onChangeValue={setDcVoltage} unit="V" />
                <View style={{ width: 12 }} />
                <NumberStepperField label="OIL PRESSURE" value={oilPressure} onChangeValue={setOilPressure} />
              </View>
              <View style={[styles.fieldRow, { marginTop: 14 }]}>
                <NumberStepperField label="COOLANT TEMP" value={coolantTemp} onChangeValue={setCoolantTemp} unit="°C" />
                <View style={{ width: 12 }} />
                <NumberStepperField label="DEF LEVEL" value={defLevel} onChangeValue={setDefLevel} unit="%" />
              </View>

              {/* OIL LEVEL toggle */}
              <View style={{ marginTop: 18 }}>
                <Text style={styles.fieldLabelStatic}>OIL LEVEL</Text>
                <View style={styles.okNotOkRow}>
                  <TouchableOpacity
                    style={[styles.okButton, oilLevel === 'OK' && styles.okButtonActive]}
                    onPress={() => setOilLevel('OK')}
                  >
                    <Text style={[styles.okButtonText, oilLevel === 'OK' && styles.okButtonTextActive]}>OK</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.notOkButton, oilLevel === 'Not OK' && styles.notOkButtonActive]}
                    onPress={() => setOilLevel('Not OK')}
                  >
                    <Text style={[styles.notOkButtonText, oilLevel === 'Not OK' && styles.notOkButtonTextActive]}>Not OK</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* COOLANT LEVEL toggle */}
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabelStatic}>COOLANT LEVEL</Text>
                <View style={styles.okNotOkRow}>
                  <TouchableOpacity
                    style={[styles.okButton, coolantLevel === 'OK' && styles.okButtonActive]}
                    onPress={() => setCoolantLevel('OK')}
                  >
                    <Text style={[styles.okButtonText, coolantLevel === 'OK' && styles.okButtonTextActive]}>OK</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.notOkButton, coolantLevel === 'Not OK' && styles.notOkButtonActive]}
                    onPress={() => setCoolantLevel('Not OK')}
                  >
                    <Text style={[styles.notOkButtonText, coolantLevel === 'Not OK' && styles.notOkButtonTextActive]}>Not OK</Text>
                  </TouchableOpacity>
                </View>
              </View>

             {sectionError['engineParams'] ? (
  <Text style={styles.sectionErrorText}>{sectionError['engineParams']}</Text>
) : null}
<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    sectionSuccess['engineParams'] && styles.sectionSaveButtonSuccess,
    sectionSaving['engineParams'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={() => handleSaveAssetSection('engineParams')}
  disabled={sectionSaving['engineParams']}
>
  {sectionSaving['engineParams']
    ? <ActivityIndicator color="#fff" size="small" />
    : <Text style={styles.sectionSaveButtonText}>{sectionSuccess['engineParams'] ? '✓ Saved' : 'Save'}</Text>}
</TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 2 — COMPLAINT / FAULT CODES ── */}
        {currentStep === 2 && (
          <>
            <Text style={styles.stepHeading}>STEP 2 — COMPLAINT / FAULT CODES</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>COMPLAINT CODES</Text>

              {selectedComplaintCodes.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  {selectedComplaintCodes.map((item) => (
                   
<ComplaintCodeCard
  key={item.uid}
  item={item}
  onRemove={() => handleRemoveComplaintCode(item.uid)}
  onChangeObservation={(text: string) => handleChangeComplaintObservation(item.uid, text)}
  onChangeRootCause={(text: string) => handleChangeComplaintRootCause(item.uid, text)}
  onChangeCorrectiveAction={(text: string) => handleChangeComplaintCorrectiveAction(item.uid, text)}
/>
                  ))}
                </View>
              )}

              
              <TouchableOpacity style={styles.addCodeButton} onPress={() => setComplaintPickerVisible(true)}>
                <Text style={styles.addCodeButtonText}>+  Add Code</Text>
              </TouchableOpacity>

              {step2Error ? (
                <Text style={styles.sectionErrorText}>{step2Error}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.groupSaveButton,
                  step2Success && styles.groupSaveButtonSaved,
                  step2Saving && { opacity: 0.6 },
                  { marginTop: 16 },
                ]}
                onPress={handleSaveFaultCodes}
                disabled={step2Saving}
              >
                {step2Saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.groupSaveButtonText}>{step2Success ? '✓ Saved' : 'Save Complaint Codes'}</Text>}
              </TouchableOpacity>
            </View>

            <ComplaintCodePickerModal
  visible={complaintPickerVisible}
  onClose={() => setComplaintPickerVisible(false)}
  faultCodes={apiFaultCodes}
  loading={faultCodesLoading}
  onSelectCode={handleSelectComplaintCode}
/>
          </>
        )}

        {/* ── STEP 3 — PARTS USED ── */}
        {currentStep === 3 && (
          <>
            <Text style={styles.stepHeading}>STEP 3 — PARTS USED</Text>

            <View style={styles.bigFormCard}>
              <Text style={styles.bigFormTitle}>Parts Used</Text>
              <Text style={styles.bigFormSubtitle}>Add parts consumed during this job</Text>

              <View style={styles.groupDivider} />

              {selectedParts.map((part) => (
                <SelectedPartCard
                  key={part.partId}
                  part={part}
                  onIncrease={() => handleIncreaseQty(part.partId)}
                  onDecrease={() => handleDecreaseQty(part.partId)}
                  onRemove={() => handleRemovePart(part.partId)}
                />
              ))}

              
              <TouchableOpacity style={styles.addPartButton} onPress={() => setPartPickerVisible(true)}>
                <Text style={styles.addPartButtonText}>+  Add Part</Text>
              </TouchableOpacity>

              {step3Error ? (
                <Text style={styles.sectionErrorText}>{step3Error}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.groupSaveButton,
                  step3Success && styles.groupSaveButtonSaved,
                  step3Saving && { opacity: 0.6 },
                  { marginTop: 16 },
                ]}
                onPress={handleSavePartsUsed}
                disabled={step3Saving}
              >
                {step3Saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.groupSaveButtonText}>{step3Success ? '✓ Saved' : 'Save Parts Used'}</Text>}
              </TouchableOpacity>
            </View>

            <PartPickerModal
  visible={partPickerVisible}
  onClose={() => setPartPickerVisible(false)}
  parts={apiParts}
  loading={partsLoading}
  onSelectPart={handleSelectPart}
/>
          </>
        )}

        {/* ── STEP 4 — PHOTOS ── */}
        {currentStep === 4 && (
          <>
            <Text style={styles.stepHeading}>STEP 4 — PHOTOS</Text>

            <View style={styles.bigFormCard}>
              <Text style={styles.bigFormTitle}>SITE PHOTOS</Text>

              {sitePhotos.length > 0 && (
                <View style={styles.photoGrid}>
                  {sitePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoThumbWrapper}>
                      <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                      <TouchableOpacity style={styles.photoRemoveBadge} onPress={() => handleRemovePhoto(photo.id)}>
                        <Text style={styles.photoRemoveBadgeText}>✕</Text>
                      </TouchableOpacity>
                      <View style={styles.photoNameTag}>
                        <Text style={styles.photoNameText} numberOfLines={1}>{photo.fileName}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.addPhotoBox} onPress={() => setPhotoOptionsVisible(true)}>
                <View style={styles.addPhotoIconCircle}>
                  <Text style={styles.addPhotoIcon}>📷</Text>
                </View>
                <Text style={styles.addPhotoTitle}>{sitePhotos.length === 0 ? 'Add Photos' : 'Add More'}</Text>
                <Text style={styles.addPhotoSubtitle}>Tap to open camera or gallery</Text>
              </TouchableOpacity>

              {sitePhotos.length > 0 && (
                <Text style={styles.photoCountText}>
                  {sitePhotos.length} photo{sitePhotos.length > 1 ? 's' : ''} selected
                </Text>
              )}

              {photosUploadError ? (
                <Text style={styles.sectionErrorText}>{photosUploadError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.groupSaveButton,
                  photosUploadSuccess && styles.groupSaveButtonSaved,
                  photosUploading && { opacity: 0.6 },
                  { marginTop: 16 },
                ]}
                onPress={handleSaveAllPhotos}
                disabled={photosUploading}
              >
                {photosUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.groupSaveButtonText}>
                    {photosUploadSuccess ? '✓ Photos Saved' : 'Save Photos'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 5 / 6 — placeholders ── */}
        
{/* ── STEP 5 — NOTES & SUMMARY ── */}
{currentStep === 5 && (
  <>
    <Text style={styles.stepHeading}>STEP 5 — NOTES & SUMMARY</Text>

    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>WORK SUMMARY / NOTES</Text>

      <ScrollView
        style={{ maxHeight: 220, marginTop: 12 }}
        nestedScrollEnabled
      >
        <TextInput
          style={[styles.fieldInput, styles.feedbackTextArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Describe the work done, observations, or any remarks..."
          placeholderTextColor="#9CA3AF"
          multiline
          scrollEnabled
          textAlignVertical="top"
        />
      </ScrollView>

      {step5Error ? (
        <Text style={styles.sectionErrorText}>{step5Error}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.groupSaveButton,
          step5Success && styles.groupSaveButtonSaved,
          step5Saving && { opacity: 0.6 },
          { marginTop: 16 },
        ]}
        onPress={handleSaveNotes}
        disabled={step5Saving}
      >
        {step5Saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.groupSaveButtonText}>{step5Success ? '✓ Saved' : 'Save'}</Text>}
      </TouchableOpacity>
    </View>
  </>
)}



{/* ── STEP 6 — CATEGORY & APPROVAL ── */}
{currentStep === 6 && (
  <>
    <Text style={styles.stepHeading}>STEP 6 — CATEGORY & APPROVAL</Text>

    {workApprovalStatus === '' ? (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>SELECT SERVICE CATEGORY</Text>

        <View style={{ marginTop: 12 }}>
          {SERVICE_CATEGORIES.map((cat) => {
            const isExpanded = expandedCategory === cat.letter;
            const isSelectedCat = selectedCategoryLetter === cat.letter;
            const highlight = isExpanded || isSelectedCat;

            return (
              <View key={cat.letter} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    catStyles.headerRow,
                    highlight && { backgroundColor: cat.bg, borderColor: cat.border },
                  ]}
                  onPress={() => toggleCategory(cat.letter)}
                >
                  <View style={[catStyles.letterCircle, highlight && { backgroundColor: '#fff' }]}>
                    <Text style={[catStyles.letterText, highlight && { color: cat.text }]}>{cat.letter}</Text>
                  </View>
                  <Text style={[catStyles.categoryName, highlight && { color: cat.text }]}>{cat.name}</Text>
                  <Text style={[catStyles.chevron, highlight && { color: cat.text }]}>
                    {isExpanded ? '︿' : '﹀'}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={catStyles.subList}>
                    {cat.subCategories.map((sub) => {
                      const isSubSelected = selectedCategoryLetter === cat.letter && selectedSubCategory === sub;
                      return (
                        <TouchableOpacity
                          key={sub}
                          style={[catStyles.subRow, isSubSelected && { backgroundColor: cat.bg, borderColor: cat.border }]}
                          onPress={() => selectSubCategory(cat.letter, sub)}
                        >
                          <Text style={[catStyles.subText, isSubSelected && { color: cat.text, fontWeight: '700' }]}>
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {step6Error ? <Text style={styles.sectionErrorText}>{step6Error}</Text> : null}

        <TouchableOpacity
          style={[
            catStyles.sendButton,
            selectedSubCategory ? catStyles.sendButtonActive : catStyles.sendButtonDisabled,
          ]}
          onPress={handleSendForApproval}
          disabled={!selectedSubCategory || step6Saving}
        >
          {step6Saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={catStyles.sendButtonText}>Send for Approval</Text>
          )}
        </TouchableOpacity>
      </View>
    ) : (
      <>
        {/* ── Locked category row ── */}
        <View style={styles.sectionCard}>
          <View style={catStyles.lockedRow}>
            <View style={[catStyles.headerBadge, { backgroundColor: selectedCategoryColor.bg, borderColor: selectedCategoryColor.border }]}>
              <Text style={[catStyles.headerBadgeText, { color: selectedCategoryColor.text }]}>
                {selectedCategoryLetter} — {selectedSubCategory}
              </Text>
            </View>
            <Text style={catStyles.lockedText}>Category locked for approval</Text>
          </View>
        </View>

        {/* ── PENDING_AM ── */}
        {workApprovalStatus === 'PENDING_AM' && (
          <View style={getStatusCardStyle('amber')}>
            <Text style={catStyles.statusIcon}>🕐</Text>
            <Text style={[catStyles.statusTitle, { color: '#C2410C' }]}>Awaiting AM Review</Text>
            <Text style={[catStyles.statusSubtitle, { color: '#C2410C' }]}>
              Your work is submitted for Area Manager approval. Pull down to refresh for updates.
            </Text>
          </View>
        )}

        {/* ── PENDING_RSM ── */}
        {workApprovalStatus === 'PENDING_RSM' && (
          <View style={getStatusCardStyle('amber')}>
            <Text style={catStyles.statusIcon}>🕐</Text>
            <Text style={[catStyles.statusTitle, { color: '#1D4ED8' }]}>Awaiting RSM Confirmation</Text>
            <Text style={[catStyles.statusSubtitle, { color: '#1D4ED8' }]}>
              AM has approved — waiting for RSM to confirm. Pull down to refresh for updates.
            </Text>
          </View>
        )}

   
        {/* ── CONFIRMED ── */}
        {workApprovalStatus === 'CONFIRMED' && (
          <>
           <View style={getStatusCardStyle('green')}>
              <Text style={[catStyles.statusTitle, { color: '#15803D' }]}>✓ Fully Approved</Text>
              <Text style={[catStyles.statusSubtitle, { color: '#15803D' }]}>
                RSM has confirmed. Generate OTP to close the ticket.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>COMPLETION VERIFICATION</Text>

              {/* ── STEP 1: GENERATE OTP ── */}
              <View style={styles.otpSubCard}>
                <Text style={styles.otpSubCardTitle}>STEP 1 — GENERATE OTP</Text>

                {!otpGenerated ? (
                  <TouchableOpacity
                    style={[styles.generateOtpButton, otpLoading && { opacity: 0.6 }]}
                    onPress={handleGenerateOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.generateOtpButtonText}>🔑  Generate OTP</Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={styles.otpShareText}>Share this code with the customer</Text>
                    <View style={styles.otpDigitsRow}>
                      {generatedOtp.map((digit, index) => (
                        <View key={index} style={styles.otpDigitBox}>
                          <Text style={styles.otpDigitText}>{digit}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      onPress={handleRegenerateOtp}
                      disabled={otpLoading}
                      style={{ alignSelf: 'center', marginTop: 12 }}
                    >
                      <Text style={styles.regenerateLink}>Regenerate</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* ── STEP 2: CUSTOMER ENTERS OTP ── */}
              {otpGenerated && !taskCompleted && (
                <View style={[styles.otpSubCard, { marginTop: 16 }]}>
                  <Text style={styles.otpSubCardTitle}>STEP 2 — CUSTOMER ENTERS OTP</Text>

                  <View style={styles.otpInputRow}>
                    {customerOtp.map((digit, index) => (
                      
<TextInput
  key={index}
  ref={(ref) => { otpInputRefs.current[index] = ref; }}
  style={[
    styles.otpInputBox,
    digit ? { borderColor: '#F26722' } : {},
  ]}
  value={digit}
  onChangeText={(text) => handleChangeCustomerOtpDigit(index, text)}
  onFocus={handleOtpInputFocus}
  keyboardType="numeric"
  maxLength={1}
  textAlign="center"
/>
                    ))}
                  </View>

                  {otpError ? (
                    <Text style={[styles.sectionErrorText, { marginBottom: 12 }]}>{otpError}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.verifyCompleteButton,
                      customerOtp.join('').length < 4 && { backgroundColor: '#D1FAE5', opacity: 0.5 },
                      otpLoading && { opacity: 0.6 },
                    ]}
                    onPress={handleVerifyAndComplete}
                    disabled={customerOtp.join('').length < 4 || otpLoading}
                  >
                    {otpLoading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.verifyCompleteButtonText}>Verify & Complete</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* ── SUCCESS STATE ── */}
              {taskCompleted && (
                <View style={[styles.otpSubCard, { marginTop: 16, alignItems: 'center' }]}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#15803D', marginBottom: 6 }}>
                    Task Completed!
                  </Text>
                  <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>
                    Work completion has been verified and the task is now marked as complete.
                  </Text>
                  <TouchableOpacity
                    style={[styles.generateOtpButton, { marginTop: 20, backgroundColor: '#15803D' }]}
                    onPress={() => router.back()}
                  >
                    <Text style={styles.generateOtpButtonText}>← Back to SR Tasks</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </>
    )}
  </>
)}

        {/* Camera / Gallery picker modal */}
        <Modal
          visible={photoOptionsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoOptionsVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setPhotoOptionsVisible(false)}>
            <View style={styles.optionsSheet}>
              <Text style={styles.optionsTitle}>Add Photo</Text>
              <TouchableOpacity style={styles.optionRow} onPress={handleTakePhoto}>
                <Text style={styles.optionText}>📷  Take Photo</Text>
              </TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={handleChoosePhotos}>
                <Text style={styles.optionText}>🖼️  Choose from Gallery</Text>
              </TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity style={styles.optionRow} onPress={() => setPhotoOptionsVisible(false)}>
                <Text style={styles.optionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </ScrollView>

      {/* ── Fixed Back/Next bar ── */}
       {/* ── Fixed Back/Next bar ── */}
      <View style={styles.fixedBottomActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={currentStep === 1 ? handleCancel : handleBack}>
          <Text style={styles.cancelButtonText}>{currentStep === 1 ? 'Cancel' : '← Back'}</Text>
        </TouchableOpacity>
        {currentStep !== 6 && (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// catStyles / statusCardColors now live in _components/srTaskForm/SrTaskForm.styles.ts