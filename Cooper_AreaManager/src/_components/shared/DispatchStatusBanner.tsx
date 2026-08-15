import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { formatDate } from '../../utils/reportFormatters';
import { DispatchType } from '../../controllers/createAssetCommissionController';

type Props = {
  dispatchType: DispatchType;
  billingDate?: string | null;
  // 'auto' only — the SAP record's own commissioning date, named in the
  // banner's own body text ("SAP commissioning date (05 Jun 2024) will be
  // used...") when present, since that's the actual date the backend will
  // use for the auto-created entry, not just "before July 2024" in the
  // abstract. Ignored when `compact` is set (see below).
  commissioningDate?: string | null;
  // Create Asset's own reference design wants a single merged sentence with
  // the dispatch date inlined ("Dispatch date (29 Dec 2023) is before July
  // 2024 — ... when this asset is registered.") instead of a separate
  // "Dispatch Date: ..." line above a generic body — that screen already
  // has Dispatch Date as its own editable field elsewhere on the form, so
  // repeating it as a standalone line here read as redundant. New Job/New
  // Service Job's SAP-found card keeps the original two-part layout
  // (default, compact omitted/false).
  compact?: boolean;
};

// Per-state copy/color for computeDispatchType()'s 4 outcomes — all 4 are
// real, reachable states (not just "auto"), so every one gets its own
// callout instead of only the happy path being visible to the user.
const CONFIG: Record<DispatchType, { bg: string; border: string; dot: string; title: string; note: string; heading: string; body: string }> = {
  auto: {
    bg: '#E7F7EC', border: '#A7E3BC', dot: '#16A34A', title: '#166534', note: '#16A34A',
    heading: 'Auto-Commissioned',
    body: 'Dispatch date before July 2024 — a completed commissioning entry will be created automatically.',
  },
  window: {
    bg: '#EFF6FF', border: '#BFDBFE', dot: '#2563EB', title: '#1D4ED8', note: '#2563EB',
    heading: 'Commissioning Window Open',
    body: 'Dispatch date is within the last 6 months — a Commissioning entry can be created now.',
  },
  revalidation: {
    bg: '#FFFBEB', border: '#FDE68A', dot: '#D97706', title: '#92400E', note: '#B45309',
    heading: 'Revalidation Required',
    body: 'Dispatch date is more than 6 months ago — revalidation will be needed before services can be raised.',
  },
  no_date: {
    bg: '#F9FAFB', border: '#E5E7EB', dot: '#9CA3AF', title: '#4B5563', note: '#6B7280',
    heading: 'No Dispatch Date',
    body: 'No SAP dispatch date found for this asset — dates must be entered manually.',
  },
};

// Compact mode's per-state body — the dispatch date inlined into the
// sentence itself rather than a separate line above it. Only 'auto' is
// confirmed against the actual reference design; window/revalidation follow
// the same "Dispatch date (...) is ..." shape as their existing (non-
// compact) bodies below, just with the date folded in the same way.
function compactBody(dispatchType: DispatchType, billingDate?: string | null): string {
  const datePrefix = billingDate ? `(${formatDate(billingDate)}) ` : '';
  switch (dispatchType) {
    case 'auto':
      return `Dispatch date ${datePrefix}is before July 2024 — a completed commissioning entry will be created automatically when this asset is registered.`;
    case 'window':
      return `Dispatch date ${datePrefix}is within the last 6 months — a Commissioning entry can be created now.`;
    case 'revalidation':
      return `Dispatch date ${datePrefix}is more than 6 months ago — revalidation will be needed before services can be raised.`;
    case 'no_date':
      return CONFIG.no_date.body;
  }
}

// SAP dispatch-status callout shown wherever a genset's SAP record is in
// view (New Job's/New Service Job's SAP-fallback card, Create Asset's
// commissioning-entry section) — reused so all 3 spots stay in sync rather
// than each hand-rolling its own "auto"-only box.
export function DispatchStatusBanner({ dispatchType, billingDate, commissioningDate, compact }: Props) {
  const cfg = CONFIG[dispatchType];
  const body = compact
    ? compactBody(dispatchType, billingDate)
    : dispatchType === 'auto' && commissioningDate
      ? `SAP commissioning date (${formatDate(commissioningDate)}) will be used — a completed commissioning entry will be created automatically.`
      : cfg.body;
  return (
    <View style={[styles.box, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={styles.titleRow}>
        <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
        <Text style={[styles.title, { color: cfg.title }]}>{cfg.heading}</Text>
      </View>
      {!compact && !!billingDate && <Text style={styles.date}>Dispatch Date: {formatDate(billingDate)}</Text>}
      <Text style={[styles.note, { color: cfg.note }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 4 },
  note: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
