// Shared formatting helpers for the commissioning and SR task report screens.

export const val = (v: any) => (v === undefined || v === null || v === '' ? '--' : String(v));

// "1.9 MB" / "850 KB" — used by DocumentsCard's list row next to each
// added PDF's upload status. Returns '' (renders nothing) when the picker
// result didn't include a fileSize — not every platform path returns one.
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The GCS URL's own filename (last path segment) — the only thing worth
// showing per row, since the rest of the URL is just bucket/folder noise.
export function videoFileName(url: string): string {
  const last = url.split('/').pop() || url;
  return last.split('?')[0];
}

// Commissioning's `photos` array mixes all three media types together (see
// the confirm-endpoint note in commisionAPi.ts's uploadCommissioningVideos —
// there's no dedicated videos/documents field, everything rides the one
// array) — split back out by extension so the report screen can render
// separate Photos/Videos/Documents sections, same as Service already does
// with its own (server-separated) photos/videos fields.
export function splitMediaByExtension(urls: string[]): { photos: string[]; videos: string[]; documents: string[] } {
  const photos: string[] = [];
  const videos: string[] = [];
  const documents: string[] = [];
  for (const url of urls) {
    const ext = url.toLowerCase().split('?')[0].split('.').pop() || '';
    if (ext === 'pdf') documents.push(url);
    else if (ext === 'mp4' || ext === 'mov' || ext === 'm4v' || ext === 'avi') videos.push(url);
    else photos.push(url);
  }
  return { photos, videos, documents };
}

// First letter of the first two words (e.g. "Hamid Patel" -> "HP", "Shree
// Engineering Works Kolhapur" -> "SE") — not first+last, which would give
// the wrong letters for a multi-word company name like that dealer example
// ("SK" instead of the intended "SE"). Just the one letter when there's
// only a single word to work with.
export function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

const SR_NUMBER_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// SR numbers are backend-generated as DDMMYY + an 8-digit zero-padded
// sequence (e.g. "05082600000101" -> 05/08/26, sequence 101) — shown as
// "05Aug26 · 101" instead of the raw 14-digit string. Falls back to the raw
// value if it doesn't parse as a valid date (defensive, not expected).
export function formatSrNumber(srNumber: string): string {
  const digits = srNumber.replace(/\D/g, '');
  if (digits.length < 6) return srNumber;
  const dd = parseInt(digits.slice(0, 2), 10);
  const mm = parseInt(digits.slice(2, 4), 10);
  const yy = digits.slice(4, 6);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return srNumber;
  const seq = digits.length > 6 ? String(parseInt(digits.slice(6), 10)) : '';
  return `${String(dd).padStart(2, '0')}${SR_NUMBER_MONTHS[mm - 1]}${yy}${seq ? ` · ${seq}` : ''}`;
}

