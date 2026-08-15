import React, { useContext, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Modal, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { ChevronLeft, ChevronDown, Info } from 'lucide-react-native';
import { useCreateAssetCommissionController, ENTRY_TYPES } from '../../controllers/createAssetCommissionController';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { DispatchStatusBanner } from '../../_components/shared/DispatchStatusBanner';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';
import { formatDate } from '../../utils/reportFormatters';

const REF_WIDTH = 420;

// Same peach->light radial gradient backdrop as newJob.tsx (duplicated, not
// extracted — small, screen-specific visual).
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
          <RadialGradient id="createAssetBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#createAssetBg)" />
      </Svg>
    </View>
  );
}

// Lets every FormField below reach the screen's one ScrollView ref without
// prop-drilling it through ~18 call sites — set once via
// ScrollRefContext.Provider near the bottom of this file.
const ScrollRefContext = React.createContext<React.RefObject<ScrollView | null> | null>(null);

// Neither Android's native "pan" (relied on elsewhere on this screen) nor a
// flat extra-padding guess reliably kept every field reachable above the
// keyboard — pan only guarantees the OS's own focused-view heuristics stay
// above the keyboard, and static padding was either not enough or (the full
// keyboard height) too much, per direct testing. Scrolling the actual
// focused field into view explicitly, on focus, is deterministic instead of
// guessing — same measureLayout+scrollTo pattern already proven on
// srTaskForm.tsx's OTP card. Passing the ScrollView ref itself (not a
// findNodeHandle()-derived number) is required under the New Architecture —
// see that same fix's own comment there. Shared by FormField below AND the
// hand-rolled Entry Date/Notes fields further down (COMMISSIONING ENTRY
// card) — those aren't FormField instances but need the identical fix,
// since they're what's actually focused in the "Cancel/Confirm hidden
// behind the keyboard" report this was built for.
function scrollFieldIntoView(scrollView: ScrollView | null, field: View | null) {
  if (!scrollView || !field) return;
  setTimeout(() => {
    field.measureLayout(
      scrollView as any,
      (_x: number, y: number) => { scrollView.scrollTo({ y: Math.max(0, y - 16), animated: true }); },
      () => {}
    );
  }, 100);
}

// Context-based wrapper for FormField instances (rendered as descendants of
// ScrollRefContext.Provider, so useContext resolves correctly there).
// CreateAssetCommissionScreen itself renders that Provider rather than
// being a descendant of it, so its own Entry Date/Notes fields (below) call
// scrollFieldIntoView directly with the scrollViewRef it already has,
// instead of going through this context — useContext would only ever
// return the default (null) if called there.
function useScrollIntoViewOnFocus() {
  const scrollViewRef = useContext(ScrollRefContext);
  const fieldRef = useRef<View>(null);
  const onFocus = () => scrollFieldIntoView(scrollViewRef?.current ?? null, fieldRef.current);
  return { fieldRef, onFocus };
}

function FormField({ label, required, value, onChangeText, placeholder }: {
  label: string; required?: boolean; value: string; onChangeText: (v: string) => void; placeholder?: string;
}) {
  const { fieldRef, onFocus } = useScrollIntoViewOnFocus();

  return (
    <View style={styles.fieldHalf} ref={fieldRef}>
      <Text style={styles.fieldLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        onFocus={onFocus}
      />
    </View>
  );
}

function SummaryField({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.summaryField}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || '--'}</Text>
    </View>
  );
}

