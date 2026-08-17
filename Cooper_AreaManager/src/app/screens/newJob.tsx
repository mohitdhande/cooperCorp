import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import {
  ChevronLeft, Bell, Settings,
  ChevronDown, ChevronUp, ChevronRight, Zap, CheckCircle2, RefreshCw, ShieldCheck, UserRoundCog, Info,
  User, Phone, MapPin, Plus,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNewJobController } from '../../controllers/newJobController';
import { computeDispatchType } from '../../controllers/createAssetCommissionController';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { AssignEngineerModal } from '../../_components/shared/AssignEngineerModal';
import { DispatchStatusBanner } from '../../_components/shared/DispatchStatusBanner';
import { SearchBar } from '../../_components/shared/SearchBar';
import { AssetHistorySection } from '../../_components/shared/AssetHistorySection';
import { TASK_TYPE_BADGE, DEFAULT_TASK_TYPE_BADGE, formatAddress, formatDate } from '../../utils/reportFormatters';

const REF_WIDTH = 420;

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
          <RadialGradient id="newJobBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#newJobBg)" />
      </Svg>
    </View>
  );
}

// Backend doesn't supply an icon per action — reuses the exact colors
// TASK_TYPE_BADGE already established for these same type strings elsewhere
// in the app, just as an icon tint instead of a pill background.
const ACTION_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  PRE_COMMISSIONING: Zap,
  COMMISSIONING: CheckCircle2,
  REVALIDATION: ShieldCheck,
  RE_COMMISSIONING: RefreshCw,
};

// Revalidation's icon wants a brighter amber than TASK_TYPE_BADGE.REVALIDATION's
// own text color (#C2410C, a burnt orange) — scoped to just this icon rather
// than changing that shared badge color, which also drives the type pill
// elsewhere in the app (TaskPreviewCard, report screens) that wasn't asked
// to change. Falls back to the badge's own text color for every other
// action type, unchanged.
const ACTION_ICON_TINT: Record<string, string> = {
  REVALIDATION: '#F59E0B',
};

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