// "area_manager" -> "Area Manager" — role strings come back snake_cased
// from the backend; this is the one place that turns them into a display
// label (used by the avatar-tap tooltip and the Profile screen's role pill).
export const formatRole = (role?: string) => (role ? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');

// Role pill colors — shared by the New Job/New Service Job "Assign To"
// candidate list (dealer/engineer only, never area_manager as a
// subordinate) and the Profile screen's own role pill (any role). Keyed by
// the exact snake_case string the backend sends (e.g. "area_manager"), not
// a normalized/camelCase version.
export const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  dealer: { label: 'Dealer', bg: '#FFE4D2', text: '#C2410C' },
  engineer: { label: 'Engineer', bg: '#DBEAFE', text: '#1D4ED8' },
  area_manager: { label: 'Area Manager', bg: '#F3F1FD', text: '#1E1951' },
};
export const DEFAULT_ROLE_BADGE = { label: 'Member', bg: '#F3F4F6', text: '#374151' };

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

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Reads the calendar date straight out of the string's own leading
// "YYYY-MM-DD" digits instead of ever constructing a `Date` from it — some
// backend fields (SAP import dates like billingDate/commissioningDate in
// particular) arrive as either a bare date ("2023-12-29") or a datetime
// with no "Z"/offset ("2023-12-29T00:00:00"). `Date` treats a string with
// no timezone designator as LOCAL time, not UTC — for anyone east of UTC
// (e.g. IST, UTC+5:30), local midnight on the 29th is still the 28th in
// UTC, and the old `timeZone: 'UTC'` formatting below then displayed that
// shifted instant, showing "28 Dec" for a date the backend meant as the
// 29th. Regex-extracting the digits sidesteps that parsing ambiguity
// entirely — still correct for a proper "...Z" UTC timestamp too, since its
// leading digits already are its UTC calendar date.
export const formatDate = (dateStr: string) => {
  if (!dateStr) return '--';
  try {
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d} ${SHORT_MONTHS[parseInt(m, 10) - 1]} ${y}`;
    }
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return '--';
  }
};

// Date + time together — "27 Jul 2026, 05:30". Ported from the reference
// design's fmtDateTime(); not yet wired into any screen, available for
// wherever a full timestamp (not just a relative label) is needed.
export function formatDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Ported verbatim from the reference design's own timeAgo() (the source of
// truth for every "X ago" label in the reference app) — do not re-derive
// this from scratch again; match this exact algorithm if it ever needs to
// change. Note minutes stay singular ("5 min ago", never "mins") while
// hours/days pluralize normally, and "Yesterday, HH:MM" only applies to the
// literal previous calendar date, not just "24-48 hours ago".
export function formatTimeAgoLabel(d?: string | Date | null): string {
  if (!d) return '—';
  const date = new Date(d);
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (secs < 60) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;

  if (days < 7) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return `Yesterday, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export type RelativeAge = { label: string; bg: string; pillText: string; text: string };

// Countdown/count-up pill for a deadline-style timestamp — "3h 20m left"
// (future, still amber/green) vs "2d 4h" (past, green/orange/red the
// longer it's been overdue). Ported from the reference design's
// relativeAge() (Tailwind bg-*/text-* pairs there, translated 1:1 to the
// hex tokens this app already uses elsewhere for the same shades — e.g.
// green-100/green-700 match TASK_TYPE_BADGE.COMMISSIONING). `bg`+`pillText`
// are for a colored pill; `text` is the same color family for bare text
// with no pill background. Not yet wired into any screen.
export function getRelativeAge(date?: string | Date | null): RelativeAge {
  if (!date) return { label: '—', bg: '#F3F4F6', pillText: '#9CA3AF', text: '#9CA3AF' };
  const ms = Date.now() - new Date(date).getTime();
  const isPast = ms >= 0;
  const absMins = Math.floor(Math.abs(ms) / 60_000);
  const absHrs = Math.floor(absMins / 60);
  const absDays = Math.floor(absHrs / 24);

  const compact = absDays > 0
    ? `${absDays}d ${absHrs % 24 > 0 ? `${absHrs % 24}h` : ''}`.trim()
    : absHrs > 0
      ? `${absHrs}h ${absMins % 60 > 0 ? `${absMins % 60}m` : ''}`.trim()
      : `${absMins || 1}m`;

  if (!isPast) {
    const label = `${compact} left`;
    if (absHrs < 24) return { label, bg: '#FEF9C3', pillText: '#A16207', text: '#CA8A04' };
    return { label, bg: '#DCFCE7', pillText: '#15803D', text: '#16A34A' };
  }

  const label = compact;
  if (absHrs < 4) return { label, bg: '#DCFCE7', pillText: '#15803D', text: '#16A34A' };
  if (absHrs < 24) return { label, bg: '#FDE9DF', pillText: '#E76124', text: '#E76124' };
  return { label, bg: '#FEE2E2', pillText: '#DC2626', text: '#DC2626' };
}

// Color-coded pill styling for a commissioning/SR task's type — shared by the
// task-card badge and the commissioning records screen's activity badges.
export const TASK_TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  PRE_COMMISSIONING: { label: 'Pre-Comm', bg: '#DBEAFE', text: '#1D4ED8' },
  COMMISSIONING: { label: 'Commissioning', bg: '#DCFCE7', text: '#15803D' },
  REVALIDATION: { label: 'Revalidation', bg: '#FFEDD5', text: '#C2410C' },
  RE_COMMISSIONING: { label: 'Re-Commissioning', bg: '#F3E8FF', text: '#7E22CE' },
};
export const DEFAULT_TASK_TYPE_BADGE = { label: '--', bg: '#F3F4F6', text: '#374151' };