// Reached from New Job's SAP-fallback card: a genset with real SAP dispatch/
// commissioning history but no Asset record yet in this app. The form is
// pre-filled from that SAP record (see createAssetCommissionController) but
// every field stays editable — SAP data is a starting point, not a
// guaranteed-correct source.
export default function CreateAssetCommissionScreen() {
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const [entryTypePickerOpen, setEntryTypePickerOpen] = useState(false);

  // Neither a static paddingBottom nor stacking the keyboard's own height on
  // top of Android's native "pan" compensation landed reliably (one left
  // fields hidden, the other left a large empty gap) — see FormField's own
  // handleFocus above for the actual fix: scroll the focused field into
  // view explicitly instead of guessing how much padding pan already
  // accounts for.
  const scrollViewRef = useRef<ScrollView>(null);
  // Same fix as FormField (see scrollFieldIntoView above), for the two
  // hand-rolled fields in the COMMISSIONING ENTRY card that aren't
  // FormField instances — called directly with scrollViewRef rather than
  // through useScrollIntoViewOnFocus's context lookup, since this
  // component is the one that renders ScrollRefContext.Provider, not a
  // descendant of it. Entry Type is a dropdown, not a text field, so it
  // never opens the keyboard and doesn't need this.
  const entryDateFieldRef = useRef<View>(null);
  const notesFieldRef = useRef<View>(null);

  const {
    sapAsset, dispatchType,
    gensetSn, setGensetSn, engineSn, setEngineSn,
    clientName, setClientName, clientCode, setClientCode, clientEmail, setClientEmail,
    primaryContactName, setPrimaryContactName,
    primaryContactNumber, setPrimaryContactNumber,
    alternateContactName, setAlternateContactName,
    alternateContactNumber, setAlternateContactNumber,
    dispatchDate, setDispatchDate,
    addressLine1, setAddressLine1, addressLine2, setAddressLine2,
    pinCode, setPinCode, city, setCity, district, setDistrict, state, setState,
    locality, setLocality, taluk, setTaluk,
    entryType, setEntryType, entryDate, setEntryDate, notes, setNotes,
    handleCancel, handleConfirmCreate, creating, createError,
  } = useCreateAssetCommissionController();

  const entryTypeLabel = ENTRY_TYPES.find((t) => t.value === entryType)?.label || entryType;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      {creating && <LoadingOverlay />}

      {/* The header used to sit fixed above the ScrollView — only the
          content below it could scroll. Now it's the ScrollView's own
          first child, so the whole screen (header included) scrolls as one
          unit instead of the header staying pinned. Kept as its own
          direct child (own headerPad, not hPad) rather than folded into
          the content wrapper below, since its horizontal padding is
          intentionally wider than the rest of the screen's. */}
      {/* Relying on Android's native "pan" alone (behavior=undefined, the
          pattern used elsewhere in this app) did not reliably keep content
          on THIS screen reachable, even combined with the explicit
          scroll-into-view-on-focus fix above — confirmed by repeated
          testing, not just a guess. Switching to behavior="height" on
          Android here makes RN itself shrink this KeyboardAvoidingView's
          own measured height by the keyboard's height, which is what
          actually makes the nested ScrollView able to scroll far enough to
          reveal trailing content (fields, the Cancel/Confirm buttons) —
          independent of whatever pan is simultaneously doing visually.
          This is known to risk a visible gap if it ends up double-
          compensating with pan (the bug "height" caused elsewhere earlier
          in this app, which is why undefined was chosen there) — but an
          unreachable field/button is a worse bug than a gap, and this
          screen's own testing showed undefined alone genuinely wasn't
          enough. If a gap shows up here, that's a smaller follow-up fix
          (trim contentContainerStyle's paddingBottom below) rather than
          reverting this. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 130, gap: 16 }}
      >
        <ScrollRefContext.Provider value={scrollViewRef}>
        <View style={[styles.header, { paddingHorizontal: headerPad }]}>
          <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
            <ChevronLeft size={22} color="#979797" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Create Asset</Text>
            {dispatchType === 'auto' && (
              <Text style={styles.headerSubtitle}>Commissioning entry will be created automatically</Text>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: hPad, gap: 16 }}>
        {!!sapAsset && (
          <>
            <View style={styles.infoBanner}>
              <Info size={18} color="#C2410C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBannerTitle}>Found in SAP records</Text>
                <Text style={styles.infoBannerText}>
                  The form below is pre-filled from the SAP data. Review and create the asset to proceed with commissioning.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.summaryTitle}>{sapAsset.gensetSerialNo}</Text>
                <View style={styles.sapPill}><Text style={styles.sapPillText}>SAP</Text></View>
                {!!sapAsset.gensetRating && (
                  <View style={styles.kvaPill}><Text style={styles.kvaPillText}>{sapAsset.gensetRating}</Text></View>
                )}
                {!!sapAsset.cpcbStage && (
                  <View style={styles.cpcbPill}><Text style={styles.cpcbPillText}>{sapAsset.cpcbStage}</Text></View>
                )}
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <SummaryField label="GENSET S/N" value={sapAsset.gensetSerialNo} />
                <SummaryField label="ENGINE S/N" value={sapAsset.engineSerialNo} />
              </View>
              <View style={styles.summaryRow}>
                <SummaryField label="INVOICE NO." value={sapAsset.invoiceNumber} />
                {/* This read-only summary shows the same "29 Dec 2023" style
                    as New Job/New Service Job's own SAP card — deliberately
                    NOT the dispatchDate/entryDate state below, which stays
                    in mm/dd/yyyy specifically because those feed the
                    editable Dispatch Date/Entry Date text inputs further
                    down this form. */}
                <SummaryField label="BILLING DATE" value={sapAsset.billingDate ? formatDate(sapAsset.billingDate) : undefined} />
              </View>
              <View style={styles.summaryRow}>
                <SummaryField label="MATERIAL NO." value={sapAsset.materialNo} />
                <SummaryField label="SHIP-TO PARTY" value={sapAsset.shipToPartyName} />
              </View>
              <View style={styles.summaryRow}>
                <SummaryField label="ZONE" value={sapAsset.zone} />
                <SummaryField label="SEGMENT" value={sapAsset.customerSegment} />
              </View>
              <View style={styles.summaryRow}>
                <SummaryField label="COMMISSIONING DT" value={sapAsset.commissioningDate ? formatDate(sapAsset.commissioningDate) : undefined} />
              </View>
              <View style={[styles.summaryField, { marginTop: -4 }]}>
                <Text style={styles.summaryLabel}>END CUSTOMER</Text>
                <Text style={styles.summaryValue}>{sapAsset.endCustomerDetails || '--'}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ASSET DETAILS</Text>
          <View style={styles.fieldRow}>
            <FormField label="Genset S/N" required value={gensetSn} onChangeText={setGensetSn} />
            <FormField label="Engine S/N" required value={engineSn} onChangeText={setEngineSn} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CLIENT</Text>
          <View style={styles.fieldRow}>
            <FormField label="Client Name" value={clientName} onChangeText={setClientName} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Client Code" value={clientCode} onChangeText={setClientCode} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Client Email" value={clientEmail} onChangeText={setClientEmail} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Primary Contact Name" value={primaryContactName} onChangeText={setPrimaryContactName} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Primary Contact No." value={primaryContactNumber} onChangeText={setPrimaryContactNumber} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Alternate Contact Name" value={alternateContactName} onChangeText={setAlternateContactName} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Alternate Contact No." value={alternateContactNumber} onChangeText={setAlternateContactNumber} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Dispatch Date" value={dispatchDate} onChangeText={setDispatchDate} placeholder="mm/dd/yyyy" />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ADDRESS</Text>
          <View style={styles.fieldRow}>
            <FormField label="PIN Code" value={pinCode} onChangeText={setPinCode} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="State" value={state} onChangeText={setState} />
            <FormField label="District" value={district} onChangeText={setDistrict} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Taluk" value={taluk} onChangeText={setTaluk} placeholder="Taluk..." />
            <FormField label="City" value={city} onChangeText={setCity} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Address Line 2" value={addressLine2} onChangeText={setAddressLine2} placeholder="Street / Road / Lane" />
          </View>
          <View style={styles.fieldRow}>
            <FormField label="Locality / Area / Village" value={locality} onChangeText={setLocality} placeholder="Locality or village..." />
          </View>
          <View style={styles.countryRow}>
            <Text style={styles.fieldLabel}>Country</Text>
            <Text style={styles.countryValue}>India</Text>
          </View>
        </View>

        {/* Both the dispatch-status banner and the commissioning-entry card
            only make sense when there's real SAP data behind them — reached
            via "Create New Asset" (no SAP match at all — see newJob.tsx's/
            newServiceJob.tsx's "No asset found" card), this screen is a
            plain manual entry form: Asset Details, Client, Address, then
            straight to Cancel/Confirm & Create, nothing SAP-related below
            it. Revalidation is excluded even when sapAsset IS present —
            that's the asset dispatched over 6 months ago with no follow-up
            commissioning entry on record, so "Date (pre-filled from SAP)"
            would only ever be falling back to today's date, not a real SAP
            value; the user goes through the normal New Job flow afterward
            to create the real Revalidation entry instead. */}
        {!!sapAsset && dispatchType !== 'revalidation' && (
          <>
            {/* Same callout as New Job's/New Service Job's SAP-found card —
                repeated here since this is the screen that actually submits
                the request, and the user should see this again right
                before they commit. */}
            <DispatchStatusBanner dispatchType={dispatchType} billingDate={sapAsset?.billingDate} commissioningDate={sapAsset?.commissioningDate} compact />

            <View style={styles.card}>
              <Text style={styles.sectionLabel}>
                COMMISSIONING ENTRY{dispatchType === 'auto' ? ' (FROM SAP)' : ''}
              </Text>
              <View style={styles.fieldFull}>
                <Text style={styles.fieldLabel}>Entry Type</Text>
                <TouchableOpacity style={styles.dropdownInput} onPress={() => setEntryTypePickerOpen(true)}>
                  <Text style={styles.fieldValueText}>{entryTypeLabel}</Text>
                  <ChevronDown size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={styles.fieldFull} ref={entryDateFieldRef}>
                <Text style={styles.fieldLabel}>
                  Date {dispatchType === 'auto' && <Text style={styles.optionalLabel}>(pre-filled from SAP)</Text>}
                </Text>
                <TextInput
                  style={styles.fieldInput}
                  value={entryDate}
                  onChangeText={setEntryDate}
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor="#9CA3AF"
                  onFocus={() => scrollFieldIntoView(scrollViewRef.current, entryDateFieldRef.current)}
                />
              </View>
              <View style={styles.fieldFull} ref={notesFieldRef}>
                <Text style={styles.fieldLabel}>Notes <Text style={styles.optionalLabel}>(optional)</Text></Text>
                <TextInput
                  style={[styles.fieldInput, styles.fieldTextarea]}
                  value={notes}
                  onChangeText={setNotes}
                  onFocus={() => scrollFieldIntoView(scrollViewRef.current, notesFieldRef.current)}
                  placeholder="Add notes..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </>
        )}

        {!!createError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{createError}</Text>
          </View>
        )}

        {/* In-flow, at the end of the form (not floating) — only the
            BottomNavBar below floats, same as every other screen's fixed
            nav bar. */}
        <View style={styles.formActionsRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={creating}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleConfirmCreate} disabled={creating}>
            <Text style={styles.createButtonText}>Confirm & Create</Text>
          </TouchableOpacity>
        </View>
        </View>
        </ScrollRefContext.Provider>
      </ScrollView>

      <View style={styles.floatingFooter} pointerEvents="box-none">
        <BottomNavBar active="commissioning" />
      </View>
      </KeyboardAvoidingView>

      <Modal visible={entryTypePickerOpen} transparent animationType="fade" onRequestClose={() => setEntryTypePickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEntryTypePickerOpen(false)}>
          <View style={styles.modalSheet}>
            {ENTRY_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={styles.modalRow}
                onPress={() => { setEntryType(t.value); setEntryTypePickerOpen(false); }}
              >
                <Text style={[styles.modalRowText, t.value === entryType && styles.modalRowTextSelected]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000000', flexShrink: 1 },
  headerSubtitle: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginTop: 2 },

  infoBanner: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#FDECE2',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#F5BC9D',
    padding: 14,
  },
  infoBannerTitle: { fontSize: 14, fontWeight: '700', color: '#C2410C' },
  infoBannerText: { fontSize: 12.5, color: '#9A5B3A', marginTop: 2, lineHeight: 17 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: 12 },

  summaryHeaderRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  summaryTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  sapPill: { backgroundColor: '#F26722', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  sapPillText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  kvaPill: { backgroundColor: '#FDECE2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  kvaPillText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  cpcbPill: { backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  cpcbPillText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },
  summaryRow: { flexDirection: 'row', marginBottom: 14 },
  summaryField: { flex: 1 },
  summaryLabel: { fontSize: 10.5, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.4, marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },

  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  fieldHalf: { flex: 1, gap: 6 },
  fieldFull: { gap: 6, marginBottom: 14 },
  // Country is fixed ('India' — every asset created through this screen is
  // domestic), so it's a plain read-only row instead of an editable input
  // like every other address field above it.
  countryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  countryValue: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  required: { color: '#DC2626' },
  optionalLabel: { fontWeight: '400', color: '#9CA3AF' },
  fieldInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1F2937',
  },
  fieldTextarea: { height: 90 },
  fieldValueText: { fontSize: 14, color: '#1F2937' },
  dropdownInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 14, paddingVertical: 12,
  },

  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Same floating (not in-flow) bottom footer pattern as Dashboard/
  // srDetail.tsx/taskReport.tsx — see the comment above where this is used.
  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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
  createButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8, paddingBottom: 24 },
  modalRow: { paddingHorizontal: 24, paddingVertical: 16 },
  modalRowText: { fontSize: 15, color: '#1F2937' },
  modalRowTextSelected: { fontWeight: '700', color: '#F26722' },
});