// New Job — reached from Commissioning's + icon (dealer/areaManager only):
// search an asset by S/N, then either create+assign a Pre-Commissioning or
// Commissioning entry for it, depending on which actions are currently
// available. Standalone focused screen (no BottomNavBar), matching
// taskForm.tsx/srTaskForm.tsx's precedent for +/deep-flow screens.
export default function NewJobScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    searchText, setSearchText, handleSearch, handleClearSearch, searched, isSearching, searchError,
    asset, assetLoading, availableActions, assetHasBeenServiced,
    sapAsset,
    engineers, engineersLoading,
    assignPickerActionType, openAssignPicker, handleCancelAssign,
    jobDate,
    selectedAssignee, handleSelectAssignee,
    assigneePickerVisible, openAssigneePicker, closeAssigneePicker,
    notes, setNotes, notesError, assigneeError,
    preCommEntry,
    handleCreateJob, creating, createError,
  } = useNewJobController();

  const [clientInfoExpanded, setClientInfoExpanded] = useState(false);

  const history = asset?.history || [];
  // Tied to the real GET /api/commissioning/prefill-checks result
  // (fetched in openAssignPicker as soon as Commissioning is tapped) rather
  // than guessed from availableActions — this is the actual data that's
  // about to get written onto the new entry, not an inference about it.
  const hasPreCommissioningData = !!preCommEntry && Object.values(preCommEntry).some((v) => !!v);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      {(isSearching || assetLoading || creating) && <LoadingOverlay />}

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>COMMISSIONING</Text>
        <View style={styles.headerButton}>
          <Bell size={22} color="#979797" />
        </View>
      </View>

      {/* One persistent page — tapping an action expands its Create Job
          Card form inline, directly below that action's own card, rather
          than replacing the whole screen (asset details/other actions/
          Client Info/History all stay put and stay reachable). */}
      {/* Android's own softwareKeyboardLayoutMode is "pan" (app.json) — the
          OS already shifts the whole screen up for the focused input;
          pairing that with behavior="height" double-compensated and left
          a large empty gap above the keyboard. undefined on Android leaves
          the OS's native pan as the only mechanism; iOS still needs its
          own "padding" here. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* The search bar used to sit fixed above the ScrollView (a sibling,
            not a scrollable child) — only everything below it could scroll,
            so it stayed pinned in place and clipped whatever card was
            underneath it once the header title/asset details scrolled up
            behind it. Now it's the ScrollView's own first child, so the
            whole screen — search bar included — scrolls as one unit under
            the fixed app bar above. */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 16, paddingBottom: 120, gap: 20 }}
        >
          <SearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={handleSearch}
            onClear={handleClearSearch}
            placeholder="Genset S/N or Engine S/N..."
            variant="pill"
          />

          {!searched ? (
            <Text style={styles.placeholderText}>Enter Genset S/N or Engine S/N to search</Text>
          ) : isSearching || assetLoading ? null : searchError ? (
            <Text style={styles.placeholderText}>{searchError}</Text>
          ) : !asset ? (
            sapAsset ? (
              <>
                <View style={styles.sapCard}>
                  <View style={styles.sapHeaderStrip}>
                    <Text style={styles.sapHeaderSerial} numberOfLines={1}>{sapAsset.gensetSerialNo}</Text>
                    <View style={styles.sapBadge}>
                      <Text style={styles.sapBadgeText}>SAP</Text>
                    </View>
                    {!!sapAsset.gensetRating && (
                      <View style={styles.sapPill}>
                        <Text style={styles.sapPillText}>{sapAsset.gensetRating}</Text>
                      </View>
                    )}
                    {!!sapAsset.cpcbStage && (
                      <View style={styles.sapPillNeutral}>
                        <Text style={styles.sapPillNeutralText}>{sapAsset.cpcbStage}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.sapBody}>
                    <View style={styles.sapDetailRow}>
                      <DetailField label="GENSET S/N" value={sapAsset.gensetSerialNo} />
                      <DetailField label="ENGINE S/N" value={sapAsset.engineSerialNo} />
                      <DetailField label="INVOICE NO." value={sapAsset.invoiceNumber} />
                    </View>
                    <View style={styles.sapDetailRow}>
                      <DetailField label="BILLING DATE" value={sapAsset.billingDate ? formatDate(sapAsset.billingDate) : undefined} />
                      <DetailField label="MATERIAL NO." value={sapAsset.materialNo} />
                      <DetailField label="SHIP-TO PARTY" value={sapAsset.shipToPartyName} />
                    </View>
                    <View style={styles.sapDetailRow}>
                      <DetailField label="ZONE" value={sapAsset.zone} />
                      <DetailField label="SEGMENT" value={sapAsset.customerSegment} />
                      <DetailField label="COMMISSIONING DT" value={sapAsset.commissioningDate ? formatDate(sapAsset.commissioningDate) : undefined} />
                    </View>

                    {(() => {
                      const endCustomer = sapAsset.endCustomerDetails
                        || [sapAsset.cityTQ, sapAsset.district, sapAsset.state, sapAsset.pin].filter(Boolean).join(', ');
                      return !!endCustomer && (
                        <View>
                          <Text style={styles.detailLabel}>END CUSTOMER</Text>
                          <Text style={[styles.detailValue, { marginTop: 4 }]}>{endCustomer}</Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>

                {/* Every dispatchType gets its own callout — not just
                    "auto" — so the user sees why the commissioning flow
                    will behave the way it's about to, whichever state this
                    asset is actually in. */}
                <DispatchStatusBanner
                  dispatchType={computeDispatchType(sapAsset.billingDate)}
                  billingDate={sapAsset.billingDate}
                  commissioningDate={sapAsset.commissioningDate}
                />

                <TouchableOpacity
                  style={styles.sapCreateButton}
                  onPress={() => router.push({ pathname: '/screens/createAssetCommission' as any, params: { sapAsset: JSON.stringify(sapAsset) } })}
                >
                  <Zap size={18} color="#FFFFFF" />
                  <Text style={styles.sapCreateButtonText}>Create Asset</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.noAssetCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noAssetTitle}>No asset found</Text>
                    <Text style={styles.noAssetText}>
                      No result for "<Text style={styles.noAssetTextBold}>{searchText}</Text>" in database or SAP.
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.noAssetCancelButton} onPress={handleClearSearch}>
                    <Text style={styles.noAssetCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.createNewAssetButton}
                  onPress={() => router.push({ pathname: '/screens/createAssetCommission' as any })}
                >
                  <Plus size={18} color="#6B7280" />
                  <Text style={styles.createNewAssetButtonText}>Create New Asset</Text>
                </TouchableOpacity>
              </>
            )
          ) : (
            <>
              <View style={styles.assetCard}>
                <View style={styles.assetHeaderRow}>
                  <View style={styles.assetIconChip}>
                    <Settings size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assetName}>{asset.gensetNumber}</Text>
                    <Text style={styles.assetSubtitle}>Asset Details</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <DetailField label="GENSET MODEL" value={asset.gensetModel} />
                  <DetailField label="GENSET S/N" value={asset.gensetNumber} />
                </View>
                <View style={styles.detailRow}>
                  <DetailField label="ENGINE S/N" value={asset.engineNumber} />
                  <DetailField label="ALTERNATOR MAKE" value={asset.alternatorMake} />
                </View>
                <View style={styles.detailRow}>
                  <DetailField label="ALTERNATOR MODEL" value={asset.alternatorModel} />
                  <DetailField label="ENGINE MODEL" value={asset.engineModel} />
                </View>
              </View>

              {/* An asset that's already been serviced shouldn't go through
                  commissioning again — blocks the actions list entirely
                  rather than letting a commissioning entry get created for
                  an asset already past that point. See
                  assetHasBeenServiced's own comment in
                  newJobController.ts for how this is detected. */}
              {assetHasBeenServiced ? (
                <View style={styles.servicedBlockBox}>
                  <View style={styles.servicedBlockTitleRow}>
                    <Info size={18} color="#B45309" />
                    <Text style={styles.servicedBlockTitle}>Already serviced</Text>
                  </View>
                  <Text style={styles.servicedBlockBody}>
                    This asset has already been serviced and can no longer be commissioned.
                  </Text>
                </View>
              ) : (
                <>
              {!!createError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{createError}</Text>
                </View>
              )}

              {!!availableActions?.actions?.length && (
                <>
                  <Text style={styles.sectionLabel}>ACTIONS</Text>
                  {availableActions.actions.map((action) => {
                    const badge = TASK_TYPE_BADGE[action.action] || DEFAULT_TASK_TYPE_BADGE;
                    const Icon = ACTION_ICON[action.action] || CheckCircle2;
                    // available:false alone doesn't say *why* — cross-check the
                    // asset's history for a past entry of this same action type
                    // to tell "already completed" apart from "not eligible yet"
                    // (wrong sequence, outside the commissioning window, etc).
                    const isDone = !action.available && history.some((h) => h.type === action.action);
                    const isExpanded = assignPickerActionType === action.action;
                    return (
                      <View key={action.action}>
                        <TouchableOpacity
                          style={[
                            styles.actionCard,
                            !action.available && !isDone && styles.actionCardDisabled,
                            isExpanded && styles.actionCardExpandedBase,
                            isExpanded && { backgroundColor: badge.bg, borderColor: badge.text },
                          ]}
                          onPress={() => (isExpanded ? handleCancelAssign() : openAssignPicker(action.action))}
                          disabled={!action.available}
                        >
                          <Icon size={22} color={action.available || isDone ? (ACTION_ICON_TINT[action.action] || badge.text) : '#9CA3AF'} />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.actionLabel}>{action.label}</Text>
                            <Text style={styles.actionDescription}>{action.description}</Text>
                            {isDone && <Text style={styles.actionDoneCaption}>Already completed for this asset.</Text>}
                          </View>
                          {isDone && (
                            <View style={styles.actionDoneBadge}>
                              <Text style={styles.actionDoneBadgeText}>Done</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Create Job Card — expands directly below the
                            action that was tapped, instead of navigating
                            away to its own screen. */}
                        {isExpanded && (
                          <View style={styles.jobCardBox}>
                            <View style={styles.jobCardHeaderRow}>
                              <View style={[styles.jobTypePill, { backgroundColor: badge.bg }]}>
                                <Text style={[styles.jobTypePillText, { color: badge.text }]}>{badge.label}</Text>
                              </View>
                              <Text style={styles.jobCardTitle}>Commissioning</Text>
                            </View>

                            {/* Commissioning only — Pre-Commissioning is
                                always the first entry for an asset, so it
                                can never have prior data to inherit. Backend
                                pre-fills checks/fault codes/parts from a
                                completed Pre-Commissioning entry onto the
                                new Commissioning one automatically; this is
                                just telling the user it'll happen. */}
                            {action.action === 'COMMISSIONING' && hasPreCommissioningData && (
                              <View style={styles.preFilledBanner}>
                                <Info size={18} color="#2563EB" />
                                <Text style={styles.preFilledBannerText}>
                                  Pre-commissioning data found — checks, fault codes & parts will be pre-filled.
                                </Text>
                              </View>
                            )}

                            <View style={[styles.formField, { marginTop: 20 }]}>
                              <Text style={styles.formLabel}>Assign To <Text style={styles.requiredAsterisk}>*</Text></Text>
                              <TouchableOpacity
                                style={[styles.assignToField, !!assigneeError && styles.formInputError]}
                                onPress={openAssigneePicker}
                              >
                                <UserRoundCog size={18} color="#9CA3AF" />
                                <Text style={[styles.assignToFieldText, !selectedAssignee && styles.assignToPlaceholder]} numberOfLines={1}>
                                  {selectedAssignee ? selectedAssignee.name : 'Select assignee...'}
                                </Text>
                                <ChevronRight size={18} color="#9CA3AF" />
                              </TouchableOpacity>
                              {!!assigneeError && <Text style={styles.fieldErrorText}>{assigneeError}</Text>}
                            </View>

                            <View style={[styles.formField, { marginTop: 20 }]}>
                              <Text style={styles.formLabel}>Notes <Text style={styles.requiredAsterisk}>*</Text></Text>
                              <TextInput
                                style={[styles.formInput, styles.formTextarea, !!notesError && styles.formInputError]}
                                placeholder="Add notes..."
                                placeholderTextColor="#9CA3AF"
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                              />
                              {!!notesError && <Text style={styles.fieldErrorText}>{notesError}</Text>}
                            </View>

                            {!!createError && (
                              <View style={[styles.errorBox, { marginTop: 20 }]}>
                                <Text style={styles.errorText}>{createError}</Text>
                              </View>
                            )}

                            <View style={[styles.formActionsRow, { paddingHorizontal: 0 }]}>
                              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelAssign} disabled={creating}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.createButton, creating && styles.createButtonDisabled]}
                                onPress={handleCreateJob}
                                disabled={creating}
                              >
                                {creating ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <ActivityIndicator color="#FFFFFF" />
                                    <Text style={styles.createButtonText}>Creating...</Text>
                                  </View>
                                ) : (
                                  <Text style={styles.createButtonText}>Create</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
                </>
              )}

              <View style={styles.collapsibleCard}>
                <TouchableOpacity
                  style={[styles.collapsibleHeader, clientInfoExpanded && styles.collapsibleHeaderExpanded]}
                  onPress={() => setClientInfoExpanded((v) => !v)}
                >
                  <Text style={styles.collapsibleTitle}>CLIENT INFO</Text>
                  {clientInfoExpanded ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
                </TouchableOpacity>
                {clientInfoExpanded && (
                  <View style={[styles.collapsibleBody, { gap: 14 }]}>
                    <View style={styles.clientInfoRow}>
                      <User size={18} color="#6B7280" />
                      <Text style={styles.clientInfoName}>{asset?.clientName || '—'}</Text>
                    </View>
                    {!!(asset?.primaryContactName || asset?.primaryContactNumber) && (
                      <TouchableOpacity
                        style={styles.clientInfoRow}
                        disabled={!asset?.primaryContactNumber}
                        onPress={() => asset?.primaryContactNumber && Linking.openURL(`tel:${asset.primaryContactNumber}`)}
                      >
                        <Phone size={18} color="#6B7280" />
                        <Text style={styles.clientInfoText}>
                          {[asset?.primaryContactName, asset?.primaryContactNumber].filter(Boolean).join(' · ')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!!asset?.alternateContactNumber && (
                      <TouchableOpacity
                        style={styles.clientInfoRow}
                        onPress={() => Linking.openURL(`tel:${asset.alternateContactNumber}`)}
                      >
                        <Phone size={18} color="#6B7280" />
                        <Text style={styles.clientInfoText}>Alt: {asset.alternateContactNumber}</Text>
                      </TouchableOpacity>
                    )}
                    {!!asset?.address && (
                      <View style={styles.clientInfoRow}>
                        <MapPin size={18} color="#6B7280" style={{ marginTop: 2 }} />
                        <Text style={styles.clientInfoText}>{formatAddress(asset.address)}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <AssetHistorySection history={history} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AssignEngineerModal
        visible={assigneePickerVisible}
        onClose={closeAssigneePicker}
        engineers={engineers}
        loading={engineersLoading}
        title="Assign To"
        confirmLabel="Select"
        onConfirm={handleSelectAssignee}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },

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
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#000000', textTransform: 'uppercase' },

  placeholderText: { color: '#9CA3AF', fontSize: 15, textAlign: 'center', marginTop: 40 },

  noAssetCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#FCA5A5',
    padding: 16,
  },
  noAssetTitle: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  noAssetText: { fontSize: 13, fontWeight: '500', color: '#EF4444', marginTop: 4, lineHeight: 18 },
  noAssetTextBold: { fontWeight: '700', color: '#DC2626' },
  noAssetCancelButton: {
    borderWidth: 1, borderColor: '#FCA5A5',
    borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  noAssetCancelButtonText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  createNewAssetButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#D1D5DB', borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
  },
  createNewAssetButtonText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },

  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  assetHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  assetIconChip: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  assetName: { fontSize: 17, fontWeight: '700', color: '#000000' },
  assetSubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 16 },
  detailRow: { flexDirection: 'row', marginBottom: 16 },
  detailField: { flex: 1 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.4, marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: '700', color: '#1F2937' },

  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Blocks the actions list for an asset that's already been serviced —
  // same amber warning tone New Service Job's own commissioning-required
  // box uses (the mirror-image rule of this one).
  servicedBlockBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 16,
  },
  servicedBlockTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  servicedBlockTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  servicedBlockBody: { fontSize: 13, fontWeight: '500', color: '#B45309', lineHeight: 18 },

  sapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#F5BC9D',
    overflow: 'hidden',
  },
  sapHeaderStrip: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    backgroundColor: '#FDECE2',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  sapHeaderSerial: { fontSize: 17, fontWeight: '700', color: '#1F2937', flexShrink: 1 },
  sapBadge: {
    backgroundColor: '#F26722',
    borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  sapBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  sapPill: {
    backgroundColor: '#FDECE2',
    borderWidth: 1, borderColor: '#F5BC9D',
    borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  sapPillText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },
  sapPillNeutral: {
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  sapPillNeutralText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  sapBody: { padding: 16, gap: 4 },
  sapDetailRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  sapCreateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F26722',
    borderRadius: 100,
    paddingVertical: 15,
  },
  sapCreateButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: -8 },
  actionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
  },
  actionCardDisabled: { opacity: 0.5 },
  // Highlights whichever action's Create Job Card form is currently
  // expanded below it — bg/borderColor come from that action's own
  // TASK_TYPE_BADGE at the call site (blue for Pre-Commissioning, green for
  // Commissioning, ...), not one fixed color for every type.
  actionCardExpandedBase: { borderWidth: 1 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  actionDescription: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  actionDoneCaption: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  // Same green "Completed" tokens as TaskPreviewCard's statusPillDone —
  // not new colors invented for this screen.
  actionDoneBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  actionDoneBadgeText: { color: '#15803D', fontSize: 13, fontWeight: '500' },

  // Header + body now share one outer card (collapsibleCard) instead of
  // each having its own background/radius — that's what previously made
  // an expanded section read as two stacked cards with a gap between them.
  collapsibleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20,
  },
  collapsibleHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  collapsibleTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', letterSpacing: 0.4 },
  collapsibleBody: {
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  infoText: { fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1 },

  clientInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  clientInfoName: { fontSize: 16, fontWeight: '700', color: '#000000' },
  clientInfoText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#374151', lineHeight: 20 },

  // ─── Create Job Card form ───
  formField: { gap: 8 },
  formLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  formStaticInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  formStaticInputText: { fontSize: 15, color: '#1F2937', fontWeight: '600' },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1F2937',
  },
  formTextarea: { height: 100 },
  formInputError: { borderColor: '#DC2626' },
  fieldErrorText: { fontSize: 12, fontWeight: '600', color: '#DC2626', marginTop: 6 },
  requiredAsterisk: { color: '#DC2626' },

  // Expands directly below the tapped action's own card.
  jobCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 12,
  },
  jobCardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preFilledBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  preFilledBannerText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#2563EB', lineHeight: 18 },
  jobTypePill: { borderRadius: 100, paddingVertical: 5, paddingHorizontal: 12 },
  jobTypePillText: { fontSize: 12, fontWeight: '700' },
  jobCardTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  // Tappable, not the inline search+list — that now lives in its own
  // bottom-sheet Modal, matching the reference's compact 3-field card.
  assignToField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  assignToFieldText: { flex: 1, fontSize: 15, color: '#1F2937', fontWeight: '600' },
  assignToPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  formActionsRow: {
    flexDirection: 'row', gap: 12,
    paddingTop: 12, paddingBottom: 16,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 100,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: '#4B5563' },
  createButton: {
    flex: 1,
    borderRadius: 100,
    backgroundColor: '#F26722',
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