// Commissioning tasks carry a `type` enum (PRE_COMMISSIONING, REVALIDATION,
// ...); service tasks don't — they use category/subCategory instead. Falls
// back to that, then a plain label, rather than showing "undefined".
export function taskTypeLabel(task: any): string {
  if (task.type) return formatTaskType(task.type);
  if (task.category) return task.category;
  return 'Service';
}

// The real assignment chain: who created the task, whoever it passed
// through on the way (reassignments[i].fromUser — e.g. the dealer, when an
// areaManager assigns to a dealer who then reassigns to their engineer),
// and who has it now — deduped by userId. A direct dealer->engineer
// assignment has no reassignments, so this naturally resolves to 2 people
// instead of 3 — never a fixed/fabricated count.
export function getTaskPeople(task: any): any[] {
  const chain = [
    task.createdBy,
    ...(task.reassignments || []).map((r: any) => r.fromUser),
    task.assignedTo,
  ].filter((p) => p?.userId);
  const seenUserIds = new Set<string>();
  return chain.filter((p) => {
    if (seenUserIds.has(p.userId)) return false;
    seenUserIds.add(p.userId);
    return true;
  });
}

// ─── Activity History (View Report screens) ───
// Rounds to the largest meaningful unit only (no "7hr 11min 20s" — matches
// the reference design's plain "7hr 11min"/"15s"/"2min" labels).
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms)) return '--';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}${hours === 1 ? 'hr' : 'hrs'} ${minutes}${minutes === 1 ? 'min' : 'mins'}`;
  if (minutes > 0) return `${minutes}${minutes === 1 ? 'min' : 'mins'}`;
  return `${seconds}${seconds === 1 ? 'sec' : 'secs'}`;
}

export type ActivityStage = { key: string; label: string; durationMs: number | null };

// The task's own flat fields (startedAt in particular) don't always carry
// every checkpoint — but the backend separately logs each lifecycle
// transition into `actionLog` (event: 'Created'/'Assigned'/'Accepted'/
// 'Started'/'Completed'/'OtpVerified'). Confirmed against a real task
// whose `startedAt` was absent yet still had a "Started" actionLog entry —
// so this is a fallback lookup, not a guess.
function actionLogTime(task: any, eventName: string): string | undefined {
  const entry = (task.actionLog || []).find((e: any) => e?.event === eventName);
  return entry?.at;
}

// Each stage's duration is how long the task actually sat in that status
// before moving to the next one — derived straight from the task's own
// lifecycle timestamps (assignedAt/acceptedAt/startedAt/completedAt/
// completionOtp.verifiedAt, falling back to actionLog when a flat field is
// missing), not a separate history endpoint. Always all 5 fixed stages, in
// the same fixed order/styling — a stage with either endpoint missing from
// BOTH sources reports null (shown as "--"), rather than being merged into
// its neighbor.
export function getActivityStages(task: any): ActivityStage[] {
  const points: { key: string; label: string; at?: string }[] = [
    { key: 'created', label: 'Created', at: task.createdAt || actionLogTime(task, 'Created') },
    { key: 'assigned', label: 'Assigned', at: task.assignedAt || actionLogTime(task, 'Assigned') },
    { key: 'accepted', label: 'Accepted', at: task.acceptedAt || actionLogTime(task, 'Accepted') },
    { key: 'inProgress', label: 'Started', at: task.startedAt || actionLogTime(task, 'Started') },
    { key: 'completed', label: 'Completed', at: task.completedAt || actionLogTime(task, 'Completed') },
    { key: 'verified', label: 'Verified', at: task.completionOtp?.verifiedAt || actionLogTime(task, 'OtpVerified') },
  ];
  const stages: ActivityStage[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i].at ? new Date(points[i].at as string).getTime() : null;
    const to = points[i + 1].at ? new Date(points[i + 1].at as string).getTime() : null;
    stages.push({
      key: points[i].key,
      // "Accepted → Started" etc — what each duration actually measures.
      label: `${points[i].label} → ${points[i + 1].label}`,
      durationMs: from !== null && to !== null ? Math.max(0, to - from) : null,
    });
  }
  return stages;
}

// Resolution: total time from assignment to completion. Response: time to
// accept after being assigned. Completion: actual work duration once
// started (IN_PROGRESS -> COMPLETED) — the three headline stats above the
// stage timeline.
export function getActivitySummary(task: any) {
  const toMs = (d?: string) => (d ? new Date(d).getTime() : null);
  const assignedAt = toMs(task.assignedAt || actionLogTime(task, 'Assigned'));
  const acceptedAt = toMs(task.acceptedAt || actionLogTime(task, 'Accepted'));
  const startedAt = toMs(task.startedAt || actionLogTime(task, 'Started'));
  const completedAt = toMs(task.completedAt || actionLogTime(task, 'Completed'));
  const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? Math.max(0, b - a) : null);
  return {
    resolutionMs: diff(assignedAt, completedAt),
    responseMs: diff(assignedAt, acceptedAt),
    completionMs: diff(startedAt, completedAt),
  };
}

export const formatAddress = (address: any) => {
  if (!address) return '--';
  const parts = [address.line1, address.line2, address.locality, address.city, address.taluk, address.district, address.state, address.pinCode, address.country]
    .filter(Boolean);
  return parts.length ? parts.join(', ') : '--';
};

export const getPriorityColor = (priority: string) => {
  const colors: Record<string, { backgroundColor: string }> = {
    P1: { backgroundColor: '#FEE2E2' },
    P2: { backgroundColor: '#FFEDD5' },
    P3: { backgroundColor: '#DBEAFE' },
    P4: { backgroundColor: '#F3F4F6' },
  };
  return colors[priority] || colors['P4'];
};

export const getPriorityTextColor = (priority: string) => {
  const colors: Record<string, string> = {
    P1: '#DC2626',
    P2: '#C2410C',
    P3: '#1D4ED8',
    P4: '#6B7280',
  };
  return colors[priority] || colors['P4'];
};

// ─── GET /me/team (area manager's Commissioning/Service tabs) ───
// This endpoint has no ?status= param and no pagination — it always
// returns the AM's entire reporting tree (their own tasks, every dealer's
// own tasks, every engineer's tasks under each dealer), so the Active/
// Completed/Closed tabs bucket and paginate this client-side instead of
// asking the server for a specific page/status like GET /me/tasks does.
export type TaskStatusBucket = 'active' | 'completed' | 'closed';

// Commissioning: OPEN/ASSIGNED/ACCEPTED/IN_PROGRESS all read as "Active" —
// COMPLETED and APPROVED both read as "Completed" (matches GET /me/tasks's
// own counts for commissioning).
//
// Service is genuinely different, per the backend dev guide's own status
// table: COMPLETED means work is done but the customer hasn't given OTP
// sign-off yet, so it still reads as "Active" — only CLIENT_APPROVED (OTP
// verified) is "Completed". Treating service COMPLETED as done here was
// the same bug as calling /service/:id/complete too early — both conflate
// "work finished" with "customer signed off."
export function bucketTaskStatus(status: string, kind: 'commissioning' | 'service' = 'commissioning'): TaskStatusBucket {
  if (status === 'CLOSED') return 'closed';
  if (kind === 'service') {
    return status === 'CLIENT_APPROVED' ? 'completed' : 'active';
  }
  if (status === 'COMPLETED' || status === 'APPROVED') return 'completed';
  return 'active';
}

// Flattens myTasks + every dealer's ownTasks + every engineer's tasks for
// one entry kind ('commissioning' or 'service') into a single array — the
// AM's full team, task list, not paginated or status-filtered yet.
export function flattenTeamTasks(teamData: any, kind: 'commissioning' | 'service'): any[] {
  if (!teamData) return [];
  const all: any[] = [...(teamData.myTasks?.[kind] || [])];
  for (const dealerEntry of teamData.team || []) {
    all.push(...(dealerEntry.ownTasks?.[kind] || []));
    for (const engineerEntry of dealerEntry.engineers || []) {
      all.push(...(engineerEntry.tasks?.[kind] || []));
    }
  }
  return all;
}

// ─── SR Approvals status pill (Dashboard card + the full SR Approvals list) ───
// A service entry can be pending on two independent gates — partApproval
// (AM reviews individual parts) and workApproval (AM then RSM sign off,
// only for categories that require it). A task can have BOTH pending at
// once (e.g. a Goodwill/D/E entry that also used parts), so this resolves
// every gate that's actually present into its own pill — prefixed by which
// gate it is ("Parts ·"/"Work ·") — rather than just the first one found.
export type ApprovalStatusPill = { label: string; bg: string; text: string };

const PENDING_PILL = { bg: '#FEF3C7', text: '#B45309' };
const REVIEWED_PILL = { bg: '#DCFCE7', text: '#15803D' };
const REJECTED_PILL = { bg: '#FEE2E2', text: '#DC2626' };

export function resolveApprovalStatusPills(entry: any): ApprovalStatusPill[] {
  const pills: ApprovalStatusPill[] = [];

  const partStatus = entry?.partApproval?.status;
  if (partStatus === 'PENDING') pills.push({ label: 'Parts · Pending AM', ...PENDING_PILL });
  else if (partStatus === 'REVIEWED') pills.push({ label: 'Parts · Reviewed', ...REVIEWED_PILL });

  const workStatus = entry?.workApproval?.status;
  if (workStatus === 'PENDING_AM') pills.push({ label: 'Work · Pending AM', ...PENDING_PILL });
  else if (workStatus === 'PENDING_RSM') pills.push({ label: 'Work · Pending RSM', ...PENDING_PILL });
  else if (workStatus === 'CONFIRMED' || workStatus === 'APPROVED') pills.push({ label: 'Work · Approved', ...REVIEWED_PILL });
  else if (workStatus === 'REJECTED') pills.push({ label: 'Work · Rejected', ...REJECTED_PILL });

  return pills;
}

// "Still needs a decision" vs "already decided" — the binary the SR
// Approvals screen's Pending/Approved tabs bucket by.
//
// REJECTED counts as pending too, per the backend dev guide's own
// approvalList inclusion rule (workApproval.status in [PENDING_AM,
// PENDING_RSM, REJECTED]) — a rejected request isn't "approved", it's
// waiting on the engineer to revise and resubmit. Without this, a
// rejected entry landed in the "Approved" tab while still showing a red
// "Rejected" pill on itself — approved-tab card, rejected-looking pill.
export function isApprovalPending(entry: any): boolean {
  const partStatus = entry?.partApproval?.status;
  if (partStatus === 'PENDING') return true;
  const workStatus = entry?.workApproval?.status;
  return workStatus === 'PENDING_AM' || workStatus === 'PENDING_RSM' || workStatus === 'REJECTED';
}
