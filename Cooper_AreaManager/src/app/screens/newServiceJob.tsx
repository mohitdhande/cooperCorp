import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { TextInput } from '@/_components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import {
  ChevronLeft, Bell,
  ChevronDown, ChevronRight, Info, Zap, UserRoundCog, Plus,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNewServiceJobController } from '../../controllers/newServiceJobController';
import { computeDispatchType } from '../../controllers/createAssetCommissionController';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { AssignEngineerModal } from '../../_components/shared/AssignEngineerModal';
import { DispatchStatusBanner } from '../../_components/shared/DispatchStatusBanner';
import { SearchBar } from '../../_components/shared/SearchBar';
import { AssetLocationContact } from '../../_components/shared/AssetLocationContact';
import { AssetIdentityHeader } from '../../_components/shared/AssetIdentityHeader';
import { AnchoredPanel, Anchor } from '../../_components/shared/AnchoredPanel';
import { FreeServiceItem, ServiceCategory } from '../../controllers/newServiceJobController';
import { FINANCING_BANK_OPTIONS } from '../../_components/srTaskForm/srDropdownOptions';
import { DateField } from '../../_components/shared/DateField';

// "03 Aug" (no year) or "03 Feb 2027" (withYear) — the compact window-range
// display under a selected Free Service sub-category, distinct from
// reportFormatters' formatDate which always includes the year.
function formatShortDate(iso?: string | null, withYear = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', timeZone: 'UTC' };
  if (withYear) opts.year = 'numeric';
  return d.toLocaleDateString('en-GB', opts);
}

