import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getToken } from '../utils/tokenStore';
import { safeJsonParse } from '../utils/safeJsonParse';
import { GensetSapAsset } from '../models/commissioningRecords.types';
import { getLocationMaster, createAsset } from '../viewModel/commisionAPi';
import { parseApiError } from '../utils/apiError';

function formatDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  // Reads the calendar date straight out of the string's own leading
  // "YYYY-MM-DD" digits instead of constructing a `Date` from it — SAP
  // fields like this arrive as either a bare date or a datetime with no
  // "Z"/offset, which `Date` treats as LOCAL time, not UTC. Reading
  // .getUTCMonth()/.getUTCDate() off a Date built from a no-offset string
  // rolled the calendar date back by a day for anyone east of UTC (e.g.
  // IST) — a "29 Dec" SAP date showing as 28/12 here. Same fix and
  // reasoning as reportFormatters' own formatDate.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function todayDDMMYYYY(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// dd/mm/yyyy -> ISO date (yyyy-mm-dd) for the request body. Returns null for
// an incomplete/invalid string rather than sending garbage.
function parseDDMMYYYYToISODate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const ENTRY_TYPES = [
  { value: 'PRE_COMMISSIONING', label: 'Pre-Commissioning' },
  { value: 'COMMISSIONING', label: 'Commissioning' },
  { value: 'REVALIDATION', label: 'Revalidation' },
  { value: 'RE_COMMISSIONING', label: 'Re-Commissioning' },
];

export type DispatchType = 'no_date' | 'auto' | 'window' | 'revalidation';

// Server-documented dispatch-date rule (see the API reference's "Dispatch
// date -> commissioning entry logic" table): billingDate before 1 Jul 2024
// always wins as "auto" regardless of how long ago that is, before the
// 6-month window check is even considered.
const AUTO_CUTOFF = new Date('2024-07-01T00:00:00.000Z');

export function computeDispatchType(billingDate?: string): DispatchType {
  if (!billingDate) return 'no_date';
  const billing = new Date(billingDate);
  if (isNaN(billing.getTime())) return 'no_date';
  if (billing < AUTO_CUTOFF) return 'auto';
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return billing >= sixMonthsAgo ? 'window' : 'revalidation';
}

