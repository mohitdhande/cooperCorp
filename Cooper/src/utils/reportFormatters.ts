// Shared formatting helpers for the commissioning/SR report screens.
// Extracted from taskReport.tsx and srTaskReport.tsx, where they were byte-identical.

export const formatAddress = (address: any) => {
  if (!address) return '--';
  const parts = [
    address.line1, address.line2, address.locality, address.city,
    address.taluk, address.district, address.state, address.pinCode, address.country,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : '--';
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '--';
  }
};

export const val = (v: any) => (v === undefined || v === null || v === '' ? '--' : String(v));
