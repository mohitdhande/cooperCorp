// Centralized status/value -> color mappings, used by the task list and report screens.

type StatusStyle = { label: string; bg: string; text: string };

export const getSrStatusStyle = (status: string): StatusStyle => {
  const map: Record<string, StatusStyle> = {
    ASSIGNED: { label: 'Assigned', bg: '#FFEDD5', text: '#C2410C' },
    ACCEPTED: { label: 'Accepted', bg: '#FFEDD5', text: '#C2410C' },
    IN_PROGRESS: { label: 'In Progress', bg: '#EDE9FE', text: '#7C3AED' },
    COMPLETED: { label: 'Completed', bg: '#DCFCE7', text: '#15803D' },
    CLOSED: { label: 'Closed', bg: '#E5E7EB', text: '#6B7280' },
  };
  return map[status] || { label: status || '—', bg: '#F3F4F6', text: '#6B7280' };
};

export const getWorkApprovalStyle = (status: string): StatusStyle => {
  const map: Record<string, StatusStyle> = {
    PENDING_AM: { label: '🕐 Awaiting AM Review', bg: '#FFEDD5', text: '#C2410C' },
    PENDING_RSM: { label: '🕐 Awaiting RSM Confirmation', bg: '#DBEAFE', text: '#1D4ED8' },
    CONFIRMED: { label: '✓ Approved', bg: '#DCFCE7', text: '#15803D' },
    REJECTED: { label: '✕ Rejected', bg: '#FEE2E2', text: '#DC2626' },
  };
  return map[status] || { label: status || '—', bg: '#F3F4F6', text: '#6B7280' };
};

// Color for a check-item value pill (OK / Not OK / anything else) shown in report screens.
export const getCheckValueStyle = (value: string): { bg: string; text: string } => {
  const v = (value || '').trim().toLowerCase();
  if (v === 'ok') return { bg: '#D1FAE5', text: '#059669' };
  if (v === 'not ok') return { bg: '#FEE2E2', text: '#DC2626' };
  return { bg: '#F3F4F6', text: '#4B5563' };
};

export const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    P1: '#FEE2E2', // Red
    P2: '#FFEDD5', // Orange
    P3: '#DBEAFE', // Blue
    P4: '#F3F4F6', // Gray
  };
  return colors[priority] || colors.P4;
};

export const getPriorityTextColor = (priority: string): string => {
  const colors: Record<string, string> = {
    P1: '#DC2626',
    P2: '#C2410C',
    P3: '#1D4ED8',
    P4: '#6B7280',
  };
  return colors[priority] || colors.P4;
};