// Drives the "Create Asset" screen — reached from New Job's SAP-fallback
// card when a genset has SAP dispatch/commissioning history but no Asset
// record has been created for it in this app yet. The whole form is
// pre-filled from that SAP record but every field stays editable, since SAP
// data is a starting point, not a guaranteed-correct source.
export function useCreateAssetCommissionController() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sapAsset?: string }>();
  const sapAsset = useMemo(() => safeJsonParse<GensetSapAsset>(params.sapAsset), [params.sapAsset]);

  const dispatchType = useMemo(() => computeDispatchType(sapAsset?.billingDate), [sapAsset?.billingDate]);

  const [gensetSn, setGensetSn] = useState(sapAsset?.gensetSerialNo || '');
  const [engineSn, setEngineSn] = useState(sapAsset?.engineSerialNo || '');

  const [clientName, setClientName] = useState(sapAsset?.shipToPartyName || '');
  const [clientCode, setClientCode] = useState(sapAsset?.shipToParty || '');
  const [clientEmail, setClientEmail] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactNumber, setPrimaryContactNumber] = useState('');
  const [alternateContactName, setAlternateContactName] = useState('');
  const [alternateContactNumber, setAlternateContactNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState(formatDDMMYYYY(sapAsset?.billingDate));

  const [addressLine1, setAddressLine1] = useState(sapAsset?.endCustomerDetails || '');
  const [addressLine2, setAddressLine2] = useState('');
  const [pinCode, setPinCode] = useState(sapAsset?.pin || '');
  const [city, setCity] = useState(sapAsset?.cityTQ || '');
  const [district, setDistrict] = useState(sapAsset?.district || '');
  const [state, setState] = useState(sapAsset?.state || '');
  // Auto-filled by the PIN lookup below — Taluk and Locality/Area/Village
  // are their own fields on the screen too, not just sent-through-as-is.
  const [locality, setLocality] = useState('');
  const [taluk, setTaluk] = useState('');

  // Auto-fires once the PIN Code field reaches 6 digits, same trigger the
  // reference design specifies. Guarded against re-firing for the same PIN
  // (e.g. re-renders, or the user backspacing one digit and retyping it).
  const lastLookedUpPin = useRef<string>('');
  useEffect(() => {
    const digits = pinCode.trim();
    if (digits.length !== 6 || !/^\d{6}$/.test(digits) || digits === lastLookedUpPin.current) return;
    lastLookedUpPin.current = digits;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await getLocationMaster(token, digits);
        // /location-master?search= returns a filtered list per the backend
        // dev guide, not a single record — unwrap the first match. Handles
        // a bare-object response too (list.entries, or the object itself)
        // in case the real shape differs from what's documented.
        const list = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : Array.isArray(data?.results) ? data.results : null;
        const result = list ? list[0] : data;
        if (!result) return;
        if (result.district) setDistrict(result.district);
        if (result.state) setState(result.state);
        if (result.post_office) setLocality(result.post_office);
        if (result.taluka) setTaluk(result.taluka);
      } catch (error) {
        console.log('[Create Asset] PIN lookup failed:', error);
      }
    })();
  }, [pinCode]);

  const [entryType, setEntryType] = useState('COMMISSIONING');
  const [entryDate, setEntryDate] = useState(formatDDMMYYYY(sapAsset?.commissioningDate) || todayDDMMYYYY());
  const [notes, setNotes] = useState('');

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCancel = () => router.back();

  // Every field is required except Alternate Contact Name/No. and Address
  // Line 1/2 (per explicit instruction — those four stay optional).
  const validateRequiredFields = useCallback((): string | null => {
    const missing: string[] = [];
    if (!gensetSn.trim()) missing.push('Genset S/N');
    if (!engineSn.trim()) missing.push('Engine S/N');
    if (!clientName.trim()) missing.push('Client Name');
    if (!clientCode.trim()) missing.push('Client Code');
    if (!clientEmail.trim()) missing.push('Client Email');
    if (!primaryContactName.trim()) missing.push('Primary Contact Name');
    if (!primaryContactNumber.trim()) missing.push('Primary Contact No.');
    if (!dispatchDate.trim()) missing.push('Dispatch Date');
    if (!pinCode.trim()) missing.push('PIN Code');
    if (!state.trim()) missing.push('State');
    if (!district.trim()) missing.push('District');
    if (!taluk.trim()) missing.push('Taluk');
    if (!city.trim()) missing.push('City');
    if (!locality.trim()) missing.push('Locality / Area / Village');
    if (missing.length === 0) return null;
    return `Please fill in: ${missing.join(', ')}.`;
  }, [
    gensetSn, engineSn, clientName, clientCode, clientEmail,
    primaryContactName, primaryContactNumber, dispatchDate,
    pinCode, state, district, taluk, city, locality,
  ]);

  const handleConfirmCreate = useCallback(async () => {
    const validationError = validateRequiredFields();
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const token = await getToken();
      if (!token) return;

      const dispatchDateIso = parseDDMMYYYYToISODate(dispatchDate);
      const body: Record<string, any> = {
        gensetNumber: gensetSn.trim(),
        engineNumber: engineSn.trim(),
        clientName: clientName.trim(),
        clientCode: clientCode.trim(),
        clientEmail: clientEmail.trim(),
        primaryContactName: primaryContactName.trim(),
        primaryContactNumber: primaryContactNumber.trim(),
        alternateContactName: alternateContactName.trim(),
        alternateContactNumber: alternateContactNumber.trim(),
        ...(dispatchDateIso ? { dispatchDate: dispatchDateIso } : {}),
        address: {
          line1: addressLine1.trim(),
          line2: addressLine2.trim(),
          locality,
          taluk,
          district,
          city,
          state,
          pinCode,
          country: 'India',
        },
      };

      // Only "auto" sends the SAP commissioning fields — revalidation has
      // no real SAP commissioning data to submit (the screen doesn't even
      // show this section for it, see createAssetCommission.tsx), and
      // "window" asset creation carries no commissioning entry at all
      // either way. Both proceed through the normal New Job flow
      // afterward to create their real entry.
      if (dispatchType === 'auto' && sapAsset?.commissioningDate) {
        const entryDateIso = parseDDMMYYYYToISODate(entryDate);
        body.sapCommissioningDate = sapAsset.commissioningDate;
        body.commissioningType = entryType;
        if (entryDateIso) body.commissioningEntryDate = entryDateIso;
        if (notes.trim()) body.commissioningNotes = notes.trim();
      }

      const created = await createAsset(token, body);
      // Back to New Job with the just-created asset's own S/N pre-filled,
      // not the Commissioning list — New Job re-searches it immediately and
      // lands on the normal "asset found, here are its Actions" view, so
      // the user picks Pre-Commissioning/Commissioning/Re-Commissioning
      // right away instead of hunting for the new asset from a task list
      // that doesn't even show un-assigned assets.
      router.replace({
        pathname: '/screens/newJob' as any,
        params: { initialSearch: created?.gensetNumber || gensetSn.trim() },
      });
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to create asset. Please try again.');
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, [
    validateRequiredFields,
    gensetSn, engineSn, clientName, clientCode, clientEmail,
    primaryContactName, primaryContactNumber, alternateContactName, alternateContactNumber, dispatchDate,
    addressLine1, addressLine2, locality, taluk, district, city, state, pinCode,
    dispatchType, sapAsset, entryType, entryDate, notes, router,
  ]);

  return {
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
  };
}