// GET /api/service/free-service-availability's per-window `status` — fetched
// and typed but previously unused (only canCreate/reason drove the UI).
// Colors each window row/pill so "due now" reads differently from "in grace
// period" or "already overdue" at a glance, not just via the reason text.
const FREE_SERVICE_STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  due: { bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  grace: { bg: '#FEF3C7', text: '#92400E', dot: '#D97706' },
  overdue: { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  no_date: { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
};
const DEFAULT_FREE_SERVICE_STATUS_COLOR = FREE_SERVICE_STATUS_COLOR.no_date;

// Purely a display grouping for the Category list (General/Standard/AMC-
// CAMC/Special headers) — doesn't change what gets selected or sent to the
// API, that's still the live categoryConfig entry itself. Matched by title
// against whatever GET /api/service/category-config actually returns.
const CATEGORY_DISPLAY_GROUPS: { group: string; titles: string[] }[] = [
  { group: 'General', titles: ['Free Service'] },
  { group: 'Standard', titles: ['Warranty Repair', 'Out Of Warranty'] },
  { group: 'AMC / CAMC', titles: ['AMC', 'CAMC', 'Cooper AMC', 'Cooper CAMC', 'Dealer AMC', 'Dealer CAMC'] },
  { group: 'Special', titles: ['Campaign', 'Other'] },
];

// The New Service Request form's Category field — the categories fetched
// from GET /api/service/category-config, shown under group headers purely
// for visual organization. Local to this screen; the shared DropdownField
// doesn't fit since it works with plain strings, not { letter, title, ... }
// objects.
function CategoryPickerField({
  categories, value, onSelect,
}: {
  categories: ServiceCategory[];
  value: ServiceCategory | null;
  onSelect: (cat: ServiceCategory) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<View>(null);

  const openDropdown = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };

  return (
    <View>
      <TouchableOpacity ref={triggerRef} style={styles.categoryTrigger} activeOpacity={0.7} onPress={openDropdown}>
        <Text style={[styles.categoryValueText, !value && styles.categoryPlaceholderText]}>
          {value?.title || 'Select category...'}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <AnchoredPanel visible={visible} anchor={anchor} onRequestClose={() => setVisible(false)} maxHeight={480}>
        {/* flexShrink: 1 (not just AnchoredPanel's own maxHeight+overflow:
            hidden on its outer panel) is what actually makes this scroll —
            without it a plain View child just renders at its full content
            height and gets silently clipped by the panel instead of
            becoming scrollable, which is what cut this list off before. */}
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
          {CATEGORY_DISPLAY_GROUPS.map(({ group, titles }) => (
            <View key={group}>
              <Text style={styles.categoryGroupLabel}>{group}</Text>
              {titles.map((title) => {
                const cat = categories.find((c) => c.title === title);
                if (!cat) return null;
                return (
                  <TouchableOpacity
                    key={cat.letter}
                    style={[styles.categoryOptionRow, value?.letter === cat.letter && styles.categoryOptionRowSelected]}
                    onPress={() => { onSelect(cat); setVisible(false); }}
                  >
                    <Text style={styles.categoryOptionText}>{cat.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </AnchoredPanel>
    </View>
  );
}

// The Sub-category field. Free Service is special: its 4 windows aren't a
// static list — which ones are actually due depends on this asset's own
// commissioning date, so those items (and their canCreate/reason) come
// from the backend's free-service-availability fetch instead of
// category.subCategories. Every other category stays a plain, ungated list.
function SubCategoryPickerField({
  category, value, onSelect, freeServiceItems, freeServiceLoading, freeServiceError,
}: {
  category: ServiceCategory | null;
  value: string;
  onSelect: (value: string) => void;
  freeServiceItems: FreeServiceItem[];
  freeServiceLoading: boolean;
  freeServiceError: string;
}) {
  const isFreeService = category?.title === 'Free Service';
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<View>(null);

  const openDropdown = () => {
    if (!category) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };

  return (
    <View>
      <TouchableOpacity
        ref={triggerRef}
        style={[styles.categoryTrigger, !category && styles.categoryTriggerDisabled]}
        activeOpacity={0.7}
        onPress={openDropdown}
      >
        <Text style={[styles.categoryValueText, !value && styles.categoryPlaceholderText]}>
          {value || 'Select sub-category...'}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <AnchoredPanel visible={visible} anchor={anchor} onRequestClose={() => setVisible(false)} maxHeight={300}>
        {/* flexShrink: 1 (not just AnchoredPanel's own maxHeight+overflow:
            hidden on its outer panel) is what actually makes this scroll —
            without it a plain View child just renders at its full content
            height and gets silently clipped by the panel instead of
            becoming scrollable. */}
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
          {isFreeService ? (
            freeServiceLoading ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color="#F26722" />
            ) : freeServiceError ? (
              <Text style={[styles.placeholderText, { padding: 16 }]}>{freeServiceError}</Text>
            ) : (
              <View>
                {freeServiceItems.map((item) => {
                  const statusColor = FREE_SERVICE_STATUS_COLOR[item.status] || DEFAULT_FREE_SERVICE_STATUS_COLOR;
                  return (
                    <TouchableOpacity
                      key={item.no}
                      style={[styles.categoryOptionRow, styles.freeServiceOptionRow, value === item.label && styles.categoryOptionRowSelected]}
                      disabled={!item.canCreate}
                      onPress={() => { onSelect(item.label); setVisible(false); }}
                    >
                      <View style={[styles.freeServiceOptionDot, { backgroundColor: statusColor.dot }]} />
                      <Text style={[styles.categoryOptionText, !item.canCreate && styles.categoryOptionTextDisabled]}>
                        {item.label} — {item.reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )
          ) : (
            <View>
              {(category?.subCategories || []).map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.categoryOptionRow, value === sub && styles.categoryOptionRowSelected]}
                  onPress={() => { onSelect(sub); setVisible(false); }}
                >
                  <Text style={styles.categoryOptionText}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </AnchoredPanel>
    </View>
  );
}

// Financing Bank — only asked for the two Cooper-managed AMC/CAMC
// categories (letters D/E), which are financed through a bank tie-up.
// Plain flat list, same trigger/panel shape as the pickers above.
function BankPickerField({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<View>(null);

  const openDropdown = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  };

  return (
    <View>
      <TouchableOpacity ref={triggerRef} style={styles.categoryTrigger} activeOpacity={0.7} onPress={openDropdown}>
        <Text style={[styles.categoryValueText, !value && styles.categoryPlaceholderText]}>
          {value || 'Select bank...'}
        </Text>
        <ChevronDown size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <AnchoredPanel visible={visible} anchor={anchor} onRequestClose={() => setVisible(false)} maxHeight={300}>
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
          {FINANCING_BANK_OPTIONS.map((bank) => (
            <TouchableOpacity
              key={bank}
              style={[styles.categoryOptionRow, value === bank && styles.categoryOptionRowSelected]}
              onPress={() => { onSelect(bank); setVisible(false); }}
            >
              <Text style={styles.categoryOptionText}>{bank}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </AnchoredPanel>
    </View>
  );
}

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
          <RadialGradient id="newServiceJobBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#newServiceJobBg)" />
      </Svg>
    </View>
  );
}

// New Service Job — reached from Services' + icon (dealer/areaManager
// only): search an asset by S/N, then — once the asset is found — fill in a
// New Service Request form shown inline right away (no separate "tap an
// action" step, matching the reference design's MobileServiceNew.tsx).
// Standalone focused screen (no BottomNavBar), matching newJob.tsx's own
// precedent.
export default function NewServiceJobScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    searchText, setSearchText, handleSearch, handleClearSearch, searched, isSearching, searchError,
    asset, assetLoading, sapAsset,
    engineers, engineersLoading,
    jobTitle, setJobTitle, jobDate,
    category, handleSelectCategory, categoryConfig, categoryConfigLoading, categoryConfigError,
    subCategory, handleSelectSubCategory, needsSubCategoryNow,
    financingBank, setFinancingBank,
    freeServiceItems, freeServiceLoading, freeServiceError,
    selectedAssignee, handleSelectAssignee,
    assigneePickerVisible, openAssigneePicker, closeAssigneePicker,
    dueDate, setDueDate, notes, setNotes, performedBy, setPerformedBy,
    handleCreateJob, creating, createError,
  } = useNewServiceJobController();

  const selectedFreeServiceItem = category?.title === 'Free Service'
    ? freeServiceItems.find((item) => item.label === subCategory)
    : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      {(isSearching || assetLoading || creating) && <LoadingOverlay />}

      {/* Android's own softwareKeyboardLayoutMode is "pan" (app.json) alone
          wasn't reliably shifting the layout enough to keep the focused
          field clear of the keyboard — behavior="height" here (matching
          newJob.tsx/taskForm.tsx's own fix) actually resizes the scrollable
          area instead of just relying on the OS's own pan. iOS keeps its
          own "padding" behavior. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      {/* App bar is now the ScrollView's own first child (was a fixed
          sibling above it) — the whole screen, header included, scrolls as
          one unit instead of the bar staying pinned while only the content
          below it moves. Same reasoning as the search bar's own move here
          (newJob.tsx did the same for its search bar). */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingTop: 16, paddingBottom: 120, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* headerPad (30/420) is wider than the ScrollView's own hPad
            (20/420) content padding — negative margin cancels that out so
            this still sits at the original, wider header inset instead of
            the narrower one every other card uses. */}
        <View style={[styles.header, { marginHorizontal: -hPad, paddingHorizontal: headerPad }]}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <ChevronLeft size={22} color="#979797" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NEW SR</Text>
          <View style={styles.headerButton}>
            <Bell size={22} color="#979797" />
          </View>
        </View>

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
                <Text style={styles.sapCardTitle}>Found in SAP records</Text>
                <Text style={styles.sapCardLine}>
                  {sapAsset.gensetSerialNo}{sapAsset.engineSerialNo ? ` · ${sapAsset.engineSerialNo}` : ''}
                </Text>
                {!!sapAsset.shipToPartyName && <Text style={styles.sapCardLine}>{sapAsset.shipToPartyName}</Text>}
                {!!(sapAsset.cityTQ || sapAsset.district || sapAsset.state) && (
                  <Text style={styles.sapCardLine}>
                    {[sapAsset.cityTQ, sapAsset.district, sapAsset.state].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>

              {/* Every dispatchType gets its own callout — not just
                  "auto" — so the user sees why the commissioning flow will
                  behave the way it's about to, whichever state this asset
                  is actually in. */}
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
        ) : !asset.completedAt ? (
          // Asset exists but has never had a commissioning task completed on
          // it (completedAt absent from GET /api/assets/:id) — raising a
          // service request for it isn't a valid flow, so the New Service
          // Request form is replaced entirely by this notice instead of
          // just being disabled/hidden below a still-visible form.
          <>
            {/* Same shared AssetIdentityHeader every task list/form/report
                screen uses — task/taskPeople are empty here since nothing's
                been created yet (no SR number, nobody assigned), so the
                ribbon and avatar cluster just don't render; only the
                identity pill itself (icon, genset/engine number, dispatch
                date) shows. hideGensetModel keeps this screen's existing
                "always bold genset number" look instead of switching to a
                model-first headline. */}
            <View style={styles.assetCard}>
              <AssetIdentityHeader task={{}} isService taskPeople={[]} hideGensetModel assetOverride={{
                gensetNumber: asset.gensetNumber, engineNumber: asset.engineNumber,
                gensetModel: asset.gensetModel, dispatchDate: asset.dispatchDate,
              }} />
              <View style={{ marginTop: 12 }}>
                <AssetLocationContact asset={asset} hideContact />
              </View>
            </View>

            <View style={styles.commissioningRequiredBox}>
              <Info size={20} color="#EA580C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.commissioningRequiredTitle}>Commissioning required</Text>
                <Text style={styles.commissioningRequiredText}>
                  This asset has not been commissioned yet. Complete commissioning before raising a service request.
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Compact identity pill + client contact — reference's own
                MobileServiceNew.tsx keeps this asset card lean (just enough
                to confirm which asset you're on), folding location/contact
                straight into it instead of behind a CLIENT INFO accordion. */}
            <View style={styles.assetCard}>
              <AssetIdentityHeader task={{}} isService taskPeople={[]} hideGensetModel assetOverride={{
                gensetNumber: asset.gensetNumber, engineNumber: asset.engineNumber,
                gensetModel: asset.gensetModel, dispatchDate: asset.dispatchDate,
              }} />
              <View style={{ marginTop: 12 }}>
                <AssetLocationContact asset={asset} hideContact />
              </View>
            </View>

            <View style={styles.newSrFormCard}>
              <Text style={styles.newSrFormTitle}>New Service Request</Text>

                <View style={[styles.formField, { marginTop: 16 }]}>
                  <Text style={styles.formLabel}>Title <Text style={styles.requiredStar}>*</Text></Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Brief description of the issue..."
                    placeholderTextColor="#9CA3AF"
                    value={jobTitle}
                    onChangeText={setJobTitle}
                  />
                </View>

              

                <View style={[styles.formField, { marginTop: 16 }]}>
                  <Text style={styles.formLabel}>Category <Text style={styles.requiredStar}>*</Text></Text>
                  <CategoryPickerField categories={categoryConfig} value={category} onSelect={handleSelectCategory} />
                  {categoryConfigLoading && <ActivityIndicator style={{ marginTop: 8 }} color="#F26722" />}
                  {!!categoryConfigError && <Text style={[styles.errorText, { marginTop: 8 }]}>{categoryConfigError}</Text>}
                </View>

                {/* Cooper AMC/CAMC only (letters D/E) — those are the two
                    categories financed through a bank tie-up. */}
                {(category?.letter === 'D' || category?.letter === 'E') && (
                  <View style={[styles.formField, { marginTop: 16 }]}>
                    <Text style={styles.formLabel}>Financing Bank</Text>
                    <BankPickerField value={financingBank} onSelect={setFinancingBank} />
                  </View>
                )}

                {!!category && (
                  <View style={[styles.categoryInfoCard, { marginTop: 16, borderColor: category.border, backgroundColor: category.bg }]}>
                    <View style={[styles.categoryInfoBadge, { backgroundColor: category.text }]}>
                      <Text style={styles.categoryInfoBadgeText}>{category.letter} - {category.title}</Text>
                    </View>
                    <Text style={styles.categoryInfoDescription}>{category.description}</Text>
                    {category.subCategoryAtStep6 ? (
                      <View style={styles.categoryInfoNoteRow}>
                        <Info size={14} color="#1D4ED8" />
                        <Text style={styles.categoryInfoNoteText}>Engineer selects the service sub-type at Step 5</Text>
                      </View>
                    ) : !subCategory && (
                      <Text style={styles.categoryInfoHint}>Select the service type below ↓</Text>
                    )}
                  </View>
                )}

                {/* Only once a category is actually picked — and only for
                    categories that need it now. Warranty Repair/Out Of
                    Warranty/AMC/CAMC don't ask for Sub-category here — the
                    engineer picks the specific sub-type later, at the SR
                    form's own Step 5 selection. */}
                {!!category && !category.subCategoryAtStep6 && (
                  <View style={[styles.formField, { marginTop: 16 }]}>
                    <Text style={styles.formLabel}>Sub-category</Text>
                    <SubCategoryPickerField
                      category={category}
                      value={subCategory}
                      onSelect={handleSelectSubCategory}
                      freeServiceItems={freeServiceItems}
                      freeServiceLoading={freeServiceLoading}
                      freeServiceError={freeServiceError}
                    />
                  </View>
                )}

                {/* Once a Free Service window is picked, show its own due
                    date + window range — the same reason/windowStart/
                    windowEnd the backend already computed, just surfaced
                    right under the field instead of making the user reopen
                    the dropdown. */}
                {!!selectedFreeServiceItem && (
                  <View style={[styles.freeServiceWindowCard, { marginTop: 12 }]}>
                    <View style={[styles.freeServiceDuePill, { backgroundColor: (FREE_SERVICE_STATUS_COLOR[selectedFreeServiceItem.status] || DEFAULT_FREE_SERVICE_STATUS_COLOR).bg }]}>
                      <Text style={[styles.freeServiceDuePillText, { color: (FREE_SERVICE_STATUS_COLOR[selectedFreeServiceItem.status] || DEFAULT_FREE_SERVICE_STATUS_COLOR).text }]}>
                        {selectedFreeServiceItem.reason}
                      </Text>
                    </View>
                    <Text style={styles.freeServiceWindowText}>
                      Window: {formatShortDate(selectedFreeServiceItem.windowStart)} – {formatShortDate(selectedFreeServiceItem.windowEnd, true)}
                    </Text>
                  </View>
                )}

                <View style={[styles.formField, { marginTop: 16 }]}>
                  <Text style={styles.formLabel}>Voice of Customer</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextarea]}
                    placeholder="Additional details..."
                    placeholderTextColor="#9CA3AF"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

        

                <View style={{ marginTop: 16 }}>
                  <DateField label="Due Date" value={dueDate} onChangeText={setDueDate} placeholder="dd/mm/yyyy" />
                </View>

                <View style={[styles.formField, { marginTop: 16 }]}>
                  <Text style={styles.formLabel}>Assign To</Text>
                  <TouchableOpacity style={styles.assignToField} onPress={openAssigneePicker}>
                    <UserRoundCog size={18} color="#9CA3AF" />
                    <Text style={[styles.assignToFieldText, !selectedAssignee && styles.assignToPlaceholder]} numberOfLines={1}>
                      {selectedAssignee ? selectedAssignee.name : 'Select assignee...'}
                    </Text>
                    <ChevronRight size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {!!createError && (
                  <View style={[styles.errorBox, { marginTop: 16 }]}>
                    <Text style={styles.errorText}>{createError}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.createButton, { marginTop: 20 }, (!selectedAssignee || !jobTitle.trim() || !category || (needsSubCategoryNow && !subCategory)) && styles.createButtonDisabled]}
                  onPress={handleCreateJob}
                  disabled={!selectedAssignee || !jobTitle.trim() || !category || (needsSubCategoryNow && !subCategory) || creating}
                >
                  <Text style={styles.createButtonText}>{creating ? 'Creating…' : 'Create Service Request'}</Text>
                </TouchableOpacity>
            </View>
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
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000000', textTransform: 'uppercase'},

  placeholderText: { color: '#9CA3AF', fontSize: 15, textAlign: 'center', marginTop: 40 },

  // Asset found but never commissioned — replaces the New Service Request
  // form entirely with this notice.
  commissioningRequiredBox: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#FEF9E7',
    borderWidth: 1, borderColor: '#F5D68C',
    borderRadius: 16,
    padding: 16,
  },
  commissioningRequiredTitle: { fontSize: 15, fontWeight: '700', color: '#C2410C', marginBottom: 4 },
  commissioningRequiredText: { fontSize: 13, fontWeight: '500', color: '#B45309', lineHeight: 19 },

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

  // Outer white card wrapping the compact identity pill + client contact —
  // no more full spec grid (Genset Model/Alternator Make/etc.), matching
  // the reference's leaner "just enough to confirm the asset" card.
  assetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // SAP fallback (no Asset exists yet for this genset) — same tokens as
  // newJob.tsx's own SAP card, kept consistent across both screens.
  sapCard: {
    backgroundColor: '#FDECE2',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#F5BC9D',
    padding: 16,
  },
  sapCardTitle: { fontSize: 15, fontWeight: '700', color: '#C2410C', marginBottom: 6 },
  sapCardLine: { fontSize: 13, fontWeight: '500', color: '#C2410C', marginTop: 2 },
  sapCreateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F26722',
    borderRadius: 100,
    paddingVertical: 15,
  },
  sapCreateButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // The New Service Request form's own white card — shown inline as soon
  // as the asset is found, no separate tap-through step.
  newSrFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  newSrFormTitle: {
    fontSize: 16, fontWeight: '800', color: '#111827',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },

  formField: { gap: 8 },
  formLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  // Marks Title/Category as required, matching the reference's red "*" next
  // to those two field labels — same red already used for errorText.
  requiredStar: { color: '#DC2626' },
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

  categoryTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  categoryTriggerDisabled: { opacity: 0.5 },
  categoryValueText: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  categoryPlaceholderText: { fontWeight: '400', color: '#9CA3AF' },
  categoryGroupLabel: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.4,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  categoryOptionRow: { paddingHorizontal: 20, paddingVertical: 14 },
  // Free Service rows only — a small status dot ahead of the label, colored
  // by that window's own due/grace/overdue/no_date state.
  freeServiceOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeServiceOptionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  categoryOptionRowSelected: { backgroundColor: '#FFF1E9' },
  categoryOptionText: { fontSize: 15, color: '#1F2937' },
  categoryOptionTextDisabled: { color: '#D1D5DB' },

  // The colored info card shown once a Category is picked — background/
  // border/badge colors come from that category's own bg/border/text
  // tokens (already used for its badge on the SR report screen).
  categoryInfoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  categoryInfoBadge: {
    alignSelf: 'flex-start',
    borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: 10,
  },
  categoryInfoBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  categoryInfoDescription: { fontSize: 14, color: '#374151', lineHeight: 20 },
  categoryInfoHint: { fontSize: 13, fontWeight: '700', color: '#EA580C', marginTop: 10 },
  categoryInfoNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  categoryInfoNoteText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8', flex: 1 },

  // The selected Free Service window's own due-date + range — shown right
  // under the Sub-category field once a window is picked.
  freeServiceWindowCard: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  freeServiceDuePill: {
    backgroundColor: '#DBEAFE',
    borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  freeServiceDuePillText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  freeServiceWindowText: { fontSize: 13, color: '#6B7280' },

  // Tappable, not the inline search+list — that now lives in its own
  // bottom-sheet Modal, matching newJob.tsx's precedent.
  assignToField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  assignToFieldText: { flex: 1, fontSize: 15, color: '#1F2937', fontWeight: '600' },
  assignToPlaceholder: { color: '#9CA3AF', fontWeight: '400' },

  // Embedded in the form card itself now — no separate Cancel button
  // (matching the reference, which relies on the header's own back arrow
  // to back out instead of a dedicated Cancel action).
  createButton: {
    borderRadius: 100,
    backgroundColor: '#F26722',
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
