// Presentation-only formatting helpers for the commissioning tasks / SR job cards screen.

export const formatSrDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatSrDateTime = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
};

// Returns a relative-time label like "(5h)", "(86d)", or "(-891m)" (negative = still in the future)
export const getSrRelativeLabel = (dateStr?: string): { label: string; isFuture: boolean } => {
  if (!dateStr) return { label: '', isFuture: false };
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMs = now - target; // positive = in the past, negative = in the future
  const isFuture = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const minutes = Math.floor(absMs / 60000);
  const hours = Math.floor(absMs / 3600000);
  const days = Math.floor(absMs / 86400000);

  let value: number;
  let unit: string;
  if (days >= 1) { value = days; unit = 'd'; }
  else if (hours >= 1) { value = hours; unit = 'h'; }
  else { value = minutes; unit = 'm'; }

  return { label: `(${isFuture ? '-' : ''}${value}${unit})`, isFuture };
};

export const formatTaskType = (type: string) => {
  if (!type) return '';
  const map: Record<string, string> = {
    RE_COMMISSIONING: 'Re-Commissioning',
    REVALIDATION: 'Revalidation',
    COMMISSIONING: 'Commissioning',
    PRE_COMM: 'Pre-Comm',
  };
  return map[type] || type.replace(/_/g, ' ');
};

export const formatAddress = (address: any) => {
  if (!address) return '—';
  const parts = [address.line1, address.city, address.district, address.state, address.pinCode]
    .filter(Boolean);
  return parts.join(', ');
};
