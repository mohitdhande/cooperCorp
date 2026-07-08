import React, { useEffect, useState } from 'react';
import { useTaskFormScreenController } from '../../../controllers/taskFormScreenController';
import {
  Image, View, Text, TouchableOpacity, Dimensions, ScrollView,
  TextInput, Modal, Pressable,ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '../../../_components/taskForm/TaskForm.styles';
import { useTaskForm } from '../../../_components/taskForm/useTaskForm';

import { DropdownField } from '../../../_components/taskForm/_components/DropdownField';
import { GroupHeader } from '../../../_components/taskForm/_components/GroupHeader';
import { PartPickerModal } from '../../../_components/taskForm/_components/PartPickerModal';
import { SelectedPartCard } from '../../../_components/taskForm/_components/SelectedPartCard';
import { ComplaintCodePickerModal } from '../../../_components/taskForm/_components/ComplaintCodePickerModal';
import { ComplaintCodeCard } from '../../../_components/taskForm/_components/ComplaintCodeCard';
import { CheckToggleRow, TwoOptionToggleRow, MultiOptionToggleRow } from '../../../_components/taskForm/_components/FormToggleRows';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');







// Main commissioning task form screen. It renders the wizard UI and delegates the heavy logic to the task-form hook.
export default function TaskFormScreen() {
  const vm = useTaskForm();
  const { userName, userProfilePic } = useTaskFormScreenController();

  const [drawerVisible, setDrawerVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      {vm.toastVisible && (
  <View style={[
    styles.toastContainer,
    vm.toastType === 'success' ? styles.toastSuccess : styles.toastError,
  ]}>
    <Text style={styles.toastText}>{vm.toastMessage}</Text>
  </View>
)}

      {/* ── AppBar ── */}
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
           {/* User avatar */}
           <TouchableOpacity onPress={() => router.push('/screens/profile' as any)}>
             {userProfilePic ? (
               <Image
                 source={{ uri: userProfilePic }}
                 style={styles.appBarAvatar}
               />
             ) : (
               <View style={styles.appBarAvatarFallback}>
                 <Text style={styles.appBarAvatarText}>
                   {userName.charAt(0).toUpperCase()}
                 </Text>
               </View>
             )}
           </TouchableOpacity>
   
           {/* Drawer icon */}
           <TouchableOpacity
             style={styles.drawerIconButton}
             onPress={() => setDrawerVisible(true)}
           >
             <View style={styles.hamburgerLine} />
             <View style={styles.hamburgerLine} />
             <View style={styles.hamburgerLine} />
           </TouchableOpacity>
         </View>
      </View>

      

      <ScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >

        {/* ── My Tasks back link ── */}
        <TouchableOpacity style={styles.myTasksRow} onPress={vm.goToMyTasks}>
          <Text style={styles.myTasksArrow}>{'‹'}</Text>
          <Text style={styles.myTasksText}>My Tasks</Text>
        </TouchableOpacity>

        {/* ── Task + Stepper card ── */}
        <View style={styles.stepperCard}>
          <View style={styles.stepperHeaderRow}>
            <Text style={styles.taskLabel}>Task</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {vm.params.taskType || 'Re-Commissioning'}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stepperScroll}
          >
           {vm.stepSequence.map((step, index) => {
              const displayNumber = index + 1;
              const currentIndex = vm.stepSequence.indexOf(vm.currentStep);
              const isDone = currentIndex > index;
              const isActive = step === vm.currentStep;
              return (
                <React.Fragment key={step}>
                  <TouchableOpacity
                    style={[
                      styles.stepCircle,
                      isActive && styles.stepCircleActive,
                      isDone && styles.stepCircleDone,
                    ]}
                    onPress={() => vm.setCurrentStep(step)}
                  >
                    {isDone ? (
                      <Text style={styles.stepCircleTextActive}>✓</Text>
                    ) : (
                      <Text
                        style={[
                          styles.stepCircleText,
                          isActive && styles.stepCircleTextActive,
                        ]}
                      >
                        {displayNumber}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {index < vm.stepSequence.length - 1 && <View style={styles.stepLine} />}
                </React.Fragment>
              );
            })}
          </ScrollView>
        </View>

        {/* ── STEP 1 ── */}
        {vm.currentStep === 1 && (
          <>
            <Text style={styles.stepHeading}>STEP 1 — ASSET INFORMATION</Text>
{vm.assetLoading && (
  <View style={styles.assetLoadingRow}>
    <ActivityIndicator size="small" color="#F26722" />
    <Text style={styles.assetLoadingText}>Loading asset data...</Text>
  </View>
)}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>GENSET IDENTIFICATION</Text>
                {vm.gensetMissingCount > 0 && (
                  <View style={styles.missingPill}>
                    <Text style={styles.missingPillText}>{vm.gensetMissingCount} missing</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● GENSET MODEL</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vm.gensetModel}
                    onChangeText={vm.setGensetModel}
                    placeholder="—"
                  />
                </View>
<View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● GENSET SR NUMBER</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vm.gensetSrNumber}
                    onChangeText={vm.setGensetSrNumber}
                    placeholder="—"
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ENGINE MODEL</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vm.engineModel}
                    onChangeText={vm.setEngineModel}
                    placeholder="—"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ENGINE NUMBER</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vm.engineNumber}
                    onChangeText={vm.setEngineNumber}
                    placeholder="—"
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ENGINE KW</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vm.engineKw}
                    onChangeText={vm.setEngineKw}
                    placeholder="—"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ENGINE TYPE</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={vm.engineType}
                    onChangeText={vm.setEngineType}
                    placeholder="—"
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="ENGINE FAMILY"
                    value={vm.engineFamily}
                    options={vm.ENGINE_FAMILY_OPTIONS}
                    onSelect={vm.setEngineFamily}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="FUEL TYPE"
                    value={vm.fuelType}
                    options={vm.FUEL_TYPE_OPTIONS}
                    onSelect={vm.setFuelType}
                  />
                </View>
              </View>

              <View style={styles.fieldFull}>
                <DropdownField
                  label="APPLICATION"
                  value={vm.application}
                  options={vm.APPLICATION_OPTIONS}
                  onSelect={vm.setApplication}
                />
              </View>

             {vm.sectionError['genset'] ? (
  <Text style={styles.sectionErrorText}>{vm.sectionError['genset']}</Text>
) : null}

<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    vm.sectionSuccess['genset'] && styles.sectionSaveButtonSuccess,
    vm.sectionSaving['genset'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={vm.handleSaveGensetIdentification}
  disabled={vm.sectionSaving['genset']}
>
  {vm.sectionSaving['genset'] ? (
    <ActivityIndicator color="#fff" size="small" />
  ) : (
    <Text style={styles.sectionSaveButtonText}>
      {vm.sectionSuccess['genset'] ? '✓ Saved' : 'Save'}
    </Text>
  )}
</TouchableOpacity>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>ALTERNATOR & PANEL</Text>
                {vm.altMissingCount > 0 && (
                  <View style={styles.missingPill}>
                    <Text style={styles.missingPillText}>{vm.altMissingCount} missing</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ALT. MAKE</Text>
                  <TextInput style={styles.fieldInput} value={vm.altMake} onChangeText={vm.setAltMake} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ALT. MODEL</Text>
                  <TextInput style={styles.fieldInput} value={vm.altModel} onChangeText={vm.setAltModel} placeholder="—" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ALT. S/N</Text>
                  <TextInput style={styles.fieldInput} value={vm.altSn} onChangeText={vm.setAltSn} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● ATS S/N</Text>
                  <TextInput style={styles.fieldInput} value={vm.atsSn} onChangeText={vm.setAtsSn} placeholder="—" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● BATTERY S/N</Text>
                  <TextInput style={styles.fieldInput} value={vm.batterySn} onChangeText={vm.setBatterySn} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● KVA</Text>
                  <TextInput style={styles.fieldInput} value={vm.kva} onChangeText={vm.setKva} placeholder="—" keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="PHASE"
                    value={vm.phase}
                    options={vm.PHASE_OPTIONS}
                    onSelect={vm.setPhase}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="PANEL TYPE"
                    value={vm.panelType}
                    options={vm.PANEL_TYPE_OPTIONS}
                    onSelect={vm.setPanelType}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>● PANEL S/N</Text>
                  <TextInput style={styles.fieldInput} value={vm.panelSn} onChangeText={vm.setPanelSn} placeholder="—" />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="CPCB NORM"
                    value={vm.cpcbNorm}
                    options={vm.CPCB_NORM_OPTIONS}
                    onSelect={vm.setCpcbNorm}
                  />
                </View>
              </View>

              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>● LOAD UNBALANCE</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleOption, vm.loadUnbalance === 'Yes' && styles.toggleOptionActive]}
                    onPress={() => vm.setLoadUnbalance('Yes')}
                  >
                    <Text style={[styles.toggleText, vm.loadUnbalance === 'Yes' && styles.toggleTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, vm.loadUnbalance === 'No' && styles.toggleOptionActive]}
                    onPress={() => vm.setLoadUnbalance('No')}
                  >
                    <Text style={[styles.toggleText, vm.loadUnbalance === 'No' && styles.toggleTextActive]}>No</Text>
                  </TouchableOpacity>

       
                </View>
                           {vm.loadUnbalance === 'Yes' && (
  <View style={[styles.fieldFull, { marginTop: 12 }]}>
    <Text style={styles.fieldLabel}>UNBALANCE %</Text>
    <TextInput
      style={styles.fieldInput}
      value={vm.loadUnbalancePercentage}
      onChangeText={vm.setLoadUnbalancePercentage}
      placeholder="—"
      keyboardType="numeric"
    />
  </View>
)}
              </View>

             {vm.sectionError['alternator'] ? (
  <Text style={styles.sectionErrorText}>{vm.sectionError['alternator']}</Text>
) : null}

<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    vm.sectionSuccess['alternator'] && styles.sectionSaveButtonSuccess,
    vm.sectionSaving['alternator'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={vm.handleSaveAlternatorPanel}
  disabled={vm.sectionSaving['alternator']}
>
  {vm.sectionSaving['alternator'] ? (
    <ActivityIndicator color="#fff" size="small" />
  ) : (
    <Text style={styles.sectionSaveButtonText}>
      {vm.sectionSuccess['alternator'] ? '✓ Saved' : 'Save'}
    </Text>
  )}
</TouchableOpacity>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>SERVICE</Text>
                {vm.serviceMissingCount > 0 && (
                  <View style={styles.missingPill}>
                    <Text style={styles.missingPillText}>{vm.serviceMissingCount} missing</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="TYPE OF SERVICE"
                    value={vm.typeOfService}
                    options={vm.TYPE_OF_SERVICE_OPTIONS}
                    onSelect={vm.setTypeOfService}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <DropdownField
                    label="WARRANTY STATUS"
                    value={vm.warrantyStatus}
                    options={vm.WARRANTY_STATUS_OPTIONS}
                    onSelect={vm.setWarrantyStatus}
                  />
                </View>
              </View>

             {vm.sectionError['service'] ? (
  <Text style={styles.sectionErrorText}>{vm.sectionError['service']}</Text>
) : null}

<TouchableOpacity
  style={[
    styles.sectionSaveButton,
    vm.sectionSuccess['service'] && styles.sectionSaveButtonSuccess,
    vm.sectionSaving['service'] && styles.sectionSaveButtonDisabled,
  ]}
  onPress={vm.handleSaveService}
  disabled={vm.sectionSaving['service']}
>
  {vm.sectionSaving['service'] ? (
    <ActivityIndicator color="#fff" size="small" />
  ) : (
    <Text style={styles.sectionSaveButtonText}>
      {vm.sectionSuccess['service'] ? '✓ Saved' : 'Save'}
    </Text>
  )}
</TouchableOpacity>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>COMMISSIONING DATE</Text>
              <View style={[styles.fieldFull, { marginTop: 12 }]}>
                <TextInput
                  style={styles.fieldInput}
                  value={vm.commissioningDate}
                  onChangeText={vm.setCommissioningDate}
                />
              </View>
            </View>
          </>
        )}

        {/* ── STEP 2 ── */}
       {vm.currentStep === 2 && !vm.isRevalidation && (
  <>
    <Text style={styles.stepHeading}>STEP 2 — COMMISSIONING CHECKS</Text>

    {vm.checksLoading && (
      <View style={styles.assetLoadingRow}>
        <ActivityIndicator size="small" color="#F26722" />
        <Text style={styles.assetLoadingText}>Loading saved checks...</Text>
      </View>
    )}

    <View style={styles.bigFormCard}>
      <Text style={styles.bigFormTitle}>Commissioning Checks</Text>
      <Text style={styles.bigFormSubtitle}>Complete all applicable items</Text>

      <View style={styles.groupDivider} />

      {/* ── GROUP A ── */}
      <GroupHeader letter="A" title="Pre-Installation Checks" saved={vm.sectionSuccess['groupA'] || false} />

      <CheckToggleRow index={1} question="Genset Installation" value={vm.A1} comment={vm.A1_comment} onSetValue={vm.setA1} onSetComment={vm.setA1_comment} />
      <CheckToggleRow index={2} question="No obstruction to cooling air inlet and air outlet" value={vm.A2} comment={vm.A2_comment} onSetValue={vm.setA2} onSetComment={vm.setA2_comment} />
      <CheckToggleRow index={3} question="All canopy doors open fully for service access" value={vm.A3} comment={vm.A3_comment} onSetValue={vm.setA3} onSetComment={vm.setA3_comment} />
      <CheckToggleRow index={4} question="DG set room ventilation (if installed in a room)" value={vm.A4} comment={vm.A4_comment} hasNA onSetValue={vm.setA4} onSetComment={vm.setA4_comment} />
      <CheckToggleRow index={5} question="Fitment of exhaust silencer and exhaust piping" value={vm.A5} comment={vm.A5_comment} onSetValue={vm.setA5} onSetComment={vm.setA5_comment} />
      <CheckToggleRow index={6} question="Earthing (2 pits genset/panel body, 1 neutral, 1 alternator)" value={vm.A6} comment={vm.A6_comment} onSetValue={vm.setA6} onSetComment={vm.setA6_comment} />
      <CheckToggleRow index={7} question="Visually check all fasteners" value={vm.A7} comment={vm.A7_comment} onSetValue={vm.setA7} onSetComment={vm.setA7_comment} />
      <CheckToggleRow index={8} question="Visually check wiring connections in control panel" value={vm.A8} comment={vm.A8_comment} onSetValue={vm.setA8} onSetComment={vm.setA8_comment} />
      <CheckToggleRow index={9} question="230V supply for battery charger (if external charger fitted)" value={vm.A9} comment={vm.A9_comment} hasNA onSetValue={vm.setA9} onSetComment={vm.setA9_comment} />
      <CheckToggleRow index={10} question="Visually check all connectors and actuators on engine" value={vm.A10} comment={vm.A10_comment} onSetValue={vm.setA10} onSetComment={vm.setA10_comment} />

      {/* EB Mains */}
      <View style={styles.checkItemBlock}>
        <Text style={styles.checkItemQuestion}>11. EB (Mains)</Text>
        <Text style={styles.numericSubLabel}>1. Voltage (V)</Text>
        <View style={styles.numericFieldRow}>
          {[['R-N Phase', vm.A17, vm.setA17], ['Y-N Phase', vm.A18, vm.setA18], ['B-N Phase', vm.A19, vm.setA19]].map(([label, val, setter]) => (
            <View key={label as string} style={styles.numericFieldThird}>
              <Text style={styles.numericFieldLabel}>{label as string}</Text>
              <TextInput style={styles.numericFieldInput} value={val as string} onChangeText={setter as any} placeholder="—" keyboardType="numeric" />
            </View>
          ))}
        </View>
        <Text style={[styles.numericSubLabel, { marginTop: 14 }]}>2. Load (A)</Text>
        <View style={styles.numericFieldRow}>
          {[['R Phase', vm.A11, vm.setA11], ['Y Phase', vm.A12, vm.setA12], ['B Phase', vm.A13, vm.setA13]].map(([label, val, setter]) => (
            <View key={label as string} style={styles.numericFieldThird}>
              <Text style={styles.numericFieldLabel}>{label as string}</Text>
              <TextInput style={styles.numericFieldInput} value={val as string} onChangeText={setter as any} placeholder="—" keyboardType="numeric" />
            </View>
          ))}
        </View>
      </View>

      {vm.sectionError['groupA'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupA']}</Text> : null}
      <TouchableOpacity
        style={[styles.groupSaveButton, vm.sectionSuccess['groupA'] && styles.groupSaveButtonSaved, vm.sectionSaving['groupA'] && { opacity: 0.6 }]}
        onPress={vm.handleSaveGroupA}
        disabled={vm.sectionSaving['groupA']}
      >
        {vm.sectionSaving['groupA'] ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text style={styles.groupSaveButtonText}>{vm.sectionSuccess['groupA'] ? '✓ Saved' : 'Save Pre-Installation Checks'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.groupDivider} />

      {/* ── GROUP B ── */}
      <GroupHeader letter="B" title="Commissioning Instructions" saved={vm.sectionSuccess['groupB'] || false} />

      <CheckToggleRow index={1} question="Lub Oil Level" value={vm.B1} comment={vm.B1_comment} onSetValue={vm.setB1} onSetComment={vm.setB1_comment} />
      <CheckToggleRow index={2} question="Fuel Level" value={vm.B2} comment={vm.B2_comment} onSetValue={vm.setB2} onSetComment={vm.setB2_comment} />
      <CheckToggleRow index={3} question="Coolant Level" value={vm.B3} comment={vm.B3_comment} onSetValue={vm.setB3} onSetComment={vm.setB3_comment} />
      <CheckToggleRow index={4} question="Oil Leakage" value={vm.B4a} comment={vm.B4a_comment} onSetValue={vm.setB4a} onSetComment={vm.setB4a_comment} />
      <CheckToggleRow index={5} question="Coolant Leakage" value={vm.B4b} comment={vm.B4b_comment} onSetValue={vm.setB4b} onSetComment={vm.setB4b_comment} />
      <CheckToggleRow index={6} question="Fuel Leakage" value={vm.B4c} comment={vm.B4c_comment} onSetValue={vm.setB4c} onSetComment={vm.setB4c_comment} />
      <CheckToggleRow index={7} question="Air Leakage" value={vm.B4d} comment={vm.B4d_comment} onSetValue={vm.setB4d} onSetComment={vm.setB4d_comment} />

      {/* Phase Difference */}
      <View style={styles.checkItemBlock}>
        <Text style={styles.checkItemQuestion}>8. Phase Difference (A)</Text>
        <View style={styles.numericFieldRow}>
          {[['R Phase', vm.B5R, vm.setB5R], ['Y Phase', vm.B5Y, vm.setB5Y], ['B Phase', vm.B5B, vm.setB5B]].map(([label, val, setter]) => (
            <View key={label as string} style={styles.numericFieldThird}>
              <Text style={styles.numericFieldLabel}>{label as string}</Text>
              <TextInput style={styles.numericFieldInput} value={val as string} onChangeText={setter as any} placeholder="—" keyboardType="numeric" />
            </View>
          ))}
        </View>
      </View>

      {vm.sectionError['groupB'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupB']}</Text> : null}
      <TouchableOpacity
        style={[styles.groupSaveButton, vm.sectionSuccess['groupB'] && styles.groupSaveButtonSaved, vm.sectionSaving['groupB'] && { opacity: 0.6 }]}
        onPress={vm.handleSaveGroupB}
        disabled={vm.sectionSaving['groupB']}
      >
        {vm.sectionSaving['groupB'] ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text style={styles.groupSaveButtonText}>{vm.sectionSuccess['groupB'] ? '✓ Saved' : 'Save Commissioning Instructions'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.groupDivider} />

      {/* ── GROUP C ── */}
      <GroupHeader letter="C" title="CPCB IV+ ATS System Check Points" saved={vm.sectionSuccess['groupC'] || false} />

      <CheckToggleRow index={1} question="DEF / ADD Blue Tank Fitment & Level" value={vm.C1} comment={vm.C1_comment} hasNA onSetValue={vm.setC1} onSetComment={vm.setC1_comment} />
      <CheckToggleRow index={2} question="Urea Supply & Return Line Fitment" value={vm.C2} comment={vm.C2_comment} hasNA onSetValue={vm.setC2} onSetComment={vm.setC2_comment} />
      <CheckToggleRow index={3} question="DOC/POC/ATS Fitment/Connections" value={vm.C3} comment={vm.C3_comment} hasNA onSetValue={vm.setC3} onSetComment={vm.setC3_comment} />
      <CheckToggleRow index={4} question="Exh. Gas Temp. Sensor Connections" value={vm.C4} comment={vm.C4_comment} hasNA onSetValue={vm.setC4} onSetComment={vm.setC4_comment} />
      <CheckToggleRow index={5} question="NOx Sensor Connections" value={vm.C5} comment={vm.C5_comment} hasNA onSetValue={vm.setC5} onSetComment={vm.setC5_comment} />
      <CheckToggleRow index={6} question="EGR / ECU Fitment & Connections" value={vm.C6} comment={vm.C6_comment} hasNA onSetValue={vm.setC6} onSetComment={vm.setC6_comment} />
      <CheckToggleRow index={7} question="Engine ECM Fitment & Connections" value={vm.C7} comment={vm.C7_comment} hasNA onSetValue={vm.setC7} onSetComment={vm.setC7_comment} />
      <CheckToggleRow index={8} question="Buzzer / Flasher Working" value={vm.C8} comment={vm.C8_comment} onSetValue={vm.setC8} onSetComment={vm.setC8_comment} />
      <CheckToggleRow index={9} question="Ambient Temp. Sensor Fitment & Connections" value={vm.C9} comment={vm.C9_comment} hasNA onSetValue={vm.setC9} onSetComment={vm.setC9_comment} />
      <CheckToggleRow index={10} question="Exhaust Smoke Colour" value={vm.C10} comment={vm.C10_comment} onSetValue={vm.setC10} onSetComment={vm.setC10_comment} />
      <CheckToggleRow index={11} question="Wiring Harness & Connections" value={vm.C11} comment={vm.C11_comment} onSetValue={vm.setC11} onSetComment={vm.setC11_comment} />

      {/* Exhaust Temp DOC */}
      <View style={styles.checkItemBlock}>
        <Text style={styles.checkItemQuestion}>12. Exhaust Temp. on Load DOC (°C)</Text>
        <View style={styles.numericFieldRow}>
          {[['Before', vm.C12, vm.setC12], ['After', vm.C13, vm.setC13]].map(([label, val, setter]) => (
            <View key={label as string} style={{ width: '48%' }}>
              <Text style={styles.numericFieldLabel}>{label as string}</Text>
              <TextInput style={styles.numericFieldInput} value={val as string} onChangeText={setter as any} placeholder="—" keyboardType="numeric" />
            </View>
          ))}
        </View>
      </View>

      <CheckToggleRow index={13} question="Supply Module Fitment & Connection" value={vm.C14} comment={vm.C14_comment} hasNA onSetValue={vm.setC14} onSetComment={vm.setC14_comment} />
      <CheckToggleRow index={14} question="Dosing Module Fitment & Connection" value={vm.C15} comment={vm.C15_comment} hasNA onSetValue={vm.setC15} onSetComment={vm.setC15_comment} />
      <CheckToggleRow index={15} question="ATS Control Module Fitment & Connections" value={vm.C16} comment={vm.C16_comment} hasNA onSetValue={vm.setC16} onSetComment={vm.setC16_comment} />
      <CheckToggleRow index={16} question="ATS System Working" value={vm.C17} comment={vm.C17_comment} hasNA onSetValue={vm.setC17} onSetComment={vm.setC17_comment} />

      {/* DEF Make */}
      <View style={styles.checkItemBlock}>
        <Text style={styles.checkItemQuestion}>17. DEF Make (ISO22241 Recommendation)</Text>
        <TextInput style={styles.fieldInput} value={vm.C18} onChangeText={vm.setC18} placeholder="Enter value..." />
      </View>

      {vm.sectionError['groupC'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupC']}</Text> : null}
      <TouchableOpacity
        style={[styles.groupSaveButton, vm.sectionSuccess['groupC'] && styles.groupSaveButtonSaved, vm.sectionSaving['groupC'] && { opacity: 0.6 }]}
        onPress={vm.handleSaveGroupC}
        disabled={vm.sectionSaving['groupC']}
      >
        {vm.sectionSaving['groupC'] ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text style={styles.groupSaveButtonText}>{vm.sectionSuccess['groupC'] ? '✓ Saved' : 'Save CPCB IV+ ATS Check Points'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.groupDivider} />

      {/* ── GROUP D — Performance Trial ── */}
      <View style={styles.groupBadgeRow}>
        <View style={[styles.groupStatusCircle, styles.groupStatusCircleD]}>
          <Text style={styles.groupStatusCircleText}>D</Text>
        </View>
        <Text style={styles.groupTitle}>Performance Trial</Text>
      </View>

      {[
        { label: '0% Load', duration: '5 min', prefix: 'D0', LR: vm.D0LR, LY: vm.D0LY, LB: vm.D0LB, VR: vm.D0VR, VY: vm.D0VY, VB: vm.D0VB, F: vm.D0F, BV: vm.D0BV, REM: vm.D0REM, setLR: vm.setD0LR, setLY: vm.setD0LY, setLB: vm.setD0LB, setVR: vm.setD0VR, setVY: vm.setD0VY, setVB: vm.setD0VB, setF: vm.setD0F, setBV: vm.setD0BV, setREM: vm.setD0REM },
        { label: '25% Load', duration: '5 min', prefix: 'D25', LR: vm.D25LR, LY: vm.D25LY, LB: vm.D25LB, VR: vm.D25VR, VY: vm.D25VY, VB: vm.D25VB, F: vm.D25F, BV: vm.D25BV, REM: vm.D25REM, setLR: vm.setD25LR, setLY: vm.setD25LY, setLB: vm.setD25LB, setVR: vm.setD25VR, setVY: vm.setD25VY, setVB: vm.setD25VB, setF: vm.setD25F, setBV: vm.setD25BV, setREM: vm.setD25REM },
        { label: '50% Load', duration: '5 min', prefix: 'D50', LR: vm.D50LR, LY: vm.D50LY, LB: vm.D50LB, VR: vm.D50VR, VY: vm.D50VY, VB: vm.D50VB, F: vm.D50F, BV: vm.D50BV, REM: vm.D50REM, setLR: vm.setD50LR, setLY: vm.setD50LY, setLB: vm.setD50LB, setVR: vm.setD50VR, setVY: vm.setD50VY, setVB: vm.setD50VB, setF: vm.setD50F, setBV: vm.setD50BV, setREM: vm.setD50REM },
        { label: '75% Load', duration: '5 min', prefix: 'D75', LR: vm.D75LR, LY: vm.D75LY, LB: vm.D75LB, VR: vm.D75VR, VY: vm.D75VY, VB: vm.D75VB, F: vm.D75F, BV: vm.D75BV, REM: vm.D75REM, setLR: vm.setD75LR, setLY: vm.setD75LY, setLB: vm.setD75LB, setVR: vm.setD75VR, setVY: vm.setD75VY, setVB: vm.setD75VB, setF: vm.setD75F, setBV: vm.setD75BV, setREM: vm.setD75REM },
        { label: '100% Load', duration: '10 min', prefix: 'D100', LR: vm.D100LR, LY: vm.D100LY, LB: vm.D100LB, VR: vm.D100VR, VY: vm.D100VY, VB: vm.D100VB, F: vm.D100F, BV: vm.D100BV, REM: vm.D100REM, setLR: vm.setD100LR, setLY: vm.setD100LY, setLB: vm.setD100LB, setVR: vm.setD100VR, setVY: vm.setD100VY, setVB: vm.setD100VB, setF: vm.setD100F, setBV: vm.setD100BV, setREM: vm.setD100REM },
      ].map(stage => (
        <View key={stage.prefix} style={styles.loadStageCard}>
          <View style={styles.loadStageHeaderRow}>
            <Text style={styles.loadStageLabel}>{stage.label}</Text>
            <View style={styles.durationPill}>
              <Text style={styles.durationPillText}>{stage.duration}</Text>
            </View>
          </View>

          <Text style={styles.numericSubLabel}>LOAD (AMPS)</Text>
          <View style={styles.numericFieldRow}>
            {[['R', stage.LR, stage.setLR], ['Y', stage.LY, stage.setLY], ['B', stage.LB, stage.setLB]].map(([p, v, s]) => (
              <View key={p as string} style={styles.numericFieldThird}>
                <Text style={styles.numericFieldLabel}>{p as string}</Text>
                <TextInput style={styles.numericFieldInput} value={v as string} onChangeText={s as any} placeholder="—" keyboardType="numeric" />
              </View>
            ))}
          </View>

          <Text style={[styles.numericSubLabel, { marginTop: 14 }]}>VOLTAGE (VOLTS)</Text>
          <View style={styles.numericFieldRow}>
            {[['R', stage.VR, stage.setVR], ['Y', stage.VY, stage.setVY], ['B', stage.VB, stage.setVB]].map(([p, v, s]) => (
              <View key={p as string} style={styles.numericFieldThird}>
                <Text style={styles.numericFieldLabel}>{p as string}</Text>
                <TextInput style={styles.numericFieldInput} value={v as string} onChangeText={s as any} placeholder="—" keyboardType="numeric" />
              </View>
            ))}
          </View>

          <View style={[styles.fieldRow, { marginTop: 14 }]}>
            <View style={styles.fieldHalf}>
              <Text style={styles.numericFieldLabel}>Freq (Hz)</Text>
              <TextInput style={styles.fieldInput} value={stage.F as string} onChangeText={stage.setF as any} placeholder="—" keyboardType="numeric" />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.numericFieldLabel}>Battery V</Text>
              <TextInput style={styles.fieldInput} value={stage.BV as string} onChangeText={stage.setBV as any} placeholder="—" keyboardType="numeric" />
            </View>
          </View>

          <Text style={[styles.numericFieldLabel, { marginTop: 14, marginBottom: 6 }]}>Remarks</Text>
          <TextInput style={styles.issueInput} value={stage.REM as string} onChangeText={stage.setREM as any} placeholder="Optional remarks..." placeholderTextColor="#9CA3AF" multiline />
        </View>
      ))}

      {vm.sectionError['groupD'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupD']}</Text> : null}
      <TouchableOpacity
        style={[styles.groupSaveButton, vm.sectionSuccess['groupD'] && styles.groupSaveButtonSaved, vm.sectionSaving['groupD'] && { opacity: 0.6 }]}
        onPress={vm.handleSaveGroupD}
        disabled={vm.sectionSaving['groupD']}
      >
        {vm.sectionSaving['groupD'] ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text style={styles.groupSaveButtonText}>{vm.sectionSuccess['groupD'] ? '✓ Saved' : 'Save Performance Trial'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.groupDivider} />

      {/* ── GROUP E — Running Hours ── */}
      <View style={styles.groupBadgeRow}>
        <View style={[styles.groupStatusCircle, styles.groupStatusCircleD]}>
          <Text style={styles.groupStatusCircleText}>E</Text>
        </View>
        <Text style={styles.groupTitle}>Running Hours</Text>
      </View>

<TextInput
        style={[styles.fieldInput, { marginTop: 12 }]}
        value={vm.E_runHrs}
        onChangeText={vm.setE_runHrs}
        placeholder="Enter running hours..."
        keyboardType="numeric"
      />

      {vm.sectionError['groupE'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['groupE']}</Text> : null}
      <TouchableOpacity
        style={[styles.groupSaveButton, vm.sectionSuccess['groupE'] && styles.groupSaveButtonSaved, vm.sectionSaving['groupE'] && { opacity: 0.6 }, { marginTop: 14 }]}
        onPress={vm.handleSaveGroupE}
        disabled={vm.sectionSaving['groupE']}
      >
        {vm.sectionSaving['groupE'] ? <ActivityIndicator color="#fff" size="small" /> : (
          <Text style={styles.groupSaveButtonText}>{vm.sectionSuccess['groupE'] ? '✓ Saved' : 'Save Running Hours'}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.groupDivider} />

      {/* ── UPLOAD PHOTO — actual upload happens from Step 6's Save button ── */}
      <Text style={styles.bigFormTitle}>Upload Photo</Text>

      {vm.runningHoursPhotos.length > 0 && (
        <View style={styles.photoGrid}>
          {vm.runningHoursPhotos.map((photo) => (
            <View key={photo.id} style={styles.photoThumbWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
              <TouchableOpacity
                style={styles.photoRemoveBadge}
                onPress={() => vm.handleRemoveRunningHoursPhoto(photo.id)}
              >
                <Text style={styles.photoRemoveBadgeText}>✕</Text>
              </TouchableOpacity>
              <View style={styles.photoNameTag}>
                <Text style={styles.photoNameText} numberOfLines={1}>{photo.fileName}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.addPhotoBox}
        onPress={() => vm.setStep2PhotoOptionsVisible(true)}
      >
        <View style={styles.addPhotoIconCircle}>
          <Text style={styles.addPhotoIcon}>📤</Text>
        </View>
        <Text style={styles.addPhotoTitle}>Tap to upload photos</Text>
      </TouchableOpacity>

     {vm.runningHoursPhotos.length > 0 && (
        <Text style={styles.photoCountText}>
          {vm.runningHoursPhotos.length} photo{vm.runningHoursPhotos.length > 1 ? 's' : ''} selected
        </Text>
      )}

    </View>
  </>
)}

        {/* ── STEP 2 — VALIDATION CHECKS (Revalidation only) ── */}
       {/* ── STEP 2 — VALIDATION CHECKS (Revalidation only) ── */}
        {vm.currentStep === 2 && vm.isRevalidation && (
          <>
            <Text style={styles.stepHeading}>STEP 2 — VALIDATION CHECKS</Text>

            {vm.checksLoading && (
              <View style={styles.assetLoadingRow}>
                <ActivityIndicator size="small" color="#F26722" />
                <Text style={styles.assetLoadingText}>Loading saved checks...</Text>
              </View>
            )}

            <View style={styles.bigFormCard}>
              <Text style={styles.bigFormTitle}>Validation Checks</Text>
              <Text style={styles.bigFormSubtitle}>Select one option per item</Text>

              <View style={styles.groupDivider} />
              <GroupHeader letter="A" title="Air Intake System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Air Cleaner Condition"
                optionA="Ok" optionB="Replaced"
                value={vm.valA1} onSetValue={vm.setValA1}
                commentTriggerValue="Replaced" comment={vm.valA1_comment} onSetComment={vm.setValA1_comment}
              />
              <TwoOptionToggleRow
                index="2" question="Environment Condition"
                optionA="Dusty" optionB="Clean"
                value={vm.valA2} onSetValue={vm.setValA2}
              />
              <TwoOptionToggleRow
                index="3" question="Hoses Condition"
                optionA="Ok" optionB="Replaced"
                value={vm.valA3} onSetValue={vm.setValA3}
                commentTriggerValue="Replaced" comment={vm.valA3_comment} onSetComment={vm.setValA3_comment}
              />

              <View style={styles.groupDivider} />
              <GroupHeader letter="B" title="Exhaust System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Exhaust Leakage"
                optionA="Ok" optionB="Arrested"
                value={vm.valB1} onSetValue={vm.setValB1}
                commentTriggerValue="Arrested" comment={vm.valB1_comment} onSetComment={vm.setValB1_comment}
              />
              <TwoOptionToggleRow
                index="2" question="Visible Exhaust Smoke Level"
                optionA="OK" optionB="Not OK"
                value={vm.valB2} onSetValue={vm.setValB2}
                commentTriggerValue="Not OK" comment={vm.valB2_comment} onSetComment={vm.setValB2_comment}
              />
              <TwoOptionToggleRow
                index="3" question="Exhaust Bellow Free Fitment"
                optionA="OK" optionB="Not OK"
                value={vm.valB3} onSetValue={vm.setValB3}
                commentTriggerValue="Not OK" comment={vm.valB3_comment} onSetComment={vm.setValB3_comment}
              />

              <View style={styles.groupDivider} />
              <GroupHeader letter="C" title="Lub Oil System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Lub Oil Level"
                optionA="Ok" optionB="Replaced"
                value={vm.valC1} onSetValue={vm.setValC1}
                commentTriggerValue="Replaced" comment={vm.valC1_comment} onSetComment={vm.setValC1_comment}
              />
              <MultiOptionToggleRow
                index="2" question="Brand and Grade of Oil Used"
                options={['15W40 CH4', '15W40 CI4', '15W40 CI4 Plus']}
                value={vm.valC2} onSetValue={vm.setValC2}
              />
              <TwoOptionToggleRow
                index="3" question="Oil Leakage"
                optionA="Ok" optionB="Corrected"
                value={vm.valC3} onSetValue={vm.setValC3}
                commentTriggerValue="Corrected" comment={vm.valC3_comment} onSetComment={vm.setValC3_comment}
              />
              <TwoOptionToggleRow
                index="4" question="Lub Oil Filter"
                optionA="Ok" optionB="Replaced"
                value={vm.valC4} onSetValue={vm.setValC4}
                commentTriggerValue="Replaced" comment={vm.valC4_comment} onSetComment={vm.setValC4_comment}
              />

              <View style={styles.groupDivider} />
              <GroupHeader letter="D" title="Cooling System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Coolant Level and Condition"
                optionA="Ok" optionB="Replaced"
                value={vm.valD1} onSetValue={vm.setValD1}
                commentTriggerValue="Replaced" comment={vm.valD1_comment} onSetComment={vm.setValD1_comment}
              />
              <TwoOptionToggleRow
                index="2" question="Coolant Leakage"
                optionA="Ok" optionB="Arrested"
                value={vm.valD2} onSetValue={vm.setValD2}
                commentTriggerValue="Arrested" comment={vm.valD2_comment} onSetComment={vm.setValD2_comment}
              />
              <TwoOptionToggleRow
                index="3" question="Belt Condition"
                optionA="Ok" optionB="Replaced"
                value={vm.valD3} onSetValue={vm.setValD3}
                commentTriggerValue="Replaced" comment={vm.valD3_comment} onSetComment={vm.setValD3_comment}
              />
              <TwoOptionToggleRow
                index="4" question="Radiator Condition and Cleanliness"
                optionA="OK" optionB="Not OK"
                value={vm.valD4} onSetValue={vm.setValD4}
                commentTriggerValue="Not OK" comment={vm.valD4_comment} onSetComment={vm.setValD4_comment}
              />
              <TwoOptionToggleRow
                index="5" question="Condition of all Hoses and Clamps"
                optionA="Ok" optionB="Replaced"
                value={vm.valD5} onSetValue={vm.setValD5}
                commentTriggerValue="Replaced" comment={vm.valD5_comment} onSetComment={vm.setValD5_comment}
              />

              <View style={styles.groupDivider} />
              <GroupHeader letter="E" title="Fuel System" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Fuel Tank Cleanliness"
                optionA="OK" optionB="Not OK"
                value={vm.valE1} onSetValue={vm.setValE1}
                commentTriggerValue="Not OK" comment={vm.valE1_comment} onSetComment={vm.setValE1_comment}
              />
              <TwoOptionToggleRow
                index="2" question="Condition of Fuel Hoses and Leakages"
                optionA="Ok" optionB="Replaced"
                value={vm.valE2} onSetValue={vm.setValE2}
                commentTriggerValue="Replaced" comment={vm.valE2_comment} onSetComment={vm.setValE2_comment}
              />
              <TwoOptionToggleRow
                index="3" question="Fuel Filter"
                optionA="Ok" optionB="Replaced"
                value={vm.valE3} onSetValue={vm.setValE3}
                commentTriggerValue="Replaced" comment={vm.valE3_comment} onSetComment={vm.setValE3_comment}
              />

              <View style={styles.groupDivider} />
              <GroupHeader letter="F" title="Electrical Wiring" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Battery"
                optionA="Ok" optionB="Replaced"
                value={vm.valF1} onSetValue={vm.setValF1}
                commentTriggerValue="Replaced" comment={vm.valF1_comment} onSetComment={vm.setValF1_comment}
              />
              <TwoOptionToggleRow
                index="2" question="Electrolyte Level and Terminal Condition of Battery"
                optionA="OK" optionB="Not OK"
                value={vm.valF2} onSetValue={vm.setValF2}
                commentTriggerValue="Not OK" comment={vm.valF2_comment} onSetComment={vm.setValF2_comment}
              />

              <View style={styles.checkItemBlock}>
                <Text style={styles.checkItemQuestion}>3. Battery Voltage in DC</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={vm.valF3}
                  onChangeText={vm.setValF3}
                  placeholder="Enter value..."
                  keyboardType="numeric"
                />
              </View>

              <TwoOptionToggleRow
                index="4" question="Voltage Drop at Battery During Cranking Within 9V"
                optionA="OK" optionB="Not OK"
                value={vm.valF4} onSetValue={vm.setValF4}
                commentTriggerValue="Not OK" comment={vm.valF4_comment} onSetComment={vm.setValF4_comment}
              />
              <TwoOptionToggleRow
                index="5" question="Functioning of Charging Alternator"
                subtext="Remove the fan belt & check bearing condition"
                optionA="Ok" optionB="Replaced"
                value={vm.valF5} onSetValue={vm.setValF5}
                commentTriggerValue="Replaced" comment={vm.valF5_comment} onSetComment={vm.setValF5_comment}
              />
              <TwoOptionToggleRow
                index="6" question="Tightness of All S/W & Sensors"
                optionA="OK" optionB="Not OK"
                value={vm.valF6} onSetValue={vm.setValF6}
                commentTriggerValue="Not OK" comment={vm.valF6_comment} onSetComment={vm.setValF6_comment}
              />
              <TwoOptionToggleRow
                index="7" question="Functions of ESU (HWT, LLOP, CLS LFL)"
                optionA="Ok" optionB="Replaced"
                value={vm.valF7} onSetValue={vm.setValF7}
                commentTriggerValue="Replaced" comment={vm.valF7_comment} onSetComment={vm.setValF7_comment}
              />

              <View style={styles.groupDivider} />
              <GroupHeader letter="G" title="General" saved={vm.sectionSuccess['validationChecks'] || false} />
              <TwoOptionToggleRow
                index="1" question="Abnormal Sound from Engine"
                optionA="OK" optionB="Not OK"
                value={vm.valG1} onSetValue={vm.setValG1}
                commentTriggerValue="Not OK" comment={vm.valG1_comment} onSetComment={vm.setValG1_comment}
              />
              <TwoOptionToggleRow
                index="2" question="Overall Condition of Engine and Alternator"
                optionA="OK" optionB="Not OK"
                value={vm.valG2} onSetValue={vm.setValG2}
                commentTriggerValue="Not OK" comment={vm.valG2_comment} onSetComment={vm.setValG2_comment}
              />

              {vm.sectionError['validationChecks'] ? <Text style={styles.sectionErrorText}>{vm.sectionError['validationChecks']}</Text> : null}
              <TouchableOpacity
                style={[styles.groupSaveButton, vm.sectionSuccess['validationChecks'] && styles.groupSaveButtonSaved, vm.sectionSaving['validationChecks'] && { opacity: 0.6 }, { marginTop: 14 }]}
                onPress={vm.handleSaveValidationChecks}
                disabled={vm.sectionSaving['validationChecks']}
              >
                {vm.sectionSaving['validationChecks'] ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.groupSaveButtonText}>{vm.sectionSuccess['validationChecks'] ? '✓ Saved' : 'Save Validation Checks'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 3 — COMPLAINT CODES ── */}

       {vm.currentStep === (vm.isPreComm ? 2 : 3) && (
  <>
    <Text style={styles.stepHeading}>STEP 3 — COMPLAINT CODES</Text>

    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>COMPLAINT CODES</Text>

      {vm.selectedComplaintCodes.length > 0 && (
        <View style={{ marginTop: 16 }}>
          {vm.selectedComplaintCodes.map((item) => (
            <ComplaintCodeCard
              key={item.uid}
              item={item}
              onRemove={() => vm.handleRemoveComplaintCode(item.uid)}
              onChangeObservation={(text) =>
                vm.handleChangeComplaintObservation(item.uid, text)}
              onChangeRootCause={(text) =>
                vm.handleChangeComplaintRootCause(item.uid, text)}
            />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.addCodeButton}
        onPress={vm.handleOpenComplaintPicker}
      >
        <Text style={styles.addCodeButtonText}>+  Add Code</Text>
      </TouchableOpacity>

      {vm.step3Error ? (
        <Text style={styles.sectionErrorText}>{vm.step3Error}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.groupSaveButton,
          vm.step3Success && styles.groupSaveButtonSaved,
          vm.step3Saving && { opacity: 0.6 },
          { marginTop: 16 },
        ]}
        onPress={vm.handleSaveFaultCodes}
        disabled={vm.step3Saving}
      >
        {vm.step3Saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.groupSaveButtonText}>
              {vm.step3Success ? '✓ Saved' : 'Save Complaint Codes'}
            </Text>
        }
      </TouchableOpacity>
    </View>

    <ComplaintCodePickerModal
      visible={vm.complaintPickerVisible}
      onClose={vm.handleCloseComplaintPicker}
      faultCodes={vm.apiFaultCodes}
      loading={vm.faultCodesLoading}
      onSelectCode={vm.handleSelectComplaintCode}
    />
  </>
)}

        {/* ── STEP 4 — PARTS USED ── */}
      {vm.currentStep === (vm.isPreComm ? 3 : 4) && (
  <>
    <Text style={styles.stepHeading}>STEP 4 — PARTS USED</Text>

    <View style={styles.bigFormCard}>
      <Text style={styles.bigFormTitle}>Parts Used</Text>
      <Text style={styles.bigFormSubtitle}>Add parts consumed during this task</Text>

      <View style={styles.groupDivider} />

      {vm.selectedParts.map((part) => (
        <SelectedPartCard
          key={part.partId}
          part={part}
          onIncrease={() => vm.handleIncreaseQty(part.partId)}
          onDecrease={() => vm.handleDecreaseQty(part.partId)}
          onRemove={() => vm.handleRemovePart(part.partId)}
        />
      ))}

      <TouchableOpacity
        style={styles.addPartButton}
        onPress={() => vm.setPartPickerVisible(true)}
      >
        <Text style={styles.addPartButtonText}>+  Add Part</Text>
      </TouchableOpacity>

      {vm.step4Error ? (
        <Text style={styles.sectionErrorText}>{vm.step4Error}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.groupSaveButton,
          vm.step4Success && styles.groupSaveButtonSaved,
          vm.step4Saving && { opacity: 0.6 },
          { marginTop: 16 },
        ]}
        onPress={vm.handleSavePartsUsed}
        disabled={vm.step4Saving}
      >
        {vm.step4Saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.groupSaveButtonText}>
              {vm.step4Success ? '✓ Saved' : 'Save Parts Used'}
            </Text>
        }
      </TouchableOpacity>
    </View>

    <PartPickerModal
      visible={vm.partPickerVisible}
      onClose={() => vm.setPartPickerVisible(false)}
      parts={vm.apiParts}
      loading={vm.partsLoading}
      onSelectPart={vm.handleSelectPart}
    />
  </>
)}

       

        {/* ── STEP 5 — GENSET COMMISSIONING READINGS ── */}
       {vm.currentStep === 5 && (
  <>
    <Text style={styles.stepHeading}>STEP 5 — GENSET COMMISSIONING READINGS</Text>

    {/* Electrical Readings */}
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>ELECTRICAL READINGS</Text>

      <View style={[styles.fieldRow, { marginTop: 16 }]}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>AC VOLT R-Y (V)</Text>
          <TextInput style={styles.fieldInput} value={vm.acVoltageRY} onChangeText={vm.setAcVoltageRY} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>AC VOLT Y-B (V)</Text>
          <TextInput style={styles.fieldInput} value={vm.acVoltageYB} onChangeText={vm.setAcVoltageYB} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>AC VOLT B-R (V)</Text>
          <TextInput style={styles.fieldInput} value={vm.acVoltageBR} onChangeText={vm.setAcVoltageBR} placeholder="—" keyboardType="numeric" />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>AC AMP R (A)</Text>
          <TextInput style={styles.fieldInput} value={vm.acAmpR} onChangeText={vm.setAcAmpR} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>AC AMP Y (A)</Text>
          <TextInput style={styles.fieldInput} value={vm.acAmpY} onChangeText={vm.setAcAmpY} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>AC AMP B (A)</Text>
          <TextInput style={styles.fieldInput} value={vm.acAmpB} onChangeText={vm.setAcAmpB} placeholder="—" keyboardType="numeric" />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>LOAD KW R</Text>
          <TextInput style={styles.fieldInput} value={vm.loadKwR} onChangeText={vm.setLoadKwR} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>LOAD KW Y</Text>
          <TextInput style={styles.fieldInput} value={vm.loadKwY} onChangeText={vm.setLoadKwY} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>LOAD KW B</Text>
          <TextInput style={styles.fieldInput} value={vm.loadKwB} onChangeText={vm.setLoadKwB} placeholder="—" keyboardType="numeric" />
        </View>
      </View>

      <View style={styles.fieldFull}>
        <Text style={styles.fieldLabelStatic}>TOTAL KW</Text>
        <TextInput style={styles.fieldInput} value={vm.totalKwLoad} onChangeText={vm.setTotalKwLoad} placeholder="—" keyboardType="numeric" />
      </View>

      <View style={styles.fieldFull}>
        <Text style={styles.fieldLabelStatic}>LOAD % (%)</Text>
        <TextInput style={styles.fieldInput} value={vm.loadPercentage} onChangeText={vm.setLoadPercentage} placeholder="—" keyboardType="numeric" />
      </View>
    </View>

    {/* Engine Parameters */}
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>ENGINE PARAMETERS</Text>

      <View style={[styles.fieldRow, { marginTop: 16 }]}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>RPM</Text>
          <TextInput style={styles.fieldInput} value={vm.rpm} onChangeText={vm.setRpm} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>FREQUENCY (HZ)</Text>
          <TextInput style={styles.fieldInput} value={vm.frequency} onChangeText={vm.setFrequency} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>DC VOLTAGE (V)</Text>
          <TextInput style={styles.fieldInput} value={vm.dcVoltage} onChangeText={vm.setDcVoltage} placeholder="—" keyboardType="numeric" />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>OIL PRESSURE</Text>
          <TextInput style={styles.fieldInput} value={vm.oilPressure} onChangeText={vm.setOilPressure} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>COOLANT TEMP (°C)</Text>
          <TextInput style={styles.fieldInput} value={vm.coolantTemperature} onChangeText={vm.setCoolantTemperature} placeholder="—" keyboardType="numeric" />
        </View>
        <View style={styles.fieldThird}>
          <Text style={styles.fieldLabelStatic}>DEF LEVEL (%)</Text>
          <TextInput style={styles.fieldInput} value={vm.defLevelPercentage} onChangeText={vm.setDefLevelPercentage} placeholder="—" keyboardType="numeric" />
        </View>
      </View>

      {/* Oil Level toggle */}
      <View style={{ marginTop: 8 }}>
        <Text style={styles.fieldLabelStatic}>OIL LEVEL</Text>
        <View style={styles.okNotOkRow}>
          <TouchableOpacity
            style={[styles.okButton, vm.oilLevel?.toUpperCase() === 'OK' && styles.okButtonActive]}
            onPress={() => vm.setOilLevel('OK')}
          >
            <Text style={[styles.okButtonText, vm.oilLevel?.toUpperCase() === 'OK' && styles.okButtonTextActive]}>OK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.notOkButton, vm.oilLevel?.toUpperCase() === 'NOT OK' && styles.notOkButtonActive]}
            onPress={() => vm.setOilLevel('Not OK')}
          >
            <Text style={[styles.notOkButtonText, vm.oilLevel?.toUpperCase() === 'NOT OK' && styles.notOkButtonTextActive]}>Not OK</Text>
          </TouchableOpacity>
        </View>
        {vm.oilLevel?.toUpperCase() === 'NOT OK' && (
          <TextInput
            style={styles.issueInput}
            placeholder="Describe oil level issue..."
            placeholderTextColor="#D1A3A3"
            value={vm.oilLevelComment}
            onChangeText={vm.setOilLevelComment}
            multiline
          />
        )}
      </View>

      {/* Coolant Level toggle */}
      <View style={{ marginTop: 16 }}>
        <Text style={styles.fieldLabelStatic}>COOLANT LEVEL</Text>
        <View style={styles.okNotOkRow}>
          <TouchableOpacity
            style={[styles.okButton, vm.coolantLevel?.toUpperCase() === 'OK' && styles.okButtonActive]}
            onPress={() => vm.setCoolantLevel('OK')}
          >
            <Text style={[styles.okButtonText, vm.coolantLevel?.toUpperCase() === 'OK' && styles.okButtonTextActive]}>OK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.notOkButton, vm.coolantLevel?.toUpperCase() === 'NOT OK' && styles.notOkButtonActive]}
            onPress={() => vm.setCoolantLevel('Not OK')}
          >
            <Text style={[styles.notOkButtonText, vm.coolantLevel?.toUpperCase() === 'NOT OK' && styles.notOkButtonTextActive]}>Not OK</Text>
          </TouchableOpacity>
        </View>
        {vm.coolantLevel?.toUpperCase() === 'NOT OK' && (
          <TextInput
            style={styles.issueInput}
            placeholder="Describe coolant level issue..."
            placeholderTextColor="#D1A3A3"
            value={vm.coolantLevelComment}
            onChangeText={vm.setCoolantLevelComment}
            multiline
          />
        )}
      </View>
    </View>

    {/* Readings Saved Info */}
    {vm.readingsSavedBy && vm.readingsSavedAt && (
      <View style={styles.readingsSavedBox}>
        <Text style={styles.readingsSavedTitle}>Readings saved</Text>
        <Text style={styles.readingsSavedMeta}>
          By {vm.readingsSavedBy.name} · {new Date(vm.readingsSavedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
    )}

    {/* Save button */}
    {vm.readingsError ? <Text style={styles.sectionErrorText}>{vm.readingsError}</Text> : null}
    <TouchableOpacity
      style={[
        styles.groupSaveButton,
        vm.readingsSuccess && styles.groupSaveButtonSaved,
        vm.readingsSaving && { opacity: 0.6 },
        { marginTop: 8 },
      ]}
      onPress={vm.handleSaveReadings}
      disabled={vm.readingsSaving}
    >
      {vm.readingsSaving ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.groupSaveButtonText}>
          {vm.readingsSuccess ? '✓ Saved' : 'Save Readings'}
        </Text>
      )}
    </TouchableOpacity>
  </>
)}

    {/* ── STEP 6 — PHOTOS ── */}
        {vm.currentStep === 6 && (
          <>
            <Text style={styles.stepHeading}>STEP 6 — PHOTOS</Text>

            <View style={styles.bigFormCard}>
              <Text style={styles.bigFormTitle}>SITE PHOTOS</Text>

              {vm.sitePhotos.length > 0 && (
                <View style={styles.photoGrid}>
                  {vm.sitePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoThumbWrapper}>
                      <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                      <TouchableOpacity
                        style={styles.photoRemoveBadge}
                        onPress={() => vm.handleRemoveSitePhoto(photo.id)}
                      >
                        <Text style={styles.photoRemoveBadgeText}>✕</Text>
                      </TouchableOpacity>
                      <View style={styles.photoNameTag}>
                        <Text style={styles.photoNameText} numberOfLines={1}>{photo.fileName}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addPhotoBox}
                onPress={() => vm.setPhotoOptionsVisible(true)}
              >
                <View style={styles.addPhotoIconCircle}>
                  <Text style={styles.addPhotoIcon}>📷</Text>
                </View>
                <Text style={styles.addPhotoTitle}>
                  {vm.sitePhotos.length === 0 ? 'Add Photos' : 'Add More'}
                </Text>
                <Text style={styles.addPhotoSubtitle}>Tap to open camera or gallery</Text>
              </TouchableOpacity>

              {vm.sitePhotos.length > 0 && (
                <Text style={styles.photoCountText}>
                  {vm.sitePhotos.length} photo{vm.sitePhotos.length > 1 ? 's' : ''} selected
                </Text>
              )}

              {vm.photosUploadError ? (
                <Text style={styles.sectionErrorText}>{vm.photosUploadError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.groupSaveButton,
                  vm.photosUploadSuccess && styles.groupSaveButtonSaved,
                  vm.photosUploading && { opacity: 0.6 },
                  { marginTop: 16 },
                ]}
                onPress={vm.handleSaveAllPhotos}
                disabled={vm.photosUploading}
              >
                {vm.photosUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.groupSaveButtonText}>
                    {vm.photosUploadSuccess ? '✓ Photos Saved' : 'Save Photos'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

     

        {/* ── STEP 7 — CUSTOMER FEEDBACK ── */}
        {vm.currentStep === 7 && (
          <>
            <Text style={styles.stepHeading}>STEP 7 — CUSTOMER FEEDBACK</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>CUSTOMER REVIEW</Text>

              <View style={[styles.fieldFull, { marginTop: 16 }]}>
                <Text style={styles.fieldLabelStatic}>PRIMARY CONTACT</Text>
                <TextInput
                  style={[styles.fieldInput, { marginTop: 6 }]}
                  value={vm.customerName}
                  onChangeText={vm.setCustomerName}
                  placeholder="Enter customer name..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabelStatic}>FEEDBACK</Text>
                <TextInput
                  style={[styles.fieldInput, styles.feedbackTextArea, { marginTop: 6 }]}
                  value={vm.customerFeedback}
                  onChangeText={vm.setCustomerFeedback}
                  placeholder="Customer feedback or remarks..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  scrollEnabled
                />
              </View>
            </View>
          </>
        )}

        {/* ── STEP 8 — WORK COMPLETION OTP ── */}
      {vm.currentStep === 8 && (
  <>
    <Text style={styles.stepHeading}>STEP 8 — WORK COMPLETION OTP</Text>

    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>COMPLETION VERIFICATION</Text>

      {/* ── STEP 1: GENERATE OTP ── */}
      <View style={styles.otpSubCard}>
        <Text style={styles.otpSubCardTitle}>STEP 1 — GENERATE OTP</Text>

        {!vm.otpGenerated ? (
          <TouchableOpacity
            style={[styles.generateOtpButton, vm.otpLoading && { opacity: 0.6 }]}
            onPress={vm.handleGenerateOtp}
            disabled={vm.otpLoading}
          >
            {vm.otpLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.generateOtpButtonText}>🔑  Generate OTP</Text>
            }
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.otpShareText}>Share this code with the customer</Text>
            <View style={styles.otpDigitsRow}>
              {vm.generatedOtp.map((digit, index) => (
                <View key={index} style={styles.otpDigitBox}>
                  <Text style={styles.otpDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              onPress={vm.handleRegenerateOtp}
              disabled={vm.otpLoading}
              style={{ alignSelf: 'center', marginTop: 12 }}
            >
              <Text style={styles.regenerateLink}>Regenerate</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── STEP 2: CUSTOMER ENTERS OTP ── */}
      {vm.otpGenerated && !vm.taskCompleted && (
        <View style={[styles.otpSubCard, { marginTop: 16 }]}>
          <Text style={styles.otpSubCardTitle}>STEP 2 — CUSTOMER ENTERS OTP</Text>

          <View style={styles.otpInputRow}>
            {vm.customerOtp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { vm.otpInputRefs.current[index] = ref; }}
                style={[
                  styles.otpInputBox,
                  digit ? { borderColor: '#F26722' } : {},
                ]}
                value={digit}
                onChangeText={(text) => vm.handleChangeCustomerOtpDigit(index, text)}
                keyboardType="numeric"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          {vm.otpError ? (
            <Text style={[styles.sectionErrorText, { marginBottom: 12 }]}>{vm.otpError}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.verifyCompleteButton,
              // disabled (greyed) until all 4 digits filled
              vm.customerOtp.join('').length < 4 && { backgroundColor: '#D1FAE5', opacity: 0.5 },
              vm.otpLoading && { opacity: 0.6 },
            ]}
            onPress={vm.handleVerifyAndComplete}
            disabled={vm.customerOtp.join('').length < 4 || vm.otpLoading}
          >
            {vm.otpLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.verifyCompleteButtonText}>Verify & Complete</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ── SUCCESS STATE ── */}
      {vm.taskCompleted && (
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
            onPress={vm.goToMyTasks}
          >
            <Text style={styles.generateOtpButtonText}>← Back to My Tasks</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  </>
)}

        {/* Camera / Gallery picker modal */}
       {/* Camera / Gallery picker modal — Step 6 */}
        <Modal
          visible={vm.photoOptionsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => vm.setPhotoOptionsVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => vm.setPhotoOptionsVisible(false)}>
            <View style={styles.optionsSheet}>
              <Text style={styles.optionsTitle}>Add Photo</Text>

              <TouchableOpacity style={styles.optionRow} onPress={vm.handleTakeSitePhoto}>
                <Text style={styles.optionText}>📷  Take Photo</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity style={styles.optionRow} onPress={vm.handleChooseSitePhotos}>
                <Text style={styles.optionText}>🖼️  Choose from Gallery</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity style={styles.optionRow} onPress={() => vm.setPhotoOptionsVisible(false)}>
                <Text style={styles.optionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Camera / Gallery picker modal — Step 2 (Running Hours) */}
        <Modal
          visible={vm.step2PhotoOptionsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => vm.setStep2PhotoOptionsVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => vm.setStep2PhotoOptionsVisible(false)}>
            <View style={styles.optionsSheet}>
              <Text style={styles.optionsTitle}>Add Photo</Text>

              <TouchableOpacity style={styles.optionRow} onPress={vm.handleTakeRunningHoursPhoto}>
                <Text style={styles.optionText}>📷  Take Photo</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity style={styles.optionRow} onPress={vm.handleChooseRunningHoursPhotos}>
                <Text style={styles.optionText}>🖼️  Choose from Gallery</Text>
              </TouchableOpacity>

              <View style={styles.optionDivider} />

              <TouchableOpacity style={styles.optionRow} onPress={() => vm.setStep2PhotoOptionsVisible(false)}>
                <Text style={styles.optionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* ── Bottom Cancel/Back / Next ── */}
        <View style={styles.bottomActionRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={vm.currentStep === 1 ? vm.handleCancel : vm.handleBack}
          >
            <Text style={styles.cancelButtonText}>
              {vm.currentStep === 1 ? 'Cancel' : '← Back'}
            </Text>
          </TouchableOpacity>
          {vm.currentStep !== 8 && (
            <TouchableOpacity style={styles.nextButton} onPress={vm.handleNext}>
              <Text style={styles.nextButtonText}>Next →</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
 {/* ── Fixed Back/Next bar (replaces old bottom tab bar) ── */}
      <View style={styles.fixedBottomActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={vm.currentStep === 1 ? vm.handleCancel : vm.handleBack}
        >
          <Text style={styles.cancelButtonText}>
            {vm.currentStep === 1 ? 'Cancel' : '← Back'}
          </Text>
        </TouchableOpacity>
        {vm.currentStep !== 8 && (
          <TouchableOpacity style={styles.nextButton} onPress={vm.handleNext}>
            <Text style={styles.nextButtonText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>

    </SafeAreaView>
  );
}


